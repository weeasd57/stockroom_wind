'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import { useSubscription } from '@/providers/SubscriptionProvider';
import styles from './checkout.module.css';

const CheckoutPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, supabase } = useSupabase();
  const { upgradeToProSubscription, isPro } = useSubscription();
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [planType, setPlanType] = useState('monthly');
  const paypalInitialized = useRef(false);
  const [cspNonce, setCspNonce] = useState('');

  // Get plan type from URL params
  useEffect(() => {
    const plan = searchParams.get('plan');
    if (plan === 'yearly' || plan === 'monthly') {
      setPlanType(plan);
    }
  }, [searchParams]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/login?redirect=/checkout');
      return;
    }
  }, [user, router]);

  // If user is already Pro, redirect them away from checkout
  useEffect(() => {
    if (user && isPro) {
      router.push('/profile');
    }
  }, [user, isPro, router]);

  const planDetails = {
    monthly: {
      price: 7.00,
      period: 'month',
      title: 'Pro Monthly',
      description: 'Billed monthly'
    },
    yearly: {
      price: 70.00,
      period: 'year', 
      title: 'Pro Yearly',
      description: 'Billed annually (Save 38%)'
    }
  };

  const currentPlan = planDetails[planType];

  // PayPal SDK configuration
  const paypalClientId = process.env.NODE_ENV === 'production' 
    ? (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_LIVE || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID)
    : (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID);

  useEffect(() => {
    try {
      const n = typeof window !== 'undefined' && window.__CSP_NONCE__ ? String(window.__CSP_NONCE__) : '';
      setCspNonce(n);
    } catch (_) {}
  }, []);

  const initializePayPal = () => {
    if (!window.paypal || paypalInitialized.current) return;

    const container = document.getElementById('paypal-button-container');
    if (!container || container.hasChildNodes()) return;

    try {
      window.paypal.Buttons({
        createOrder: async (data, actions) => {
          try {
            return await actions.order.create({
              purchase_units: [{
                amount: {
                  currency_code: 'USD',
                  value: currentPlan.price.toString()
                },
                description: `${currentPlan.title} Subscription`
              }],
              intent: 'CAPTURE'
            });
          } catch (error) {
            console.error('Error creating PayPal order:', error);
            setError('Failed to initialize payment. Please try again.');
            throw error;
          }
        },

        onApprove: async (data, actions) => {
          try {
            setIsLoading(true);
            setError('');

            const details = await actions.order.capture();

            const unit = details?.purchase_units?.[0];
            const cap = unit?.payments?.captures?.[0] || details;
            const captureId = cap?.id;
            const amountValue = cap?.amount?.value || currentPlan.price.toFixed(2);
            const currencyCode = cap?.amount?.currency_code || 'USD';

            if (!captureId) {
              console.error('Missing captureId from PayPal response:', details);
              setError('Payment completed but missing transaction ID. Please contact support.');
              setIsLoading(false);
              return;
            }

            // Upgrade subscription using captured PayPal payment
            const upgradeResult = await upgradeToProSubscription({
              transaction_type: 'payment',
              paypal_order_id: data?.orderID,
              paypal_capture_id: captureId,
              payer_id: data?.payerID,
              amount: amountValue,
              currency: currencyCode,
              captured_at: new Date().toISOString(),
              billing_period: planType,
            });

            if (upgradeResult?.success) {
              router.push('/checkout/success?plan=' + planType);
            } else {
              console.error('Failed to upgrade subscription:', upgradeResult?.error);
              setError(upgradeResult?.error || 'Payment processed but subscription upgrade failed.');
              setIsLoading(false);
            }
          } catch (error) {
            console.error('Payment approval error:', error);
            setError('Payment processing failed. Please try again.');
            setIsLoading(false);
          }
        },

        onCancel: () => {
          setError('Payment was cancelled');
          setIsLoading(false);
        },

        onError: (err) => {
          console.error('PayPal error:', err);
          setError('Payment system error. Please try again.');
          setIsLoading(false);
        }
      }).render('#paypal-button-container').then(() => {
        paypalInitialized.current = true;
        setIsLoading(false);
      });
    } catch (error) {
      console.error('PayPal initialization error:', error);
      setError('Failed to load payment system');
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner}></div>
          <p>Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Script
        src={`https://www.paypal.com/sdk/js?client-id=${paypalClientId}&components=buttons&intent=capture&commit=true`}
        strategy="afterInteractive"
        onLoad={initializePayPal}
        nonce={cspNonce || undefined}
        data-csp-nonce={cspNonce || undefined}
      />

      <div className={styles.checkoutCard}>
        <div className={styles.header}>
          <h1>Upgrade to Pro</h1>
          <p>Complete your purchase to unlock Pro features</p>
        </div>

        <div className={styles.planDetails}>
          <div className={styles.planCard}>
            <h2>Pro Plan</h2>
            <p className={styles.planBilling}>
              Billed {planType === 'yearly' ? 'annually' : 'monthly'}
            </p>
            {planType === 'yearly' && (
              <p className={styles.planSavings}>
                Save $14/year (17% off)
              </p>
            )}
            <div className={styles.price}>
              <span className={styles.currency}>$</span>
              <span className={styles.amount}>{currentPlan.price}</span>
              <span className={styles.period}>/{currentPlan.period}</span>
            </div>
          </div>

          <div className={styles.features}>
            <h3>What's included:</h3>
            <ul>
              <li>✓ 300 price checks per month</li>
              <li>✓ 500 posts per month</li>
              <li>✓ Create premium broker plans</li>
              <li>✓ Table View with Export to Excel/CSV</li>
              <li>✓ No ads - Ad-free experience</li>
              <li>✓ Telegram notifications: subscribe to traders you follow</li>
              <li>✓ Priority support</li>
            </ul>
          </div>
        </div>

        {error && (
          <div className={styles.error}>
            <p>{error}</p>
            <button 
              onClick={() => setError('')}
              className={styles.clearError}
            >
              ✕
            </button>
          </div>
        )}

        <div className={styles.paymentSection}>
          <h3>Payment Method</h3>

          {/* Always render the PayPal container so the SDK can attach buttons */}
          <div id="paypal-button-container" className={styles.paypalContainer}></div>

          {/* Show loading state until PayPal buttons are rendered */}
          {isLoading && (
            <div className={styles.loadingSpinner}>
              <div className={styles.spinner}></div>
              <p>Processing payment...</p>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <p>Secure payment powered by PayPal</p>
          <p>Cancel anytime from your profile settings</p>
          <button
            type="button"
            onClick={() => router.push('/pricing')}
            className={styles.backLink}
          >
            ← Back to pricing
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;