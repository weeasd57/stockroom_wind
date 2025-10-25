"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { COUNTRY_CODE_TO_NAME, COUNTRY_CODES } from '@/models/CountryData';
import styles from '@/styles/CountrySelectDialog.module.css';

interface CountrySelectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCountry: (countryCode: string) => void;
  selectedCountry: string;
  countryCounts?: Record<string, number>; // keyed by lowercase ISO code; includes optional 'all' or 'total'
  discoveredCountries?: string[]; // optional: limit to these ISO codes (lowercase)
}

const CountrySelectDialog: React.FC<CountrySelectDialogProps> = ({
  isOpen,
  onClose,
  onSelectCountry,
  selectedCountry,
  countryCounts,
  discoveredCountries,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Accessibility refs and state
  const contentRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedEl = useRef<HTMLElement | null>(null);

  // Memoize filtered countries for performance
  const filteredCountries = useMemo(() => {
    // Build the base list of countries from constants
    let allCountries = COUNTRY_CODES.map(code => ({
      code,
      name: COUNTRY_CODE_TO_NAME[code] || code,
    }));

    // Optionally limit to discovered countries only (keep 'all' available regardless)
    if (Array.isArray(discoveredCountries) && discoveredCountries.length > 0) {
      const set = new Set(discoveredCountries.map(c => String(c).toLowerCase()));
      allCountries = allCountries.filter(c => set.has(String(c.code).toLowerCase()));
    }

    // Always prepend a virtual 'all' option at the top
    const withAll = [{ code: 'all', name: 'All Countries' }, ...allCountries];

    // If no search term, return the list with 'all' on top
    if (!searchTerm) {
      return withAll;
    }

    // Apply search filter only to actual countries; keep 'all' visible at the top
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const filtered = allCountries.filter(country =>
      (country.name as string).toLowerCase().includes(lowerCaseSearchTerm) ||
      (country.code as string).toLowerCase().includes(lowerCaseSearchTerm)
    );
    return [{ code: 'all', name: 'All Countries' }, ...filtered];
  }, [searchTerm, discoveredCountries]);

  const handleSelect = useCallback((countryCode: string) => {
    onSelectCountry(countryCode);
    onClose();
  }, [onSelectCountry, onClose]);

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

  // Close dialog on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Manage initial focus and restore focus on close
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedEl.current = document.activeElement as HTMLElement | null;
      // Defer to ensure elements are mounted
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

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.dialogOverlay} onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="country-dialog-title">
      <div className={styles.dialogContent} onClick={(e) => e.stopPropagation()} role="document" ref={contentRef} onKeyDown={handleKeyDownTrap}>
        <div className={styles.dialogHeader}>
          <h2 id="country-dialog-title">Select a Country</h2>
          <button className={styles.closeButton} onClick={onClose} type="button" aria-label="Close dialog" ref={closeBtnRef}>
            &times;
          </button>
        </div>
        <input
          type="text"
          placeholder="Search country..."
          className={styles.searchInput}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          ref={inputRef}
          autoFocus
          aria-label="Search country"
        />
        <div className={styles.countryList} role="listbox" aria-label="Country list">
          {filteredCountries.length > 0 ? (
            filteredCountries.map((country) => (
              <button
                key={country.code}
                className={`${styles.countryItem} ${selectedCountry === country.code ? styles.selected : ''}`}
                onClick={() => handleSelect(country.code as string)}
                type="button"
                aria-pressed={selectedCountry === country.code}
              >
                {/* Display country flag if available */}
                {country.code !== 'all' && (
                  <span className={`fi fi-${(country.code as string).toLowerCase()} country-flag`}></span>
                )}
                {country.name}
                {/* Render symbol count when available */}
                {(() => {
                  const code = String(country.code).toLowerCase();
                  const count = countryCounts && typeof countryCounts[code] === 'number' ? countryCounts[code] : undefined;
                  return typeof count === 'number' ? ` (${count})` : '';
                })()}
              </button>
            ))
          ) : (
            <p className={styles.noResults}>No countries found.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CountrySelectDialog;
