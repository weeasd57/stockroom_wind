'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create a context for the Supabase client
const SupabaseContext = createContext(null);

// Provider component to wrap around the app
export function SupabaseProvider({ children }) {
  const [supabase, setSupabase] = useState(null);

  useEffect(() => {
    // Initialize the Supabase client
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    setSupabase(supabaseClient);
  }, []);

  return (
    <SupabaseContext.Provider value={{ supabase }}>
      {children}
    </SupabaseContext.Provider>
  );
}

// Hook to use the Supabase client
export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
}
