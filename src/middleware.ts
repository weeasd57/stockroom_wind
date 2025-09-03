import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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

export function middleware(req: NextRequest) {
  const nonce = generateNonce()
  const isDev = process.env.NODE_ENV !== 'production'

  // Pass nonce to the rest of the app via request headers
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)

  const paypal = "https://www.paypal.com https://*.paypal.com https://*.paypalobjects.com"

  const directives = [
    "default-src 'self' https: data: blob:",
    `script-src 'self' 'nonce-${nonce}' ${paypal}${isDev ? " 'unsafe-eval' blob:" : ''}`,
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline' ${paypal}`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    `connect-src 'self' https:${isDev ? ' ws:' : ''} ${paypal}`,
    `frame-src 'self' ${paypal}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
  ]

  const csp = directives.join('; ')

  const res = NextResponse.next({ request: { headers: requestHeaders } })
  res.headers.set('Content-Security-Policy', csp)

  return res
}

export const config = {
  matcher: '/:path*',
}
