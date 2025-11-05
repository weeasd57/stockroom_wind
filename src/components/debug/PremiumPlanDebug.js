'use client';

import { useState } from 'react';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';

export default function PremiumPlanDebug() {
  const { supabase, user } = useSupabase();
  const [debugInfo, setDebugInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const testConnection = async () => {
    setLoading(true);
    const info = {
      user: user ? { id: user.id, email: user.email } : null,
      timestamp: new Date().toISOString()
    };

    try {
      // Test if table exists
      console.log('Testing premium_plans table...');
      const { data, error, count } = await supabase
        .from('premium_plans')
        .select('*', { count: 'exact' })
        .limit(1);

      info.tableTest = {
        success: !error,
        error: error?.message,
        rowCount: count,
        sampleData: data
      };

      // Test user's plan
      if (user?.id) {
        console.log('Testing user plan fetch...');
        const { data: userPlan, error: userError } = await supabase
          .from('premium_plans')
          .select('*')
          .eq('user_id', user.id)
          .single();

        info.userPlanTest = {
          success: !userError || userError.code === 'PGRST116',
          error: userError?.message,
          errorCode: userError?.code,
          data: userPlan
        };
      }

      // Test PayPal accounts table
      console.log('Testing paypal_accounts table...');
      const { data: paypalData, error: paypalError } = await supabase
        .from('paypal_accounts')
        .select('*', { count: 'exact' })
        .limit(1);

      info.paypalTableTest = {
        success: !paypalError,
        error: paypalError?.message,
        data: paypalData
      };

    } catch (err) {
      info.generalError = err.message;
    }

    setDebugInfo(info);
    setLoading(false);
    console.log('Debug Info:', info);
  };

  return (
    <div style={{
      padding: '2rem',
      background: 'hsl(var(--card))',
      border: '1px solid hsl(var(--border))',
      borderRadius: '12px',
      margin: '1rem 0'
    }}>
      <h3 style={{ marginBottom: '1rem' }}>🔍 Premium Plan Debug</h3>
      
      <button
        onClick={testConnection}
        disabled={loading}
        style={{
          padding: '0.75rem 1.5rem',
          background: 'hsl(var(--primary))',
          color: 'hsl(var(--primary-foreground))',
          border: 'none',
          borderRadius: '8px',
          cursor: loading ? 'not-allowed' : 'pointer',
          marginBottom: '1rem'
        }}
      >
        {loading ? 'Testing...' : 'Test Database Connection'}
      </button>

      {debugInfo && (
        <div style={{
          background: 'hsl(var(--muted))',
          padding: '1rem',
          borderRadius: '8px',
          fontFamily: 'monospace',
          fontSize: '12px',
          whiteSpace: 'pre-wrap'
        }}>
          {JSON.stringify(debugInfo, null, 2)}
        </div>
      )}
    </div>
  );
}
