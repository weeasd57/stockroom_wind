'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import { useTheme } from '@/providers/theme-provider';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import styles from '@/styles/telegram-subscribe-button.module.css';

export default function TelegramSubscribeButton({ userId, username }) {
  const { isAuthenticated } = useSupabase();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [botInfo, setBotInfo] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [checked, setChecked] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // تأكد من أن الـ component mounted في الـ client
  useEffect(() => {
    setMounted(true);
  }, []);

  // تحميل البوت بشكل آمن مع fallback
  useEffect(() => {
    if (userId && !checked) {
      // تأخير أطول لضمان تحميل الصفحة أولاً
      const timer = setTimeout(() => {
        checkTelegramBot();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [userId, checked]);

  const checkTelegramBot = async () => {
    try {
      setLoading(true);
      setChecked(true);
      
      // timeout للـ fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(`/api/telegram/check-bot/${userId}`, {
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
      } else {
        setBotInfo(null);
      }
    } catch (error) {
      // لا نعرض error للمستخدم، فقط نخفي الزر
      console.log('Telegram check failed (this is ok):', error.name);
      setBotInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribeClick = () => {
    if (!isAuthenticated) {
      toast.error('يجب تسجيل الدخول أولاً');
      return;
    }

    if (!botInfo) {
      toast.error('البوت غير متاح حالياً');
      return;
    }

    setShowDialog(true);
  };

  const handleConfirmSubscribe = () => {
    if (botInfo?.subscribeLink) {
      // فتح رابط Telegram في نافذة جديدة
      window.open(botInfo.subscribeLink, '_blank');
      setShowDialog(false);
      toast.success('تم توجيهك إلى Telegram للاشتراك');
    }
  };

  // لا تظهر الزر إذا تم التحقق ولا يوجد بوت
  if (checked && !botInfo) {
    return null;
  }

  // إظهار زر placeholder أثناء التحميل
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
      <button 
        className={styles.telegramButton}
        onClick={handleSubscribeClick}
        title={`اشترك في إشعارات ${username} عبر Telegram`}
      >
        <svg className={styles.telegramIcon} viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
        <span className={styles.buttonText}>Subscribe to Telegram</span>
      </button>

      {/* Dialog التأكيد */}
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
              <div className={styles.botInfo}>
                <div className={styles.botIcon}>🤖</div>
                <div>
                  <h4>{botInfo.name}</h4>
                  <p>@{botInfo.username}</p>
                  <small>{botInfo.subscriberCount} مشترك</small>
                </div>
              </div>
              
              <p className={styles.description}>
                ستتلقى إشعارات فورية عن:
              </p>
              <ul className={styles.featuresList}>
                <li>📊 المنشورات الجديدة</li>
                <li>💰 تحديثات الأسعار</li>
                <li>🎯 الوصول للأهداف</li>
                <li>🛑 إيقاف الخسائر</li>
              </ul>
              
              <p className={styles.note}>
                سيتم فتح Telegram للاشتراك في البوت
              </p>
            </div>
            
            <div className={styles.dialogActions}>
              <button 
                className={`${styles.confirmButton} ${theme === 'dark' ? styles.darkConfirmButton : styles.lightConfirmButton}`}
                onClick={handleConfirmSubscribe}
              >
                <svg className={styles.buttonIcon} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                Open Telegram
              </button>
              <button 
                className={`${styles.cancelButton} ${theme === 'dark' ? styles.darkCancelButton : styles.lightCancelButton}`}
                onClick={() => setShowDialog(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
