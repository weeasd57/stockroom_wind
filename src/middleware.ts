import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  // Try to base64-encode (Edge runtime may not expose btoa in all environments)
  try {
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    const maybeBtoa = (globalThis as any).btoa as ((s: string) => string) | undefined
    if (typeof maybeBtoa === 'function') {
      return maybeBtoa(binary)
    }
  } catch (_) {}
  // Fallback to hex string (still high entropy, widely accepted by user agents)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function middleware(req: NextRequest) {
  const nonce = generateNonce()
  const isDev = process.env.NODE_ENV !== 'production'

  // Pass nonce to the rest of the app via request headers
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)

  const paypal = "https://www.paypal.com https://*.paypal.com https://*.paypalobjects.com"
  const googleFonts = "https://fonts.googleapis.com https://fonts.gstatic.com"

  // For maximum compatibility with third-party SDKs that inject inline scripts (PayPal,
  // some toasters, etc.) we avoid requiring a script nonce in the CSP header. We still
  // expose a per-request `x-nonce` header so server-rendered inline scripts that you control
  // can include a matching nonce attribute if desired, but we do not require it here so that
  // SDK-injected inline code is not blocked by the browser.
  const scriptSrc = `script-src 'self' ${paypal} 'unsafe-inline' 'unsafe-eval' blob:`;

  const directives = [
    "default-src 'self' https: data: blob:",
    scriptSrc,
    // Keep style-src permissive to allow runtime-inserted styles from libraries (e.g., sonner, PayPal SDK).
    // We intentionally do NOT include a style nonce here because many third-party libs insert
    // <style> tags without a nonce at runtime which would otherwise be blocked when a nonce
    // is present in the directive. This is a pragmatic tradeoff for development convenience.
    `style-src 'self' 'unsafe-inline' ${paypal} ${googleFonts}`,
    "img-src 'self' data: blob: https:",
    `font-src 'self' data: https: ${googleFonts}`,
    `connect-src 'self' https: wss:${isDev ? ' ws:' : ''} ${paypal}`,
    `frame-src 'self' ${paypal}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
  ]

  const csp = directives.join('; ')

  const res = NextResponse.next({ request: { headers: requestHeaders } })

  // Ensure Supabase auth session cookies are kept in sync for server routes
  try {
    const supabase = createMiddlewareClient({ req, res })
    // This call refreshes session cookies when needed so API routes can read them
    await supabase.auth.getSession()
  } catch (e) {
    // Silent fail: do not block request if auth helper is unavailable
  }
  res.headers.set('Content-Security-Policy', csp)

  return res
}

export const config = {
  matcher: '/:path*',
}
