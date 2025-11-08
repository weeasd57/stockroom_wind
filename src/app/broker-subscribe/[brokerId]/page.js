'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import { useSubscription } from '@/providers/SubscriptionProvider';
import styles from './BrokerSubscribe.module.css';

export default function BrokerSubscribePage() {
  const { brokerId } = useParams();
  const router = useRouter();
  const { user, isAuthenticated } = useSupabase();
  const { subscriptionInfo } = useSubscription();
  const [brokerData, setBrokerData] = useState(null);
  const [premiumPlan, setPremiumPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/broker-subscribe/${brokerId}`);
      return;
    }

    fetchBrokerData();
  }, [brokerId, isAuthenticated]);

  // Handle PayPal return
  useEffect(() => {
    const handlePayPalReturn = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const success = searchParams.get('success');
      const cancelled = searchParams.get('cancelled');
      const token = searchParams.get('token'); // PayPal order ID

      if (success === 'true' && token) {
        try {
          setSubscribing(true);
          
          // Retrieve metadata from localStorage
          let metadata = null;
          try {
            const storedMetadata = localStorage.getItem('pending_subscription_metadata');
            if (storedMetadata) {
              metadata = JSON.parse(storedMetadata);
              // Clean up localStorage
              localStorage.removeItem('pending_subscription_metadata');
            }
          } catch (e) {
            console.error('Failed to retrieve subscription metadata:', e);
          }

          if (!metadata) {
            throw new Error('Subscription metadata not found. Please try again.');
          }

          // Validate metadata
          if (!metadata.user_id || !metadata.broker_id || !metadata.plan_type) {
            console.error('[Metadata Validation Error]:', metadata);
            throw new Error('Invalid subscription metadata. Please try subscribing again.');
          }

          console.log('[Capture Request] Sending:', {
            order_id: token,
            metadata: {
              user_id: metadata.user_id,
              broker_id: metadata.broker_id,
              plan_type: metadata.plan_type,
              amount: metadata.amount
            }
          });

          // Capture the payment
          const response = await fetch('/api/broker-subscription/capture', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              order_id: token,
              metadata: metadata,
            }),
          });

          const data = await response.json();

          if (response.ok && data.success) {
            // Subscription activated, redirect to broker profile
            router.push(`/view-profile/${brokerId}?subscribed=true`);
          } else {
            // Log detailed error for debugging
            console.error('[Capture Error] Response:', {
              status: response.status,
              error: data.error,
              details: data.details,
              fullData: data
            });
            throw new Error(data.error || 'Failed to capture payment');
          }
        } catch (err) {
          console.error('Capture error:', err);
          setSubscribeError(err.message || 'Failed to complete subscription');
          setSubscribing(false);
        }
      } else if (cancelled === 'true') {
        // Clean up localStorage on cancellation
        try {
          localStorage.removeItem('pending_subscription_metadata');
        } catch (e) {
          console.error('Failed to clean up metadata:', e);
        }
        setSubscribeError('Subscription cancelled');
      }
    };

    handlePayPalReturn();
  }, [brokerId, router]);

  const fetchBrokerData = async () => {
    try {
      const { supabase } = await import('@/utils/supabase');
      
      // Fetch broker profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, bio, is_broker')
        .eq('id', brokerId)
        .single();

      if (profileError) throw profileError;
      if (!profile?.is_broker) {
        throw new Error('This user is not a broker');
      }

      setBrokerData(profile);

      // Fetch premium plan (only active plans)
      const { data: plan, error: planError } = await supabase
        .from('premium_plans')
        .select('*')
        .eq('user_id', brokerId)
        .eq('is_active', true)
        .maybeSingle();

      if (planError) throw planError;
      
      // Set plan (will be null if broker hasn't created one)
      setPremiumPlan(plan);

      // Check if user is already subscribed to this broker
      const { data: existingSubscription, error: subError } = await supabase
        .from('broker_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('broker_id', brokerId)
        .eq('status', 'active')
        .maybeSingle();

      if (subError) {
        console.error('Error checking subscription:', subError);
      } else if (existingSubscription) {
        // Check if subscription is still valid (not expired)
        const now = new Date();
        const expiresAt = existingSubscription.expires_at ? new Date(existingSubscription.expires_at) : null;
        
        if (!expiresAt || expiresAt > now) {
          setIsSubscribed(true);
          setSubscription(existingSubscription);
        }
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching broker data:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const handleSubscribe = async (planType) => {
    try {
      setSubscribing(true);
      setSubscribeError(null);

      // Create subscription order
      const response = await fetch('/api/broker-subscription/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          broker_id: brokerId,
          plan_type: planType,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create subscription');
      }

      // Store metadata in localStorage for capture API after PayPal return
      if (data.metadata) {
        try {
          localStorage.setItem('pending_subscription_metadata', JSON.stringify(data.metadata));
        } catch (e) {
          console.error('Failed to store subscription metadata:', e);
        }
      }

      // Redirect to PayPal approval page
      if (data.approval_url) {
        window.location.href = data.approval_url;
      } else {
        throw new Error('No approval URL received');
      }

    } catch (err) {
      console.error('Subscription error:', err);
      setSubscribeError(err.message || 'Failed to create subscription');
      setSubscribing(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading broker information...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => router.back()} className={styles.backButton}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
        <div className={styles.card}>
          {/* Broker Header */}
          <div className={styles.brokerHeader}>
            <div className={styles.brokerAvatar}>
              {brokerData?.avatar_url ? (
                <img src={brokerData.avatar_url} alt={brokerData.username} />
              ) : (
                <div className={styles.avatarPlaceholder}>
                  {brokerData?.username?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className={styles.brokerInfo}>
              <h1 className={styles.brokerName}>{brokerData?.username}</h1>
              <span className={styles.premiumBadge}>⭐ Premium Broker</span>
            </div>
          </div>

          {/* Bio */}
          {brokerData?.bio && (
            <div className={styles.bioSection}>
              <p>{brokerData.bio}</p>
            </div>
          )}

          {/* No Plan Available Message */}
          {!premiumPlan && (
            <div className={styles.planSection}>
              <div style={{
                padding: '3rem 2rem',
                textAlign: 'center',
                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                borderRadius: '12px',
                border: '2px solid #f59e0b'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#78350f', marginBottom: '1rem' }}>
                  Premium Plan Not Yet Available
                </h2>
                <p style={{ fontSize: '1rem', color: '#92400e', marginBottom: '2rem', lineHeight: 1.6 }}>
                  This broker hasn't set up their premium subscription plan yet.<br/>
                  Please check back later or visit their profile for updates.
                </p>
                <button 
                  onClick={() => router.push(`/view-profile/${brokerId}`)}
                  style={{
                    padding: '1rem 2rem',
                    background: '#f59e0b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Back to Broker Profile
                </button>
              </div>
            </div>
          )}

          {/* Plan Details */}
          {premiumPlan && (
          <div className={styles.planSection}>
            <h2 className={styles.sectionTitle}>Premium Plan</h2>
            
            {/* Pricing */}
            <div className={styles.pricingCards}>
              {premiumPlan?.pricing?.monthly > 0 && (
                <div className={styles.pricingCard}>
                  <div className={styles.priceAmount}>
                    ${premiumPlan.pricing.monthly}
                    <span className={styles.pricePeriod}>/month</span>
                  </div>
                  <div className={styles.priceLabel}>Monthly Plan</div>
                </div>
              )}
              
              {premiumPlan?.pricing?.yearly > 0 && (
                <div className={styles.pricingCard}>
                  <div className={styles.priceAmount}>
                    ${premiumPlan.pricing.yearly}
                    <span className={styles.pricePeriod}>/year</span>
                  </div>
                  <div className={styles.priceLabel}>Yearly Plan</div>
                  {premiumPlan.pricing.monthly > 0 && (
                    <div className={styles.savings}>
                      Save ${(premiumPlan.pricing.monthly * 12 - premiumPlan.pricing.yearly).toFixed(2)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Description */}
            {premiumPlan?.description && (
              <div className={styles.description}>
                <h3>About This Plan</h3>
                <p>{premiumPlan.description}</p>
              </div>
            )}

            {/* Features */}
            {premiumPlan?.features?.length > 0 && (
              <div className={styles.features}>
                <h3>What You'll Get</h3>
                <ul className={styles.featuresList}>
                  {premiumPlan.features.map((feature, idx) => (
                    <li key={idx}>
                      <span className={styles.checkIcon}>✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Stats */}
            {premiumPlan?.stats && (
              <div className={styles.stats}>
                <div className={styles.statItem}>
                  <div className={styles.statValue}>{premiumPlan.stats.successRate || 0}%</div>
                  <div className={styles.statLabel}>Success Rate</div>
                </div>
                <div className={styles.statItem}>
                  <div className={styles.statValue}>{premiumPlan.stats.averagePostsPerMonth || 0}</div>
                  <div className={styles.statLabel}>Avg Posts/Month</div>
                </div>
              </div>
            )}
          </div>
          )}

          {/* PayPal Payment */}
          {premiumPlan && (
          <div className={styles.paymentSection}>
            <h2 className={styles.sectionTitle}>
              {isSubscribed ? 'Your Subscription' : 'Subscribe Now'}
            </h2>
            
            {isSubscribed ? (
              <div className={styles.subscribedContainer}>
                <div className={styles.subscribedBadge}>✓ Active Subscription</div>
                <p className={styles.subscribedMessage}>
                  You are currently subscribed to this broker's premium plan.
                </p>
                <div className={styles.subscriptionDetails}>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Plan Type:</span>
                    <span className={styles.detailValue}>
                      {subscription?.plan_type === 'monthly' ? 'Monthly' : 'Yearly'}
                    </span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Started:</span>
                    <span className={styles.detailValue}>
                      {subscription?.started_at ? new Date(subscription.started_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  {subscription?.expires_at && (
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Expires:</span>
                      <span className={styles.detailValue}>
                        {new Date(subscription.expires_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
                <p className={styles.accessNote}>
                  You have full access to all premium posts from this broker.
                </p>
              </div>
            ) : (
              <div>
                <div className={styles.subscriptionOptions}>
                  {/* Monthly Plan */}
                  {premiumPlan?.pricing?.monthly > 0 && (
                    <div className={styles.subscriptionCard}>
                      <h3>Monthly Plan</h3>
                      <div className={styles.price}>
                        ${premiumPlan.pricing.monthly}
                        <span>/month</span>
                      </div>
                      <button
                        onClick={() => handleSubscribe('monthly')}
                        disabled={subscribing}
                        className={styles.subscribeButton}
                      >
                        {subscribing ? 'Processing...' : 'Subscribe Monthly'}
                      </button>
                    </div>
                  )}

                  {/* Yearly Plan */}
                  {premiumPlan?.pricing?.yearly > 0 && (
                    <div className={styles.subscriptionCard}>
                      <h3>Yearly Plan</h3>
                      <div className={styles.price}>
                        ${premiumPlan.pricing.yearly}
                        <span>/year</span>
                      </div>
                      {premiumPlan.pricing.monthly > 0 && (
                        <div className={styles.savings}>
                          Save ${(premiumPlan.pricing.monthly * 12 - premiumPlan.pricing.yearly).toFixed(2)}
                        </div>
                      )}
                      <button
                        onClick={() => handleSubscribe('yearly')}
                        disabled={subscribing}
                        className={styles.subscribeButton}
                      >
                        {subscribing ? 'Processing...' : 'Subscribe Yearly'}
                      </button>
                    </div>
                  )}
                </div>

                {subscribeError && (
                  <div className={styles.errorMessage}>
                    {subscribeError}
                  </div>
                )}
              </div>
            )}

            <button 
              onClick={() => router.push(`/view-profile/${brokerId}`)}
              className={styles.backButton}
            >
              Back to Broker Profile
            </button>
          </div>
          )}
        </div>
      </div>
  );
}
