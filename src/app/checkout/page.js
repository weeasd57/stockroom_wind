'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useSubscription } from '@/providers/SubscriptionProvider';
import Script from 'next/script';

export default function CheckoutPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useSupabase();
  const { upgradeToProSubscription, refreshSubscription, isPro } = useSubscription();
  
  // Support both Sandbox and Production modes
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID 
  const paypalPlanId = (process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID || '').trim();
  const useSubscriptionFlow = !!paypalPlanId;
  const intentParam = useSubscriptionFlow ? 'subscription' : 'capture';
  const vaultParam = useSubscriptionFlow ? '&vault=true' : '';
  
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

  // Obtain CSP nonce exposed by RootLayout to allow PayPal SDK to inject styles with the same nonce
  useEffect(() => {
    try {
      // eslint-disable-next-line no-undef
      const n = typeof window !== 'undefined' ? (window.__CSP_NONCE__ || '') : '';
      setCspNonce(n);
    } catch (_) {}
  }, []);

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
      // Capture the order
      console.log('Starting PayPal approval process...');
      const details = await actions.order.capture();
      console.log('Payment captured successfully:', details);

      // Upgrade to Pro using subscription provider
      const upgradeResult = await upgradeToProSubscription({
        paypal_order_id: details.id,
        payer_id: details.payer.payer_id,
        amount: details.purchase_units[0].amount.value,
        currency: details.purchase_units[0].amount.currency_code,
        captured_at: new Date().toISOString()
      });

      if (upgradeResult.success) {
        console.log('Subscription upgraded successfully');
        setShowSuccessDialog(true);
      } else {
        console.error('Failed to upgrade subscription:', upgradeResult.error);
        setErrorDetails(`Subscription upgrade failed: ${upgradeResult.error}`);
        setShowErrorDialog(true);
      }
      
      setLoading(false);

      // Original backend confirmation code (commented for testing)
      /*
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      console.log('Sending payment confirmation to backend...');
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
        console.error('Backend confirmation failed:', response.status, response.statusText);
        throw new Error(`Failed to confirm payment: ${response.status}`);
      }

      const result = await response.json();
      console.log('Backend confirmation successful:', result);
      
      console.log('Redirecting to profile page...');
      router.push('/profile');
      */
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
      {paypalClientId ? (
        <Script
          strategy="afterInteractive"
          src={`https://www.paypal.com/sdk/js?client-id=${encodedClientId}&currency=USD&components=buttons&intent=${intentParam}&commit=true${vaultParam}&debug=true`}
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

              // Build PayPal Buttons configuration for either Subscription or one-time Order
              const buttonsConfig = useSubscriptionFlow ? {
                // Subscription flow
                createSubscription: async (data, actions) => {
                  try {
                    console.log('Creating PayPal subscription with plan:', paypalPlanId);
                    const subscriptionId = await actions.subscription.create({
                      plan_id: paypalPlanId
                    });
                    console.log('PayPal subscription created successfully:', subscriptionId);
                    return subscriptionId;
                  } catch (error) {
                    console.error('PayPal subscription creation failed:', error);
                    throw error;
                  }
                },
                onApprove: async (data, actions) => {
                  console.log('Starting PayPal subscription approval process...', data);
                  setErrorAndSuppressRedirect('');
                  setLoading(true);

                  try {
                    // Verify subscription on server
                    const response = await fetch('/api/paypal/verify-subscription', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ subscriptionId: data.subscriptionID })
                    });

                    const result = await response.json();
                    if (response.ok && result.success) {
                      console.log('PayPal subscription verification successful:', result);

                      if (result.status === 'ACTIVE' || result.status === 'APPROVAL_PENDING') {
                        // Treat ACTIVE as success; APPROVAL_PENDING may require short delay, but proceed optimistically
                        await upgradeToProSubscription({
                          paypal_order_id: result.id, // store subscription id
                          transaction_type: 'subscription',
                          amount: 7.00,
                          currency: 'USD',
                          paypal_subscription_id: result.id,
                          plan_id: result.plan_id,
                          status: result.status,
                          verified_at: new Date().toISOString()
                        });
                        await refreshSubscription();
                        router.push('/dashboard?payment=success');
                        return;
                      }

                      // Not active
                      setLoading(false);
                      setErrorDetails(`Subscription status is ${result.status}. Please contact support or try again.`);
                      setShowErrorDialog(true);
                      return;
                    }

                    // Server returned an error with details
                    const issue = result?.details?.[0]?.issue;
                    if (result?.name === 'UNPROCESSABLE_ENTITY' && issue === 'COMPLIANCE_VIOLATION') {
                      setLoading(false);
                      setErrorDetails(result?.details?.[0]?.description || 'Payment blocked by PayPal compliance. Please try a different PayPal account or funding method.');
                      setShowErrorDialog(true);
                      return;
                    }

                    throw new Error(result?.message || 'Failed to verify subscription');
                  } catch (error) {
                    console.error('PayPal subscription onApprove failed:', error);
                    setLoading(false);
                    setErrorAndSuppressRedirect('Subscription processing failed. Please try again or contact support.');
                  }
                },
                onError: handlePayPalError,
                onCancel: handlePayPalCancel,
                style: {
                  layout: 'vertical',
                  color: 'blue',
                  shape: 'rect',
                  label: 'paypal',
                },
              } : {
                // One-time order flow (existing)
                createOrder: async (data, actions) => {
                  try {
                    const orderData = {
                      intent: 'CAPTURE',
                      purchase_units: [
                        {
                          custom_id: user?.id?.toString() || 'guest',
                          amount: {
                            currency_code: 'USD',
                            value: '7.00'
                          },
                          description: 'SharksZone Pro Plan - Monthly Subscription'
                        }
                      ],
                      application_context: {
                        brand_name: 'SharksZone',
                        landing_page: 'NO_PREFERENCE',
                        user_action: 'PAY_NOW',
                        shipping_preference: 'NO_SHIPPING',
                        return_url: window.location.origin + '/dashboard?payment=success',
                        cancel_url: window.location.origin + '/checkout?cancelled=true'
                      }
                    };

                    console.log('Creating PayPal order with:', orderData);
                    const order = await actions.order.create(orderData);
                    console.log('PayPal order created successfully:', order);
                    return order;
                  } catch (error) {
                    console.error('PayPal order creation failed:', error);
                    throw error;
                  }
                },
                onApprove: async (data, actions) => {
                  console.log('Starting PayPal approval process...', data);
                  setErrorAndSuppressRedirect('');
                  setLoading(true);
                  
                  try {
                    // Try server-side capture first, fallback to client-side if server error
                    try {
                      const response = await fetch('/api/paypal/capture-order', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          orderId: data.orderID
                        }),
                      });

                      if (response.ok) {
                        const result = await response.json();
                        if (result.success) {
                          console.log('PayPal server-side capture successful:', result);
                          
                          // Update user subscription in database with capture details
                          await upgradeToProSubscription({
                            transaction_type: 'payment',
                            paypal_order_id: result?.captureData?.id || data.orderID,
                            paypal_capture_id: result?.captureId || result?.captureData?.purchase_units?.[0]?.payments?.captures?.[0]?.id,
                            amount: result?.amount?.value || result?.captureData?.purchase_units?.[0]?.amount?.value || '7.00',
                            currency: result?.amount?.currency_code || result?.captureData?.purchase_units?.[0]?.amount?.currency_code || 'USD',
                            captured_at: new Date().toISOString(),
                          });
                          await refreshSubscription();
                          
                          // Redirect to success page
                          router.push('/dashboard?payment=success');
                          return;
                        }
                      } else {
                        // Log and handle structured server error to decide whether to restart
                        let serverErr = null;
                        try { serverErr = await response.json(); } catch (_) {}
                        console.warn('Server-side capture failed:', { status: response.status, error: serverErr });

                        const issue = serverErr?.details?.[0]?.issue;
                        const name = serverErr?.name;

                        // If PayPal signals a compliance block, do not retry client capture. Show clear message.
                        if (name === 'UNPROCESSABLE_ENTITY' && issue === 'COMPLIANCE_VIOLATION') {
                          setLoading(false);
                          setErrorDetails(
                            serverErr?.details?.[0]?.description ||
                            'Payment blocked by PayPal compliance. Please try a different PayPal account or funding method.'
                          );
                          setShowErrorDialog(true);
                          return;
                        }

                        // If instrument declined or additional payer action (3DS) is required, restart the flow
                        if ((name === 'UNPROCESSABLE_ENTITY' && (issue === 'INSTRUMENT_DECLINED' || issue === 'PAYER_ACTION_REQUIRED')) || issue === 'INSTRUMENT_DECLINED' || issue === 'PAYER_ACTION_REQUIRED') {
                          console.warn('Restarting PayPal flow due to:', issue || name);
                          try {
                            await actions.restart();
                            return; // let SDK restart the approval flow
                          } catch (restartErr) {
                            console.warn('Failed to restart PayPal flow:', restartErr);
                          }
                        }

                        // If server indicates order already captured, treat as success
                        if (issue === 'ORDER_ALREADY_CAPTURED' || issue === 'ORDER_ALREADY_COMPLETED') {
                          console.log('Order already captured according to server. Completing checkout...');
                          await upgradeToProSubscription({
                            transaction_type: 'payment',
                            paypal_order_id: data.orderID,
                            paypal_capture_id: serverErr?.details?.[0]?.capture_id || undefined,
                            amount: '7.00',
                            currency: 'USD',
                            captured_at: new Date().toISOString(),
                          });
                          await refreshSubscription();
                          router.push('/dashboard?payment=success');
                          return;
                        }
                      }
                    } catch (serverError) {
                      console.warn('Server-side capture failed, trying client-side:', serverError);
                    }

                    // Fallback to client-side capture
                    console.log('Attempting client-side capture for order:', data.orderID);
                    
                    // First get order details to check status
                    try {
                      const orderDetails = await actions.order.get();
                      console.log('Order details before capture:', orderDetails);
                      
                      if (orderDetails.status === 'COMPLETED') {
                        console.log('Order already captured, updating subscription...');
                        await upgradeToProSubscription({
                          transaction_type: 'payment',
                          paypal_order_id: data.orderID,
                          paypal_capture_id: orderDetails?.purchase_units?.[0]?.payments?.captures?.[0]?.id,
                          amount: orderDetails?.purchase_units?.[0]?.amount?.value || '7.00',
                          currency: orderDetails?.purchase_units?.[0]?.amount?.currency_code || 'USD',
                          captured_at: new Date().toISOString(),
                        });
                        await refreshSubscription();
                        router.push('/dashboard?payment=success');
                        return;
                      }
                      
                      if (orderDetails.status !== 'APPROVED') {
                        throw new Error(`Order status is ${orderDetails.status}, cannot capture`);
                      }
                    } catch (statusError) {
                      console.warn('Could not get order status:', statusError);
                    }
                    
                    const order = await actions.order.capture();
                    console.log('PayPal client-side capture successful:', order);
                    
                    // Update user subscription in database with captured order data
                    await upgradeToProSubscription({
                      transaction_type: 'payment',
                      paypal_order_id: order?.id || data.orderID,
                      paypal_capture_id: order?.purchase_units?.[0]?.payments?.captures?.[0]?.id,
                      amount: order?.purchase_units?.[0]?.amount?.value || '7.00',
                      currency: order?.purchase_units?.[0]?.amount?.currency_code || 'USD',
                      captured_at: new Date().toISOString(),
                    });
                    await refreshSubscription();
                    
                    // Redirect to success page
                    router.push('/dashboard?payment=success');
                    
                  } catch (error) {
                    console.error('PayPal capture failed:', error);
                    console.error('PayPal error details:', {
                      name: error?.name,
                      message: error?.message,
                      details: error?.details,
                      httpStatusCode: error?.httpStatusCode,
                      stack: error?.stack
                    });

                    // On client-side capture errors, handle restart cases as recommended by PayPal
                    try {
                      const issue = error?.details?.[0]?.issue;
                      if (error?.name === 'UNPROCESSABLE_ENTITY' && issue === 'COMPLIANCE_VIOLATION') {
                        setLoading(false);
                        setErrorDetails(
                          error?.details?.[0]?.description ||
                          'Payment blocked by PayPal compliance. Please try a different PayPal account or funding method.'
                        );
                        setShowErrorDialog(true);
                        return;
                      }
                      if (issue === 'INSTRUMENT_DECLINED' || issue === 'PAYER_ACTION_REQUIRED' || error?.name === 'UNPROCESSABLE_ENTITY') {
                        console.warn('Client-side capture requires restart due to:', issue || error?.name);
                        await actions.restart();
                        return;
                      }
                    } catch (_) {}
                    setLoading(false);
                    
                    // Handle specific PayPal errors
                    if (error?.details?.[0]?.issue === 'INSTRUMENT_DECLINED' || 
                        error?.name === 'UNPROCESSABLE_ENTITY' ||
                        error?.httpStatusCode === 422) {
                      setErrorAndSuppressRedirect(`Payment method declined. Please try a different payment method. (${error?.details?.[0]?.issue || error?.name || '422'})`);
                    } else if (error?.name === 'RESOURCE_NOT_FOUND') {
                      setErrorAndSuppressRedirect('Payment session expired. Please refresh the page and try again.');
                    } else {
                      setErrorAndSuppressRedirect('Payment processing failed. Please try again or contact support.');
                    }
                  }
                },
                onError: handlePayPalError,
                onCancel: handlePayPalCancel,
                style: {
                  layout: 'vertical',
                  color: 'blue',
                  shape: 'rect',
                  label: 'paypal',
                },
              };
              const buttons = window.paypal.Buttons(buttonsConfig);
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
