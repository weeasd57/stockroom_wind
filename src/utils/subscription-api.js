/**
 * Frontend Utilities for Subscription Management
 * دوال مساعدة لاستخدام API إدارة الاشتراكات من الفرونت إند
 */

const API_BASE = '/api/subscription/manage';

/**
 * إلغاء الاشتراك فوراً
 */
export async function cancelSubscription(options = {}) {
  try {
    const _dbgStart = Date.now();
    console.warn('[subscription-api] cancel -> start');
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'cancel',
        reason: options.reason,
        shouldCancelPayPal: options.shouldCancelPayPal,
        metadata: options.metadata
      }),
    });
    console.warn('[subscription-api] cancel <- end', { status: response.status, ms: Date.now() - _dbgStart });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'Failed to cancel subscription');
    }
    
    return result;
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    throw error;
  }
}

/**
 * التحويل للخطة المجانية مع تأكيد
 */
export async function switchToFreePlan(options = {}) {
  try {
    if (!options.confirmCancellation) {
      throw new Error('Confirmation is required to switch to free plan');
    }

    const _dbgStart = Date.now();
    console.warn('[subscription-api] switch_to_free -> start');
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'switch_to_free',
        confirmCancellation: options.confirmCancellation,
        reason: options.reason,
        shouldCancelPayPal: options.shouldCancelPayPal,
        metadata: options.metadata
      }),
    });
    console.warn('[subscription-api] switch_to_free <- end', { status: response.status, ms: Date.now() - _dbgStart });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'Failed to switch to free plan');
    }
    
    return result;
  } catch (error) {
    console.error('Error switching to free plan:', error);
    throw error;
  }
}

/**
 * مزامنة حالة الاشتراك مع PayPal
 */
export async function syncWithPayPal() {
  try {
    const _dbgStart = Date.now();
    console.warn('[subscription-api] sync_with_paypal -> start');
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'sync_with_paypal'
      }),
    });
    console.warn('[subscription-api] sync_with_paypal <- end', { status: response.status, ms: Date.now() - _dbgStart });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'Failed to sync with PayPal');
    }
    
    return result;
  } catch (error) {
    console.error('Error syncing with PayPal:', error);
    throw error;
  }
}

/**
 * التحقق من صحة اشتراك PayPal
 */
export async function validatePayPalSubscription(subscriptionId) {
  try {
    if (!subscriptionId) {
      throw new Error('PayPal subscription ID is required');
    }

    const _dbgStart = Date.now();
    console.warn('[subscription-api] validate_paypal -> start');
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'validate_paypal',
        subscriptionId
      }),
    });
    console.warn('[subscription-api] validate_paypal <- end', { status: response.status, ms: Date.now() - _dbgStart });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'Failed to validate PayPal subscription');
    }
    
    return result;
  } catch (error) {
    console.error('Error validating PayPal subscription:', error);
    throw error;
  }
}

/**
 * React Hook لإدارة حالة الاشتراك
 */
import { useState } from 'react';

export function useSubscriptionActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCancel = async (options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const result = await cancelSubscription(options);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToFree = async (options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const result = await switchToFreePlan(options);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await syncWithPayPal();
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async (subscriptionId) => {
    setLoading(true);
    setError(null);
    try {
      const result = await validatePayPalSubscription(subscriptionId);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    cancelSubscription: handleCancel,
    switchToFreePlan: handleSwitchToFree,
    syncWithPayPal: handleSync,
    validatePayPalSubscription: handleValidate,
    clearError: () => setError(null)
  };
}

/**
 * دالة مساعدة لعرض رسائل الأخطاء بالعربية
 */
export function getSubscriptionErrorMessage(error) {
  const errorMessages = {
    'auth_required': 'يجب تسجيل الدخول أولاً',
    'confirmation_required': 'يجب تأكيد العملية',
    'no_subscription': 'لا يوجد اشتراك نشط للإلغاء',
    'cancellation_failed': 'فشل في إلغاء الاشتراك',
    'switch_failed': 'فشل في التحويل للخطة المجانية',
    'missing_subscription_id': 'معرف اشتراك PayPal مطلوب',
    'paypal_error': 'خطأ في التواصل مع PayPal',
    'server_error': 'خطأ في الخادم، حاول مرة أخرى'
  };

  return errorMessages[error] || error || 'حدث خطأ غير متوقع';
}

/**
 * التحقق من حالة الاشتراك
 */
export function getSubscriptionStatus(subscription) {
  if (!subscription) return 'free';
  
  const { plan_type, subscription_status, status } = subscription;
  
  if (plan_type === 'free') return 'free';
  if (subscription_status === 'active' || status === 'active') return 'active';
  if (subscription_status === 'cancelled' || status === 'cancelled') return 'cancelled';
  if (subscription_status === 'expired' || status === 'expired') return 'expired';
  
  return 'unknown';
}

/**
 * تنسيق تاريخ انتهاء الاشتراك
 */
export function formatSubscriptionDate(dateString, locale = 'ar-EG') {
  if (!dateString) return null;
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
}
