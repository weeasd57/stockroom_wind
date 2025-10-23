'use client';

import { usePriceCheckResultsGlobal } from '@/hooks/usePriceCheckResultsGlobal';

/**
 * Internal component that initializes the global price check results handler.
 * Must be placed inside PriceCheckResultsProvider.
 */
export default function GlobalPriceCheckHandler() {
  // Initialize the global handler
  usePriceCheckResultsGlobal();
  
  // This component doesn't render anything
  return null;
}
