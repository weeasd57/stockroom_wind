'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import styles from '@/styles/profile.module.css';
import { useProfile } from '@/providers/ProfileProvider';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useSubscription } from '@/providers/SubscriptionProvider';
import dialogStyles from '@/styles/ProfilePostCard.module.css';
import ConfirmActionDialog from '@/components/common/ConfirmActionDialog'; // Import the new dialog
import { toast } from 'sonner';

export default function CheckPostPricesButton({ userId }) {
  const [isChecking, setIsChecking] = useState(false);
  const [checkStats, setCheckStats] = useState(null);
  const [error, setError] = useState(null);
  const { refreshData } = useProfile();
  const { supabase } = useSupabase();
  const { canPerformPriceCheck, refreshSubscription, usageInfo } = useSubscription();
  const [abortController, setAbortController] = useState(null);
  const [isCancelled, setIsCancelled] = useState(false);
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  const [realTimeUpdates, setRealTimeUpdates] = useState(new Map());
  const [detailedResults, setDetailedResults] = useState([]);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false); // New state for confirm dialog
  const [confirmDialogContent, setConfirmDialogContent] = useState({ title: '', message: '', confirmAction: () => {}, confirmText: 'Confirm', cancelText: 'Cancel', showCancelButton: true });
  const [isPreflight, setIsPreflight] = useState(false);
  // Telegram broadcast controls
  const [sendToTelegram, setSendToTelegram] = useState(false);
  const [tgTitle, setTgTitle] = useState('Price Check Report');
  const [tgComment, setTgComment] = useState('');
  const [selectedForBroadcast, setSelectedForBroadcast] = useState([]);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Default-select changed posts when the stats dialog opens
  useEffect(() => {
    if (!showStatsDialog) return;
    try {
      const defaults = (detailedResults || [])
        .filter(r => r && r.id && (r.targetReached || r.stopLossTriggered || r.closed))
        .map(r => r.id);
      setSelectedForBroadcast(defaults);
      // Build a helpful default title
      const changedCount = defaults.length;
      const total = (detailedResults || []).length;
      if (changedCount > 0) {
        setTgTitle(`Price Check Report · ${changedCount}/${total} changed`);
      } else {
        setTgTitle('Price Check Report');
      }
    } catch (_) {}
  }, [showStatsDialog, detailedResults]);

  // Auto-toggle Telegram section when selection changes
  useEffect(() => {
    if ((selectedForBroadcast || []).length > 0) {
      setSendToTelegram(true);
    } else {
      setSendToTelegram(false);
    }
  }, [selectedForBroadcast]);

  const toggleSelectPost = (postId) => {
    if (!postId) return;
    setSelectedForBroadcast(prev => {
      const next = prev.includes(postId) ? prev.filter(id => id !== postId) : [...prev, postId];
      if (next.length > 0) setSendToTelegram(true);
      return next;
    });
  };

  const selectAllChanged = () => {
    const ids = (detailedResults || [])
      .filter(r => r && r.id && (r.targetReached || r.stopLossTriggered || r.closed))
      .map(r => r.id);
    setSelectedForBroadcast(ids);
    setSendToTelegram(ids.length > 0);
  };

  const clearAllSelected = () => { setSelectedForBroadcast([]); setSendToTelegram(false); };

  const handleSendTelegram = async () => {
    try {
      if (!sendToTelegram) {
        toast.error('Enable "Send to Telegram followers" first');
        return;
      }
      if (!selectedForBroadcast || selectedForBroadcast.length === 0) {
        toast.error('Select at least one post to include');
        return;
      }
      setSendingBroadcast(true);
      const res = await fetch('/api/telegram/send-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: tgTitle || 'Price Check Report',
          message: tgComment || '',
          selectedPosts: selectedForBroadcast,
          selectedRecipients: [],
          recipientType: 'followers'
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || data?.message || 'Failed to send broadcast');
      }
      toast.success('Report sent to Telegram followers');
    } catch (e) {
      toast.error(e?.message || 'Failed to send to Telegram');
    } finally {
      setSendingBroadcast(false);
    }
  };
  
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
          setError(data.message || 'You have reached the maximum checks for today. Try again tomorrow.');
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
      
      // Refresh subscription info after successful check (usage is updated by API)
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
        console.log('Request aborted');
        // Error is already set in cancelCheck
      } else if (!isCancelled) {
        // Only set error if not cancelled
        setError(err.message || 'An error occurred while checking prices');
      }
    } finally {
      setIsChecking(false);
      setAbortController(null);
      // Reset cancelled state
      setIsCancelled(false);
    }
  }, [userId, refreshData, canPerformPriceCheck, usageInfo, refreshSubscription]);
  
  const checkPostPrices = async () => {
    setCheckStats(null);
    setError(null);
    setIsCancelled(false);
    setDetailedResults([]);

    // Get remaining checks from subscription provider
    const remaining = usageInfo?.priceChecks?.remaining || 0;

    // If limit reached, show info-only dialog
    if (remaining <= 0) {
      setConfirmDialogContent({
        title: 'Daily Check Limit Reached',
        message: 'You have reached the maximum price checks for today. Please upgrade your plan or try again tomorrow.',
        confirmAction: () => setShowConfirmDialog(false),
        confirmText: 'Got it',
        showCancelButton: false
      });
      setShowConfirmDialog(true);
      return;
    }

    const remainingText = ` You have ${remaining} checks left for today.`;
    setConfirmDialogContent({
      title: 'Confirm Price Check',
      message: `This will check the latest prices for your posts and update their statuses accordingly.${remainingText}`,
      confirmAction: handleProceedCheck,
      confirmText: 'Proceed',
      cancelText: 'Cancel',
      showCancelButton: true
    });
    setShowConfirmDialog(true);
  };
  
  // Calculate price change percentage and direction between initial and current price
  const getPriceChangeStatus = (post) => {
    if (!post?.current_price) return null;
    const initial = parseFloat(post.initial_price || post.current_price);
    const current = parseFloat(post.current_price);
    if (isNaN(initial) || isNaN(current) || initial === 0) return null;
    if (current < initial) {
      return { change: 'decrease', percent: (((initial - current) / initial) * 100).toFixed(2) };
    } else if (current > initial) {
      return { change: 'increase', percent: (((current - initial) / initial) * 100).toFixed(2) };
    }
    return { change: 'none', percent: 0 };
  };
  
  return (
    <div className={styles.priceCheckContainer}>
      <div className={styles.priceCheckButtonGroup}>
        <div style={{ flex: 1 }}></div>
        
        <button 
          onClick={checkPostPrices}
          disabled={isChecking || isPreflight}
          className={styles.checkPricesButton}
          aria-label="Check post prices"
        >
          {(isChecking || isPreflight) ? (
            <>
              <span className={styles.spinner}>⟳</span>
              {isChecking ? 'Checking...' : 'Preparing...'}
            </>
          ) : (
            <>
              📈 Check Post Prices
              {realTimeUpdates.size > 0 && (
                <span className={styles.updateBadge}>
                  {realTimeUpdates.size}
                </span>
              )}
            </>
          )}
        </button>
        
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
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
              style={{ marginLeft: '10px' }}
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
            <div className={dialogStyles.dialogContent} style={{ paddingBottom: '96px' }}>
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
          <div className={dialogStyles.statusDialog} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', background: 'hsl(var(--background))', color: 'hsl(var(--foreground))', border: '1px solid var(--gold-border, rgba(245, 215, 110, 0.3))' }}>
            <div className={dialogStyles.dialogHeader}>
              <h3>Price Check Results</h3>
              <button className={dialogStyles.closeButton} onClick={() => setShowStatsDialog(false)}>Close</button>
            </div>
            <div className={dialogStyles.dialogContent} style={{ paddingBottom: '120px' }}>
              {/* Main Content Background */}
              <div style={{
                backgroundColor: 'hsl(var(--card))',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '16px',
                border: '1px solid var(--border)',
                boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
                color: 'hsl(var(--foreground))'
              }}>
                {/* Summary Section */}
                <div className={styles.resultsSummary}>
                <div className={dialogStyles.dialogItem} style={{ color: 'hsl(var(--foreground))' }}>
                  <span className={dialogStyles.dialogLabel} style={{ color: 'hsl(var(--muted-foreground))', fontWeight: 600 }}>Checks Today:</span>
                  <span className={dialogStyles.dialogValue} style={{ color: 'hsl(var(--foreground))', fontWeight: 700 }}>{checkStats.usageCount}</span>
                </div>
                {typeof checkStats.remainingChecks !== 'undefined' && checkStats.remainingChecks !== null && (
                  <div className={dialogStyles.dialogItem} style={{ color: 'hsl(var(--foreground))' }}>
                    <span className={dialogStyles.dialogLabel} style={{ color: 'hsl(var(--muted-foreground))', fontWeight: 600 }}>Remaining:</span>
                    <span className={dialogStyles.dialogValue} style={{ color: 'hsl(var(--foreground))', fontWeight: 700 }}>{checkStats.remainingChecks}</span>
                  </div>
                )}
                
                <div className={dialogStyles.dialogItem} style={{ color: 'hsl(var(--foreground))' }}>
                  <span className={dialogStyles.dialogLabel} style={{ color: 'hsl(var(--muted-foreground))', fontWeight: 600 }}>Checked Posts:</span>
                  <span className={dialogStyles.dialogValue} style={{ color: 'hsl(var(--foreground))', fontWeight: 700 }}>{checkStats.checkedPosts}</span>
                </div>
                
                <div className={dialogStyles.dialogItem} style={{ color: 'hsl(var(--foreground))' }}>
                  <span className={dialogStyles.dialogLabel} style={{ color: 'hsl(var(--muted-foreground))', fontWeight: 600 }}>Updated Posts:</span>
                  <span className={dialogStyles.dialogValue} style={{ color: 'hsl(var(--foreground))', fontWeight: 700 }}>{checkStats.updatedPosts}</span>
                </div>
              </div>
              
              {/* Results - Show only updated posts */}
              <div className={styles.resultsList}>
                {(() => {
                  // Debug logging
                  console.log('[DEBUG] All detailed results:', detailedResults);
                  
                  const updatedPosts = (detailedResults || []).filter(res => {
                    const hasChanges = res.targetReached || 
                                     res.stopLossTriggered || 
                                     res.closed || 
                                     res.priceChanged || 
                                     res.updated ||
                                     res.statusChanged ||
                                     (res.currentPrice && res.initialPrice && res.currentPrice !== res.initialPrice) ||
                                     (res.message && !res.message.toLowerCase().includes('no change') && 
                                      !res.message.toLowerCase().includes('checked') && 
                                      res.message !== 'Price updated');
                    
                    console.log(`[DEBUG] Post ${res.symbol}: targetReached=${res.targetReached}, stopLossTriggered=${res.stopLossTriggered}, closed=${res.closed}, currentPrice=${res.currentPrice}, initialPrice=${res.initialPrice}, message="${res.message}", hasChanges=${hasChanges}`);
                    return hasChanges;
                  });
                  
                  console.log('[DEBUG] Filtered updated posts:', updatedPosts);
                  
                  return updatedPosts.length > 0 ? (
                    <>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', fontWeight: 600, color: 'var(--primary)' }}>
                        📈 Updated Posts:
                      </h4>
                      {updatedPosts.map((res, index) => {
                        const statusLabel = res.targetReached
                          ? 'Target Reached'
                          : res.stopLossTriggered
                            ? 'Stop Loss Triggered'
                            : res.closed
                              ? 'Closed'
                              : 'Updated';
                        const tagClass = res.targetReached
                          ? styles.priceUpTag
                          : res.stopLossTriggered
                            ? styles.priceDownTag
                            : styles.lastPriceTag;
                        return (
                          <div 
                            key={index} 
                            className={styles.simpleResultRow}
                            style={{ backgroundColor: 'hsl(var(--card))', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}
                          >
                            <div className={styles.symbolWithTag}>
                              <span className={styles.symbolText} style={{ color: 'hsl(var(--foreground))', fontWeight: 700, fontSize: '1rem' }}>{res.symbol || 'N/A'}</span>
                              {res.companyName && (
                                <span className={styles.exchangeTag} style={{ color: 'hsl(var(--muted-foreground))' }}>{res.companyName}</span>
                              )}
                            </div>

                            <span className={`${styles.responseTypeTag} ${tagClass}`} style={{ color: '#ffffff', fontWeight: 700 }}>
                              {statusLabel}
                            </span>

                            <div className={styles.apiUrlContainer}>
                              <div className={styles.apiUrlInput} style={{ pointerEvents: 'none', backgroundColor: 'hsl(var(--background))', border: '1px solid var(--border)', color: 'hsl(var(--foreground))', borderRadius: 6, padding: '8px 10px' }}>
                                Price: {formatPrice(res.currentPrice)} | Target: {formatPrice(res.targetPrice)} | SL: {formatPrice(res.stopLossPrice)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <div className={styles.noDataMessage}>
                      <div style={{ textAlign: 'center', padding: '20px', color: 'var(--muted-foreground)' }}>
                        <span style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }}>✅</span>
                        <strong>No posts were updated</strong>
                        <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem' }}>
                          All your posts are still within their target ranges.
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Actions */}
              <div className={styles.statsActions}>
                <button 
                  className={styles.cancelCheckButton}
                  onClick={() => setShowStatsDialog(false)}
                  style={{
                    backgroundColor: '#6b7280',
                    color: 'white',
                    fontWeight: 600,
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
              </div>
              
              {/* Telegram Broadcast Section - with sticky bottom control bar */}
              <div className={styles.telegramBroadcastSection} style={{
                marginTop: '20px',
                padding: '20px',
                paddingBottom: '84px',
                borderTop: '1px solid var(--border)',
                position: 'relative',
                background: 'hsl(var(--card))',
                color: 'hsl(var(--foreground))',
                borderRadius: '12px',
                boxShadow: '0 -2px 10px rgba(0,0,0,0.08)',
                border: '1px solid var(--border)'
              }}>
                {sendToTelegram && (
                  <div style={{ display: 'grid', gap: 12, padding: '16px', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', borderRadius: 8, border: '1px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>Title</label>
                      <input
                        type="text"
                        value={tgTitle}
                        onChange={(e) => setTgTitle(e.target.value)}
                        placeholder="Price Check Report"
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
                )}

                {/* end Telegram section content */}
              </div>

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
