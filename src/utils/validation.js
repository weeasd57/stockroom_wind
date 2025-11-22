// Centralized validation/sanitization helpers (no Arabic in code)

/** Normalize whitespace: collapse multiple spaces, trim ends */
export function normalizeWhitespace(str) {
  return String(str ?? '').replace(/\s+/g, ' ').trim();
}

/** Username: letters, numbers, underscores only; length 1-50; no spaces or symbols */
export function sanitizeUsername(input) {
	let s = String(input ?? '');
	// remove any disallowed characters (allow only a-z, A-Z, 0-9 and underscore)
	s = s.replace(/[^a-zA-Z0-9_]/g, '');
	if (s.length === 0 || s.length > 50) return '';
	return s;
}

export function isValidUsername(input) {
	const s = String(input ?? '');
	return s.length >= 1 && s.length <= 50 && /^[a-zA-Z0-9_]+$/.test(s);
}

/** Human full name: keep letters (all scripts), digits, spaces, hyphen, apostrophes; max 100 */
export function sanitizeFullName(input) {
  let s = normalizeWhitespace(input);
  // Remove anything not Unicode letters, numbers, space, hyphen, apostrophe
  try {
    s = s.replace(/[^\p{L}\p{N} '\-’]+/gu, '');
  } catch {
    // Fallback without Unicode property escapes
    s = s.replace(/[^A-Za-z0-9 '\-]/g, '');
  }
  s = normalizeWhitespace(s);
  if (s.length > 100) s = s.slice(0, 100);
  return s;
}

/** Remove control chars, HTML tags/script blocks, normalize whitespace, cap length */
export function sanitizeText(input, opts = {}) {
  const maxLength = typeof opts.maxLength === 'number' ? opts.maxLength : 1000;
  let s = String(input ?? '');
  // strip null/control characters (except common whitespace)
  s = s.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '');
  // remove <script>...</script>
  s = s.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '');
  // remove all HTML tags to avoid XSS in displays that might dangerously set innerHTML
  s = s.replace(/<[^>]*>/g, '');
  // neutralize SQL comment patterns and suspicious sequences
  s = s.replace(/\/\*[\s\S]*?\*\//g, ''); // /* ... */
  s = s.replace(/--/g, '—'); // em-dash to neutralize inline SQL comment
  // normalize whitespace and crop
  s = normalizeWhitespace(s);
  if (maxLength > 0 && s.length > maxLength) s = s.slice(0, maxLength);
  return s;
}

/** Ensure URL is http/https; otherwise return empty string */
export function sanitizeUrl(url) {
  try {
    const u = new URL(String(url));
    const p = u.protocol.toLowerCase();
    if (p === 'http:' || p === 'https:') return u.toString();
    return '';
  } catch {
    return '';
  }
}

/** Symbols: uppercase letters, digits, dot and hyphen; max 15 chars */
export function sanitizeSymbol(sym) {
  let s = String(sym ?? '').toUpperCase().trim();
  s = s.replace(/[^A-Z0-9.\-]/g, '');
  if (s.length > 15) s = s.slice(0, 15);
  return s;
}

/** Numbers: coerce to finite number else null */
export function sanitizeNumber(n) {
  const v = typeof n === 'string' ? Number(n) : n;
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return v;
}

/** Post payload sanitizer: include all required DB fields, clean text/url fields, bounds lengths */
export function sanitizePostData(post, userId) {
  const base = post || {};
  const cleaned = {};
  cleaned.user_id = base.user_id || userId || null;
  
  // Required text fields with sanitization
  if (base.title != null) cleaned.title = sanitizeText(base.title, { maxLength: 140 });
  // Preserve both content and description - don't overwrite content with description
  if (base.content != null) cleaned.content = sanitizeText(base.content, { maxLength: 5000 });
  if (base.description != null) cleaned.description = sanitizeText(base.description, { maxLength: 5000 });
  
  // Stock/company metadata - ensure company_name is never null/empty
  if (base.symbol != null) cleaned.symbol = sanitizeSymbol(base.symbol);
  cleaned.company_name = sanitizeText(base.company_name || base.name || base.symbol || 'Unknown Company', { maxLength: 200 });
  cleaned.country = sanitizeText(base.country || '', { maxLength: 100 });
  cleaned.exchange = sanitizeText(base.exchange || '', { maxLength: 100 });
  
  // Strategy and status
  if (base.strategy != null) cleaned.strategy = sanitizeText(base.strategy, { maxLength: 50 });
  cleaned.status = sanitizeText(base.status || 'open', { maxLength: 50 });
  cleaned.status_message = sanitizeText(base.status_message || base.status || 'open', { maxLength: 200 });
  
  // http(s) only
  const url = base.image_url || base.imageUrl;
  cleaned.image_url = url ? (sanitizeUrl(url) || null) : null;
  
  // Required numeric fields with fallbacks
  cleaned.current_price = sanitizeNumber(base.current_price) || 0;
  cleaned.initial_price = sanitizeNumber(base.initial_price) || sanitizeNumber(base.current_price) || 0;
  
  // Optional numeric fields
  if ('target_price' in base) cleaned.target_price = sanitizeNumber(base.target_price);
  if ('stop_loss' in base) cleaned.stop_loss = sanitizeNumber(base.stop_loss);
  if ('stop_loss_price' in base) cleaned.stop_loss_price = sanitizeNumber(base.stop_loss_price);
  if ('entry_price' in base) cleaned.entry_price = sanitizeNumber(base.entry_price);
  
  // Boolean flags
  cleaned.is_public = Boolean(base.is_public !== false); // default true
  if ('is_premium_only' in base) cleaned.is_premium_only = Boolean(base.is_premium_only);
  
  // Ensure numeric fields are null instead of undefined for optional ones
  ['target_price', 'stop_loss', 'stop_loss_price', 'entry_price'].forEach(k => {
    if (cleaned[k] === null) cleaned[k] = null;
  });
  
  return cleaned;
}

/** Comment sanitizer: 1..1000 chars after cleaning */
export function sanitizeComment(input) {
  const s = sanitizeText(input, { maxLength: 1000 });
  return s;
}
