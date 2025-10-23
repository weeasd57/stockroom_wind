'use client';

import { useEffect } from 'react';
import { usePriceCheckResults } from '@/providers/PriceCheckResultsProvider';

export function usePriceCheckResultsGlobal() {
  const { showResults } = usePriceCheckResults();

  useEffect(() => {
    // Make the showResults function available globally
    if (typeof window !== 'undefined') {
      window.showPriceCheckResults = (results, stats) => {
        console.log('[Global Hook] Price check results received:', { results, stats });
        showResults(results, stats);
      };

      // Cleanup on unmount
      return () => {
        if (typeof window !== 'undefined') {
          delete window.showPriceCheckResults;
        }
      };
    }
  }, [showResults]);

  return null;
}
