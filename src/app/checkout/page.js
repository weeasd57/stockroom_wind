'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useSupabase } from '@/providers/SupabaseProvider';
import Script from 'next/script';

export default function CheckoutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { supabase } = useSupabase();
  
  // Support both Sandbox and Production modes
  const isProduction = process.env.NODE_ENV === 'production';
  const paypalClientId = isProduction 
    ? process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_LIVE 
    : process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  
  // Normalize and encode client id to avoid accidental whitespace/encoding issues
  const encodedClientId = encodeURIComponent((paypalClientId || '').trim());
  const buttonsRenderedRef = useRef(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const [scriptRetryKey, setScriptRetryKey] = useState(0);
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
  const [cspNonce, setCspNonce] = useState('');

  // Obtain CSP nonce exposed by RootLayout to allow PayPal SDK to inject styles with the same nonce
  useEffect(() => {
    try {
      // eslint-disable-next-line no-undef
      const n = typeof window !== 'undefined' ? (window.__CSP_NONCE__ || '') : '';
      setCspNonce(n);
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (!user) {
      router.push('/login?redirect=/checkout');
      return;
    }
    fetchSubscriptionInfo();
  }, [user]);

  const fetchSubscriptionInfo = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await (token
        ? fetch('/api/subscription/info', {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          })
        : fetch('/api/subscription/info', {
            credentials: 'include',
            cache: 'no-store',
          }));
      const result = await response.json();
      
      if (result.success && result.data) {
        setSubscriptionInfo(result.data);
        // If already pro, redirect to pricing
        if (result.data.plan_name === 'pro') {
          router.push('/pricing');
        }
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    }
  };

  const handlePayPalApprove = async (data, actions) => {
    setLoading(true);
    setError('');

    try {
      // Capture the order
      const details = await actions.order.capture();
      console.log('Payment captured:', details);

      // Send order details to backend
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch('/api/checkout/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(token ? {} : { credentials: 'include' }),
        cache: 'no-store',
        body: JSON.stringify({
          orderId: details.id,
          captureId: details.purchase_units[0].payments.captures[0].id,
          userId: user.id,
          amount: details.purchase_units[0].amount.value,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to confirm payment');
      }

      const result = await response.json();
      
      // Redirect to success page
      router.push('/checkout/success');
    } catch (error) {
      console.error('Payment error:', error);
      setError('Payment failed. Please try again.');
      setLoading(false);
    }
  };

  const handlePayPalError = (err) => {
    console.error('PayPal error:', err);
    setError('Payment error occurred. Please try again.');
    setLoading(false);
  };

  const handlePayPalCancel = () => {
    setError('Payment cancelled.');
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Upgrade to Pro</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Complete your purchase to unlock Pro features
          </p>
        </div>

        {/* Plan Summary */}
        <div className="bg-card rounded-lg border p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold">Pro Plan</h3>
              <p className="text-sm text-muted-foreground">Billed monthly</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">$4.00</p>
              <p className="text-sm text-muted-foreground">/month</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">What's included:</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                30 price checks per month
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                Unlimited post creation
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                Advanced analytics
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                Priority support
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                Pro badge on profile
              </li>
            </ul>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        {/* PayPal Button Container */}
        <div className="bg-card rounded-lg border p-6">
          <h4 className="font-medium mb-4">Payment Method</h4>
          <div id="paypal-button-container"></div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center">
            <div className="inline-flex items-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
              <span>Processing payment...</span>
            </div>
          </div>
        )}

        {/* Back Link */}
        <div className="text-center">
          <button
            onClick={() => router.push('/pricing')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to pricing
          </button>
        </div>
      </div>

      {/* PayPal SDK */}
      {paypalClientId ? (
        <Script
          strategy="afterInteractive"
          src={`https://www.paypal.com/sdk/js?client-id=${encodedClientId}&currency=EUR&components=buttons&intent=authorize&commit=true&debug=true`}
          // Provide nonce attributes so SDK can tag injected <style> with the same nonce
          nonce={cspNonce}
          data-csp-nonce={cspNonce}
          onError={(e) => {
            console.error('[PayPal SDK] Script load error:', e?.message || e);
            // This often indicates a network block from adblock/privacy extensions
            setError('Failed to load PayPal SDK. Please disable adblocker or privacy extensions and retry.');
          }}
          onLoad={() => {
            try {
              const container = document.getElementById('paypal-button-container');
              setPaypalLoaded(true);
              if (!window?.paypal || !container) {
                setError('PayPal SDK loaded but `window.paypal` is not available. This can happen when requests are blocked by browser extensions. Please disable blockers and retry.');
                return;
              }
              // Prevent duplicate renders during Fast Refresh / StrictMode double-invoke
              if (buttonsRenderedRef.current || container.hasChildNodes()) {
                return;
              }

              const buttons = window.paypal.Buttons({
                createOrder: (data, actions) => {
                  return actions.order.create({
                    purchase_units: [
                      {
                        amount: {
                          value: '4.00',
                          currency_code: 'EUR',
                        },
                        description: 'SharksZone Pro Plan - Monthly Subscription',
                      },
                    ],
                    application_context: {
                      brand_name: 'SharksZone',
                      landing_page: 'NO_PREFERENCE',
                      user_action: 'PAY_NOW',
                      intent: 'AUTHORIZE'
                    },
                  });
                },
                onApprove: handlePayPalApprove,
                onError: handlePayPalError,
                onCancel: handlePayPalCancel,
                style: {
                  layout: 'vertical',
                  color: 'blue',
                  shape: 'rect',
                  label: 'paypal',
                },
              });
              buttons.render(container);
              buttonsRenderedRef.current = true;
            } catch (e) {
              console.error('PayPal init error:', e);
              setError('Failed to initialize PayPal. Please refresh the page.');
            }
          }}
          key={scriptRetryKey}
        />
      ) : (
        <div className="mt-4 text-sm text-destructive bg-destructive/10 p-3 rounded">
          PayPal client ID is missing. Please set NEXT_PUBLIC_PAYPAL_CLIENT_ID.
        </div>
      )}
      {/* Retry / Troubleshooting UI */}
      {error && (
        <div className="mt-4 text-sm">
          <div className="flex gap-2 items-center">
            <button
              onClick={() => {
                // Try reloading the SDK with a cache-busting param
                setError('');
                buttonsRenderedRef.current = false;
                setPaypalLoaded(false);
                setScriptRetryKey((k) => k + 1);
              }}
              className="px-3 py-1 bg-primary text-white rounded"
            >
              Retry
            </button>
            <button
              onClick={() => {
                // Open a short help hint
                window.open('https://stackoverflow.com/questions/44149696/paypal-button-for-react-js?rq=4', '_blank');
              }}
              className="px-3 py-1 border rounded"
            >
              Troubleshoot
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
