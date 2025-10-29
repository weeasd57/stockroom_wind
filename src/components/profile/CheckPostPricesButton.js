'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import styles from '@/styles/profile.module.css';
import { useProfile } from '@/providers/ProfileProvider';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import { useSubscription } from '@/providers/SubscriptionProvider';
import { useBackgroundPriceCheck } from '@/providers/BackgroundPriceCheckProvider';
import dialogStyles from '@/styles/ProfilePostCard.module.css';
import ConfirmActionDialog from '@/components/common/ConfirmActionDialog'; // Import the new dialog
import { savePriceCheckResult } from '@/utils/priceCheckHistory';

export default function CheckPostPricesButton({ userId }) {
  const [isChecking, setIsChecking] = useState(false);
  const [checkStats, setCheckStats] = useState(null);
  const [error, setError] = useState(null);
  const { refreshData } = useProfile();
  const { supabase } = useSupabase();
  const { canPerformPriceCheck, refreshSubscription, usageInfo } = useSubscription();
  const { submitPriceCheck, isProcessing } = useBackgroundPriceCheck();
  const [abortController, setAbortController] = useState(null);
  const [isCancelled, setIsCancelled] = useState(false);
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  const [realTimeUpdates, setRealTimeUpdates] = useState(new Map());
  const [detailedResults, setDetailedResults] = useState([]);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false); // New state for confirm dialog
  const [confirmDialogContent, setConfirmDialogContent] = useState({ title: '', message: '', confirmAction: () => {}, confirmText: 'Confirm', cancelText: 'Cancel', showCancelButton: true });
  const [isPreflight, setIsPreflight] = useState(false);
  
  // Telegram broadcast states
  const [sendToTelegram, setSendToTelegram] = useState(false);
  const [selectedForBroadcast, setSelectedForBroadcast] = useState([]);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [tgTitle, setTgTitle] = useState('');
  const [tgComment, setTgComment] = useState('');
  
  // Real-time subscription for price updates
  useEffect(() => {
    if (!supabase || !userId) return;
    
    const channel = supabase
      .channel('price-check-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'posts',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        console.log('Real-time price update received:', payload);
        
        // Check if this is a price-related update
        const updatedFields = Object.keys(payload.new || {});
        const priceFields = ['current_price', 'last_price_check', 'target_reached', 'stop_loss_triggered', 'price_checks', 'status_message'];
        
        if (updatedFields.some(field => priceFields.includes(field))) {
          setRealTimeUpdates(prev => {
            const newMap = new Map(prev);
            newMap.set(payload.new.id, {
              ...payload.new,
              timestamp: new Date().toISOString()
            });
            return newMap;
          });
          
          // Refresh profile data to update the UI
          if (refreshData) {
            refreshData(userId);
          }
        }
      })
      .subscribe();
    
    return () => {
      try { 
        channel.unsubscribe(); 
      } catch (e) {
        console.log('Error unsubscribing from price updates:', e);
      }
    };
  }, [supabase, userId, refreshData]);
  
  const cancelCheck = () => {
    if (abortController) {
      // Mark as cancelled before aborting to prevent processing response
      setIsCancelled(true);
      abortController.abort();
      setIsChecking(false);
      setError('Price check cancelled');
      setTimeout(() => {
        setError(null);
      }, 3000);
    }
  };
  
  // Format price with 2 decimal places or display N/A if null
  const formatPrice = (price) => {
    if (!price) return 'N/A';
    return parseFloat(price).toFixed(2);
  };
  
  // Format date to locale string or display N/A if null
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString(undefined, {
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Function to actually perform the POST request after confirmation - using useCallback
  const handleProceedCheck = useCallback(async () => {
    if (!userId) return;
    
    // Hide the confirmation dialog immediately
    setShowConfirmDialog(false);
    
    console.log('[CHECK POST PRICES] Starting price check request:', {
      timestamp: new Date().toISOString(),
      userId: userId,
      remainingChecks: usageInfo?.priceChecks?.remaining || 0,
      canPerformCheck: canPerformPriceCheck()
    });
    
    // Check if user can perform price check
    if (!canPerformPriceCheck()) {
      console.log('[CHECK POST PRICES] Price check limit reached:', {
        remaining: usageInfo?.priceChecks?.remaining || 0
      });
      setError(`You have reached your price check limit. Remaining: ${usageInfo?.priceChecks?.remaining || 0}`);
      return;
    }
    
    setIsChecking(true);

    // Create a new AbortController for this request
    const controller = new AbortController();
    setAbortController(controller);

    try {
      // Set a 3-minute timeout for the API request
      const timeoutId = setTimeout(() => {
        if (!isCancelled) {
          console.log('[CHECK POST PRICES] Request timed out after 3 minutes');
          controller.abort();
          setError('Request timed out after 3 minutes. Please try again.');
          setIsChecking(false);
        }
      }, 3 * 60 * 1000); // 3 minutes in milliseconds

      // Request the price check API
      const response = await fetch('/api/posts/check-prices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId }), 
        credentials: 'include',
        signal: controller.signal // Add the abort signal to the fetch request
      });

      // Clear the timeout if request completes successfully
      clearTimeout(timeoutId);
      
      // Check if cancelled before processing response
      if (isCancelled) {
        console.log('Request was cancelled, ignoring response');
        return;
      }
      
      const data = await response.json();
      
      // Check again if cancelled after parsing JSON
      if (isCancelled) {
        console.log('Request was cancelled while parsing response, ignoring data');
        return;
      }
      
      if (!response.ok) {
        // Special handling for API key errors
        if (response.status === 429) {
          setError(data.message || 'You have reached the maximum checks for this month. Try again next month.');
        } else if (data.error === 'missing_api_key') {
          throw new Error('API key not configured. Please contact the administrator to set up the stock data API.');
        } else {
          throw new Error(data.message || 'An error occurred while checking prices');
        }
      }
      
      // Received API response
      console.log('[CHECK POST PRICES] Last check request completed:', {
        timestamp: new Date().toISOString(),
        usageCount: data.usageCount,
        remainingChecks: data.remainingChecks,
        checkedPosts: data.checkedPosts,
        updatedPosts: data.updatedPosts,
        closedPostsSkipped: data.closedPostsSkipped,
        results: data.results
      });
      
      setCheckStats({
        usageCount: data.usageCount,
        remainingChecks: usageInfo?.priceChecks?.remaining || 0, // Get from subscription provider
        checkedPosts: data.checkedPosts,
        updatedPosts: data.updatedPosts,
        closedPostsSkipped: data.closedPostsSkipped
      });
      
      // Store detailed results for display in the dialog
      if (data.results && Array.isArray(data.results)) {
        setDetailedResults(data.results);
      }
      
      // Save results to localStorage for history
      const historyEntryId = savePriceCheckResult({
        checkedPosts: data.checkedPosts,
        updatedPosts: data.updatedPosts,
        closedPostsSkipped: data.closedPostsSkipped,
        usageCount: data.usageCount,
        remainingChecks: data.remainingChecks,
        results: data.results,
        userId: userId
      });
      
      console.log(`[CHECK POST PRICES] Saved to history with ID: ${historyEntryId}`);
      
      // Refresh subscription info after successful check
      refreshSubscription();
      
      if (userId && !isCancelled) {
        refreshData(userId);
      }
      
      // Show the stats dialog
      if (!isCancelled) {
        setShowStatsDialog(true);
      } 
      
    } catch (err) {
      if (err.name === 'AbortError') {
        // This is expected when the request is aborted
        console.log('[CHECK POST PRICES] Request aborted');
        // Don't set error if already handled by timeout or cancel
        if (!isCancelled) {
          setError('Request was cancelled');
        }
      } else if (!isCancelled) {
        // Only set error if not cancelled
        console.error('[CHECK POST PRICES] Error occurred:', err);
        setError(err.message || 'An error occurred while checking prices');
      }
    } finally {
      // Always ensure loading state is stopped
      setIsChecking(false);
      setAbortController(null);
      // Reset cancelled state
      setIsCancelled(false);
      console.log('[CHECK POST PRICES] Request completed, loading state cleared');
    }
  }, [userId, refreshData, canPerformPriceCheck, usageInfo, refreshSubscription]);
  
  const checkPostPrices = async () => {
    // Prevent duplicate submissions while background task is running
    if (isProcessing) {
      console.log('[CHECK POST PRICES] Skipping: background processing already running');
      return;
    }
    setCheckStats(null);
    setError(null);
    setIsCancelled(false);
    setDetailedResults([]);

    // Get remaining checks from subscription provider
    const remaining = usageInfo?.priceChecks?.remaining || 0;

    // If limit reached, show info-only dialog
    if (remaining <= 0) {
      console.error('[CHECK POST PRICES] Limit reached. Remaining checks is 0');
      setConfirmDialogContent({
        title: 'Monthly Check Limit Reached',
        message: 'You have reached the maximum price checks for this month. Please upgrade your plan or try again next month.',
        confirmAction: () => setShowConfirmDialog(false),
        confirmText: 'Got it',
        showCancelButton: false
      });
      setShowConfirmDialog(true);
      return;
    }

    const remainingText = ` You have ${remaining} checks left for this month.`;
    setConfirmDialogContent({
      title: 'Confirm Price Check',
      message: `This will check the latest prices for your posts and update their statuses accordingly.${remainingText}`,
      confirmAction: handleProceedCheckBackground,
      confirmText: 'Proceed',
      cancelText: 'Cancel',
      showCancelButton: true
    });
    setShowConfirmDialog(true);
  };

  // New background price check handler
  const handleProceedCheckBackground = async () => {
    setShowConfirmDialog(false);
    
    try {
      // Submit to background processing
      const taskId = await submitPriceCheck(userId);
      
      console.log(`[PRICE CHECK] Price check submitted to background processing: ${taskId}`);
      
      // Show success message
      if (typeof window !== 'undefined') {
        console.log('✅ Price check submitted to background processing');
      }
      
    } catch (error) {
      console.error('[CHECK POST PRICES] Error submitting price check:', error);
      setError(error.message || 'Failed to submit price check. Please try again.');
    }
  };
  
  // Calculate price change percentage and direction between initial and last price
  const getPriceChangeStatus = (post) => {
    if (!post.last_price || (!post.initial_price && !post.current_price)) return null;
    
    const initial = parseFloat(post.initial_price || post.current_price);
    const last = parseFloat(post.last_price);
    
    if (last < initial) {
      return { change: 'decrease', percent: (((initial - last) / initial) * 100).toFixed(2) };
    } else if (last > initial) {
      return { change: 'increase', percent: (((last - initial) / initial) * 100).toFixed(2) };
    }
    return { change: 'none', percent: 0 };
  };

  // Telegram broadcast functions
  const toggleSelectPost = (postId) => {
    setSelectedForBroadcast(prev => 
      prev.includes(postId) 
        ? prev.filter(id => id !== postId)
        : [...prev, postId]
    );
  };

  const selectAllChanged = () => {
    const changedPosts = (detailedResults || []).filter(res => 
      res.targetReached || res.stopLossTriggered || res.closed
    );
    setSelectedForBroadcast(changedPosts.map(post => post.id));
  };

  const clearAllSelected = () => {
    setSelectedForBroadcast([]);
  };

  const handleSendTelegram = async () => {
    if (!sendToTelegram || selectedForBroadcast.length === 0) return;
    
    setSendingBroadcast(true);
    try {
      // Get access token
      const { data: { session } } = await supabase.auth.getSession();
      const headers = {
        'Content-Type': 'application/json'
      };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/telegram/send-broadcast', {
        method: 'POST',
        headers,
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

      // Show success message
      console.log('✅ Telegram broadcast sent successfully');
      
      // Reset form
      setSendToTelegram(false);
      setSelectedForBroadcast([]);
      setTgTitle('');
      setTgComment('');
      
    } catch (error) {
      console.error('❌ Failed to send Telegram broadcast:', error);
      setError(error.message || 'Failed to send Telegram broadcast');
    } finally {
      setSendingBroadcast(false);
    }
  };
  
  return (
    <div className={styles.priceCheckContainer}>
      <div className={styles.priceCheckButtonGroup}>
        <div style={{ flex: 1 }}></div>
        
        <button 
          onClick={checkPostPrices}
          disabled={isChecking || isPreflight || isProcessing}
          className={`${styles.checkPricesButton} ${isProcessing ? styles.processing : ''}`}
          aria-label="Check post prices"
        >
          {(isChecking || isPreflight || isProcessing) ? (
            <>
              <div className={styles.modernSpinner}>
                <div className={styles.spinnerRing}></div>
              </div>
              {isProcessing ? 'Processing in background...' : isChecking ? 'Checking...' : 'Preparing...'}
            </>
          ) : (
            <>
              <span className={styles.buttonIcon}>📈</span>
              Check Post Prices
              {realTimeUpdates.size > 0 && (
                <span className={styles.updateBadge}>
                  {realTimeUpdates.size}
                </span>
              )}
            </>
          )}
        </button>
        
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          
          <button 
            onClick={() => setShowInfoDialog(true)}
            className={styles.infoButton}
            aria-label="Check prices information"
          >
            ℹ️ Info
          </button>
          
          {isChecking && (
            <button 
              onClick={cancelCheck}
              className={styles.cancelCheckButton}
              aria-label="Cancel price check"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
      
      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}
      
      {/* Info Dialog */}
      {showInfoDialog && (
        <div className={dialogStyles.dialogOverlay} onClick={() => setShowInfoDialog(false)} style={{ zIndex: 9999 }}>
          <div className={dialogStyles.statusDialog} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className={dialogStyles.dialogHeader}>
              <h3>Check Post Prices Information</h3>
              <button className={dialogStyles.closeButton} onClick={() => setShowInfoDialog(false)}>Close</button>
            </div>
            <div className={dialogStyles.dialogContent}>
              <div className={styles.infoContent}>
                <h4>What does "Check Post Prices" do?</h4>
                <p>This feature checks the current prices of stocks in your posts and updates their status based on your target and stop-loss prices.</p>
                
                <h4>How it works:</h4>
                <ul>
                  <li>Fetches the latest price data for each stock from the EOD Historical Data API</li>
                  <li>Compares the latest prices against your target and stop-loss prices</li>
                  <li>Automatically marks posts as "Target Reached" or "Stop Loss Triggered" based on price movement</li>
                  <li>Updates your experience score when targets are reached or stop losses are triggered</li>
                </ul>
                
                
                <h4>Tips:</h4>
                <ul>
                  <li>Check prices regularly to keep your portfolio status up to date</li>
                  <li>Posts created after market close may not show updated prices until the next trading day</li>
                  <li>If the API is temporarily unavailable, the system will use the last known price</li>
                </ul>
              </div>
              
              <div className={styles.statsActions}>
                <button 
                  className={styles.closeStatsButton}
                  onClick={() => setShowInfoDialog(false)}
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Enhanced API Response Dialog */}
      {showStatsDialog && checkStats && (
        <div className={dialogStyles.dialogOverlay} onClick={() => setShowStatsDialog(false)} style={{ zIndex: 9999 }}>
          <div className={dialogStyles.statusDialog} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className={dialogStyles.dialogHeader}>
              <h3>Price Check Results</h3>
              <button className={dialogStyles.closeButton} onClick={() => setShowStatsDialog(false)}>Close</button>
            </div>
            <div className={dialogStyles.dialogContent}>
              {/* Summary Section */}
              <div className={styles.resultsSummary}>
                <div className={dialogStyles.dialogItem}>
                  <span className={dialogStyles.dialogLabel}>Checks This Month:</span>
                  <span className={dialogStyles.dialogValue}>{checkStats.usageCount}</span>
                </div>
                {typeof checkStats.remainingChecks !== 'undefined' && checkStats.remainingChecks !== null && (
                  <div className={dialogStyles.dialogItem}>
                    <span className={dialogStyles.dialogLabel}>Remaining:</span>
                    <span className={dialogStyles.dialogValue}>{checkStats.remainingChecks}</span>
                  </div>
                )}
                
                <div className={dialogStyles.dialogItem}>
                  <span className={dialogStyles.dialogLabel}>Checked Posts:</span>
                  <span className={dialogStyles.dialogValue}>{checkStats.checkedPosts}</span>
                </div>
                
                <div className={dialogStyles.dialogItem}>
                  <span className={dialogStyles.dialogLabel}>Updated Posts:</span>
                  <span className={dialogStyles.dialogValue}>{checkStats.updatedPosts}</span>
                </div>
              </div>
              
              {/* Results - Show updated posts data, hide API URLs */}
              <div className={styles.resultsList}>
                {detailedResults && detailedResults.length > 0 ? (
                  detailedResults.map((res, index) => {
                    const statusLabel = res.targetReached
                      ? 'Target Reached'
                      : res.stopLossTriggered
                        ? 'Stop Loss Triggered'
                        : res.message
                          ? res.message
                          : 'Checked';
                    const tagClass = res.targetReached
                      ? styles.priceUpTag
                      : res.stopLossTriggered
                        ? styles.priceDownTag
                        : res.message && (res.noDataAvailable || res.postAfterMarketClose || res.postDateAfterPriceDate)
                          ? styles.errorTag
                          : styles.lastPriceTag;
                    return (
                      <div key={index} className={styles.simpleResultRow}>
                        <div className={styles.symbolWithTag}>
                          <span className={styles.symbolText}>{res.symbol || 'N/A'}</span>
                          {res.companyName && (
                            <span className={styles.exchangeTag}>{res.companyName}</span>
                          )}
                        </div>

                        <span className={`${styles.responseTypeTag} ${tagClass}`}>
                          {statusLabel}
                          {res.closed ? ' (Closed)' : ''}
                        </span>

                        <div className={styles.apiUrlContainer}>
                          <div className={styles.apiUrlInput} style={{ pointerEvents: 'none' }}>
                            Price: {formatPrice(res.currentPrice)} | Target: {formatPrice(res.targetPrice)} | SL: {formatPrice(res.stopLossPrice)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className={styles.noDataMessage}>No results available</div>
                )}
              </div>

              {/* Telegram Broadcast Section */}
              {detailedResults && detailedResults.length > 0 && (
                <div className={styles.telegramBroadcastSection}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'hsl(var(--primary))' }}>
                      📢 Telegram Broadcast
                    </h4>
                  </div>
                  <div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>Title</label>
                      <input
                        type="text"
                        value={tgTitle}
                        onChange={(e) => setTgTitle(e.target.value)}
                        placeholder="Price Check Update - [Date]"
                        style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid var(--border)', backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))', fontSize: '0.9rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>Comment (optional)</label>
                      <textarea
                        value={tgComment}
                        onChange={(e) => setTgComment(e.target.value)}
                        rows={3}
                        placeholder="Add a short comment to your followers..."
                        style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid var(--border)', backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))', fontSize: '0.9rem', resize: 'vertical' }}
                      />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Select posts to include</label>
                        <div className={styles.postSelectionActions} style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            className={styles.selectChangedButton} 
                            onClick={selectAllChanged} 
                            title="Select posts with changes"
                            style={{
                              padding: '8px 16px',
                              backgroundColor: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontWeight: 600,
                              fontSize: '0.9rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            📈 Select changed
                          </button>
                          <button 
                            className={styles.clearSelectionButton} 
                            onClick={clearAllSelected}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontWeight: 600,
                              fontSize: '0.9rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            🗑️ Clear
                          </button>
                        </div>
                      </div>
                      <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, padding: 8, backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
                        {(detailedResults || []).map((res) => (
                          <label key={res.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 6px', cursor: 'pointer', borderRadius: 4 }} className={styles.postSelectionItem}>
                            <input
                              type="checkbox"
                              checked={selectedForBroadcast.includes(res.id)}
                              onChange={() => toggleSelectPost(res.id)}
                              style={{ cursor: 'pointer', accentColor: '#0066cc' }}
                            />
                            <span style={{ minWidth: 64, fontWeight: 600, fontSize: '0.9rem', color: 'hsl(var(--foreground))' }}>{res.symbol || 'N/A'}</span>
                            <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.9rem', flex: 1 }}>{res.companyName || ''}</span>
                            {(res.targetReached || res.stopLossTriggered || res.closed) && (
                              <span className={styles.postStatusBadge}>
                                {res.targetReached ? '🎯 Target' : res.stopLossTriggered ? '🛑 Stop Loss' : res.closed ? '🔒 Closed' : ''}
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                      <small style={{ display: 'block', marginTop: 8, color: 'var(--muted-foreground)', fontSize: '0.8rem', textAlign: 'center' }}>
                        📊 Selected: {selectedForBroadcast.length} / {(detailedResults || []).length} posts
                      </small>
                    </div>
                  </div>
                </div>
              )}

              {/* Global sticky footer inside dialog content */}
              <div style={{
                position: 'sticky',
                bottom: 0,
                left: 0,
                right: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '12px 16px',
                background: 'hsl(var(--card))',
                borderTop: '1px solid hsl(var(--border))',
                zIndex: 50
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'hsl(var(--primary))' }}>
                    📢 Telegram Broadcast
                  </h4>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={sendToTelegram}
                    onChange={(e) => setSendToTelegram(e.target.checked)}
                    style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: 'hsl(var(--primary))' }}
                  />
                  <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                    Send to Telegram followers
                  </span>
                </label>
                </div>

                <button 
                  className={styles.closeStatsButton}
                  onClick={handleSendTelegram}
                  disabled={!sendToTelegram || sendingBroadcast || selectedForBroadcast.length === 0}
                  style={{ 
                    backgroundColor: 'hsl(var(--primary))',
                    color: 'white',
                    fontWeight: 700,
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    opacity: (!sendToTelegram || sendingBroadcast || selectedForBroadcast.length === 0) ? 0.6 : 1
                  }}
                >
                  {sendingBroadcast ? '📤 Sending...' : '📢 Send to Telegram'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Show the error message as a dialog for better visibility */}
      {error && (
        <div className={dialogStyles.dialogOverlay} onClick={() => setError(null)} style={{ zIndex: 9999 }}>
          <div className={dialogStyles.statusDialog} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className={dialogStyles.dialogHeader}>
              <h3>Price Check Status</h3>
              <button className={dialogStyles.closeButton} onClick={() => setError(null)}>Cancel</button>
            </div>
            <div className={dialogStyles.dialogContent}>
              <div className={styles.errorMessageContainer}>
                <div className={styles.errorIcon}>⚠️</div>
                <div className={styles.errorText}>{error}</div>
              </div>
              <div className={styles.statsActions}>
                <button 
                  className={styles.cancelCheckButton}
                  onClick={() => setError(null)}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for limit checks */}
      <ConfirmActionDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={confirmDialogContent.confirmAction}
        title={confirmDialogContent.title}
        message={confirmDialogContent.message}
        confirmText={confirmDialogContent.confirmText}
        cancelText={confirmDialogContent.cancelText}
        showCancelButton={confirmDialogContent.showCancelButton}
      />

    </div>
  );
}
