'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useAuth } from '@/hooks/useAuth';

export default function PricingPage() {
  const router = useRouter();
  const { supabase } = useSupabase();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
  // Fetch user's current subscription
  useEffect(() => {
    if (user) {
      fetchSubscriptionInfo();
    }
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
        setCurrentPlan(result.data.plan_name);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    }
  };

  const handleUpgradeToPro = async () => {
    if (!user) {
      router.push('/login?redirect=/pricing');
      return;
    }

    setLoading(true);
    // Redirect to checkout page
    router.push('/checkout');
  };

  const handleFreePlan = () => {
    if (!user) {
      // User not logged in - redirect to login page
      router.push('/login');
    } else {
      // User logged in - redirect to home page
      router.push('/home');
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
          Choose the plan that works best for you. Start with Free or upgrade to Pro for more price checks.
        </p>
        {subscriptionInfo && (
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-sm">
            <span>Current Plan:</span>
            <span className="font-semibold">{subscriptionInfo.plan_display_name}</span>
            {subscriptionInfo.plan_name === 'free' && (
              <span className="text-muted-foreground">
                ({subscriptionInfo.remaining_checks}/{subscriptionInfo.price_check_limit} price checks remaining)
              </span>
            )}
          </div>
        )}
      </section>

      {/* Plans */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Free */}
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 flex flex-col">
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
            <li className="flex items-start gap-2"><span>✅</span> <strong>2 price checks per month</strong></li>
            <li className="flex items-start gap-2"><span>✅</span> Create and view posts</li>
          </ul>
          <div className="mt-6">
            {currentPlan === 'free' ? (
              <button disabled className="inline-flex w-full items-center justify-center rounded-md bg-muted px-4 py-2 text-sm font-medium text-muted-foreground cursor-not-allowed">
                Current Plan
              </button>
            ) : (
              <button 
                onClick={handleFreePlan}
                className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none"
              >
                {!user ? 'Get started free' : 'Switch to Free'}
              </button>
            )}
          </div>
        </div>

        {/* Pro */}
        <div className="relative rounded-xl border bg-card/60 backdrop-blur text-card-foreground shadow-sm p-6 flex flex-col ring-1 ring-primary/10">
          <div className="mb-4 flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium">
              Pro
            </span>
            <span className="text-xs text-primary font-medium">Most popular</span>
          </div>
          <h2 className="text-xl font-semibold">Pro Plan</h2>
          <p className="text-muted-foreground mt-1">For active traders</p>
          <div className="mt-5 flex items-baseline gap-1">
            <span className="text-3xl font-bold">$4.00</span>
            <span className="text-sm text-muted-foreground">/ month</span>
          </div>
          <ul className="mt-6 space-y-2 text-sm">
            <li className="flex items-start gap-2"><span>🚀</span> <strong>30 price checks per month</strong></li>
            <li className="flex items-start gap-2"><span>🚀</span> Unlimited post creation</li>
            <li className="flex items-start gap-2"><span>🚀</span> Priority support</li>
          </ul>
          <div className="mt-6 grid grid-cols-1 gap-2">
            {currentPlan === 'pro' ? (
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
            <li>• You can upgrade or cancel anytime</li>
            <li>• Prices in USD. Taxes may apply</li>
            <li>• Secure payment processing via PayPal</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
