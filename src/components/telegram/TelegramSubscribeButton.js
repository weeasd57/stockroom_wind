'use client';

import { useState, useEffect, useRef } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useTheme } from '@/providers/theme-provider';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import styles from '@/styles/telegram-subscribe-button.module.css';

export default function TelegramSubscribeButton({ userId, username, language = 'ar' }) {
  const { isAuthenticated, user } = useSupabase();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [botInfo, setBotInfo] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [checked, setChecked] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);
  const [awaitingSubscription, setAwaitingSubscription] = useState(false);
  const pollRef = useRef(null);
  const botCheckRetried = useRef(false);
  
  // Text based on language
  const texts = {
    ar: {
      subscribe: 'Subscribe to Telegram',
      unsubscribe: 'Unsubscribe from Telegram',
      botNotAvailable: 'البوت غير متاح حالياً',
      loginRequired: 'يجب تسجيل الدخول أولاً',
      opening: 'Opening Telegram...',
      openedBrowser: 'Telegram opened in browser',
      subscribeTitle: '📧 Subscribe to Telegram Updates',
      unsubscribeTitle: '🛑 Unsubscribe from Telegram',
      unsubscribeConfirm: 'هل أنت متأكد من إلغاء الاشتراك؟',
      unsubscribeSuccess: 'تم إلغاء الاشتراك بنجاح',
      unsubscribeError: 'فشل إلغاء الاشتراك',
      description: 'ستتلقى إشعارات فورية عن:',
      unsubscribeDescription: 'لن تتلقى بعد الآن إشعارات عن:',
      features: ['📊 المنشورات الجديدة', '💰 تحديثات الأسعار', '🎯 الوصول للأهداف', '🛑 إيقاف الخسائر'],
      note: 'سيتم فتح Telegram للاشتراك في البوت',
      openTelegram: 'Open Telegram',
      openTelegramWeb: 'Open in Telegram Web',
      confirmUnsubscribe: 'Confirm Unsubscribe',
      startCommandCopied: 'Start command copied. Paste it in the chat and send.',
      cancel: 'Cancel',
      tooltip: `اشترك في إشعارات ${username} عبر Telegram`,
      unsubscribeTooltip: `إلغاء الاشتراك من إشعارات ${username}`
    },
    en: {
      subscribe: 'Subscribe to Telegram',
      unsubscribe: 'Unsubscribe from Telegram',
      botNotAvailable: 'Bot is not available',
      loginRequired: 'Please login first',
      opening: 'Opening Telegram...',
      openedBrowser: 'Telegram opened in browser',
      subscribeTitle: '📧 Subscribe to Telegram Updates',
      unsubscribeTitle: '🛑 Unsubscribe from Telegram',
      unsubscribeConfirm: 'Are you sure you want to unsubscribe?',
      unsubscribeSuccess: 'Successfully unsubscribed',
      unsubscribeError: 'Failed to unsubscribe',
      description: 'You will receive instant notifications about:',
      unsubscribeDescription: 'You will no longer receive notifications about:',
      features: ['📊 New Posts', '💰 Price Updates', '🎯 Target Reached', '🛑 Stop Loss'],
      note: 'Telegram will open to subscribe to the bot',
      openTelegram: 'Open Telegram',
      openTelegramWeb: 'Open in Telegram Web',
      confirmUnsubscribe: 'Confirm Unsubscribe',
      startCommandCopied: 'Start command copied. Paste it in the chat and send.',
      cancel: 'Cancel',
      tooltip: `Subscribe to ${username}'s Telegram notifications`,
      unsubscribeTooltip: `Unsubscribe from ${username}'s notifications`
    }
  };
  
  const t = texts[language] || texts.en;
  
  // تأكد من أن الـ component mounted في الـ client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Clear polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  // تحميل البوت بشكل آمن مع fallback
  useEffect(() => {
    if (userId && !checked) {
      // تأخير أطول لضمان تحميل الصفحة أولاً
      const timer = setTimeout(() => {
        checkTelegramBot();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [userId, checked]);

  const checkTelegramBot = async (timeoutMs = 12000) => {
    try {
      setLoading(true);
      setChecked(true);
      
      // fetch timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const q = user?.id ? `?currentUserId=${encodeURIComponent(user.id)}` : '';
      const response = await fetch(`/api/telegram/check-bot/${userId}${q}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.warn(`Telegram API returned ${response.status}, treating as no bot`);
        setBotInfo(null);
        return;
      }
      
      const data = await response.json();

      if (data.hasTelegramBot && data.botInfo) {
        setBotInfo(data.botInfo);
        // Check subscription status if user is authenticated
        if (user?.id) {
          checkSubscriptionStatus();
        }
      } else {
        setBotInfo(null);
      }
    } catch (error) {
      // Handle aborts silently and retry once with longer timeout
      if (error?.name === 'AbortError') {
        if (!botCheckRetried.current) {
          botCheckRetried.current = true;
          setTimeout(() => checkTelegramBot(20000), 1000);
        }
        return;
      }
      console.warn('[Telegram] check-bot failed:', error);
      setBotInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const checkSubscriptionStatus = async () => {
    let subscribed = false;
    try {
      const response = await fetch('/api/telegram/subscription-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brokerId: userId,
          currentUserId: user?.id
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        subscribed = !!data.isSubscribed;
        setIsSubscribed(subscribed);
      }
    } catch (error) {
      console.log('Subscription status check failed:', error);
    } finally {
      setSubscriptionChecked(true);
    }
    return subscribed;
  };

  // Start short polling after user opens Telegram to auto-refresh UI
  const startSubscriptionPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setAwaitingSubscription(true);
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts += 1;
      const subscribed = await checkSubscriptionStatus();
      if (subscribed || attempts >= 12) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setAwaitingSubscription(false);
      }
    }, 1000);
  };

  const handleUnsubscribe = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/telegram/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brokerId: userId,
          currentUserId: user?.id
        })
      });
      
      if (response.ok) {
        setIsSubscribed(false);
        setShowDialog(false);
        toast.success(t.unsubscribeSuccess);
      } else {
        toast.error(t.unsubscribeError);
      }
    } catch (error) {
      console.error('Unsubscribe error:', error);
      toast.error(t.unsubscribeError);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribeClick = () => {
    if (!isAuthenticated) {
      toast.error(t.loginRequired);
      return;
    }

    if (!botInfo) {
      toast.error(t.botNotAvailable);
      return;
    }

    setShowDialog(true);
  };

  // Build safe web links and helpers from a subscribe link
  const buildTelegramHelpers = (subscribeLink) => {
    let botUsername = botInfo?.username || '';
    let startParam = '';
    try {
      const link = String(subscribeLink || '');
      if (/^tg:\/\//i.test(link)) {
        const url = new URL(link);
        const domain = url.searchParams.get('domain') || '';
        botUsername = (domain || botUsername || '').replace(/^@+/, '');
        startParam = url.searchParams.get('start') || '';
      } else {
        const m = link.match(/t\.me\/([^?]+)(?:\?start=([^&]+))?/i);
        if (m) {
          botUsername = (m[1] || '').replace(/^@+/, '');
          startParam = m[2] || '';
        } else if (/^@/.test(link)) {
          botUsername = link.replace(/^@+/, '');
        }
      }
    } catch (_) {}
    const webLink = startParam ? `https://t.me/${botUsername}?start=${startParam}` : `https://t.me/${botUsername}`;
    // Deep link for Telegram Web using tgaddr to avoid t.me intermediate page
    const tgAddr = encodeURIComponent(`tg://resolve?domain=${botUsername}${startParam ? `&start=${startParam}` : ''}`);
    const tgWebDeepLink = `https://web.telegram.org/k/#?tgaddr=${tgAddr}`;
    const tgAppLink = `tg://resolve?domain=${botUsername}${startParam ? `&start=${startParam}` : ''}`;
    const startCommand = startParam ? `/start ${startParam}` : '';
    return { webLink, tgWebDeepLink, tgAppLink, startCommand };
  };

  const handleOpenTelegramWeb = async () => {
    if (!botInfo?.subscribeLink) return;
    const { tgWebDeepLink, startCommand } = buildTelegramHelpers(botInfo.subscribeLink);
    const w = window.open(tgWebDeepLink, '_blank', 'noopener,noreferrer');
    if (startCommand) {
      try { await navigator.clipboard?.writeText(startCommand); } catch (_) {}
      toast.success(t.startCommandCopied);
    }
    if (!w) {
      toast.message(`${t.openTelegramWeb}: ${tgWebDeepLink}`);
    }
    setShowDialog(false);
    startSubscriptionPolling();
  };

  const handleConfirmSubscribe = async () => {
    if (botInfo?.subscribeLink) {
      const { webLink, tgWebDeepLink, tgAppLink, startCommand } = buildTelegramHelpers(botInfo.subscribeLink);
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isWindows = /Windows/i.test(navigator.userAgent);
      const isMac = /Mac/i.test(navigator.userAgent);
      
      if (!isMobile && (isWindows || isMac)) {
        // Desktop: Try to open Telegram Desktop app first
        toast.info(t.opening);
        // Copy start command as fallback in case payload is lost
        if (startCommand) {
          try { await navigator.clipboard?.writeText(startCommand); } catch (_) {}
        }
        
        // Direct window.location for better app detection
        window.location.href = tgAppLink;
        
        // Fallback to web after delay if app didn't open
        let usedFallback = false;
        const fallbackTimer = setTimeout(() => {
          if (!usedFallback && !document.hidden) {
            usedFallback = true;
            const w = window.open(webLink, '_blank', 'noopener,noreferrer');
            if (w) {
              toast.success(t.openedBrowser);
            } else {
              toast.message(`${t.openTelegram}: ${webLink}`);
            }
          }
        }, 2500);

        // Cancel fallback if user switched to app
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
        // Mobile: open direct link (OS will handle app/web)
        const newWin = window.open(webLink, '_blank', 'noopener,noreferrer');
        // Copy start command as fallback in case payload is lost
        if (startCommand) {
          try { await navigator.clipboard?.writeText(startCommand); } catch (_) {}
        }
        if (newWin) {
          toast.success(t.openedBrowser);
        } else {
          toast.message(`${t.openTelegram}: ${webLink}`);
        }
      }
      
      setShowDialog(false);
      startSubscriptionPolling();
    }
  };

  // لا تخفي الزر إذا تم التحقق ولا يوجد بوت
  if (checked && !botInfo) {
    return (
      <div className={styles.noBotMessage}>
        <svg className={styles.telegramIcon} viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
        <span className={styles.buttonText}>{t.botNotAvailable}</span>
      </div>
    );
  }

  // إظهار زر placeholder أثناء التحميل
  if (!checked) {
    return (
      <div className={styles.placeholderButton}>
        <svg className={styles.telegramIcon} viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
        <span className={styles.buttonText}>Loading...</span>
      </div>
    );
  }

  return (
    <>
      <button 
        className={isSubscribed ? styles.unsubscribeButton : styles.telegramButton}
        onClick={isSubscribed ? () => setShowDialog(true) : handleSubscribeClick}
        title={isSubscribed ? t.unsubscribeTooltip : t.tooltip}
        disabled={loading}
      >
        <svg className={styles.telegramIcon} viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
        <span className={styles.buttonText}>
          {loading ? 'Loading...' : (isSubscribed ? t.unsubscribe : t.subscribe)}
        </span>
      </button>

      {/* Dialog */}
      {showDialog && mounted && createPortal(
        <div className={`${styles.dialogOverlay} ${theme === 'dark' ? styles.darkTheme : styles.lightTheme}`} onClick={() => setShowDialog(false)}>
          <div className={`${styles.dialog} ${theme === 'dark' ? styles.darkDialog : styles.lightDialog}`} onClick={e => e.stopPropagation()}>
            <div className={styles.dialogHeader}>
              <h3>{isSubscribed ? t.unsubscribeTitle : t.subscribeTitle}</h3>
              <button 
                className={styles.closeButton}
                onClick={() => setShowDialog(false)}
              >
                ×
              </button>
            </div>
            
            <div className={styles.dialogContent}>
              {!isSubscribed && botInfo && (
                <>
                  <div className={styles.botInfo}>
                    <div className={styles.botIcon}>🤖</div>
                    <div>
                      <h4>{botInfo.name}</h4>
                      <p>@{botInfo.username}</p>
                      <small>{botInfo.subscriberCount} subscribers</small>
                    </div>
                  </div>
                  
                  <p className={styles.description}>{t.description}</p>
                  <ul className={styles.featuresList}>
                    {t.features.map((feature, index) => (
                      <li key={index}>{feature}</li>
                    ))}
                  </ul>
                  
                  <p className={styles.note}>{t.note}</p>
                </>
              )}
              
              {isSubscribed && (
                <>
                  <p className={styles.description}>{t.unsubscribeConfirm}</p>
                  <p className={styles.description}>{t.unsubscribeDescription}</p>
                  <ul className={styles.featuresList}>
                    {t.features.map((feature, index) => (
                      <li key={index}>{feature}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            
            <div className={styles.dialogActions}>
              {!isSubscribed && (
                <>
                  <button 
                    className={`${styles.confirmButton} ${theme === 'dark' ? styles.darkConfirmButton : styles.lightConfirmButton}`}
                    onClick={handleConfirmSubscribe}
                    disabled={loading}
                  >
                    <svg className={styles.buttonIcon} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                    </svg>
                    {t.openTelegram}
                  </button>
                  <button 
                    className={`${styles.confirmButton} ${theme === 'dark' ? styles.darkConfirmButton : styles.lightConfirmButton}`}
                    onClick={handleOpenTelegramWeb}
                    disabled={loading}
                  >
                    {t.openTelegramWeb}
                  </button>
                </>
              )}
              
              {isSubscribed && (
                <button 
                  className={`${styles.confirmButton} ${styles.dangerButton} ${theme === 'dark' ? styles.darkConfirmButton : styles.lightConfirmButton}`}
                  onClick={handleUnsubscribe}
                  disabled={loading}
                >
                  {loading ? 'Processing...' : t.confirmUnsubscribe}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
