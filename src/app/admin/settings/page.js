'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { toast } from 'sonner';
import styles from '@/styles/admin/settings.module.css';

export default function SystemSettings() {
  const { user, loading } = useSupabase();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const hasLocalAdmin =
    typeof window !== 'undefined'
      ? !!localStorage.getItem('admin_email')
      : false;

  // Settings state
  const [settings, setSettings] = useState({
    general: {
      siteName: 'SharksZone',
      siteUrl: 'https://sharkszone.com',
      siteDescription: 'Professional Trading Platform',
      contactEmail: 'contact@sharkszone.com',
      supportEmail: 'support@sharkszone.com',
      timezone: 'UTC',
      language: 'en',
      maintenanceMode: false,
      maintenanceMessage: 'Site is under maintenance. Please check back later.'
    },
    email: {
      smtpHost: '',
      smtpPort: '587',
      smtpUser: '',
      smtpPassword: '',
      smtpSecure: true,
      fromName: 'SharksZone',
      fromEmail: 'noreply@sharkszone.com',
      emailEnabled: false
    },
    paypal: {
      clientId: '',
      clientSecret: '',
      sandboxMode: true,
      monthlyPrice: '10',
      yearlyPrice: '99',
      currency: 'USD',
      paypalEnabled: false
    },
    api: {
      stockApiKey: '',
      stockApiProvider: 'eodhd',
      telegramBotToken: '',
      telegramChatId: '',
      googleAnalyticsId: '',
      recaptchaSiteKey: '',
      recaptchaSecretKey: ''
    },
    features: {
      registrationEnabled: true,
      postingEnabled: true,
      commentsEnabled: true,
      likesEnabled: true,
      followingEnabled: true,
      telegramEnabled: false,
      emailVerification: false,
      twoFactorAuth: false,
      postModeration: false,
      userVerification: false
    },
    limits: {
      maxPostLength: '1000',
      maxCommentLength: '500',
      maxPostsPerDay: '10',
      maxCommentsPerDay: '50',
      maxFileSize: '5', // MB
      allowedFileTypes: 'jpg,jpeg,png,gif,webp',
      maxFollowers: '1000',
      maxFollowing: '1000'
    }
  });

  // Check admin permissions
  useEffect(() => {
    if (!loading && !hasLocalAdmin && (!user || !isAdmin(user))) {
      router.push('/admin');
      return;
    }

    if ((user && isAdmin(user)) || hasLocalAdmin) {
      fetchSettings();
    }
  }, [user, loading, router]);

  const isAdmin = (user) => {
    return user?.email === 'admin@sharkszone.com' ||
      user?.user_metadata?.role === 'admin' ||
      user?.app_metadata?.role === 'admin';
  };

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const adminEmail = typeof window !== 'undefined' ? localStorage.getItem('admin_email') : null;

      const response = await fetch('/api/admin/settings', {
        headers: adminEmail
          ? { 'X-Admin-Email': adminEmail }
          : undefined,
      });
      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          setSettings(prevSettings => ({
            ...prevSettings,
            ...data.settings
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      const adminEmail = typeof window !== 'undefined' ? localStorage.getItem('admin_email') : null;

      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminEmail ? { 'X-Admin-Email': adminEmail } : {}),
        },
        body: JSON.stringify({ settings })
      });

      if (response.ok) {
        toast.success('Settings saved successfully');
      } else {
        toast.error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (section, field, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleToggle = (section, field) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: !prev[section][field]
      }
    }));
  };

  if (loading || isLoading) {
    return (
      <AdminLayout>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading settings...</p>
        </div>
      </AdminLayout>
    );
  }

  if ((!user || !isAdmin(user)) && !hasLocalAdmin) {
    return (
      <div className={styles.unauthorized}>
        <h1>🚫 Unauthorized Access</h1>
        <p>You don't have permission to access system settings.</p>
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className={styles.settingsContainer}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>⚙️ System Settings</h1>
            <p className={styles.subtitle}>Configure your platform settings</p>
          </div>
          <div className={styles.headerActions}>
            <button
              onClick={handleSaveSettings}
              className={styles.saveBtn}
              disabled={isSaving}
            >
              {isSaving ? '💾 Saving...' : '💾 Save Changes'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'general' ? styles.active : ''}`}
            onClick={() => setActiveTab('general')}
          >
            🌐 General
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'email' ? styles.active : ''}`}
            onClick={() => setActiveTab('email')}
          >
            📧 Email
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'paypal' ? styles.active : ''}`}
            onClick={() => setActiveTab('paypal')}
          >
            💳 PayPal
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'api' ? styles.active : ''}`}
            onClick={() => setActiveTab('api')}
          >
            🔑 API Keys
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'features' ? styles.active : ''}`}
            onClick={() => setActiveTab('features')}
          >
            ✨ Features
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'limits' ? styles.active : ''}`}
            onClick={() => setActiveTab('limits')}
          >
            🚫 Limits
          </button>
        </div>

        {/* Tab Content */}
        <div className={styles.tabContent}>
          {/* General Settings */}
          {activeTab === 'general' && (
            <div className={styles.settingsSection}>
              <h2 className={styles.sectionTitle}>General Settings</h2>

              <div className={styles.formGroup}>
                <label>Site Name</label>
                <input
                  type="text"
                  value={settings.general.siteName}
                  onChange={(e) => handleInputChange('general', 'siteName', e.target.value)}
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Site URL</label>
                <input
                  type="url"
                  value={settings.general.siteUrl}
                  onChange={(e) => handleInputChange('general', 'siteUrl', e.target.value)}
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Site Description</label>
                <textarea
                  value={settings.general.siteDescription}
                  onChange={(e) => handleInputChange('general', 'siteDescription', e.target.value)}
                  className={styles.textarea}
                  rows="3"
                />
              </div>

              <div className={styles.formGroup}>
                <label>Contact Email</label>
                <input
                  type="email"
                  value={settings.general.contactEmail}
                  onChange={(e) => handleInputChange('general', 'contactEmail', e.target.value)}
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Support Email</label>
                <input
                  type="email"
                  value={settings.general.supportEmail}
                  onChange={(e) => handleInputChange('general', 'supportEmail', e.target.value)}
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Timezone</label>
                <select
                  value={settings.general.timezone}
                  onChange={(e) => handleInputChange('general', 'timezone', e.target.value)}
                  className={styles.select}
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                  <option value="Europe/London">London</option>
                  <option value="Asia/Dubai">Dubai</option>
                </select>
              </div>

              <div className={styles.toggleGroup}>
                <label>
                  <input
                    type="checkbox"
                    checked={settings.general.maintenanceMode}
                    onChange={() => handleToggle('general', 'maintenanceMode')}
                  />
                  <span>Maintenance Mode</span>
                </label>
                <p className={styles.hint}>Enable to show maintenance message to users</p>
              </div>

              {settings.general.maintenanceMode && (
                <div className={styles.formGroup}>
                  <label>Maintenance Message</label>
                  <textarea
                    value={settings.general.maintenanceMessage}
                    onChange={(e) => handleInputChange('general', 'maintenanceMessage', e.target.value)}
                    className={styles.textarea}
                    rows="2"
                  />
                </div>
              )}
            </div>
          )}

          {/* Email Settings */}
          {activeTab === 'email' && (
            <div className={styles.settingsSection}>
              <h2 className={styles.sectionTitle}>Email Configuration</h2>

              <div className={styles.toggleGroup}>
                <label>
                  <input
                    type="checkbox"
                    checked={settings.email.emailEnabled}
                    onChange={() => handleToggle('email', 'emailEnabled')}
                  />
                  <span>Enable Email</span>
                </label>
                <p className={styles.hint}>Enable email functionality for the platform</p>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>SMTP Host</label>
                  <input
                    type="text"
                    value={settings.email.smtpHost}
                    onChange={(e) => handleInputChange('email', 'smtpHost', e.target.value)}
                    className={styles.input}
                    placeholder="smtp.gmail.com"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>SMTP Port</label>
                  <input
                    type="text"
                    value={settings.email.smtpPort}
                    onChange={(e) => handleInputChange('email', 'smtpPort', e.target.value)}
                    className={styles.input}
                    placeholder="587"
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>SMTP Username</label>
                  <input
                    type="text"
                    value={settings.email.smtpUser}
                    onChange={(e) => handleInputChange('email', 'smtpUser', e.target.value)}
                    className={styles.input}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>SMTP Password</label>
                  <input
                    type="password"
                    value={settings.email.smtpPassword}
                    onChange={(e) => handleInputChange('email', 'smtpPassword', e.target.value)}
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>From Name</label>
                  <input
                    type="text"
                    value={settings.email.fromName}
                    onChange={(e) => handleInputChange('email', 'fromName', e.target.value)}
                    className={styles.input}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>From Email</label>
                  <input
                    type="email"
                    value={settings.email.fromEmail}
                    onChange={(e) => handleInputChange('email', 'fromEmail', e.target.value)}
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.toggleGroup}>
                <label>
                  <input
                    type="checkbox"
                    checked={settings.email.smtpSecure}
                    onChange={() => handleToggle('email', 'smtpSecure')}
                  />
                  <span>Use TLS/SSL</span>
                </label>
                <p className={styles.hint}>Enable secure connection for SMTP</p>
              </div>
            </div>
          )}

          {/* PayPal Settings */}
          {activeTab === 'paypal' && (
            <div className={styles.settingsSection}>
              <h2 className={styles.sectionTitle}>PayPal Configuration</h2>

              <div className={styles.toggleGroup}>
                <label>
                  <input
                    type="checkbox"
                    checked={settings.paypal.paypalEnabled}
                    onChange={() => handleToggle('paypal', 'paypalEnabled')}
                  />
                  <span>Enable PayPal</span>
                </label>
                <p className={styles.hint}>Enable PayPal payment gateway</p>
              </div>

              <div className={styles.toggleGroup}>
                <label>
                  <input
                    type="checkbox"
                    checked={settings.paypal.sandboxMode}
                    onChange={() => handleToggle('paypal', 'sandboxMode')}
                  />
                  <span>Sandbox Mode</span>
                </label>
                <p className={styles.hint}>Use PayPal sandbox for testing</p>
              </div>

              <div className={styles.formGroup}>
                <label>Client ID</label>
                <input
                  type="text"
                  value={settings.paypal.clientId}
                  onChange={(e) => handleInputChange('paypal', 'clientId', e.target.value)}
                  className={styles.input}
                  placeholder="PayPal Client ID"
                />
              </div>

              <div className={styles.formGroup}>
                <label>Client Secret</label>
                <input
                  type="password"
                  value={settings.paypal.clientSecret}
                  onChange={(e) => handleInputChange('paypal', 'clientSecret', e.target.value)}
                  className={styles.input}
                  placeholder="PayPal Client Secret"
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Monthly Price ($)</label>
                  <input
                    type="number"
                    value={settings.paypal.monthlyPrice}
                    onChange={(e) => handleInputChange('paypal', 'monthlyPrice', e.target.value)}
                    className={styles.input}
                    min="1"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Yearly Price ($)</label>
                  <input
                    type="number"
                    value={settings.paypal.yearlyPrice}
                    onChange={(e) => handleInputChange('paypal', 'yearlyPrice', e.target.value)}
                    className={styles.input}
                    min="1"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Currency</label>
                  <select
                    value={settings.paypal.currency}
                    onChange={(e) => handleInputChange('paypal', 'currency', e.target.value)}
                    className={styles.select}
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="AUD">AUD</option>
                    <option value="CAD">CAD</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* API Keys */}
          {activeTab === 'api' && (
            <div className={styles.settingsSection}>
              <h2 className={styles.sectionTitle}>API Keys & Integration</h2>

              <div className={styles.formGroup}>
                <label>Stock API Key</label>
                <input
                  type="text"
                  value={settings.api.stockApiKey}
                  onChange={(e) => handleInputChange('api', 'stockApiKey', e.target.value)}
                  className={styles.input}
                  placeholder="Your stock API key"
                />
                <p className={styles.hint}>API key for stock data provider</p>
              </div>

              <div className={styles.formGroup}>
                <label>Stock API Provider</label>
                <select
                  value={settings.api.stockApiProvider}
                  onChange={(e) => handleInputChange('api', 'stockApiProvider', e.target.value)}
                  className={styles.select}
                >
                  <option value="eodhd">EODHD</option>
                  <option value="alphavantage">Alpha Vantage</option>
                  <option value="finnhub">Finnhub</option>
                  <option value="polygon">Polygon.io</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Telegram Bot Token</label>
                <input
                  type="text"
                  value={settings.api.telegramBotToken}
                  onChange={(e) => handleInputChange('api', 'telegramBotToken', e.target.value)}
                  className={styles.input}
                  placeholder="Bot token from @BotFather"
                />
              </div>

              <div className={styles.formGroup}>
                <label>Telegram Chat ID</label>
                <input
                  type="text"
                  value={settings.api.telegramChatId}
                  onChange={(e) => handleInputChange('api', 'telegramChatId', e.target.value)}
                  className={styles.input}
                  placeholder="Chat ID for notifications"
                />
              </div>

              <div className={styles.formGroup}>
                <label>Google Analytics ID</label>
                <input
                  type="text"
                  value={settings.api.googleAnalyticsId}
                  onChange={(e) => handleInputChange('api', 'googleAnalyticsId', e.target.value)}
                  className={styles.input}
                  placeholder="G-XXXXXXXXXX"
                />
              </div>

              <div className={styles.formGroup}>
                <label>reCAPTCHA Site Key</label>
                <input
                  type="text"
                  value={settings.api.recaptchaSiteKey}
                  onChange={(e) => handleInputChange('api', 'recaptchaSiteKey', e.target.value)}
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label>reCAPTCHA Secret Key</label>
                <input
                  type="password"
                  value={settings.api.recaptchaSecretKey}
                  onChange={(e) => handleInputChange('api', 'recaptchaSecretKey', e.target.value)}
                  className={styles.input}
                />
              </div>
            </div>
          )}

          {/* Features */}
          {activeTab === 'features' && (
            <div className={styles.settingsSection}>
              <h2 className={styles.sectionTitle}>Platform Features</h2>

              <div className={styles.toggleGrid}>
                <div className={styles.toggleGroup}>
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.features.registrationEnabled}
                      onChange={() => handleToggle('features', 'registrationEnabled')}
                    />
                    <span>User Registration</span>
                  </label>
                  <p className={styles.hint}>Allow new users to register</p>
                </div>

                <div className={styles.toggleGroup}>
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.features.postingEnabled}
                      onChange={() => handleToggle('features', 'postingEnabled')}
                    />
                    <span>Post Creation</span>
                  </label>
                  <p className={styles.hint}>Allow users to create posts</p>
                </div>

                <div className={styles.toggleGroup}>
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.features.commentsEnabled}
                      onChange={() => handleToggle('features', 'commentsEnabled')}
                    />
                    <span>Comments</span>
                  </label>
                  <p className={styles.hint}>Enable commenting on posts</p>
                </div>

                <div className={styles.toggleGroup}>
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.features.likesEnabled}
                      onChange={() => handleToggle('features', 'likesEnabled')}
                    />
                    <span>Likes</span>
                  </label>
                  <p className={styles.hint}>Enable post likes</p>
                </div>

                <div className={styles.toggleGroup}>
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.features.followingEnabled}
                      onChange={() => handleToggle('features', 'followingEnabled')}
                    />
                    <span>Following System</span>
                  </label>
                  <p className={styles.hint}>Enable user following</p>
                </div>

                <div className={styles.toggleGroup}>
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.features.telegramEnabled}
                      onChange={() => handleToggle('features', 'telegramEnabled')}
                    />
                    <span>Telegram Integration</span>
                  </label>
                  <p className={styles.hint}>Enable Telegram features</p>
                </div>

                <div className={styles.toggleGroup}>
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.features.emailVerification}
                      onChange={() => handleToggle('features', 'emailVerification')}
                    />
                    <span>Email Verification</span>
                  </label>
                  <p className={styles.hint}>Require email verification</p>
                </div>

                <div className={styles.toggleGroup}>
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.features.twoFactorAuth}
                      onChange={() => handleToggle('features', 'twoFactorAuth')}
                    />
                    <span>Two-Factor Auth</span>
                  </label>
                  <p className={styles.hint}>Enable 2FA for users</p>
                </div>

                <div className={styles.toggleGroup}>
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.features.postModeration}
                      onChange={() => handleToggle('features', 'postModeration')}
                    />
                    <span>Post Moderation</span>
                  </label>
                  <p className={styles.hint}>Require approval for posts</p>
                </div>

                <div className={styles.toggleGroup}>
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.features.userVerification}
                      onChange={() => handleToggle('features', 'userVerification')}
                    />
                    <span>User Verification</span>
                  </label>
                  <p className={styles.hint}>Enable verified badges</p>
                </div>
              </div>
            </div>
          )}

          {/* Limits */}
          {activeTab === 'limits' && (
            <div className={styles.settingsSection}>
              <h2 className={styles.sectionTitle}>Platform Limits</h2>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Max Post Length</label>
                  <input
                    type="number"
                    value={settings.limits.maxPostLength}
                    onChange={(e) => handleInputChange('limits', 'maxPostLength', e.target.value)}
                    className={styles.input}
                    min="100"
                    max="5000"
                  />
                  <p className={styles.hint}>Maximum characters per post</p>
                </div>

                <div className={styles.formGroup}>
                  <label>Max Comment Length</label>
                  <input
                    type="number"
                    value={settings.limits.maxCommentLength}
                    onChange={(e) => handleInputChange('limits', 'maxCommentLength', e.target.value)}
                    className={styles.input}
                    min="50"
                    max="1000"
                  />
                  <p className={styles.hint}>Maximum characters per comment</p>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Max Posts Per Day</label>
                  <input
                    type="number"
                    value={settings.limits.maxPostsPerDay}
                    onChange={(e) => handleInputChange('limits', 'maxPostsPerDay', e.target.value)}
                    className={styles.input}
                    min="1"
                    max="100"
                  />
                  <p className={styles.hint}>Per user per day</p>
                </div>

                <div className={styles.formGroup}>
                  <label>Max Comments Per Day</label>
                  <input
                    type="number"
                    value={settings.limits.maxCommentsPerDay}
                    onChange={(e) => handleInputChange('limits', 'maxCommentsPerDay', e.target.value)}
                    className={styles.input}
                    min="1"
                    max="500"
                  />
                  <p className={styles.hint}>Per user per day</p>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Max File Size (MB)</label>
                  <input
                    type="number"
                    value={settings.limits.maxFileSize}
                    onChange={(e) => handleInputChange('limits', 'maxFileSize', e.target.value)}
                    className={styles.input}
                    min="1"
                    max="50"
                  />
                  <p className={styles.hint}>Maximum upload size</p>
                </div>

                <div className={styles.formGroup}>
                  <label>Allowed File Types</label>
                  <input
                    type="text"
                    value={settings.limits.allowedFileTypes}
                    onChange={(e) => handleInputChange('limits', 'allowedFileTypes', e.target.value)}
                    className={styles.input}
                  />
                  <p className={styles.hint}>Comma separated extensions</p>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Max Followers</label>
                  <input
                    type="number"
                    value={settings.limits.maxFollowers}
                    onChange={(e) => handleInputChange('limits', 'maxFollowers', e.target.value)}
                    className={styles.input}
                    min="100"
                    max="100000"
                  />
                  <p className={styles.hint}>Maximum followers per user</p>
                </div>

                <div className={styles.formGroup}>
                  <label>Max Following</label>
                  <input
                    type="number"
                    value={settings.limits.maxFollowing}
                    onChange={(e) => handleInputChange('limits', 'maxFollowing', e.target.value)}
                    className={styles.input}
                    min="100"
                    max="100000"
                  />
                  <p className={styles.hint}>Maximum following per user</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
