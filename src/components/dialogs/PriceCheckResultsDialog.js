'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from 'next-themes';
import styles from './PriceCheckResultsDialog.module.css';

export default function PriceCheckResultsDialog({ 
  isOpen, 
  onClose, 
  results,
  stats 
}) {
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();
  const [selectedForBroadcast, setSelectedForBroadcast] = useState([]);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [tgTitle, setTgTitle] = useState('');
  const [tgComment, setTgComment] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedForBroadcast([]);
      setTgTitle(`Price Check Update - ${new Date().toLocaleDateString()}`);
      setTgComment('');
    }
  }, [isOpen]);

  // Format price with 2 decimal places or display N/A if null
  const formatPrice = (price) => {
    if (!price) return 'N/A';
    return parseFloat(price).toFixed(2);
  };

  // Toggle post selection for broadcast
  const toggleSelectPost = (postId) => {
    setSelectedForBroadcast(prev => 
      prev.includes(postId) 
        ? prev.filter(id => id !== postId)
        : [...prev, postId]
    );
  };

  // Select all posts with changes
  const selectAllChanged = () => {
    const changedPosts = (results || []).filter(res => 
      res.targetReached || res.stopLossTriggered || res.closed
    );
    setSelectedForBroadcast(changedPosts.map(post => post.id));
  };

  // Clear all selections
  const clearAllSelected = () => {
    setSelectedForBroadcast([]);
  };

  // Handle Telegram broadcast
  const handleSendTelegram = async () => {
    if (selectedForBroadcast.length === 0) return;
    
    setSendingBroadcast(true);
    try {
      const response = await fetch('/api/telegram/send-broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          postIds: selectedForBroadcast,
          title: tgTitle || 'Price Check Update',
          comment: tgComment
        }),
        credentials: 'include'
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to send Telegram broadcast');
      }

      // Show success notification
      if (typeof window !== 'undefined' && window.showNotification) {
        window.showNotification('✅ Telegram broadcast sent successfully', 'success');
      }
      
      // Reset form and close dialog
      setSelectedForBroadcast([]);
      setTgTitle('');
      setTgComment('');
      onClose();
      
    } catch (error) {
      console.error('❌ Failed to send Telegram broadcast:', error);
      if (typeof window !== 'undefined' && window.showNotification) {
        window.showNotification(error.message || 'Failed to send Telegram broadcast', 'error');
      }
    } finally {
      setSendingBroadcast(false);
    }
  };

  // Don't render on server side
  if (!mounted || !isOpen) return null;

  const dialogContent = (
    <div 
      className={`${styles.dialogOverlay} ${theme === 'dark' ? styles.dark : styles.light}`} 
      onClick={onClose}
    >
      <div className={styles.dialogContainer} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.dialogHeader}>
          <h3 className={styles.dialogTitle}>📊 Price Check Results</h3>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Content */}
        <div className={styles.dialogContent}>
          {/* Summary Section */}
          {stats && (
            <div className={styles.summarySection}>
              <div className={styles.summaryGrid}>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Checks Today:</span>
                  <span className={styles.summaryValue}>{stats.usageCount || 0}</span>
                </div>
                {typeof stats.remainingChecks !== 'undefined' && (
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Remaining:</span>
                    <span className={styles.summaryValue}>{stats.remainingChecks}</span>
                  </div>
                )}
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Checked Posts:</span>
                  <span className={styles.summaryValue}>{stats.checkedPosts || 0}</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Updated Posts:</span>
                  <span className={styles.summaryValue}>{stats.updatedPosts || 0}</span>
                </div>
              </div>
            </div>
          )}

          {/* Results List */}
          <div className={styles.resultsSection}>
            <h4 className={styles.sectionTitle}>📈 Detailed Results</h4>
            <div className={styles.resultsList}>
              {results && results.length > 0 ? (
                results.map((result, index) => {
                  const statusLabel = result.targetReached
                    ? 'Target Reached'
                    : result.stopLossTriggered
                      ? 'Stop Loss Triggered'
                      : result.message
                        ? result.message
                        : 'Checked';
                  
                  const statusClass = result.targetReached
                    ? styles.targetReached
                    : result.stopLossTriggered
                      ? styles.stopLoss
                      : result.message && (result.noDataAvailable || result.postAfterMarketClose)
                        ? styles.warning
                        : styles.checked;

                  return (
                    <div key={index} className={styles.resultItem}>
                      <div className={styles.resultHeader}>
                        <div className={styles.symbolInfo}>
                          <span className={styles.symbol}>{result.symbol || 'N/A'}</span>
                          {result.companyName && (
                            <span className={styles.companyName}>{result.companyName}</span>
                          )}
                        </div>
                        <span className={`${styles.statusBadge} ${statusClass}`}>
                          {statusLabel}
                          {result.closed ? ' (Closed)' : ''}
                        </span>
                      </div>
                      <div className={styles.priceInfo}>
                        <span>Current: <strong>{formatPrice(result.currentPrice)}</strong></span>
                        <span>Target: <strong>{formatPrice(result.targetPrice)}</strong></span>
                        <span>Stop Loss: <strong>{formatPrice(result.stopLossPrice)}</strong></span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className={styles.noResults}>
                  📝 No results available
                </div>
              )}
            </div>
          </div>

          {/* Telegram Broadcast Section */}
          {results && results.length > 0 && (
            <div className={styles.telegramSection}>
              <h4 className={styles.sectionTitle}>📢 Telegram Broadcast</h4>
              
              {/* Title Input */}
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Title</label>
                <input
                  type="text"
                  value={tgTitle}
                  onChange={(e) => setTgTitle(e.target.value)}
                  placeholder="Price Check Update - [Date]"
                  className={styles.textInput}
                />
              </div>

              {/* Comment Input */}
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Comment (optional)</label>
                <textarea
                  value={tgComment}
                  onChange={(e) => setTgComment(e.target.value)}
                  rows={3}
                  placeholder="Add a short comment to your followers..."
                  className={styles.textArea}
                />
              </div>

              {/* Post Selection */}
              <div className={styles.inputGroup}>
                <div className={styles.selectionHeader}>
                  <label className={styles.inputLabel}>Select posts to include</label>
                  <div className={styles.selectionActions}>
                    <button 
                      className={styles.selectChangedBtn} 
                      onClick={selectAllChanged}
                      type="button"
                    >
                      📈 Select changed
                    </button>
                    <button 
                      className={styles.clearSelectionBtn} 
                      onClick={clearAllSelected}
                      type="button"
                    >
                      🗑️ Clear
                    </button>
                  </div>
                </div>
                
                <div className={styles.postSelectionList}>
                  {results.map((result) => (
                    <label key={result.id} className={styles.postSelectionItem}>
                      <input
                        type="checkbox"
                        checked={selectedForBroadcast.includes(result.id)}
                        onChange={() => toggleSelectPost(result.id)}
                        className={styles.checkbox}
                      />
                      <span className={styles.postSymbol}>{result.symbol || 'N/A'}</span>
                      <span className={styles.postCompany}>{result.companyName || ''}</span>
                      {(result.targetReached || result.stopLossTriggered || result.closed) && (
                        <span className={styles.postStatusBadge}>
                          {result.targetReached ? '🎯 Target' : 
                           result.stopLossTriggered ? '🛑 Stop Loss' : 
                           result.closed ? '🔒 Closed' : ''}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
                
                <div className={styles.selectionCount}>
                  📊 Selected: {selectedForBroadcast.length} / {results.length} posts
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.dialogFooter}>
          <div className={styles.telegramControls}>
            <button 
              className={styles.sendButton}
              onClick={handleSendTelegram}
              disabled={sendingBroadcast || selectedForBroadcast.length === 0}
            >
              {sendingBroadcast ? '📤 Sending...' : '📢 Send to Telegram'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Use portal to render dialog at document.body level
  return createPortal(dialogContent, document.body);
}
