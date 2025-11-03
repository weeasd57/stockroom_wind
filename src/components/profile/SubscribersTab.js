'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import { useRouter } from 'next/navigation';
import styles from '@/styles/profile.module.css';
import Image from 'next/image';

export default function SubscribersTab({ userId, isPro, subscription }) {
  const { supabase } = useSupabase();
  const router = useRouter();
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'premium', 'free'
  const [stats, setStats] = useState({
    total: 0,
    premium: 0,
    free: 0
  });

  useEffect(() => {
    if (isPro && userId) {
      fetchSubscribers();
    } else {
      setLoading(false);
    }
  }, [isPro, userId, filter]);

  const fetchSubscribers = async () => {
    setLoading(true);
    try {
      // Fetch telegram subscribers with subscription info
      let query = supabase
        .from('telegram_subscribers_with_subscription')
        .select('*')
        .eq('is_subscribed', true);

      // Apply filter
      if (filter === 'premium') {
        query = query.eq('subscription_tier', 'premium');
      } else if (filter === 'free') {
        query = query.eq('subscription_tier', 'free');
      }

      const { data, error } = await query.order('subscribed_at', { ascending: false });

      if (error) throw error;

      setSubscribers(data || []);

      // Calculate stats
      const premiumCount = (data || []).filter(s => s.subscription_tier === 'premium').length;
      const freeCount = (data || []).filter(s => s.subscription_tier === 'free').length;
      
      setStats({
        total: (data || []).length,
        premium: premiumCount,
        free: freeCount
      });
    } catch (error) {
      console.error('Error fetching subscribers:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Free User View - Upgrade Prompt
  if (!isPro) {
    return (
      <div className={styles.upgradePrompt} style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 2rem',
        textAlign: 'center',
        minHeight: '400px',
        borderRadius: '16px',
        margin: '2rem 0'
      }}>
        <div style={{
          fontSize: '64px',
          marginBottom: '1.5rem',
          filter: 'grayscale(0.3)',
          animation: 'bounce 2s infinite'
        }}>
          ⭐
        </div>
        
        <h2 style={{
          fontSize: '28px',
          fontWeight: 700,
          color: 'hsl(var(--foreground))',
          marginBottom: '1rem',
          lineHeight: 1.3
        }}>
          Premium Feature - Subscribers Management
        </h2>
        
        <p style={{
          fontSize: '16px',
          color: 'hsl(var(--muted-foreground))',
          maxWidth: '600px',
          marginBottom: '2rem',
          lineHeight: 1.6
        }}>
          Unlock the power to manage your Telegram bot subscribers! 
          Track who's following your trading signals, see subscription tiers, 
          and send targeted notifications to your premium members.
        </p>

        <div style={{
          background: 'hsl(var(--card))',
          padding: '2rem',
          borderRadius: '12px',
          marginBottom: '2rem',
          boxShadow: '0 4px 12px hsl(var(--border) / 0.3)',
          maxWidth: '500px',
          width: '100%'
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: 600,
            marginBottom: '1rem',
            color: 'hsl(var(--foreground))'
          }}>
            ✨ What You'll Get:
          </h3>
          <ul style={{
            textAlign: 'left',
            listStyle: 'none',
            padding: 0,
            margin: 0
          }}>
            {[
              '📊 View all your Telegram subscribers',
              '⭐ Filter by Premium/Free tiers',
              '📈 Track subscription statistics',
              '🎯 Send targeted broadcasts',
              '💎 Premium member management',
              '🔔 Advanced notification controls'
            ].map((feature, index) => (
              <li key={index} style={{
                padding: '0.75rem 0',
                borderBottom: index < 5 ? '1px solid hsl(var(--border))' : 'none',
                fontSize: '15px',
                color: 'hsl(var(--muted-foreground))'
              }}>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={() => router.push('/pricing')}
          className={styles.upgradeButton}
          style={{
            padding: '16px 48px',
            border: 'none',
            borderRadius: '12px',
            fontSize: '18px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(245, 158, 11, 0.5)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(245, 158, 11, 0.4)';
          }}
        >
          <span style={{ fontSize: '24px' }}>⭐</span>
          Upgrade to Pro Plan
        </button>

        <p style={{
          marginTop: '1.5rem',
          fontSize: '14px',
          color: 'hsl(var(--muted-foreground))'
        }}>
          Starting at just $7/month
        </p>

        <style jsx>{`
          @keyframes bounce {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-10px);
            }
          }
        `}</style>
      </div>
    );
  }

  // Pro User View - Subscribers List
  return (
    <div className={styles.subscribersContainer}>
      {/* Header with Stats */}
      <div style={{
        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
        padding: '2rem',
        borderRadius: '16px',
        marginBottom: '2rem',
        border: '2px solid #f59e0b'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: 700,
            color: '#92400e',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            margin: 0
          }}>
            <span style={{ fontSize: '28px' }}>⭐</span>
            Telegram Subscribers
          </h2>
          
          <button
            onClick={fetchSubscribers}
            disabled={loading}
            style={{
              padding: '10px 20px',
              background: loading ? '#d1d5db' : '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {loading ? '🔄 Loading...' : '🔄 Refresh'}
          </button>
        </div>

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '1rem'
        }}>
          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#1f2937', marginBottom: '0.5rem' }}>
              {stats.total}
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500 }}>
              Total Subscribers
            </div>
          </div>

          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#f59e0b', marginBottom: '0.5rem' }}>
              {stats.premium}
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <span>⭐</span> Premium
            </div>
          </div>

          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#3b82f6', marginBottom: '0.5rem' }}>
              {stats.free}
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500 }}>
              Free Users
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '2rem',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => setFilter('all')}
          style={{
            padding: '10px 24px',
            background: filter === 'all' ? '#1f2937' : 'white',
            color: filter === 'all' ? 'white' : '#1f2937',
            border: '2px solid #1f2937',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          All Subscribers ({stats.total})
        </button>

        <button
          onClick={() => setFilter('premium')}
          style={{
            padding: '10px 24px',
            background: filter === 'premium' ? '#f59e0b' : 'white',
            color: filter === 'premium' ? 'white' : '#f59e0b',
            border: '2px solid #f59e0b',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span>⭐</span> Premium ({stats.premium})
        </button>

        <button
          onClick={() => setFilter('free')}
          style={{
            padding: '10px 24px',
            background: filter === 'free' ? '#3b82f6' : 'white',
            color: filter === 'free' ? 'white' : '#3b82f6',
            border: '2px solid #3b82f6',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Free ({stats.free})
        </button>
      </div>

      {/* Subscribers List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#6b7280' }}>
          <div style={{ fontSize: '48px', marginBottom: '1rem' }}>⏳</div>
          Loading subscribers...
        </div>
      ) : subscribers.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '4rem',
          background: '#f9fafb',
          borderRadius: '12px',
          color: '#6b7280'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '1rem' }}>📭</div>
          <p style={{ fontSize: '16px', fontWeight: 500 }}>
            No subscribers found in this category
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1.5rem'
        }}>
          {subscribers.map((subscriber) => (
            <div
              key={subscriber.id}
              style={{
                background: 'white',
                padding: '1.5rem',
                borderRadius: '12px',
                border: subscriber.subscription_tier === 'premium' 
                  ? '2px solid #f59e0b' 
                  : '1px solid #e5e7eb',
                boxShadow: subscriber.subscription_tier === 'premium'
                  ? '0 4px 12px rgba(245, 158, 11, 0.2)'
                  : '0 2px 8px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = subscriber.subscription_tier === 'premium'
                  ? '0 8px 20px rgba(245, 158, 11, 0.3)'
                  : '0 4px 12px rgba(0, 0, 0, 0.1)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = subscriber.subscription_tier === 'premium'
                  ? '0 4px 12px rgba(245, 158, 11, 0.2)'
                  : '0 2px 8px rgba(0, 0, 0, 0.05)';
              }}
            >
              {/* Premium Badge */}
              {subscriber.subscription_tier === 'premium' && (
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#92400e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 2px 6px rgba(245, 158, 11, 0.3)'
                }}>
                  <span>⭐</span> Pro
                </div>
              )}

              {/* Avatar & Name */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '1rem'
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  fontWeight: 700,
                  color: 'white',
                  flexShrink: 0
                }}>
                  {subscriber.telegram_first_name?.[0]?.toUpperCase() || '?'}
                </div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#1f2937',
                    marginBottom: '2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {subscriber.telegram_first_name || 'Unknown'}
                  </div>
                  {subscriber.telegram_username && (
                    <div style={{
                      fontSize: '13px',
                      color: '#6b7280',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      @{subscriber.telegram_username}
                    </div>
                  )}
                </div>
              </div>

              {/* Platform Username */}
              {subscriber.username && (
                <div style={{
                  fontSize: '14px',
                  color: '#4b5563',
                  marginBottom: '0.75rem',
                  padding: '8px 12px',
                  background: '#f3f4f6',
                  borderRadius: '6px'
                }}>
                  🌐 {subscriber.username}
                </div>
              )}

              {/* Subscription Info */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '12px',
                color: '#6b7280',
                paddingTop: '0.75rem',
                borderTop: '1px solid #e5e7eb'
              }}>
                <div>
                  <div style={{ fontWeight: 500, marginBottom: '4px' }}>Subscribed</div>
                  <div>{formatDate(subscriber.subscribed_at)}</div>
                </div>
                {subscriber.plan_name && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 500, marginBottom: '4px' }}>Plan</div>
                    <div style={{
                      textTransform: 'capitalize',
                      color: subscriber.plan_name === 'pro' ? '#f59e0b' : '#3b82f6',
                      fontWeight: 600
                    }}>
                      {subscriber.plan_name}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Responsive Styles */}
      <style jsx>{`
        @media (max-width: 768px) {
          .subscribersContainer {
            padding: 1rem;
          }
        }
      `}</style>
    </div>
  );
}
