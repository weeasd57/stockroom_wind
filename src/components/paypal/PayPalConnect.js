'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';

export default function PayPalConnect({ onConnected }) {
  const { supabase, user } = useSupabase();
  const [isConnecting, setIsConnecting] = useState(false);
  const [paypalAccount, setPaypalAccount] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkPayPalStatus();
    handleOAuthCallback();
  }, []);

  const checkPayPalStatus = async () => {
    try {
      // Use maybeSingle() instead of single() to avoid PGRST116 error when no rows exist
      const { data, error } = await supabase
        .from('paypal_accounts')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      // maybeSingle() returns null if no rows found (no error)
      if (data) {
        setPaypalAccount(data);
        onConnected?.(data);
      }
      
      if (error) {
        console.error('Error checking PayPal status:', error);
      }
    } catch (err) {
      console.error('Unexpected error checking PayPal status:', err);
    }
  };

  const handleOAuthCallback = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('paypal_success');
    const error = urlParams.get('paypal_error');

    if (success === 'true') {
      checkPayPalStatus();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (error) {
      setError('PayPal connection failed. Please try again.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  const connectPayPal = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const response = await fetch('/api/paypal/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id })
      });

      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error('Failed to get PayPal auth URL');
      }
    } catch (err) {
      setError(err.message);
      setIsConnecting(false);
    }
  };

  const disconnectPayPal = async () => {
    try {
      await supabase
        .from('paypal_accounts')
        .delete()
        .eq('user_id', user.id);
      
      setPaypalAccount(null);
    } catch (err) {
      setError('Failed to disconnect PayPal');
    }
  };

  if (paypalAccount) {
    return (
      <div style={{
        padding: '1.5rem',
        background: '#d1fae5',
        border: '1px solid #10b981',
        borderRadius: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <span style={{ fontSize: '24px' }}>✅</span>
          <h3 style={{ margin: 0, color: '#065f46' }}>PayPal Connected</h3>
        </div>
        
        <div style={{ fontSize: '14px', color: '#047857', marginBottom: '1rem' }}>
          <p><strong>Email:</strong> {paypalAccount.email}</p>
          <p><strong>Account Type:</strong> {paypalAccount.account_type}</p>
          <p><strong>Verified:</strong> {new Date(paypalAccount.verified_at).toLocaleDateString()}</p>
        </div>

        <button
          onClick={disconnectPayPal}
          style={{
            padding: '0.5rem 1rem',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Disconnect PayPal
        </button>
      </div>
    );
  }

  return (
    <div style={{
      padding: '1.5rem',
      background: 'hsl(var(--card))',
      border: '1px solid hsl(var(--border))',
      borderRadius: '12px'
    }}>
      <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        🔐 Connect PayPal Account
      </h3>
      
      <p style={{ fontSize: '14px', color: 'hsl(var(--muted-foreground))', marginBottom: '1.5rem' }}>
        Connect your PayPal account to receive subscription payments securely.
      </p>

      {error && (
        <div style={{
          padding: '1rem',
          background: '#fee2e2',
          color: '#991b1b',
          borderRadius: '8px',
          marginBottom: '1rem',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      <button
        onClick={connectPayPal}
        disabled={isConnecting}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.75rem 1.5rem',
          background: '#0070ba',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: '600',
          cursor: isConnecting ? 'not-allowed' : 'pointer',
          opacity: isConnecting ? 0.7 : 1
        }}
      >
        <img 
          src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTcuMDc2IDEyLjgzNEM2LjM5NCAxMi44MzQgNS44MzQgMTIuMjc0IDUuODM0IDExLjU5MkM1LjgzNCAxMC45MSA2LjM5NCAxMC4zNSA3LjA3NiAxMC4zNUg5LjMxOEM5Ljk5OSAxMC4zNSAxMC41NTkgMTAuOTEgMTAuNTU5IDExLjU5MkMxMC41NTkgMTIuMjc0IDkuOTk5IDEyLjgzNCA5LjMxOCAxMi44MzRINy4wNzZaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K"
          alt="PayPal"
          width="20"
          height="20"
        />
        {isConnecting ? 'Connecting...' : 'Connect with PayPal'}
      </button>
    </div>
  );
}
