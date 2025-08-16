// Type declarations for utils/symbolSearch JS module
// Keeps TS consumers happy (SymbolSearchDialog.tsx, CreatePostForm.js w/ JSDoc support)

declare module '@/utils/symbolSearch' {
  export interface StockItem {
    uniqueId?: string;
    Symbol: string;
    Name?: string;
    Exchange?: string;
    // Country is ISO 2-letter code in lowercase (e.g., 'us', 'uk')
    Country: string;
  }

  /**
   * Search local stock symbols with optional country filter.
   * Country may be full country name, ISO code, or null/undefined for all.
   */
  export function searchStocks(
    query: string,
    country?: string | null,
    limit?: number
  ): Promise<StockItem[]>;

  /**
   * Returns a map of ISO country code (lowercase) => total symbols.
   * Also includes keys: 'total' and 'all' for overall counts.
   */
  export function getCountrySymbolCounts(): Promise<Record<string, number>>;
}
