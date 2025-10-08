export type SameSite = 'Lax' | 'Strict' | 'None';

export function setCookie(
  name: string,
  value: string,
  options: {
    maxAgeSeconds?: number;
    path?: string;
    sameSite?: SameSite;
    secure?: boolean;
  } = {}
) {
  if (typeof document === 'undefined') return;
  const enc = encodeURIComponent(value);
  const path = options.path ?? '/';
  const sameSite = options.sameSite ?? 'Lax';
  const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:';
  const secure = options.secure ?? isHttps;

  let cookie = `${name}=${enc}; Path=${path}; SameSite=${sameSite}`;
  if (options.maxAgeSeconds && options.maxAgeSeconds > 0) {
    cookie += `; Max-Age=${options.maxAgeSeconds}`;
  }
  if (secure) cookie += '; Secure';

  document.cookie = cookie;
}

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  for (const c of cookies) {
    const [k, ...rest] = c.split('=');
    if (k === name) {
      try {
        return decodeURIComponent(rest.join('='));
      } catch {
        return rest.join('=');
      }
    }
  }
  return null;
}

export function deleteCookie(name: string, path: string = '/') {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; Path=${path}; Max-Age=0; SameSite=Lax`;
}
