'use client';

import { useEffect, useState } from 'react';
import { useSubscription } from '@/providers/SubscriptionProvider';
import styles from './AdBanner.module.css';

/**
 * AdBanner component - Shows ads for Free plan users only
 * Pro users will not see any ads
 * 
 * @param {string} slot - Ad slot position ('feed-top', 'feed-middle', 'sidebar', 'post-bottom')
 * @param {string} format - Ad format ('horizontal', 'vertical', 'square')
 */
export default function AdBanner({ slot = 'feed-middle', format = 'horizontal' }) {
  const { isPro, loading } = useSubscription();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't show ads for Pro users
  if (isPro || loading || !mounted) {
    return null;
  }

  // Google AdSense configuration
  const adClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || 'ca-pub-6192742001147947';
  const adSlot = getAdSlot(slot);
  
  return (
    <div className={`${styles.adContainer} ${styles[format]}`} data-slot={slot}>
      <div className={styles.adLabel}>Advertisement</div>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={adClient}
        data-ad-slot={adSlot}
        data-ad-format={format === 'horizontal' ? 'auto' : 'vertical'}
        data-full-width-responsive={format === 'horizontal' ? 'true' : 'false'}
      />
    </div>
  );
}

// Map ad slots to AdSense slot IDs
function getAdSlot(slot) {
  const slots = {
    'feed-top': '1234567890',      // Replace with your actual slot IDs
    'feed-middle': '2345678901',
    'sidebar': '3456789012',
    'post-bottom': '4567890123',
  };
  return slots[slot] || slots['feed-middle'];
}

// Initialize AdSense ads
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error('AdSense error:', e);
    }
  });
}
