export const dynamic = 'force-dynamic'; // Ensure this route is server-rendered on each request

import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Server-side only: use private key
const BASE_URL = 'https://eodhd.com/api';
const EOD_API_KEY = process.env.NEXT_PUBLIC_EOD_API_KEY;

// Lazy import to avoid any client bundling concerns
async function getExchangeForCountry(country) {
  const mod = await import('@/models/ExchangeData.js');
  return mod.getExchangeForCountry(country);
}

async function getCountryIsoCodes() {
  const mod = await import('@/models/CurrencyData.js');
  return mod.COUNTRY_ISO_CODES || {};
}

function buildError(status, message, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

// Resolve a provided country parameter (full name or ISO like 'eg') to the country name
async function resolveCountryName(countryParam) {
  if (!countryParam) return null;
  const ISO = await getCountryIsoCodes();
  // Already a known country name
  if (ISO[countryParam]) return countryParam;
  // Try reverse-lookup by iso code
  const isoLower = String(countryParam).toLowerCase();
  for (const [countryName, iso] of Object.entries(ISO)) {
    if (String(iso).toLowerCase() === isoLower) {
      return countryName;
    }
  }
  return null;
}

// Try to find exchange code for a symbol using local symbols_data JSON for the given country
async function findExchangeFromLocal(symbol, countryParam) {
  try {
    const baseSymbol = String(symbol).split('.')[0].toUpperCase();
    const countryName = await resolveCountryName(countryParam);
    if (!countryName) return null;

    const dataDir = path.join(process.cwd(), 'public', 'symbols_data');
    const files = await fs.readdir(dataDir);
    const prefix = `${countryName}_all_symbols_`;
    const candidates = files.filter((n) => n.startsWith(prefix) && n.endsWith('.json'));
    if (candidates.length === 0) return null;

    // Pick the most recent file by name (they contain a timestamp suffix)
    const fileName = candidates.sort().at(-1);
    const filePath = path.join(dataDir, fileName);
    const content = await fs.readFile(filePath, 'utf8');
    const list = JSON.parse(content);
    if (!Array.isArray(list)) return null;

    const hit = list.find((item) => {
      const sym = (item.Symbol || item.symbol || '').toUpperCase();
      return sym === baseSymbol;
    });
    const ex = hit?.Exchange || hit?.exchange;
    return ex ? String(ex).toUpperCase() : null;
  } catch (_) {
    return null;
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = (searchParams.get('symbol') || '').trim();
    const country = (searchParams.get('country') || '').trim();

    // Optional debug flag (?debug=1) to print sanitized request details to server logs
    const debug = searchParams.get('debug') === '1';
    const debugToken = searchParams.get('debug_token') === '1';
    const isProd = process.env.NODE_ENV === 'production';
    if (debug) console.log('[stocks/price] Query params:', { symbol, country });
    if (!symbol) {
      return buildError(400, 'Missing required parameter: symbol');
    }

    if (!EOD_API_KEY) {
      return buildError(500, 'Server is not configured with NEXT_PUBLIC_EOD_API_KEY');
    }

    // Format symbol with exchange if needed
    let formattedSymbol = symbol;
    if (!symbol.includes('.')) {
      let exchangeCode = '';
      if (country) {
        // First, try to derive exchange from local symbols_data by exact symbol match
        let exchange = await findExchangeFromLocal(symbol, country);
        
        // If not found locally, try resolving directly using country value (country name)
        if (!exchange) {
          exchange = await getExchangeForCountry(country);
        }

        // If not found, try treating `country` as an ISO code and map it to a country name
        if (!exchange) {
          const ISO = await getCountryIsoCodes();
          // Build reverse map: iso(lower) -> country name
          const isoLower = country.toLowerCase();
          let resolvedCountry = null;
          for (const [countryName, iso] of Object.entries(ISO)) {
            if (String(iso).toLowerCase() === isoLower) {
              resolvedCountry = countryName;
              break;
            }
          }
          if (resolvedCountry) {
            exchange = await getExchangeForCountry(resolvedCountry);
          }
        }

        if (exchange) {
          // Preserve exchange code casing as provided by data (generally uppercase, e.g., US, EGX)
          exchangeCode = String(exchange).toUpperCase();
        }
      }
      if (exchangeCode) {
        formattedSymbol = `${symbol}.${exchangeCode}`;
      }
    }

    if (debug) console.log('[stocks/price] formattedSymbol:', formattedSymbol);

    // If no exchange code found, try to get it from the country
    if (!formattedSymbol.includes('.')) {
      const exchange = await getExchangeForCountry(country) || 'US';
      formattedSymbol = `${formattedSymbol}.${exchange}`.toUpperCase();
    }
    const url = `${BASE_URL}/eod/${formattedSymbol}?filter=last_close&api_token=${EOD_API_KEY}&fmt=json`;

    // Build a sanitized URL for logging (mask api_token)
    const urlForLog = (() => {
      try {
        const u = new URL(url);
        u.searchParams.set('api_token', '***');
        return u.toString();
      } catch {
        return url;
      }
    })();
    if (debug) console.log('[stocks/price] Fetch URL:', urlForLog);
    if (debug && debugToken && !isProd) {
      // Development-only: print full URL including token for troubleshooting
      console.log('[stocks/price] Fetch URL (with token):', url);
    }

    const res = await fetch(url, { cache: 'no-store' });
    if (debug) console.log('[stocks/price] Upstream status:', res.status);
    if (!res.ok) {
      return buildError(502, 'Upstream price fetch failed', { status: res.status });
    }

    const raw = await res.json();

    // Normalize price
    let price = null;
    if (Array.isArray(raw) && raw.length > 0 && raw[0] && typeof raw[0].close === 'number') {
      price = Number(raw[0].close);
    } else if (raw && (raw.close || raw.price)) {
      price = Number(raw.close || raw.price);
    } else if (typeof raw === 'number') {
      price = Number(raw);
    }

    if (!Number.isFinite(price)) {
      return buildError(502, 'Unable to parse price from upstream response');
    }

    return NextResponse.json({
      symbol,
      country: country || null,
      formattedSymbol,
      price,
      source: 'eodhd',
      asOf: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[stocks/price] Unexpected error:', err);
    return buildError(500, 'Unexpected server error');
  }
}
