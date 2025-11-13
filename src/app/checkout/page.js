'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import styles from './checkout.module.css';

const CheckoutPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useSupabase();
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [planType, setPlanType] = useState('monthly');
  const paypalInitialized = useRef(false);

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
    ? process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_LIVE
    : (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID);

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
            const details = await actions.order.capture();
            
            // Call your existing checkout/confirm API
            const response = await fetch('/api/checkout/confirm', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                orderId: data.orderID,
                captureId: details.id,
                amount: currentPlan.price,
                billingPeriod: planType
              })
            });

            const result = await response.json();

            if (response.ok && result.success) {
              router.push('/checkout/success?plan=' + planType);
            } else {
              setError(result.error || 'Payment processing failed');
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
      />

      <div className={styles.checkoutCard}>
        <div className={styles.header}>
          <h1>Upgrade to Pro</h1>
          <p>Unlock premium features and unlimited access</p>
        </div>

        <div className={styles.planDetails}>
          <div className={styles.planCard}>
            <h2>{currentPlan.title}</h2>
            <div className={styles.price}>
              <span className={styles.currency}>$</span>
              <span className={styles.amount}>{currentPlan.price}</span>
              <span className={styles.period}>/{currentPlan.period}</span>
            </div>
            <p className={styles.description}>{currentPlan.description}</p>
          </div>

          <div className={styles.features}>
            <h3>What's included:</h3>
            <ul>
              <li>✓ Unlimited post creation</li>
              <li>✓ Advanced price checking</li>
              <li>✓ Premium analytics</li>
              <li>✓ Priority support</li>
              <li>✓ Export capabilities</li>
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
          <h3>Complete your purchase</h3>
          
          {isLoading ? (
            <div className={styles.loadingSpinner}>
              <div className={styles.spinner}></div>
              <p>Loading payment options...</p>
            </div>
          ) : (
            <div id="paypal-button-container" className={styles.paypalContainer}></div>
          )}
        </div>

        <div className={styles.planToggle}>
          <p>Want to switch plans?</p>
          <div className={styles.toggleButtons}>
            <button
              className={`${styles.toggleBtn} ${planType === 'monthly' ? styles.active : ''}`}
              onClick={() => setPlanType('monthly')}
            >
              Monthly
            </button>
            <button
              className={`${styles.toggleBtn} ${planType === 'yearly' ? styles.active : ''}`}
              onClick={() => setPlanType('yearly')}
            >
              Yearly (Save 33%)
            </button>
          </div>
        </div>

        <div className={styles.footer}>
          <p>Secure payment powered by PayPal</p>
          <p>Cancel anytime from your profile settings</p>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;