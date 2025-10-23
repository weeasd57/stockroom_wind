'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import PriceCheckResultsDialog from '@/components/dialogs/PriceCheckResultsDialog';

const PriceCheckResultsContext = createContext();

export function PriceCheckResultsProvider({ children }) {
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    results: null,
    stats: null
  });

  // Show the results dialog with data
  const showResults = useCallback((resultsData, statsData) => {
    console.log('[PriceCheckResults] Showing results dialog:', { resultsData, statsData });
    
    setDialogState({
      isOpen: true,
      results: resultsData || [],
      stats: statsData || {}
    });
  }, []);

  // Hide the dialog
  const hideResults = useCallback(() => {
    console.log('[PriceCheckResults] Hiding results dialog');
    
    setDialogState({
      isOpen: false,
      results: null,
      stats: null
    });
  }, []);

  // Check if dialog is currently open
  const isOpen = dialogState.isOpen;

  const value = {
    showResults,
    hideResults,
    isOpen,
    results: dialogState.results,
    stats: dialogState.stats
  };

  return (
    <PriceCheckResultsContext.Provider value={value}>
      {children}
      <PriceCheckResultsDialog
        isOpen={dialogState.isOpen}
        onClose={hideResults}
        results={dialogState.results}
        stats={dialogState.stats}
      />
    </PriceCheckResultsContext.Provider>
  );
}

export function usePriceCheckResults() {
  const context = useContext(PriceCheckResultsContext);
  if (context === undefined) {
    throw new Error('usePriceCheckResults must be used within a PriceCheckResultsProvider');
  }
  return context;
}
