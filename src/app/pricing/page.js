'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import { supabase } from '@/utils/supabase';
import { useSubscription } from '@/providers/SubscriptionProvider';
import { toast } from 'sonner';
import Footer from '@/components/Footer';

export default function PricingPage() {
  const router = useRouter();
  const { user, refreshSession } = useSupabase();
  const { 
    isPro,
    refreshSubscription
  } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [switchingToFree, setSwitchingToFree] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState('monthly'); // 'monthly' or 'yearly'

  const handleUpgradeToPro = async () => {
    if (!user) {
      router.push('/login?redirect=/pricing');
      return;
    }

    setLoading(true);
    // Redirect to checkout page with billing period
    router.push(`/checkout?plan=${billingPeriod}`);
  };

  // Calculate prices based on billing period
  const getProPrice = () => billingPeriod === 'yearly' ? '70.00' : '7.00';
  const getPriceLabel = () => billingPeriod === 'yearly' ? '/ year' : '/ month';
  const getSavings = () => billingPeriod === 'yearly' ? '(Save $14/year)' : null;

  const handleFreePlan = async () => {
    if (!user) {
      // User not logged in - redirect to login page
      router.push('/login');
      return;
    }

    // If user is already on free plan, redirect to home
    if (!isPro) {
      router.push('/home');
      return;
    }

    // If user is on Pro plan, switch to free
    setSwitchingToFree(true);
    
    try {
      // Get current session token for Authorization header
      const { data: { session } } = await supabase.auth.getSession();
      const headers = {
        'Content-Type': 'application/json',
      };
      
      // Add Authorization header if we have a session
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/subscription/manage', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          action: 'switch_to_free',
          confirmCancellation: true,
          reason: 'User switched to free plan from pricing page',
          metadata: { source: 'pricing_page' }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle unauthorized error - try a silent refresh once then retry
        if (response.status === 401) {
          try {
            await refreshSession?.();
            // Get refreshed session token
            const { data: { session: refreshedSession } } = await supabase.auth.getSession();
            const retryHeaders = {
              'Content-Type': 'application/json',
            };
            
            if (refreshedSession?.access_token) {
              retryHeaders['Authorization'] = `Bearer ${refreshedSession.access_token}`;
            }

            const retry = await fetch('/api/subscription/manage', {
              method: 'POST',
              headers: retryHeaders,
              credentials: 'include',
              body: JSON.stringify({
                action: 'switch_to_free',
                confirmCancellation: true,
                reason: 'User switched to free plan from pricing page',
                metadata: { source: 'pricing_page_retry' }
              })
            });
            const retryData = await retry.json();
            if (!retry.ok) {
              if (retry.status === 401) {
                toast.error('Your session has expired. Please log in again.');
                router.push('/login?redirect=/pricing');
                return;
              }
              throw new Error(retryData.message || 'Failed to switch to free plan');
            }
            // Use retryData as successful path
            toast.success('Successfully switched to Free Plan! Your Pro subscription has been cancelled.');
            if (refreshSubscription) await refreshSubscription();
            return;
          } catch (e) {
            throw e;
          }
        }
        throw new Error(data.message || 'Failed to switch to free plan');
      }

      toast.success('Successfully switched to Free Plan! Your Pro subscription has been cancelled.');
      
      // Dispatch subscription change event for real-time updates
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('subscriptionChanged', {
          detail: { plan: 'free', action: 'downgrade', timestamp: new Date().toISOString() }
        });
        window.dispatchEvent(event);
        console.log('[Pricing] Dispatched subscriptionChanged event');
      }
      
      // Refresh subscription info
      if (refreshSubscription) {
        await refreshSubscription();
      }

      // Stay on pricing page to show the updated state
    } catch (error) {
      console.error('Error switching to free plan:', error);
      toast.error(error.message || 'Failed to switch to free plan. Please try again.');
    } finally {
      setSwitchingToFree(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
      {/* Hero */}
      <section className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          Simple, transparent pricing
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Choose the plan that works best for you. Start with Free or upgrade to Pro for unlimited premium plans, ad-free experience, and more.
        </p>
      </section>

      {/* Billing Period Toggle */}
      <section className="flex justify-center mb-8">
        <div className="inline-flex items-center gap-2 p-1 bg-muted rounded-lg">
          <button
            onClick={() => setBillingPeriod('monthly')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              billingPeriod === 'monthly'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingPeriod('yearly')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              billingPeriod === 'yearly'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Yearly
            <span className="ml-1 text-xs text-green-600 dark:text-green-400 font-semibold">Save 17%</span>
          </button>
        </div>
      </section>

      {/* Plans */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Free */}
        <div className={`rounded-xl border ${!isPro ? 'ring-2 ring-primary' : ''} bg-card text-card-foreground shadow-sm p-6 flex flex-col relative`}>
          {!isPro && (
            <div className="absolute -top-3 left-6 px-2 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded">
              Current Plan
            </div>
          )}
          <div className="mb-4">
            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium">
              Free
            </span>
          </div>
          <h2 className="text-xl font-semibold">Free Plan</h2>
          <p className="text-muted-foreground mt-1">Perfect for getting started</p>
          <div className="mt-5 flex items-baseline gap-1">
            <span className="text-3xl font-bold">$0</span>
            <span className="text-sm text-muted-foreground">/ month</span>
          </div>
          <ul className="mt-6 space-y-2 text-sm">
            <li className="flex items-start gap-2"><span>✅</span> <strong>50 price checks per month</strong></li>
            <li className="flex items-start gap-2"><span>✅</span> <strong>100 posts per month</strong></li>
            <li className="flex items-start gap-2"><span>📱</span> <strong>Telegram notifications: subscribe to traders you follow</strong></li>
            <li className="flex items-start gap-2"><span>📢</span> <span className="text-muted-foreground">Ads displayed</span></li>
            <li className="flex items-start gap-2"><span>✅</span> Basic features</li>
            <li className="flex items-start gap-2"><span>✅</span> Community support</li>
          </ul>
          <div className="mt-6 grid grid-cols-1 gap-2">
            {!isPro ? (
              <button disabled className="inline-flex w-full items-center justify-center rounded-md bg-muted px-4 py-2 text-sm font-medium text-muted-foreground cursor-not-allowed">
                Current Plan
              </button>
            ) : (
              <button 
                onClick={handleFreePlan}
                disabled={switchingToFree}
                className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none disabled:opacity-50"
              >
                {switchingToFree ? 'Switching...' : (!user ? 'Get started free' : 'Switch to Free')}
              </button>
            )}
          </div>
        </div>

        {/* Pro */}
        <div className={`relative rounded-xl border ${isPro ? 'ring-2 ring-primary' : 'ring-1 ring-primary/10'} bg-card/60 backdrop-blur text-card-foreground shadow-sm p-6 flex flex-col`}>
          {isPro && (
            <div className="absolute -top-3 left-6 px-2 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded">
              Current Plan
            </div>
          )}
          <div className="mb-4 flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium">
              Pro
            </span>
            <span className="text-xs text-primary font-medium">Most popular</span>
          </div>
          <h2 className="text-xl font-semibold">Pro Plan</h2>
          <p className="text-muted-foreground mt-1">For active traders</p>
          <div className="mt-5 flex items-baseline gap-1">
            <span className="text-3xl font-bold">${getProPrice()}</span>
            <span className="text-sm text-muted-foreground">{getPriceLabel()}</span>
          </div>
          {getSavings() && (
            <div className="mt-1 text-xs text-green-600 dark:text-green-400 font-medium">
              {getSavings()}
            </div>
          )}
          <ul className="mt-6 space-y-2 text-sm">
            <li className="flex items-start gap-2"><span>🚀</span> <strong>300 price checks per month</strong></li>
            <li className="flex items-start gap-2"><span>🚀</span> <strong>500 posts per month</strong></li>
            <li className="flex items-start gap-2"><span>💎</span> <strong>Create premium broker plans</strong></li>
            <li className="flex items-start gap-2"><span>🚫</span> <strong>No ads - Ad-free experience</strong></li>
            <li className="flex items-start gap-2"><span>📱</span> <strong>Telegram notifications: subscribe to traders you follow</strong></li>
            <li className="flex items-start gap-2"><span>🚀</span> Priority support</li>
          </ul>
          <div className="mt-6 grid grid-cols-1 gap-2">
            {isPro ? (
              <button disabled className="inline-flex w-full items-center justify-center rounded-md bg-muted px-4 py-2 text-sm font-medium text-muted-foreground cursor-not-allowed">
                Current Plan
              </button>
            ) : (
              <button 
                onClick={handleUpgradeToPro}
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Upgrade to Pro'}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* FAQ / Notes */}
      <section className="mt-12 text-sm text-muted-foreground">
        <div className="rounded-lg border p-4">
          <p className="mb-2"><strong>Important:</strong></p>
          <ul className="space-y-1 ml-4">
            <li>• Price checks reset monthly on your billing date</li>
            <li>• Unused checks don't roll over to the next month</li>
            <li>• Pro users can create multiple premium broker plans to monetize their trading insights</li>
            <li>• Pro users enjoy an ad-free experience across the platform</li>
            <li>• You can upgrade or cancel anytime</li>
            <li>• Prices in USD. Taxes may apply</li>
            <li>• Secure payment processing via PayPal</li>
          </ul>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
