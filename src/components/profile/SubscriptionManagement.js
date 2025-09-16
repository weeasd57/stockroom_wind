'use client';

import { useState, useCallback } from 'react';
import { useSubscription } from '@/providers/SubscriptionProvider';
import styles from '@/styles/profile.module.css';

export default function SubscriptionManagement() {
  const { subscriptionInfo, refreshSubscription } = useSubscription();
  const [cancelling, setCancelling] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [message, setMessage] = useState(null);

  const handleCancelSubscription = useCallback(async () => {
    setCancelling(true);
    setMessage(null);

    try {
      const response = await fetch('/api/subscription/cancel', {
        method: 'POST',
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to cancel subscription');
      }

      setMessage({
        type: 'success',
        text: data.message || 'تم إلغاء الاشتراك بنجاح. تم تخفيض حسابك إلى الخطة المجانية.'
      });

      // Refresh subscription info
      if (refreshSubscription) {
        await refreshSubscription();
      }

      setShowConfirmDialog(false);
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      setMessage({
        type: 'error',
        text: error.message || 'حدث خطأ أثناء إلغاء الاشتراك. حاول مرة أخرى.'
      });
    } finally {
      setCancelling(false);
    }
  }, [refreshSubscription]);

  const formatDate = (dateString) => {
    if (!dateString) return 'غير متوفر';
    return new Date(dateString).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPlanDisplayName = (planType) => {
    switch (planType) {
      case 'free':
        return 'خطة مجانية';
      case 'pro':
        return 'خطة احترافية';
      case 'premium':
        return 'خطة مميزة';
      default:
        return planType || 'غير محدد';
    }
  };

  const getPlanColor = (planType) => {
    switch (planType) {
      case 'free':
        return '#6b7280';
      case 'pro':
        return '#3b82f6';
      case 'premium':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  if (!subscriptionInfo) {
    return (
      <div className={styles.subscriptionSection}>
        <h3>إدارة الاشتراك</h3>
        <div className={styles.loadingState}>
          <p>جاري تحميل معلومات الاشتراك...</p>
        </div>
      </div>
    );
  }

  const isFreePlan = subscriptionInfo.plan_type === 'free';
  const canCancel = !isFreePlan && subscriptionInfo.status === 'active';

  return (
    <div className={styles.subscriptionSection}>
      <h3>إدارة الاشتراك</h3>
      
      {/* Current Plan Info */}
      <div className={styles.planInfo}>
        <div className={styles.planHeader}>
          <h4>الخطة الحالية</h4>
          <span 
            className={styles.planBadge}
            style={{ backgroundColor: getPlanColor(subscriptionInfo.plan_type) }}
          >
            {getPlanDisplayName(subscriptionInfo.plan_type)}
          </span>
        </div>
        
        <div className={styles.planDetails}>
          <div className={styles.planDetail}>
            <span className={styles.label}>الحالة:</span>
            <span className={styles.value}>
              {subscriptionInfo.status === 'active' ? 'نشط' : 
               subscriptionInfo.status === 'cancelled' ? 'ملغي' : 
               subscriptionInfo.status || 'غير محدد'}
            </span>
          </div>
          
          {subscriptionInfo.start_date && (
            <div className={styles.planDetail}>
              <span className={styles.label}>تاريخ البدء:</span>
              <span className={styles.value}>{formatDate(subscriptionInfo.start_date)}</span>
            </div>
          )}
          
          {subscriptionInfo.end_date && (
            <div className={styles.planDetail}>
              <span className={styles.label}>تاريخ الانتهاء:</span>
              <span className={styles.value}>{formatDate(subscriptionInfo.end_date)}</span>
            </div>
          )}
          
          {subscriptionInfo.cancelled_at && (
            <div className={styles.planDetail}>
              <span className={styles.label}>تاريخ الإلغاء:</span>
              <span className={styles.value}>{formatDate(subscriptionInfo.cancelled_at)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Usage Stats */}
      {subscriptionInfo.usage && (
        <div className={styles.usageStats}>
          <h4>إحصائيات الاستخدام</h4>
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>فحص الأسعار المتبقي</span>
              <span className={styles.statValue}>
                {subscriptionInfo.usage.priceChecks?.remaining || 0}
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>المنشورات المتبقية</span>
              <span className={styles.statValue}>
                {subscriptionInfo.usage.posts?.remaining || 0}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Message Display */}
      {message && (
        <div className={`${styles.message} ${styles[message.type]}`}>
          {message.text}
        </div>
      )}

      {/* Action Buttons */}
      <div className={styles.subscriptionActions}>
        {canCancel && (
          <button
            className={`${styles.button} ${styles.cancelButton}`}
            onClick={() => setShowConfirmDialog(true)}
            disabled={cancelling}
          >
            {cancelling ? 'جاري الإلغاء...' : 'إلغاء الاشتراك'}
          </button>
        )}
        
        {isFreePlan && (
          <div className={styles.upgradePrompt}>
            <p>أنت على الخطة المجانية حالياً</p>
            <button className={`${styles.button} ${styles.upgradeButton}`}>
              ترقية إلى الخطة الاحترافية
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className={styles.dialogOverlay}>
          <div className={styles.confirmDialog}>
            <h4>تأكيد إلغاء الاشتراك</h4>
            <p>
              هل أنت متأكد من أنك تريد إلغاء اشتراكك؟ 
              سيتم تخفيض حسابك إلى الخطة المجانية وستفقد الوصول إلى المميزات المدفوعة.
            </p>
            <div className={styles.dialogActions}>
              <button
                className={`${styles.button} ${styles.cancelDialogButton}`}
                onClick={() => setShowConfirmDialog(false)}
                disabled={cancelling}
              >
                إلغاء
              </button>
              <button
                className={`${styles.button} ${styles.confirmButton}`}
                onClick={handleCancelSubscription}
                disabled={cancelling}
              >
                {cancelling ? 'جاري الإلغاء...' : 'تأكيد الإلغاء'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
