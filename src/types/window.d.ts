// Global window extensions for debugging

declare global {
  interface Window {
    backgroundProcessDrawer?: {
      // State getters
      getState: () => {
        isOpen: boolean;
        activeTab: string;
        processCount: number;
        historyCount: number;
        debugMode: boolean;
        testRunning: boolean;
      };
      
      // Control functions
      open: () => void;
      close: () => void;
      toggle: () => void;
      setTab: (tab: 'processes' | 'subscription' | 'history' | 'debug') => void;
      toggleDebug: () => void;
      
      // Test functions
      runTests: () => Promise<void>;
      testAPI: (type?: string) => Promise<any>;
      
      // Utility functions
      clearHistory: () => void;
      clearAll: () => void;
      
      // Data access
      getCurrentData: () => {
        processes: any[];
        processHistory: any[];
        subscription: any | null;
        expandedProcesses: string[];
      };
      
      // Help
      help: () => void;
    };
  }
}

export {};
