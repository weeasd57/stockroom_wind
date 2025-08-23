"use client";

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { searchStocks } from '@/utils/symbolSearch';
import styles from '@/styles/SymbolSearchDialog.module.css';
import { COUNTRY_CODE_TO_NAME } from '@/models/CountryData';
import { getCurrencySymbol } from '@/models/CurrencyData';

// Types for better type safety
interface Stock {
  uniqueId?: string;
  Symbol: string;
  Name?: string;
  Exchange?: string;
  Country: string;
}

interface SymbolSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStock: (stock: Stock) => void;
  initialStockSearch?: string;
  selectedCountry: string;
  discoveredSymbols?: Array<{ Symbol: string; Name?: string; Exchange?: string; Country: string; uniqueId?: string; }>; // optional
}

// Constants
const DEBOUNCE_DELAY = 300;
const MIN_SEARCH_LENGTH = 1;

/**
 * SymbolSearchDialog Component
 * 
 * A performant, accessible dialog for searching stock symbols with the following features:
 * - Debounced search to reduce API calls
 * - Memoized functions to prevent unnecessary re-renders
 * - Proper TypeScript typing for better type safety
 * - Keyboard navigation support (ESC to close)
 * - Currency symbol display based on country/exchange
 */
const SymbolSearchDialog: React.FC<SymbolSearchDialogProps> = ({
  isOpen,
  onClose,
  onSelectStock,
  initialStockSearch = '',
  selectedCountry,
  discoveredSymbols,
}) => {
  // State management
  const [searchTerm, setSearchTerm] = useState(initialStockSearch);
  const [searchResults, setSearchResults] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Accessibility: focus management and trap
  const contentRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedEl = useRef<HTMLElement | null>(null);

  // Memoized helper function to get currency symbol for a country code
  const getCurrencySymbolForCountry = useCallback((countryCode: string, exchange?: string): string => {
    if (!countryCode) return '$';
    const countryName = COUNTRY_CODE_TO_NAME[countryCode];
    return getCurrencySymbol(countryName, exchange) || '$';
  }, []);

  // Memoized search function to prevent unnecessary re-creations
  const performSearch = useCallback(async (term: string, country: string | null) => {
    // If discovered symbols are provided, filter locally
    if (Array.isArray(discoveredSymbols) && discoveredSymbols.length > 0) {
      const normalized = term.toLowerCase();
      const filtered = discoveredSymbols.filter(s => {
        const inCountry = country ? String(s.Country).toLowerCase() === String(country).toLowerCase() : true;
        if (!normalized) return inCountry;
        return inCountry && (
          String(s.Symbol).toLowerCase().includes(normalized) ||
          String(s.Name || '').toLowerCase().includes(normalized)
        );
      });
      setSearchResults(filtered as any);
      setLoading(false);
      setError(null);
      return;
    }

    // If no term but a country is selected, load all symbols for that country
    if (term.length === 0 && country) {
      setLoading(true);
      setError(null);
      try {
        const results = await searchStocks('', country);
        setSearchResults(results);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load country symbols.";
        console.error("Error loading country symbols:", err);
        setError(errorMessage);
        setSearchResults([]);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Enforce minimum length only when no country filter is applied
    if (term.length < MIN_SEARCH_LENGTH) {
      setSearchResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const results = await searchStocks(term, country);
      setSearchResults(results);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to search symbols.";
      console.error("Error searching symbols:", err);
      setError(errorMessage);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, [discoveredSymbols]);

  // Debounced search effect
  useEffect(() => {
    const handler = setTimeout(() => {
      const countryFilter = selectedCountry !== 'all' ? selectedCountry : null;
      performSearch(searchTerm, countryFilter);
    }, DEBOUNCE_DELAY);

    return () => clearTimeout(handler);
  }, [searchTerm, selectedCountry, performSearch]);

  // Memoized select handler
  const handleSelect = useCallback((stock: Stock) => {
    onSelectStock(stock);
    onClose();
  }, [onSelectStock, onClose]);

  // Memoized input change handler
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  // Keyboard event handler for ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Focus trap handler
  const handleKeyDownTrap = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const container = contentRef.current;
    if (!container) return;
    const focusable = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey) {
      if (active === first || !container.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  // Manage initial focus and restore focus on close
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedEl.current = document.activeElement as HTMLElement | null;
      const t = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        } else if (closeBtnRef.current) {
          closeBtnRef.current.focus();
        }
      }, 0);
      return () => clearTimeout(t);
    } else if (previouslyFocusedEl.current) {
      previouslyFocusedEl.current.focus();
    }
  }, [isOpen]);

  // Memoized selected country display name
  const selectedCountryName = useMemo(() => {
    return selectedCountry === 'all' 
      ? 'all countries' 
      : COUNTRY_CODE_TO_NAME[selectedCountry] || selectedCountry;
  }, [selectedCountry]);

  // Early return if dialog is not open
  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className={styles.dialogOverlay} 
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="symbol-search-title"
    >
      <div 
        className={styles.dialogContent} 
        onClick={(e) => e.stopPropagation()}
        role="document"
        ref={contentRef}
        onKeyDown={handleKeyDownTrap}
      >
        <div className={styles.dialogHeader}>
          <h2 id="symbol-search-title">Search Symbol or Name</h2>
          <button 
            className={styles.closeButton} 
            onClick={onClose}
            type="button"
            aria-label="Close dialog"
            ref={closeBtnRef}
          >
            &times;
          </button>
        </div>
        
        <input
          type="text"
          placeholder="Enter symbol or company name..."
          className={styles.searchInput}
          value={searchTerm}
          onChange={handleInputChange}
          autoFocus
          ref={inputRef}
          aria-label="Search for stocks by symbol or company name"
        />

        {loading && (
          <p className={styles.loadingMessage} role="status" aria-live="polite">
            Loading...
          </p>
        )}
        
        {error && (
          <p className={styles.errorMessage} role="alert" aria-live="assertive">
            {error}
          </p>
        )}
        
        <div className={styles.symbolList} role="listbox" aria-label="Search results">
          {!loading && !error && searchResults.length > 0 ? (
            searchResults.map((stock) => {
              const currencySymbol = getCurrencySymbolForCountry(stock.Country, stock.Exchange);
              const stockKey = stock.uniqueId || `${stock.Symbol}-${stock.Country}`;
              
              return (
                <button
                  key={stockKey}
                  className={styles.symbolItem}
                  onClick={() => handleSelect(stock)}
                  type="button"
                  aria-label={`Select ${stock.Symbol} - ${stock.Name || 'Unknown company'}`}
                >
                  <div className={styles.symbolName}>
                    <span>{stock.Symbol}</span>
                    {stock.Exchange && (
                      <span className={styles.exchange}>
                        ({stock.Exchange})
                      </span>
                    )}
                    {stock.Name && (
                      <span className={styles.companyName} title={stock.Name}>
                        {' - '}{stock.Name}
                      </span>
                    )}
                  </div>
                  
                  {stock.Country && stock.Country !== 'all' && (
                    <div className={styles.countryInfo}>
                      <span 
                        className={`fi fi-${stock.Country.toLowerCase()} country-flag`}
                        aria-label={`Country flag for ${COUNTRY_CODE_TO_NAME[stock.Country] || stock.Country}`}
                      />
                      <span>
                        {COUNTRY_CODE_TO_NAME[stock.Country] || stock.Country}
                      </span>
                      {currencySymbol && currencySymbol !== '$' && (
                        <span className={styles.currency} title={`Currency: ${currencySymbol}`}>
                          {' '}({currencySymbol})
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })
          ) : !loading && !error && (
            selectedCountry === 'all' && searchTerm.length === 0 ? (
              <p className={styles.promptMessage} role="status">
                Type at least {MIN_SEARCH_LENGTH} character to search.
              </p>
            ) : (
              <p className={styles.noResults} role="status">
                No symbols found{searchTerm ? ` for "${searchTerm}"` : ''} in {selectedCountryName}.
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(SymbolSearchDialog);