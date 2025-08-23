import Link from 'next/link';

export const metadata = {
  title: 'Pricing - SharksZone',
  description: 'Choose the plan that fits your trading workflow. Free and Pro plans available.'
};

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
      {/* Hero */}
      <section className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          Simple, transparent pricing
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Start free. Upgrade to Pro anytime for advanced analytics, watchlists with signals, and more.
        </p>
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
          <h2 className="text-xl font-semibold">Starter</h2>
          <p className="text-muted-foreground mt-1">Best for trying SharksZone</p>
          <div className="mt-5 flex items-baseline gap-1">
            <span className="text-3xl font-bold">$0</span>
            <span className="text-sm text-muted-foreground">/ forever</span>
          </div>
          <ul className="mt-6 space-y-2 text-sm">
            <li className="flex items-start gap-2"><span>✅</span> Community feed & basic posts</li>
            <li className="flex items-start gap-2"><span>✅</span> Follow traders & profiles</li>
            <li className="flex items-start gap-2"><span>✅</span> Basic stock search</li>
            <li className="flex items-start gap-2"><span>✅</span> Standard support</li>
          </ul>
          <div className="mt-6">
            <Link href="/login" className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none">
              Get started free
            </Link>
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
          <h2 className="text-xl font-semibold">Pro Trader</h2>
          <p className="text-muted-foreground mt-1">For serious traders and creators</p>
          <div className="mt-5 flex items-baseline gap-1">
            <span className="text-3xl font-bold">$12</span>
            <span className="text-sm text-muted-foreground">/ month</span>
          </div>
          <ul className="mt-6 space-y-2 text-sm">
            <li className="flex items-start gap-2"><span>🚀</span> Advanced stock analytics & signals</li>
            <li className="flex items-start gap-2"><span>🚀</span> Smart watchlists with alerts</li>
            <li className="flex items-start gap-2"><span>🚀</span> Broker-verified badge & profile boost</li>
            <li className="flex items-start gap-2"><span>🚀</span> Trade entries & journal</li>
            <li className="flex items-start gap-2"><span>🚀</span> Post analytics & advanced search</li>
            <li className="flex items-start gap-2"><span>🚀</span> Priority support</li>
          </ul>
          <div className="mt-6 grid grid-cols-1 gap-3">
            {/* Placeholder: will be wired to Stripe checkout */}
            <Link href="/login" className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none">
              Upgrade to Pro
            </Link>
            <p className="text-xs text-muted-foreground text-center">Checkout flow coming soon.</p>
          </div>
        </div>
      </section>

      {/* FAQ / Notes */}
      <section className="mt-12 text-sm text-muted-foreground">
        <div className="rounded-lg border p-4">
          <p><strong>Notes:</strong> You can upgrade or cancel anytime. Prices in USD. Taxes may apply.</p>
        </div>
      </section>
    </div>
  );
}
