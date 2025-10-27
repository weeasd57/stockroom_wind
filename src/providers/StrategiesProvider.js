'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSupabase } from './SimpleSupabaseProvider';

const StrategiesContext = createContext({});

export const useStrategies = () => {
  const context = useContext(StrategiesContext);
  if (!context) {
    throw new Error('useStrategies must be used within a StrategiesProvider');
  }
  return context;
};

export function StrategiesProvider({ children }) {
  const { supabase, user, isAuthenticated } = useSupabase();
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchStrategies = useCallback(async () => {
    if (!isAuthenticated || !user) return;
    
    setLoading(true);
    try {
      const { data } = await supabase
        .from('user_strategies')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      setStrategies(data || []);
    } catch (err) {
      console.error('Error fetching strategies:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, user, isAuthenticated]);

  const createStrategy = useCallback(async (strategyData) => {
    const { data } = await supabase
      .from('user_strategies')
      .insert([{ ...strategyData, user_id: user.id }])
      .select()
      .single();
    
    setStrategies(prev => [data, ...prev]);
    return data;
  }, [supabase, user]);

  const deleteStrategy = useCallback(async (strategyName) => {
    await supabase
      .from('user_strategies')
      .delete()
      .eq('user_id', user.id)
      .eq('strategy_name', strategyName);
    
    setStrategies(prev => prev.filter(s => s.strategy_name !== strategyName));
  }, [supabase, user]);

  useEffect(() => {
    fetchStrategies();
  }, [fetchStrategies]);

  // Realtime subscription to keep strategies in sync across the app
  useEffect(() => {
    if (!isAuthenticated || !user || !supabase) return;

    const channel = supabase
      .channel(`user-strategies-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'user_strategies',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        const row = payload.new;
        setStrategies(prev => {
          if (prev?.some(s => s.id === row.id)) return prev;
          return [row, ...(prev || [])];
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_strategies',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        const row = payload.new;
        setStrategies(prev => (prev || []).map(s => s.id === row.id ? row : s));
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'user_strategies',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        const row = payload.old;
        setStrategies(prev => (prev || []).filter(s => s.id !== row.id));
      })
      .subscribe();

    return () => {
      try { channel.unsubscribe(); } catch {}
    };
  }, [supabase, user?.id, isAuthenticated]);

  return (
    <StrategiesContext.Provider value={{
      strategies,
      loading,
      fetchStrategies,
      createStrategy,
      deleteStrategy
    }}>
      {children}
    </StrategiesContext.Provider>
  );
}
