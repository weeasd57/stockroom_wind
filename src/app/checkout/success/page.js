'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CheckoutSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home after 5 seconds
    const timer = setTimeout(() => {
      router.push('/home');
    }, 5000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-3">
            <svg
              className="h-12 w-12 text-green-600 dark:text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-bold">Payment Successful!</h1>
          <p className="mt-2 text-muted-foreground">
            Welcome to SharksZone Pro! Your account has been upgraded.
          </p>
        </div>

        <div className="bg-card rounded-lg border p-6 text-left space-y-4">
          <h2 className="font-semibold">Your Pro benefits are now active:</h2>
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
              Pro badge on your profile
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <Link
            href="/home"
            className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Go to Dashboard
          </Link>
          <p className="text-sm text-muted-foreground">
            You will be redirected automatically in a few seconds...
          </p>
        </div>
      </div>
    </div>
  );
}
