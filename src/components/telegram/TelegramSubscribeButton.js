'use client';

import { useState, useEffect, useRef } from 'react';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import { useTheme } from '@/providers/theme-provider';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import styles from '@/styles/telegram-subscribe-button.module.css';

export default function TelegramSubscribeButton({ userId, username, brokerUserId, brokerName, compact, showNotAvailable = false, language = 'en' }) {
  const { isAuthenticated, supabase, user } = useSupabase();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [botInfo, setBotInfo] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [checked, setChecked] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  
  // Support both userId/username (view-profile) and brokerUserId/brokerName (traders)
  const targetUserId = userId || brokerUserId;
  const targetUsername = username || brokerName;
  const pollRef = useRef(null);
  const retryRef = useRef(null);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (retryRef.current) {
        clearTimeout(retryRef.current);
        retryRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!targetUserId) return;
    const timer = setTimeout(() => {
      checkTelegramBot();
    }, 800);
    return () => clearTimeout(timer);
  }, [targetUserId]);

  // Re-check subscription when login state becomes available and bot exists
  useEffect(() => {
    if (isAuthenticated && botInfo?.id && !checkingSubscription) {
      checkSubscriptionStatus(botInfo.id);
    }
  }, [isAuthenticated, botInfo?.id]);

  const checkSubscriptionStatus = async (botId) => {
    if (!isAuthenticated) return false;
    console.log('[TelegramSubscribeButton] checkSubscriptionStatus start', { botId });
    let subscribed = false;
    try {
      setCheckingSubscription(true);
      // Attach Supabase access token if available to allow server route to authenticate via Bearer
      let authHeader = {};
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          authHeader = { Authorization: `Bearer ${session.access_token}` };
        }
      } catch {}

      const response = await fetch('/api/telegram/check-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        credentials: 'include',
        body: JSON.stringify({ botId })
      });
      if (response.ok) {
        const data = await response.json();
        subscribed = !!data.isSubscribed;
        console.log('[TelegramSubscribeButton] checkSubscriptionStatus result', { isSubscribed: subscribed, raw: data });
        setIsSubscribed(subscribed);
      }
    } catch (error) {
      console.log('Subscription check failed:', error);
    } finally {
      setCheckingSubscription(false);
    }
    return subscribed;
  };

  const startSubscriptionPolling = () => {
    try {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (!botInfo?.id) return;
      console.log('[TelegramSubscribeButton] startSubscriptionPolling', { botId: botInfo.id });
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts += 1;
        const ok = await checkSubscriptionStatus(botInfo.id);
        if (ok || attempts >= 12) {
          if (ok) console.log('[TelegramSubscribeButton] polling detected subscription, stopping');
          if (attempts >= 12 && !ok) console.log('[TelegramSubscribeButton] polling max attempts reached, stopping');
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }, 1000);
    } catch {}
  };

  const handleUnsubscribe = async () => {
    if (!botInfo) return;
    
    try {
      setLoading(true);
      console.log('[TelegramSubscribeButton] unsubscribe requested', { botId: botInfo?.id, brokerId: targetUserId });
      
      let authHeader = {};
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          authHeader = { Authorization: `Bearer ${session.access_token}` };
        }
      } catch {}
      
      const response = await fetch('/api/telegram/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        credentials: 'include',
        body: JSON.stringify({ 
          botId: botInfo.id,
          brokerId: targetUserId 
        })
      });
      
      if (response.ok) {
        setIsSubscribed(false);
        toast.success('Unsubscribed successfully');
        console.log('[TelegramSubscribeButton] unsubscribe response', { ok: true, status: response.status });
      } else {
        toast.error('Failed to unsubscribe');
        console.log('[TelegramSubscribeButton] unsubscribe response', { ok: false, status: response.status });
      }
    } catch (error) {
      toast.error('Unsubscribe error');
    } finally {
      setLoading(false);
    }
  };

  const checkTelegramBot = async () => {
    try {
      setLoading(true);
      console.log('[TelegramSubscribeButton] checking bot for', { targetUserId });
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(`/api/telegram/check-bot/${targetUserId}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.warn(`Telegram API returned ${response.status}, treating as no bot`);
        setBotInfo(null);
        return;
      }
      
      const data = await response.json();
      console.log('[TelegramSubscribeButton] check-bot result', data);

      if (data.hasTelegramBot && data.botInfo) {
        setBotInfo(data.botInfo);
        // Check subscription status if user is authenticated
        if (isAuthenticated) {
          await checkSubscriptionStatus(data.botInfo.id);
        }
      } else {
        setBotInfo(null);
      }
    } catch (error) {
      console.log('Telegram check failed (this is ok):', error.name);
      setBotInfo(null);
      // Retry once on abort/timeout
      try {
        if (error?.name === 'AbortError' || String(error?.message || '').includes('aborted')) {
          if (retryRef.current) {
            clearTimeout(retryRef.current);
          }
          retryRef.current = setTimeout(() => {
            retryRef.current = null;
            checkTelegramBot();
          }, 1200);
        }
      } catch {}
    } finally {
      setLoading(false);
      setChecked(true);
    }
  };

  const handleSubscribeClick = () => {
    if (!isAuthenticated) {
      toast.error('Please login first');
      return;
    }

    if (!botInfo) {
      toast.error('Bot not available');
      return;
    }

    setShowDialog(true);
  };

  const buildTelegramWebLink = (rawLink, fallbackUsername) => {
    try {
      if (!rawLink && fallbackUsername) return `https://web.telegram.org/k/#@${fallbackUsername}`;
      const lower = String(rawLink || '').trim();
      if (!lower) return fallbackUsername ? `https://web.telegram.org/k/#@${fallbackUsername}` : 'https://web.telegram.org/';
      if (lower.startsWith('tg://')) {
        const url = new URL(lower.replace('tg://', 'https://tg.local/'));
        const path = url.pathname.replace(/^\/+/, '');
        if (path === 'resolve') {
          const domain = url.searchParams.get('domain') || fallbackUsername || '';
          const params = new URLSearchParams(url.searchParams);
          params.delete('domain');
          const query = params.toString();
          if (domain) {
            if (query) return `https://t.me/${domain}?${query}`;
            return `https://web.telegram.org/k/#@${domain}`;
          }
        }
        if (path === 'join') {
          const invite = url.searchParams.get('invite');
          if (invite) return `https://t.me/+${invite}`;
        }
        return fallbackUsername ? `https://web.telegram.org/k/#@${fallbackUsername}` : 'https://web.telegram.org/';
      }
      if (lower.startsWith('http')) {
        const u = new URL(lower);
        if (['t.me', 'telegram.me', 'telegram.dog'].includes(u.hostname)) {
          const m = u.pathname.match(/^\/([A-Za-z0-9_+]+)$/);
          if (m && !m[1].startsWith('+')) {
            return `https://web.telegram.org/k/#@${m[1]}`;
          }
          return lower;
        }
      }
      return fallbackUsername ? `https://web.telegram.org/k/#@${fallbackUsername}` : 'https://web.telegram.org/';
    } catch {
      return fallbackUsername ? `https://web.telegram.org/k/#@${fallbackUsername}` : 'https://web.telegram.org/';
    }
  };

  const buildTelegramHelpers = (subscribeLink, fallbackUsername) => {
    let botUsername = botInfo?.username || '';
    let startParam = '';
    try {
      const link = String(subscribeLink || '');
      if (/^tg:\/\//i.test(link)) {
        const url = new URL(link.replace('tg://', 'https://tg.local/'));
        const path = url.pathname.replace(/^\/+/, '');
        if (path === 'resolve') {
          const domain = url.searchParams.get('domain') || '';
          botUsername = (domain || botUsername || fallbackUsername || '').replace(/^@+/, '');
          startParam = url.searchParams.get('start') || '';
        } else if (path === 'join') {
          const invite = url.searchParams.get('invite') || '';
          if (invite) {
            const tgAppLink = `tg://join?invite=${invite}`;
            const webLink = `https://t.me/+${invite}`;
            return { webLink, tgWebDeepLink: webLink, tgAppLink, startCommand: '' };
          }
        }
      } else {
        const m = link.match(/t\.(?:me|telegram\.me|dog)\/([^?]+)(?:\?start=([^&]+))?/i);
        if (m) {
          botUsername = (m[1] || '').replace(/^@+/, '');
          startParam = m[2] || '';
        } else if (/^@/.test(link)) {
          botUsername = link.replace(/^@+/, '');
        } else if (!link && fallbackUsername) {
          botUsername = String(fallbackUsername).replace(/^@+/, '');
        }
      }
    } catch {}
    // Encode broker and platform user IDs into start param
    try {
      const brokerId = targetUserId;
      const platformId = user?.id;
      const toB64 = (uuid) => {
        if (!uuid) return null;
        const hex = String(uuid).replace(/-/g, '');
        if (hex.length !== 32) return null;
        const bytes = new Uint8Array(16);
        for (let i = 0; i < 16; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
        let bin = '';
        for (let i = 0; i < 16; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/,'');
      };
      if (brokerId && platformId) {
        const a = toB64(brokerId);
        const b = toB64(platformId);
        if (a && b) {
          startParam = `s_${a}_${b}`;
        }
      } else if (brokerId && (!startParam || /^subscribe_/.test(startParam))) {
        startParam = `subscribe_${brokerId}`;
      }
    } catch {}
    const tgAppLink = `tg://resolve?domain=${botUsername}${startParam ? `&start=${startParam}` : ''}`;
    const webLink = startParam ? `https://t.me/${botUsername}?start=${startParam}` : `https://t.me/${botUsername}`;
    const tgAddr = encodeURIComponent(tgAppLink);
    const tgWebDeepLink = `https://web.telegram.org/k/#?tgaddr=${tgAddr}`;
    const startCommand = startParam ? `/start ${startParam}` : '';
    return { webLink, tgWebDeepLink, tgAppLink, startCommand };
  };

  const handleConfirmSubscribe = async () => {
    if (!botInfo?.subscribeLink) return;
    const { webLink, tgWebDeepLink, tgAppLink, startCommand } = buildTelegramHelpers(botInfo.subscribeLink, botInfo?.username || targetUsername);
    const ua = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isDesktop = !isMobile;
    console.log('[TelegramSubscribeButton] handleConfirmSubscribe', { mode: isDesktop ? 'desktop' : 'mobile', tgAppLink, webLink, tgWebDeepLink, startCommand: !!startCommand });
    if (isDesktop) {
      toast.info('Opening Telegram...');
      if (startCommand) {
        try { await navigator.clipboard?.writeText(startCommand); } catch {}
      }
      window.location.href = tgAppLink;
      let usedFallback = false;
      const fallbackTimer = setTimeout(() => {
        if (!usedFallback && !document.hidden) {
          usedFallback = true;
          const w = window.open(webLink, '_blank', 'noopener,noreferrer');
          if (w) {
            toast.success('Telegram opened in browser');
          } else {
            toast.message(`Open Telegram: ${webLink}`);
          }
        }
      }, 2500);
      const onBlur = () => {
        clearTimeout(fallbackTimer);
        window.removeEventListener('blur', onBlur);
        window.removeEventListener('visibilitychange', onVisibilityChange);
      };
      const onVisibilityChange = () => {
        if (document.hidden) {
          clearTimeout(fallbackTimer);
          window.removeEventListener('blur', onBlur);
          window.removeEventListener('visibilitychange', onVisibilityChange);
        }
      };
      window.addEventListener('blur', onBlur);
      window.addEventListener('visibilitychange', onVisibilityChange);
    } else {
      const w = window.open(webLink, '_blank', 'noopener,noreferrer');
      if (startCommand) {
        try { await navigator.clipboard?.writeText(startCommand); } catch {}
      }
      if (w) {
        toast.success('Telegram opened in browser');
      } else {
        toast.message(`Open Telegram: ${webLink}`);
      }
    }
    setShowDialog(false);
    startSubscriptionPolling();
  };

  const handleOpenTelegramWeb = async () => {
    const { tgWebDeepLink, webLink, startCommand } = buildTelegramHelpers(botInfo?.subscribeLink, botInfo?.username || targetUsername);
    const link = tgWebDeepLink || webLink || buildTelegramWebLink(botInfo?.subscribeLink, botInfo?.username || targetUsername);
    console.log('[TelegramSubscribeButton] handleOpenTelegramWeb', { link, startCommand: !!startCommand });
    if (startCommand) {
      try { await navigator.clipboard?.writeText(startCommand); } catch {}
    }
    window.open(link, '_blank', 'noopener,noreferrer');
    setShowDialog(false);
    toast.success('Opening Telegram Web to subscribe');
    startSubscriptionPolling();
  };

  console.log('[TelegramSubscribeButton] render state', { checked, hasBot: !!botInfo, isSubscribed, loading, targetUserId, targetUsername });
  if (checked && !botInfo) {
    if (showNotAvailable) {
      return (
        <div className={`${styles.notAvailableButton} ${compact ? styles.compact : ''}`}>
          <svg className={styles.telegramIcon} viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
          </svg>
          <span className={styles.buttonText}>Bot not available</span>
        </div>
      );
    }
    return null;
  }

  if (!checked) {
    return (
      <div className={styles.placeholderButton}>
        <svg className={styles.telegramIcon} viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
        <span className={styles.buttonText}>...</span>
      </div>
    );
  }

  return (
    <>
      {isSubscribed ? (
        // Unsubscribe button
        <button 
          className={`${styles.telegramButton} ${styles.unsubscribeButton} ${compact ? styles.compact : ''}`}
          onClick={handleUnsubscribe}
          disabled={loading}
          title={`Unsubscribe from ${targetUsername} notifications on Telegram`}
        >
          <svg className={styles.telegramIcon} viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
          </svg>
          <span className={styles.buttonText}>
            {loading ? 'Unsubscribing...' : 'Unsubscribe'}
          </span>
        </button>
      ) : (
        // Subscribe button
        <button 
          className={`${styles.telegramButton} ${compact ? styles.compact : ''}`}
          onClick={handleSubscribeClick}
          disabled={loading}
          title={`Subscribe to ${targetUsername} notifications on Telegram`}
        >
          <svg className={styles.telegramIcon} viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
          </svg>
          <span className={styles.buttonText}>
            {loading ? 'Loading...' : 'Subscribe to Telegram'}
          </span>
        </button>
      )}

      {showDialog && mounted && createPortal(
        <div className={`${styles.dialogOverlay} ${theme === 'dark' ? styles.darkTheme : styles.lightTheme}`} onClick={() => setShowDialog(false)}>
          <div className={`${styles.dialog} ${theme === 'dark' ? styles.darkDialog : styles.lightDialog}`} onClick={e => e.stopPropagation()}>
            <div className={styles.dialogHeader}>
              <h3>📧 Subscribe to Telegram Updates</h3>
              <button 
                className={styles.closeButton}
                onClick={() => setShowDialog(false)}
              >
                ×
              </button>
            </div>
            
            <div className={styles.dialogContent}>
              <p className={styles.description}>
                You will receive instant notifications about:
              </p>
              <ul className={styles.featuresList}>
                <li>📊 New Posts</li>
                <li>💰 Price Updates</li>
                <li>🎯 Target Reached</li>
                <li>🛑 Stop Loss</li>
              </ul>
              
              <div className={styles.infoBox}>
                <p>Telegram will open to subscribe to the bot</p>
              </div>
            </div>
            
            <div className={styles.dialogActions}>
              <button 
                className={styles.openTelegramButton}
                onClick={handleConfirmSubscribe}
              >
                <svg className={styles.buttonIcon} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                Open Telegram
              </button>
              <button 
                className={styles.openTelegramWebButton}
                onClick={handleOpenTelegramWeb}
              >
                Open in Telegram Web
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
