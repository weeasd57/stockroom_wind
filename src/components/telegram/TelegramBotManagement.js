'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';
import styles from './TelegramBotManagement.module.css';
import { toast } from 'sonner';

export default function TelegramBotManagement() {
  const { user } = useSupabase();
  const [botInfo, setBotInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [setupMode, setSetupMode] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [botName, setBotName] = useState('');
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
      const response = await fetch(`/api/posts?userId=${user.id}&limit=20`);
      const data = await response.json();
      setPosts(data.posts || []);
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
    e.preventDefault();
    if (!botToken || !botName) {
      toast.error('يرجى إدخال token واسم البوت');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/telegram/bot-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken, botName })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('تم إعداد البوت بنجاح!');
        setBotInfo(data.bot);
        setSetupMode(false);
        setBotToken('');
        setBotName('');
        fetchSubscribers();
        fetchStats();
      } else {
        toast.error(data.message || 'حدث خطأ في إعداد البوت');
      }
    } catch (error) {
      console.error('Error setting up bot:', error);
      toast.error('حدث خطأ في الاتصال');
    } finally {
      setSaving(false);
    }
  };

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    
    if (!broadcastTitle || !broadcastMessage) {
      toast.error('يرجى إدخال العنوان والرسالة');
      return;
    }

    if (selectedRecipients.length === 0) {
      toast.error('يرجى اختيار مستقبلين للرسالة');
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
        toast.success('تم إرسال الإشعار بنجاح!');
        setBroadcastTitle('');
        setBroadcastMessage('');
        setSelectedPosts([]);
        setSelectedRecipients([]);
        setShowBroadcastForm(false);
        fetchStats();
      } else {
        toast.error(data.error || 'حدث خطأ في إرسال الإشعار');
      }
    } catch (error) {
      console.error('Error sending broadcast:', error);
      toast.error('حدث خطأ في الاتصال');
    } finally {
      setSendingBroadcast(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>🤖 إدارة بوت التليجرام</h2>
        <p>أرسل إشعارات التداول لمتابعيك على التليجرام</p>
      </div>

      {!botInfo ? (
        <div className={styles.setupSection}>
          <div className={styles.emptyState}>
            <div className={styles.icon}>🤖</div>
            <h3>لا يوجد بوت مُعد</h3>
            <p>قم بإعداد بوت التليجرام الخاص بك لإرسال الإشعارات</p>
            <button 
              className={styles.setupButton}
              onClick={() => setSetupMode(true)}
              disabled={saving}
            >
              إعداد البوت
            </button>
          </div>

          {setupMode && (
            <div className={styles.setupForm}>
              <h3>إعداد بوت التليجرام</h3>
              <form onSubmit={handleBotSetup}>
                <div className={styles.formGroup}>
                  <label>Bot Token:</label>
                  <input
                    type="text"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                    disabled={saving}
                  />
                  <small>احصل على الـ token من @BotFather في التليجرام</small>
                </div>
                <div className={styles.formGroup}>
                  <label>اسم البوت:</label>
                  <input
                    type="text"
                    value={botName}
                    onChange={(e) => setBotName(e.target.value)}
                    placeholder="بوت التداول"
                    disabled={saving}
                  />
                </div>
                <div className={styles.formActions}>
                  <button type="submit" disabled={saving}>
                    {saving ? 'جاري الإعداد...' : 'إعداد البوت'}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setSetupMode(false)}
                    disabled={saving}
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.managementSection}>
          {/* إحصائيات البوت */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>👥</div>
              <div className={styles.statInfo}>
                <h3>{stats.totalSubscribers}</h3>
                <p>إجمالي المشتركين</p>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>✅</div>
              <div className={styles.statInfo}>
                <h3>{stats.activeSubscribers}</h3>
                <p>مشترك نشط</p>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>📢</div>
              <div className={styles.statInfo}>
                <h3>{stats.recentBroadcasts}</h3>
                <p>إشعارات هذا الشهر</p>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>🆕</div>
              <div className={styles.statInfo}>
                <h3>{stats.lastWeekNewSubscribers}</h3>
                <p>مشترك جديد هذا الأسبوع</p>
              </div>
            </div>
          </div>

          {/* معلومات البوت */}
          <div className={styles.botInfo}>
            <h3>🤖 {botInfo.name}</h3>
            <p>@{botInfo.username}</p>
            <span className={`${styles.status} ${botInfo.isActive ? styles.active : styles.inactive}`}>
              {botInfo.isActive ? 'نشط' : 'غير نشط'}
            </span>
          </div>

          {/* أزرار الأكشن */}
          <div className={styles.actionButtons}>
            <button 
              className={styles.broadcastButton}
              onClick={() => setShowBroadcastForm(true)}
              disabled={subscribers.length === 0}
            >
              📢 إرسال إشعار جديد
            </button>
            <button 
              className={styles.dangerButton}
              onClick={() => {
                if (confirm('هل أنت متأكد من إلغاء البوت؟')) {
                  setBotInfo(null);
                  toast.success('تم إلغاء البوت');
                }
              }}
            >
              🗑️ إلغاء البوت
            </button>
          </div>

          {/* نموذج الإشعار */}
          {showBroadcastForm && (
            <div className={styles.broadcastForm}>
              <h3>📢 إرسال إشعار جديد</h3>
              <form onSubmit={handleSendBroadcast}>
                <div className={styles.formGroup}>
                  <label>عنوان الإشعار:</label>
                  <input
                    type="text"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    placeholder="تحديث مهم حول التداول"
                    disabled={sendingBroadcast}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>نص الرسالة:</label>
                  <textarea
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="اكتب رسالتك هنا..."
                    rows={4}
                    disabled={sendingBroadcast}
                  />
                </div>

                {/* اختيار البوستات */}
                <div className={styles.formGroup}>
                  <label>البوستات المرفقة (اختياري):</label>
                  <div className={styles.postsList}>
                    {posts.length === 0 ? (
                      <p>لا توجد بوستات</p>
                    ) : (
                      posts.slice(0, 5).map(post => (
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
                      ))
                    )}
                  </div>
                </div>

                {/* اختيار المستقبلين */}
                <div className={styles.formGroup}>
                  <label>المستقبلين:</label>
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
                        {selectedRecipients.length === subscribers.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                      </button>
                    </div>
                    {subscribers.length === 0 ? (
                      <p>لا يوجد مشتركين</p>
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
                    {sendingBroadcast ? 'جاري الإرسال...' : `إرسال للـ ${selectedRecipients.length} مشترك`}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowBroadcastForm(false)}
                    disabled={sendingBroadcast}
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* قائمة المشتركين */}
          {subscribers.length > 0 && (
            <div className={styles.subscribersSection}>
              <h3>👥 المشتركين ({subscribers.length})</h3>
              <div className={styles.subscribersList}>
                {subscribers.slice(0, 10).map(subscriber => (
                  <div key={subscriber.id} className={styles.subscriberCard}>
                    <div className={styles.subscriberInfo}>
                      <strong>{subscriber.telegram_first_name}</strong>
                      {subscriber.telegram_username && (
                        <span>@{subscriber.telegram_username}</span>
                      )}
                      <small>انضم: {new Date(subscriber.subscribed_at).toLocaleDateString('ar-EG')}</small>
                    </div>
                  </div>
                ))}
                {subscribers.length > 10 && (
                  <p>و {subscribers.length - 10} مشتركين آخرين...</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
