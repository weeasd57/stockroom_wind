'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import { useSubscription } from '@/providers/SubscriptionProvider';
import Script from 'next/script';

export default function CheckoutPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useSupabase();
  const { upgradeToProSubscription, refreshSubscription, isPro } = useSubscription();
  
  // Support both Sandbox and Production modes for the SDK Client ID
  const paypalMode = ((process.env.NEXT_PUBLIC_PAYPAL_MODE || process.env.PAYPAL_MODE || 'sandbox').toLowerCase() === 'live') ? 'live' : 'sandbox';
  const paypalClientId = paypalMode === 'live'
    ? (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_LIVE || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID)
    : (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID);

  // Normalize and encode client id to avoid accidental whitespace/encoding issues
  const encodedClientId = encodeURIComponent((paypalClientId || '').trim());
  const buttonsRenderedRef = useRef(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const [scriptRetryKey, setScriptRetryKey] = useState(0);
  const [cspNonce, setCspNonce] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorDetails, setErrorDetails] = useState('');
  // URL-driven params to avoid touching env
  const [orderCurrency, setOrderCurrency] = useState('USD');
  const [orderAmount, setOrderAmount] = useState('7.00');
  const [fundingParam, setFundingParam] = useState('');
  const [intentParam, setIntentParam] = useState('authorize');
  // Prevent rendering SDK before URL params are parsed
  const [sdkReady, setSdkReady] = useState(false);

  // Obtain CSP nonce exposed by RootLayout to allow PayPal SDK to inject styles with the same nonce
  useEffect(() => {
    try {
      // eslint-disable-next-line no-undef
      const n = typeof window !== 'undefined' ? (window.__CSP_NONCE__ || '') : '';
      setCspNonce(n);
    } catch (_) {}
  }, []);

  // Initial parse of query params BEFORE rendering the SDK to avoid loading SDK twice (prevents 'zoid destroyed' spam)
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const url = new URL(window.location.href);
      const c = (url.searchParams.get('currency') || '').trim().toUpperCase();
      const a = (url.searchParams.get('amount') || '').trim();
      const f = (url.searchParams.get('funding') || '').trim().toLowerCase();
      const i = (url.searchParams.get('intent') || '').trim().toLowerCase();
      if (c) setOrderCurrency(c);
      if (a) setOrderAmount(a);
      if (f) setFundingParam(f);
      if (i && (i === 'authorize' || i === 'capture')) setIntentParam(i);
    } catch (_) {}
    // Mark SDK ready to render after parsing
    setSdkReady(true);
  }, []);

  // Read query params for currency/amount/funding/intent when we explicitly want to reload SDK (rare)
  useEffect(() => {
    if (!sdkReady) return; // don't trigger during initial parse
    try {
      if (typeof window === 'undefined') return;
      const url = new URL(window.location.href);
      const c = (url.searchParams.get('currency') || '').trim().toUpperCase();
      const a = (url.searchParams.get('amount') || '').trim();
      const f = (url.searchParams.get('funding') || '').trim().toLowerCase();
      const i = (url.searchParams.get('intent') || '').trim().toLowerCase();
      let changed = false;
      if (c && c !== orderCurrency) { setOrderCurrency(c); changed = true; }
      if (a && a !== orderAmount) { setOrderAmount(a); changed = true; }
      if (f && f !== fundingParam) { setFundingParam(f); changed = true; }
      if (i && (i === 'authorize' || i === 'capture') && i !== intentParam) { setIntentParam(i); changed = true; }
      if (changed) {
        // Force SDK script to reload with new currency param
        setScriptRetryKey((k) => k + 1);
      }
    } catch (_) {}
  }, [scriptRetryKey]);

  // Helper to set error and suppress global auth redirects temporarily so user stays on page
  const setErrorAndSuppressRedirect = (msg) => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('suppressAuthRedirect', '1');
      }
    } catch (e) {}
    setError(msg);
  };

  useEffect(() => {
    // Clear any stale post-auth redirect so we don't get redirected away
    try {
      if (typeof window !== 'undefined') localStorage.removeItem('postAuthRedirect');
    } catch (e) {}

    // Don't redirect while auth is still loading
    if (authLoading) {
      console.log('Auth still loading, waiting...');
      return;
    }

    if (!isAuthenticated) {
      // If not authenticated, send user to login and request returning to checkout
      console.log('User not authenticated, redirecting to login');
      try { if (typeof window !== 'undefined') localStorage.setItem('postAuthRedirect', '/checkout'); } catch (e) {}
      router.push('/login?redirect=/checkout');
      return;
    }

    console.log('User authenticated, checkout page ready');
    
    // Check if user is already Pro
    if (isPro) {
      console.log('User already has Pro subscription, redirecting to profile');
      router.push('/profile');
      return;
    }
  }, [user, authLoading, router, isPro]);


  const handlePayPalApprove = async (data, actions) => {
    setLoading(true);
    setError('');

    try {
      console.log('Starting PayPal approval process...');

      // If the SDK was initialized with intent=authorize, call our backend to authorize, then capture
      if (actions?.order?.authorize) {
        // 1) Server-side authorize
        const authResp = await fetch('/api/paypal/authorize-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: data?.orderID }),
        });
        const authResult = await authResp.json();

        if (!authResp.ok || !authResult?.success) {
          const issue = authResult?.details?.[0]?.issue;
          const message = authResult?.message || 'Order authorization failed';
          const dbg = authResult?.debug_id;
          console.error('Order authorization failed:', authResult);
          setErrorDetails(issue ? `${message} (${issue})${dbg ? ` [debug_id: ${dbg}]` : ''}` : `${message}${dbg ? ` [debug_id: ${dbg}]` : ''}`);
          setShowErrorDialog(true);
          setLoading(false);
          return;
        }

        const authorizationId = authResult?.authorizationId
          || authResult?.authData?.purchase_units?.[0]?.payments?.authorizations?.[0]?.id;
        if (!authorizationId) {
          console.error('Missing authorizationId from server authorize response:', authResult);
          setErrorDetails('Missing authorizationId from authorize response');
          setShowErrorDialog(true);
          setLoading(false);
          return;
        }

        // 2) Server-side capture
        const capResp = await fetch('/api/paypal/capture-authorization', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authorizationId }),
        });
        const capResult = await capResp.json();

        if (!capResp.ok || !capResult?.success) {
          const issue = capResult?.details?.[0]?.issue;
          const message = capResult?.message || 'Authorization capture failed';
          console.error('Authorization capture failed:', capResult);
          setErrorDetails(issue ? `${message} (${issue})` : message);
          setShowErrorDialog(true);
          setLoading(false);
          return;
        }

        const captureData = capResult.captureData || {};
        const captureId = capResult.captureId || captureData?.id || captureData?.purchase_units?.[0]?.payments?.captures?.[0]?.id;
        const amountValue = captureData?.amount?.value || captureData?.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || orderAmount || '7.00';
        const currencyCode = captureData?.amount?.currency_code || captureData?.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.currency_code || orderCurrency || 'USD';

        // 3) Upgrade to Pro
        console.log('Attempting to upgrade subscription with captureId:', captureId);
        
        // Prevent multiple calls
        if (window.__upgrading_subscription) {
          console.warn('Already upgrading subscription, skipping duplicate call');
          setLoading(false);
          return;
        }
        window.__upgrading_subscription = true;
        
        try {
          const upgradeResult = await upgradeToProSubscription({
            transaction_type: 'payment',
            paypal_order_id: data?.orderID,
            paypal_capture_id: captureId,
            payer_id: data?.payerID,
            amount: amountValue,
            currency: currencyCode,
            captured_at: new Date().toISOString(),
          });

          console.log('Upgrade result:', upgradeResult);

          if (upgradeResult?.success) {
            console.log('Subscription upgraded successfully');
            setShowSuccessDialog(true);
            // Clear the flag after success
            window.__upgrading_subscription = false;
          } else {
            console.error('Failed to upgrade subscription:', upgradeResult?.error);
            setErrorDetails(`Subscription upgrade failed: ${upgradeResult?.error || 'Unknown error'}`);
            setShowErrorDialog(true);
            // Clear the flag on error
            window.__upgrading_subscription = false;
          }
        } catch (err) {
          console.error('Exception during upgrade:', err);
          setErrorDetails(`Subscription upgrade error: ${err.message || 'Unknown error'}`);
          setShowErrorDialog(true);
          // Clear the flag on exception
          window.__upgrading_subscription = false;
        }
        
        setLoading(false);

      } else {
        // CAPTURE intent: do server-side capture for consistency and compliance
        const srvResp = await fetch('/api/paypal/capture-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: data?.orderID }),
        });
        const srvResult = await srvResp.json();

        if (!srvResp.ok || !srvResult?.success) {
          const issue = srvResult?.details?.[0]?.issue;
          const message = srvResult?.message || 'Order capture failed';
          const dbg = srvResult?.debug_id;
          console.error('Order capture failed:', srvResult);
          setErrorDetails(issue ? `${message} (${issue})${dbg ? ` [debug_id: ${dbg}]` : ''}` : `${message}${dbg ? ` [debug_id: ${dbg}]` : ''}`);
          setShowErrorDialog(true);
          setLoading(false);
          return;
        }

        const captureData = srvResult.captureData || {};
        const unit = captureData?.purchase_units?.[0];
        const cap = unit?.payments?.captures?.[0] || captureData;
        const captureId = cap?.id;
        const amountValue = cap?.amount?.value || orderAmount || '7.00';
        const currencyCode = cap?.amount?.currency_code || orderCurrency || 'USD';

        console.log('CAPTURE flow: Attempting to upgrade subscription with captureId:', captureId);
        
        // Prevent multiple calls
        if (window.__upgrading_subscription) {
          console.warn('Already upgrading subscription, skipping duplicate call');
          setLoading(false);
          return;
        }
        window.__upgrading_subscription = true;
        
        try {
          const upgradeResult = await upgradeToProSubscription({
            transaction_type: 'payment',
            paypal_order_id: data?.orderID,
            paypal_capture_id: captureId,
            payer_id: data?.payerID,
            amount: amountValue,
            currency: currencyCode,
            captured_at: new Date().toISOString(),
          });

          console.log('Upgrade result:', upgradeResult);

          if (upgradeResult?.success) {
            console.log('Subscription upgraded successfully');
            setShowSuccessDialog(true);
            // Clear the flag after success
            window.__upgrading_subscription = false;
          } else {
            console.error('Failed to upgrade subscription:', upgradeResult?.error);
            setErrorDetails(`Subscription upgrade failed: ${upgradeResult?.error || 'Unknown error'}`);
            setShowErrorDialog(true);
            // Clear the flag on error
            window.__upgrading_subscription = false;
          }
        } catch (err) {
          console.error('Exception during upgrade:', err);
          setErrorDetails(`Subscription upgrade error: ${err.message || 'Unknown error'}`);
          setShowErrorDialog(true);
          // Clear the flag on exception
          window.__upgrading_subscription = false;
        }
        
        setLoading(false);
      }
    } catch (error) {
      console.error('Payment approval error:', error);
      setErrorAndSuppressRedirect(`Payment failed: ${error.message}`);
      setLoading(false);
    }
  };

  const handlePayPalError = (err) => {
    console.error('PayPal error:', err);
    
    // Handle specific PayPal errors
    let errorMessage = 'Payment error occurred. Please try again.';
    
    if (err.message && err.message.includes('CANNOT_PAY_SELF')) {
      errorMessage = 'Cannot process payment: You cannot pay to your own PayPal account. Please use a different PayPal account or payment method.';
    } else if (err.message && err.message.includes('INSTRUMENT_DECLINED')) {
      errorMessage = 'Your payment method was declined. Please try a different card or payment method.';
    } else if (err.message && err.message.includes('PAYER_ACCOUNT_RESTRICTED')) {
      errorMessage = 'Your PayPal account has restrictions. Please contact PayPal support or try a different payment method.';
    }
    
    setErrorDetails(errorMessage);
    setShowErrorDialog(true);
    setLoading(false);
  };

  const handlePayPalCancel = () => {
    console.log('Payment cancelled by user');
    setShowCancelDialog(true);
    setLoading(false);
  };

  const handleRetryPayment = () => {
    setShowCancelDialog(false);
    setError('');
    // Refresh PayPal buttons
    buttonsRenderedRef.current = false;
    setPaypalLoaded(false);
    setScriptRetryKey((k) => k + 1);
  };

  const handleGoBack = () => {
    setShowCancelDialog(false);
    router.push('/pricing');
  };

  const handleSuccessDialogClose = () => {
    setShowSuccessDialog(false);
    router.push('/profile');
  };

  const handleErrorDialogClose = () => {
    setShowErrorDialog(false);
    setErrorDetails('');
  };

  const handleErrorRetry = () => {
    setShowErrorDialog(false);
    setErrorDetails('');
    // Refresh PayPal buttons
    buttonsRenderedRef.current = false;
    setPaypalLoaded(false);
    setScriptRetryKey((k) => k + 1);
  };

  // Convenience: update current URL query params to retry with different options
  const updateUrlParamsAndReload = (overrides = {}) => {
    try {
      if (typeof window === 'undefined') return;
      const url = new URL(window.location.href);
      Object.entries(overrides).forEach(([key, val]) => {
        if (val === null || typeof val === 'undefined') url.searchParams.delete(key);
        else url.searchParams.set(key, String(val));
      });
      setShowErrorDialog(false);
      // navigate then force SDK reload
      router.push(url.pathname + url.search);
      buttonsRenderedRef.current = false;
      setPaypalLoaded(false);
      setScriptRetryKey((k) => k + 1);
    } catch (e) {
      console.warn('Failed to update URL params:', e);
    }
  };

  const handleTryWalletOnly = () => {
    updateUrlParamsAndReload({ funding: 'paypal' });
  };

  const handleSwitchToUSD = () => {
    updateUrlParamsAndReload({ currency: 'USD' });
  };

  // Build PayPal SDK URL dynamically with optional funding constraints
  const buildSdkSrc = () => {
    try {
      const params = new URLSearchParams();
      params.set('client-id', encodedClientId);
      params.set('currency', orderCurrency);
      params.set('components', 'buttons');
      params.set('intent', intentParam);
      params.set('commit', 'false');
      params.set('debug', 'true');
      if (fundingParam === 'paypal') {
        params.set('enable-funding', 'paypal');
        params.set('disable-funding', 'card,venmo,credit,paylater');
      }
      return `https://www.paypal.com/sdk/js?${params.toString()}`;
    } catch (_) {
      return `https://www.paypal.com/sdk/js?client-id=${encodedClientId}&currency=${orderCurrency}&components=buttons&intent=${intentParam}&commit=false&debug=true`;
    }
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
              <p className="text-2xl font-bold">$7.00</p>
              <p className="text-sm text-muted-foreground">/month</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">What's included:</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                300 price checks per month
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                500 posts per month
              </li>
             
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                Priority support
              </li>
              
            </ul>
          </div>
        </div>


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
      {paypalClientId && sdkReady ? (
        <Script
          strategy="afterInteractive"
          src={buildSdkSrc()}
          // Provide nonce attributes so SDK can tag injected <style> with the same nonce
          nonce={cspNonce}
          data-csp-nonce={cspNonce}
          onError={(e) => {
            console.error('[PayPal SDK] Script load error:', e?.message || e);
            // This often indicates a network block from adblock/privacy extensions
            setErrorAndSuppressRedirect('Failed to load PayPal SDK. Please disable adblocker or privacy extensions and retry.');
          }}
          onLoad={() => {
            try {
              const container = document.getElementById('paypal-button-container');
              setPaypalLoaded(true);
              if (!window?.paypal || !container) {
                setErrorAndSuppressRedirect('PayPal SDK loaded but `window.paypal` is not available. This can happen when requests are blocked by browser extensions. Please disable blockers and retry.');
                return;
              }
              // Prevent duplicate renders during Fast Refresh / StrictMode double-invoke
              if (buttonsRenderedRef.current || container.hasChildNodes()) {
                return;
              }

              const buttonsConfig = {
                createOrder: (data, actions) => {
                  return actions.order.create({
                    purchase_units: [
                      {
                        amount: {
                          value: orderAmount || '7.00',
                          currency_code: orderCurrency || 'USD',
                        },
                        description: 'SharksZone Pro Plan - Monthly Subscription',
                      },
                    ],
                    application_context: {
                      brand_name: 'SharksZone',
                      landing_page: 'NO_PREFERENCE',
                      user_action: 'PAY_NOW',
                      shipping_preference: 'NO_SHIPPING',
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
              };
              // Optional: force wallet if funding=paypal specified
              const forceWallet = fundingParam === 'paypal';
              const fundingSource = forceWallet ? (window?.paypal?.FUNDING?.PAYPAL || undefined) : undefined;
              let buttons = fundingSource
                ? window.paypal.Buttons({ fundingSource, ...buttonsConfig })
                : window.paypal.Buttons(buttonsConfig);
              // If the selected funding source is not eligible, fall back to default
              if (buttons && typeof buttons.isEligible === 'function' && !buttons.isEligible()) {
                console.warn('[PayPal] Selected fundingSource not eligible, falling back to default Buttons');
                buttons = window.paypal.Buttons(buttonsConfig);
                if (buttons && typeof buttons.isEligible === 'function' && !buttons.isEligible()) {
                  console.error('[PayPal] Buttons not eligible for current configuration');
                  setErrorAndSuppressRedirect('PayPal is not eligible for this configuration. Try switching currency to USD or disable wallet-only.');
                  return;
                }
              }
              buttons.render(container);
              buttonsRenderedRef.current = true;
            } catch (e) {
              console.error('PayPal init error:', e);
              setErrorAndSuppressRedirect('Failed to initialize PayPal. Please refresh the page.');
            }
          }}
          key={scriptRetryKey}
        />
      ) : (
        <div className="mt-4 text-sm text-destructive bg-destructive/10 p-3 rounded">
          PayPal client ID is missing. Please set NEXT_PUBLIC_PAYPAL_CLIENT_ID.
        </div>
      )}

      {/* Cancel Payment Dialog - Modern & Responsive */}
      {showCancelDialog && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowCancelDialog(false)}
        >
          <div 
            className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with warning icon */}
            <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 text-white relative">
              {/* Close button */}
              <button
                onClick={() => setShowCancelDialog(false)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                aria-label="Close dialog"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-white/20 rounded-full">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-center">Payment Cancelled</h3>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="text-center">
                <p className="text-gray-600 dark:text-gray-300 mb-2">
                  Your payment was cancelled. You can try again or return to our pricing page.
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No charges were made to your account.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-4">
                <button
                  onClick={handleRetryPayment}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-blue-500/50"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Try Payment Again</span>
                  </div>
                </button>

                <button
                  onClick={handleGoBack}
                  className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-gray-500/50"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span>Back to Pricing</span>
                  </div>
                </button>
              </div>

              {/* Help text */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                  Need help? Contact our support team for assistance with your upgrade.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Payment Dialog */}
      {showSuccessDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Success Header */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-6 text-white">
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-white/20 rounded-full">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-center">Payment Successful!</h3>
            </div>

            {/* Success Content */}
            <div className="p-6 space-y-4">
              <div className="text-center">
                <p className="text-gray-600 dark:text-gray-300 mb-2">
                  Your Pro subscription is now active! Welcome to the Pro tier.
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  You now have access to all Pro features and benefits.
                </p>
              </div>

              {/* Success Actions */}
              <div className="space-y-3 pt-4">
                <button
                  onClick={handleSuccessDialogClose}
                  className="w-full py-3 px-4 bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-green-500/50"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>Go to My Profile</span>
                  </div>
                </button>
              </div>

              {/* Success Help text */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                  🎉 Your Pro badge is now visible on your profile!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Payment Dialog */}
      {showErrorDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Error Header */}
            <div className="bg-gradient-to-r from-red-500 to-red-600 p-6 text-white relative">
              {/* Close button */}
              <button
                onClick={handleErrorDialogClose}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                aria-label="Close dialog"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-white/20 rounded-full">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-center">Payment Failed</h3>
            </div>

            {/* Error Content */}
            <div className="p-6 space-y-4">
              <div className="text-center">
                <p className="text-gray-600 dark:text-gray-300 mb-2">
                  {errorDetails || 'There was an issue processing your payment.'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No charges were made to your account.
                </p>
              </div>

              {/* Error Actions */}
              <div className="space-y-3 pt-4">
                <button
                  onClick={handleErrorRetry}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-blue-500/50"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Try Again</span>
                  </div>
                </button>

                <button
                  onClick={handleGoBack}
                  className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-gray-500/50"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span>Back to Pricing</span>
                  </div>
                </button>
              </div>

              {/* Error Help text */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                  Need help? Contact our support team if this problem persists.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}