'use client';

import { useState, useCallback } from 'react';
import { useSubscription } from '@/providers/SubscriptionProvider';
import styles from '@/styles/profile.module.css';
import { toast } from 'sonner';

export default function SubscriptionManagement() {
  const { subscriptionInfo, refreshSubscription, isPro } = useSubscription();
  const [cancelling, setCancelling] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showPlanSelector, setShowPlanSelector] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('free');
  const [message, setMessage] = useState(null);

  const handleSwitchToFreePlan = useCallback(async () => {
    setCancelling(true);
    setMessage(null);

    try {
      const response = await fetch('/api/subscription/switch-to-free', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          confirmCancellation: true,
          reason: 'User switched to free plan'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to switch to free plan');
      }

      toast.success('Successfully switched to Free Plan! Your Pro subscription has been cancelled.');
      
      setMessage({
        type: 'success',
        text: 'Successfully switched to Free Plan. Your Pro subscription has been cancelled.'
      });

      // Refresh subscription info
      if (refreshSubscription) {
        await refreshSubscription();
      }

      setShowConfirmDialog(false);
      setShowPlanSelector(false);
    } catch (error) {
      console.error('Error switching to free plan:', error);
      toast.error(error.message || 'Failed to switch to free plan');
      setMessage({
        type: 'error',
        text: error.message || 'Failed to switch to free plan. Please try again.'
      });
    } finally {
      setCancelling(false);
    }
  }, [refreshSubscription]);

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

      toast.success('Subscription cancelled successfully!');
      setMessage({
        type: 'success',
        text: data.message || 'Subscription cancelled successfully. Your account has been downgraded to the free plan.'
      });

      // Refresh subscription info
      if (refreshSubscription) {
        await refreshSubscription();
      }

      setShowConfirmDialog(false);
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      toast.error(error.message || 'Failed to cancel subscription');
      setMessage({
        type: 'error',
        text: error.message || 'Failed to cancel subscription. Please try again.'
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

  const isFreePlan = subscriptionInfo.plan_type === 'free' || subscriptionInfo.plan_name === 'free' || !isPro;
  const canCancel = !isFreePlan && (subscriptionInfo.status === 'active' || subscriptionInfo.subscription_status === 'active');

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

      {/* Plan Selection */}
      <div className={styles.planSelection}>
        <h4>Switch Plan</h4>
        <div className={styles.planOptions}>
          <div 
            className={`${styles.planCard} ${isFreePlan ? styles.currentPlan : ''}`}
            onClick={() => {
              if (!isFreePlan) {
                setSelectedPlan('free');
                setShowPlanSelector(true);
              }
            }}
          >
            <div className={styles.planHeader}>
              <h5>🆓 Free Plan</h5>
              {isFreePlan && <span className={styles.currentBadge}>Current</span>}
            </div>
            <div className={styles.planFeatures}>
              <ul>
                <li>50 price checks per month</li>
                <li>100 posts per month</li>
                <li>Basic features</li>
              </ul>
            </div>
            {!isFreePlan && (
              <button className={`${styles.button} ${styles.selectButton}`}>
                Switch to Free
              </button>
            )}
          </div>

          <div className={`${styles.planCard} ${!isFreePlan ? styles.currentPlan : ''}`}>
            <div className={styles.planHeader}>
              <h5>⭐ Pro Plan</h5>
              {!isFreePlan && <span className={styles.currentBadge}>Current</span>}
            </div>
            <div className={styles.planFeatures}>
              <ul>
                <li>Unlimited price checks</li>
                <li>Unlimited posts</li>
                <li>Advanced analytics</li>
                <li>Priority support</li>
              </ul>
            </div>
            {isFreePlan && (
              <a href="/pricing" className={`${styles.button} ${styles.upgradeButton}`}>
                Upgrade to Pro 🚀
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className={styles.subscriptionActions}>
        {canCancel && (
          <button
            className={`${styles.button} ${styles.cancelButton}`}
            onClick={() => setShowConfirmDialog(true)}
            disabled={cancelling}
          >
            {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
          </button>
        )}
      </div>

      {/* Plan Switch Confirmation Dialog */}
      {showPlanSelector && (
        <div className={styles.dialogOverlay}>
          <div className={styles.confirmDialog}>
            <h4>Switch to Free Plan</h4>
            <p>
              Are you sure you want to switch to the Free Plan? 
              This will cancel your Pro subscription and you'll lose access to premium features.
            </p>
            <div className={styles.featureComparison}>
              <div className={styles.comparisonColumn}>
                <h5>You'll lose:</h5>
                <ul className={styles.featureList}>
                  <li>❌ Unlimited price checks</li>
                  <li>❌ Unlimited posts</li>
                  <li>❌ Advanced analytics</li>
                  <li>❌ Priority support</li>
                </ul>
              </div>
              <div className={styles.comparisonColumn}>
                <h5>You'll keep:</h5>
                <ul className={styles.featureList}>
                  <li>✅ 50 price checks/month</li>
                  <li>✅ 100 posts/month</li>
                  <li>✅ Basic features</li>
                  <li>✅ Community access</li>
                </ul>
              </div>
            </div>
            <div className={styles.dialogActions}>
              <button
                className={`${styles.button} ${styles.cancelDialogButton}`}
                onClick={() => setShowPlanSelector(false)}
                disabled={cancelling}
              >
                Keep Pro Plan
              </button>
              <button
                className={`${styles.button} ${styles.confirmButton}`}
                onClick={handleSwitchToFreePlan}
                disabled={cancelling}
              >
                {cancelling ? 'Switching...' : 'Confirm Switch to Free'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className={styles.dialogOverlay}>
          <div className={styles.confirmDialog}>
            <h4>Confirm Subscription Cancellation</h4>
            <p>
              Are you sure you want to cancel your subscription? 
              Your account will be downgraded to the free plan and you'll lose access to premium features.
            </p>
            <div className={styles.dialogActions}>
              <button
                className={`${styles.button} ${styles.cancelDialogButton}`}
                onClick={() => setShowConfirmDialog(false)}
                disabled={cancelling}
              >
                Cancel
              </button>
              <button
                className={`${styles.button} ${styles.confirmButton}`}
                onClick={handleCancelSubscription}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
