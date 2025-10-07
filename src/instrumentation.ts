import { NextFetchEvent, NextRequest } from 'next/server';

// Global server/edge fetch logging
// This file is picked up automatically by Next.js App Router at the project root (src/instrumentation.{ts,js})
// and executed during the server runtime bootstrap.

let installed = false;

function sanitizeUrlForLog(raw: string): string {
  try {
    const u = new URL(raw);
    const SENSITIVE = /token|api[_-]?key|key|secret|password|pass|authorization|auth|bearer/i;
    u.searchParams.forEach((value, key) => {
      if (SENSITIVE.test(key)) {
        u.searchParams.set(key, '***');
      }
    });
    return u.toString();
  } catch {
    // If not a valid URL string, avoid leaking long query by masking after '?'
    const idx = raw.indexOf('?');
    return idx >= 0 ? raw.slice(0, idx + 1) + '***' : raw;
  }
}

function installServerFetchLogger() {
  if (installed) return;
  installed = true;
  const g: any = globalThis as any;
  const originalFetch: typeof fetch = g.fetch?.bind(globalThis) || fetch;
  let requestCounter = 0;

  g.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const id = (++requestCounter).toString(36) + '-' + Date.now().toString(36);
    const url = typeof input === 'string' || input instanceof URL ? String(input) : (input as Request).url;
    const method = (init?.method) || ((typeof input === 'object' && (input as any)?.method) || 'GET');
    const start = Date.now();
    const logPrefix = `[server-fetch][${id}]`;
    try {
      console.warn(`${logPrefix} -> start`, { url: sanitizeUrlForLog(url), method, hasSignal: Boolean(init?.signal) });
      const res = await originalFetch(input as any, init as any);
      const end = Date.now();
      console.warn(`${logPrefix} <- end`, { url: sanitizeUrlForLog(url), method, status: res.status, ok: res.ok, ms: end - start });
      return res;
    } catch (err: any) {
      const end = Date.now();
      console.warn(`${logPrefix} xx error`, { url: sanitizeUrlForLog(url), method, name: err?.name, message: err?.message, ms: end - start });
      throw err;
    }
  };
}

// Next.js calls register on boot (Node.js runtime)
export function register() {
  try {
    installServerFetchLogger();
  } catch (e) {
    console.error('[instrumentation] failed to install fetch logger', e);
  }
}

// Edge runtime hook (if used). Export to be safe; Next will tree-shake if unused.
export function onRequest(_req: NextRequest, _ev: NextFetchEvent) {
  try {
    installServerFetchLogger();
  } catch (e) {
    console.error('[instrumentation:onRequest] failed to install fetch logger', e);
  }
}
