'use client';

import React, { useState } from 'react';
import { cancelSubscription, switchToFreePlan, syncWithPayPal } from '@/utils/subscription-api';

/**
 * صفحة اختبار نظام إلغاء الاشتراكات
 * يمكن الوصول إليها عبر /test/subscription
 */
export default function SubscriptionTestPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleTest = async (testType) => {
    setLoading(true);
    setError(null);
    setResult(null);

    console.log('🧪 Starting test:', testType);

    try {
      let response;

      switch (testType) {
        case 'cancel':
          response = await cancelSubscription({
            reason: 'Testing cancellation functionality',
            shouldCancelPayPal: true,
            metadata: {
              test: true,
              timestamp: new Date().toISOString()
            }
          });
          break;

        case 'switch_to_free':
          response = await switchToFreePlan({
            confirmCancellation: true,
            reason: 'Testing switch to free functionality',
            shouldCancelPayPal: true,
            metadata: {
              test: true,
              timestamp: new Date().toISOString()
            }
          });
          break;

        case 'sync':
          // For testing, we want to use the test manager for sync operations too
          response = await fetch('/api/subscription/manage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'sync_with_paypal',
              metadata: { test: true, timestamp: new Date().toISOString() }
            })
          });
          response = await response.json();
          break;

        case 'auth_test':
          // اختبار المصادقة مباشرة
          const authResponse = await fetch('/api/subscription/manage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'cancel', reason: 'Auth test' })
          });
          response = await authResponse.json();
          break;

        default:
          throw new Error('Unknown test type');
      }

      console.log('🧪 Test result:', response);
      setResult(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestScenario = async (scenario) => {
    setLoading(true);
    setError(null);
    setResult(null);

    console.log('🧪 Starting scenario test:', scenario);

    try {
      let response;

      switch (scenario) {
        case 'already_free':
          response = await cancelSubscription({
            reason: 'Testing already free scenario',
            shouldCancelPayPal: false,
            metadata: { scenario: 'already_free' }
          });
          break;

        case 'no_subscription':
          response = await cancelSubscription({
            reason: 'Testing no subscription scenario',
            shouldCancelPayPal: false,
            metadata: { scenario: 'no_subscription' }
          });
          break;

        case 'error':
          response = await cancelSubscription({
            reason: 'Testing error scenario',
            shouldCancelPayPal: true,
            metadata: { scenario: 'error' }
          });
          break;

        default:
          throw new Error('Unknown scenario: ' + scenario);
      }

      console.log('🧪 Scenario result:', response);
      setResult(response);
    } catch (err) {
      console.error('🧪 Scenario error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>🧪 اختبار نظام إلغاء الاشتراكات</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>الاختبارات المتاحة:</h3>
        
        <div style={{ marginBottom: '15px' }}>
          <h4>✅ اختبارات النجاح:</h4>
          <button 
            onClick={() => handleTest('cancel')}
            disabled={loading}
            style={{ margin: '5px', padding: '10px', backgroundColor: '#44aa44', color: 'white' }}
          >
            🚫 إلغاء اشتراك نشط
          </button>
          
          <button 
            onClick={() => handleTest('switch_to_free')}
            disabled={loading}
            style={{ margin: '5px', padding: '10px', backgroundColor: '#4488aa', color: 'white' }}
          >
            🔄 تحويل للمجاني
          </button>
          
          <button 
            onClick={() => handleTest('sync')}
            disabled={loading}
            style={{ margin: '5px', padding: '10px', backgroundColor: '#4444ff', color: 'white' }}
          >
            🔄 مزامنة PayPal
          </button>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <h4>⚠️ اختبارات الحالات الخاصة:</h4>
          <button 
            onClick={() => handleTestScenario('already_free')}
            disabled={loading}
            style={{ margin: '5px', padding: '10px', backgroundColor: '#ffaa44', color: 'white' }}
          >
            👤 مستخدم على مجاني بالفعل
          </button>
          
          <button 
            onClick={() => handleTestScenario('no_subscription')}
            disabled={loading}
            style={{ margin: '5px', padding: '10px', backgroundColor: '#ff6644', color: 'white' }}
          >
            ❌ لا يوجد اشتراك
          </button>
          
          <button 
            onClick={() => handleTestScenario('error')}
            disabled={loading}
            style={{ margin: '5px', padding: '10px', backgroundColor: '#aa4444', color: 'white' }}
          >
            💥 اختبار خطأ
          </button>
        </div>

        <div>
          <h4>🔧 اختبارات تقنية:</h4>
          <button 
            onClick={() => handleTest('auth_test')}
            disabled={loading}
            style={{ margin: '5px', padding: '10px', backgroundColor: '#44ff44', color: 'white' }}
          >
            🔑 اختبار المصادقة
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ padding: '10px', backgroundColor: '#f0f0f0', border: '1px solid #ccc' }}>
          ⏳ جاري تنفيذ الاختبار...
        </div>
      )}

      {error && (
        <div style={{ padding: '10px', backgroundColor: '#ffebee', border: '1px solid #f44336', marginTop: '10px' }}>
          <h4>❌ خطأ:</h4>
          <pre>{error}</pre>
        </div>
      )}

      {result && (
        <div style={{ padding: '10px', backgroundColor: '#e8f5e8', border: '1px solid #4caf50', marginTop: '10px' }}>
          <h4>✅ نتيجة الاختبار:</h4>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}

      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f9f9f9', border: '1px solid #ddd' }}>
        <h4>📋 ملاحظات الاختبار:</h4>
        <ul>
          <li>تأكد من تسجيل الدخول قبل الاختبار</li>
          <li>تحقق من وجود اشتراك نشط للإلغاء</li>
          <li>راقب console المتصفح للتفاصيل الإضافية</li>
          <li>تحقق من قاعدة البيانات بعد الاختبار</li>
        </ul>
      </div>
    </div>
  );
}
