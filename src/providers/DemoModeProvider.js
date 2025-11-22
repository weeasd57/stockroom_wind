'use client';

import React, { createContext, useContext } from 'react';

const DemoModeContext = createContext({
  isDemoMode: false,
  toggleDemoMode: () => {},
});

export const useDemoMode = () => useContext(DemoModeContext);

export function DemoModeProvider({ children }) {
  return (
    <DemoModeContext.Provider value={{ isDemoMode: false, toggleDemoMode: () => {} }}>
      {children}
    </DemoModeContext.Provider>
  );
}
