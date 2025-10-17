'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';
import styles from '@/styles/TelegramBotManagement.module.css';
import { toast } from 'sonner';

export default function TelegramBotManagement() {
  const { user } = useSupabase();
  const [botInfo, setBotInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subscribers, setSubscribers] = useState([]);
  const [selectedPosts, setSelectedPosts] = useState([]);
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [posts, setPosts] = useState([]);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [showBroadcastForm, setShowBroadcastForm] = useState(false);
  const [stats, setStats] = useState({ totalSubscribers: 0, activeSubscribers: 0, recentBroadcasts: 0, lastWeekNewSubscribers: 0 });

  useEffect(() => {
    if (user) {
      fetchBotInfo();
      fetchSubscribers();
      fetchUserPosts();
      fetchStats();
    }
  }, [user]);

  const fetchBotInfo = async () => {
    try {
      const response = await fetch('/api/telegram/bot-setup');
      const data = await response.json();
      setBotInfo(data.bot);
    } catch (error) {
      console.error('Error fetching bot info:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscribers = async () => {
    try {
      const response = await fetch('/api/telegram/subscribers');
      const data = await response.json();
      setSubscribers(data.subscribers || []);
    } catch (error) {
      console.error('Error fetching subscribers:', error);
    }
  };

  const fetchUserPosts = async () => {
    try {
      const response = await fetch(`/api/posts?userId=${user.id}&limit=100`);
      const data = await response.json();
      setPosts(data.data || data.posts || []);
    } catch (error) {
      console.error('Error fetching posts:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/telegram/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_stats' })
      });
      const data = await response.json();
      setStats(data.stats || stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleBotSetup = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    try {
      const response = await fetch('/api/telegram/bot-setup', { method: 'POST' });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Bot setup completed successfully');
        setBotInfo(data.bot);
        fetchSubscribers();
        fetchStats();
      } else {
        toast.error(data.message || 'Failed to setup bot');
      }
    } catch (error) {
      console.error('Error setting up bot:', error);
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    
    if (!broadcastTitle || !broadcastMessage) {
      toast.error('Please enter both title and message');
      return;
    }

    if (selectedRecipients.length === 0) {
      toast.error('Please select at least one recipient');
      return;
    }

    setSendingBroadcast(true);
    try {
      const response = await fetch('/api/telegram/send-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: broadcastTitle,
          message: broadcastMessage,
          selectedPosts,
          selectedRecipients,
          recipientType: 'manual'
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Broadcast sent successfully');
        setBroadcastTitle('');
        setBroadcastMessage('');
        setSelectedPosts([]);
        setSelectedRecipients([]);
        setShowBroadcastForm(false);
        fetchStats();
      } else {
        toast.error(data.error || 'Failed to send broadcast');
      }
    } catch (error) {
      console.error('Error sending broadcast:', error);
      toast.error('Network error');
    } finally {
      setSendingBroadcast(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>🤖 Telegram Bot Management</h2>
        <p>Send trading notifications to your Telegram subscribers</p>
      </div>

      {!botInfo ? (
        <div className={styles.setupSection}>
          <div className={styles.emptyState}>
            <div className={styles.icon}>🤖</div>
            <h3>No bot configured</h3>
            <p>Set up your Telegram bot to send notifications</p>
            <button 
              className={styles.setupButton}
              onClick={handleBotSetup}
              disabled={saving}
            >
              Set up bot
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.managementSection}>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>👥</div>
              <div className={styles.statInfo}>
                <h3>{stats.totalSubscribers}</h3>
                <p>Total subscribers</p>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>✅</div>
              <div className={styles.statInfo}>
                <h3>{stats.activeSubscribers}</h3>
                <p>Active subscribers</p>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>📢</div>
              <div className={styles.statInfo}>
                <h3>{stats.recentBroadcasts}</h3>
                <p>Broadcasts this month</p>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>🆕</div>
              <div className={styles.statInfo}>
                <h3>{stats.lastWeekNewSubscribers}</h3>
                <p>New subscribers this week</p>
              </div>
            </div>
          </div>

          <div className={styles.botInfo}>
            <h3>🤖 {botInfo.name}</h3>
            <p>@{botInfo.username}</p>
            <span className={`${styles.status} ${botInfo.isActive ? styles.active : styles.inactive}`}>
              {botInfo.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div className={styles.actionButtons}>
            <button 
              className={styles.broadcastButton}
              onClick={() => setShowBroadcastForm(true)}
              disabled={subscribers.length === 0}
            >
              📢 Send new broadcast
            </button>
            <button 
              className={styles.dangerButton}
              onClick={() => {
                if (confirm('Are you sure you want to deactivate the bot?')) {
                  setBotInfo(null);
                  toast.success('Bot deactivated');
                }
              }}
            >
              🗑️ Deactivate bot
            </button>
          </div>

          {showBroadcastForm && (
            <div className={styles.broadcastForm}>
              <h3>📢 Send a new broadcast</h3>
              <form onSubmit={handleSendBroadcast}>
                <div className={styles.formGroup}>
                  <label>Notification title:</label>
                  <input
                    type="text"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    placeholder="Important trading update"
                    disabled={sendingBroadcast}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Message:</label>
                  <textarea
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="Write your message here..."
                    rows={4}
                    disabled={sendingBroadcast}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Attached posts (optional):</label>
                  <div className={styles.postsList}>
                    {posts.length === 0 ? (
                      <p>No posts available</p>
                    ) : (
                      <>
                        <div className={styles.selectAllButton}>
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedPosts.length === posts.length) {
                                setSelectedPosts([]);
                              } else {
                                setSelectedPosts(posts.map(p => p.id));
                              }
                            }}
                            disabled={sendingBroadcast}
                          >
                            {selectedPosts.length === posts.length ? 'Unselect all posts' : 'Select all posts'}
                          </button>
                        </div>
                        {posts.map(post => (
                          <div key={post.id} className={styles.postItem}>
                            <input
                              type="checkbox"
                              checked={selectedPosts.includes(post.id)}
                              onChange={() => {
                                setSelectedPosts(prev => 
                                  prev.includes(post.id) 
                                    ? prev.filter(id => id !== post.id)
                                    : [...prev, post.id]
                                );
                              }}
                              disabled={sendingBroadcast}
                            />
                            <span>{post.symbol} - {post.company_name}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Recipients:</label>
                  <div className={styles.recipientsList}>
                    <div className={styles.selectAllButton}>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedRecipients.length === subscribers.length) {
                            setSelectedRecipients([]);
                          } else {
                            setSelectedRecipients(subscribers.map(s => s.id));
                          }
                        }}
                        disabled={sendingBroadcast}
                      >
                        {selectedRecipients.length === subscribers.length ? 'Unselect all' : 'Select all'}
                      </button>
                    </div>
                    {subscribers.length === 0 ? (
                      <p>No subscribers</p>
                    ) : (
                      subscribers.map(subscriber => (
                        <div key={subscriber.id} className={styles.recipientItem}>
                          <input
                            type="checkbox"
                            checked={selectedRecipients.includes(subscriber.id)}
                            onChange={() => {
                              setSelectedRecipients(prev => 
                                prev.includes(subscriber.id) 
                                  ? prev.filter(id => id !== subscriber.id)
                                  : [...prev, subscriber.id]
                              );
                            }}
                            disabled={sendingBroadcast}
                          />
                          <span>
                            {subscriber.telegram_first_name}
                            {subscriber.telegram_username && ` (@${subscriber.telegram_username})`}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className={styles.formActions}>
                  <button type="submit" disabled={sendingBroadcast || selectedRecipients.length === 0}>
                    {sendingBroadcast ? 'Sending...' : `Send to ${selectedRecipients.length} subscriber(s)`}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowBroadcastForm(false)}
                    disabled={sendingBroadcast}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {subscribers.length > 0 && (
            <div className={styles.subscribersSection}>
              <h3>👥 Subscribers ({subscribers.length})</h3>
              <div className={styles.subscribersList}>
                {subscribers.slice(0, 10).map(subscriber => (
                  <div key={subscriber.id} className={styles.subscriberCard}>
                    <div className={styles.subscriberInfo}>
                      <strong>{subscriber.telegram_first_name}</strong>
                      {subscriber.telegram_username && (
                        <span>@{subscriber.telegram_username}</span>
                      )}
                      <small>Joined: {new Date(subscriber.subscribed_at).toLocaleDateString('en-US')}</small>
                    </div>
                  </div>
                ))}
                {subscribers.length > 10 && (
                  <p>and {subscribers.length - 10} more subscribers...</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
