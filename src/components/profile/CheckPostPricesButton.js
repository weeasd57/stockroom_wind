'use client';

import { useState } from 'react';
import styles from '@/styles/profile.module.css';

// دالة لتنسيق التاريخ
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export default function CheckPostPricesButton({ userId }) {
  const [isChecking, setIsChecking] = useState(false);
  const [results, setResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState(null);
  
  const checkPostPrices = async () => {
    setIsChecking(true);
    setResults(null);
    setError(null);
    
    try {
      console.log('إرسال طلب التحقق من الأسعار للمستخدم:', userId);
      const response = await fetch('/api/posts/check-prices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId }), // إضافة معرف المستخدم في جسم الطلب
        credentials: 'include' // إضافة هذا الخيار لإرسال ملفات تعريف الارتباط مع الطلب
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'حدث خطأ أثناء التحقق من الأسعار');
      }
      
      setResults(data);
      setShowResults(true);
    } catch (err) {
      console.error('خطأ في التحقق من الأسعار:', err);
      setError(err.message || 'حدث خطأ أثناء التحقق من الأسعار');
    } finally {
      setIsChecking(false);
    }
  };
  
  const closeResults = () => {
    setShowResults(false);
  };
  
  return (
    <div className={styles.priceCheckContainer}>
      <button 
        onClick={checkPostPrices}
        disabled={isChecking}
        className={styles.checkPricesButton}
        aria-label="تحقق من أسعار المنشورات"
      >
        {isChecking ? 'جاري التحقق...' : '📈 تحقق من أسعار المنشورات'}
      </button>
      
      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}
      
      {showResults && results && (
        <div className={styles.resultsDialog}>
          <div className={styles.resultsDialogContent}>
            <button className={styles.closeButton} onClick={closeResults}>×</button>
            
            <h3>نتائج التحقق من الأسعار</h3>
            
            <div className={styles.usageInfo}>
              <p>
                عدد مرات التحقق اليوم: <strong>{results.usageCount}</strong> من <strong>2</strong>
                <br />
                عدد مرات التحقق المتبقية: <strong>{results.remainingChecks}</strong>
              </p>
            </div>
            
            {results.results && results.results.length > 0 ? (
              <div className={styles.resultsList}>
                {results.results.map(post => (
                  <div key={post.id} className={styles.resultItem}>
                    <div className={styles.resultHeader}>
                      <strong>{post.symbol}</strong> - {post.companyName}
                      {post.closed && (
                        <span className={styles.closedLabel}>مغلق</span>
                      )}
                    </div>
                    
                    <div className={styles.resultDetails}>
                      <div className={styles.priceInfo}>
                        <div>السعر الحالي: <strong>{post.currentPrice.toFixed(2)}</strong></div>
                        <div>سعر الهدف: <strong>{post.targetPrice.toFixed(2)}</strong></div>
                        <div>سعر وقف الخسارة: <strong>{post.stopLossPrice.toFixed(2)}</strong></div>
                      </div>
                      
                      <div className={styles.statusInfo}>
                        {post.targetReached ? (
                          <div className={styles.targetReached}>
                            <span role="img" aria-label="هدف">🎯</span> تم الوصول إلى سعر الهدف!
                            {post.targetReachedDate && (
                              <div className={styles.dateInfo}>
                                <span role="img" aria-label="تاريخ">📅</span> تاريخ الوصول: {formatDate(post.targetReachedDate)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className={styles.targetInfo}>
                            نسبة الوصول للهدف: <strong>{post.percentToTarget}%</strong>
                          </div>
                        )}
                        
                        {post.stopLossTriggered ? (
                          <div className={styles.stopLossTriggered}>
                            <span role="img" aria-label="تحذير">⚠️</span> تم تفعيل وقف الخسارة!
                            {post.stopLossTriggeredDate && (
                              <div className={styles.dateInfo}>
                                <span role="img" aria-label="تاريخ">📅</span> تاريخ التفعيل: {formatDate(post.stopLossTriggeredDate)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className={styles.stopLossInfo}>
                            المسافة لوقف الخسارة: <strong>{post.percentToStopLoss}%</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.noResults}>
                لم يتم العثور على منشورات للتحقق من أسعارها.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
