'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { toast } from 'sonner';
import styles from '@/styles/admin/settings.module.css';
import { useDemoMode } from '@/providers/DemoModeProvider';

export default function SystemSettings() {
  const { user, loading } = useSupabase();
  const router = useRouter();
  const { isDemoAdmin } = useDemoMode();
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
      siteName: 'TradingHub Pro',
      siteUrl: 'https://tradinghub.com',
      siteDescription: 'Professional Trading Platform',
      contactEmail: 'contact@tradinghub.com',
      supportEmail: 'support@tradinghub.com',
      timezone: 'UTC',
      language: 'en',
      maintenanceMode: false,
      maintenanceMessage: 'Site is under maintenance. Please check back later.'
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
    auth: {
      google: {
        enabled: false,
        clientId: '',
        clientSecret: '',
        allowedDomains: ''
      }
    },
    clock: {
      clockEnabled: true,
      timezone: 'UTC',
      showTimezone: true,
      use24HourFormat: true,
      syncWithServer: true,
      autoDetectTimezone: false,
      displayFormat: 'full' // full, short, time-only
    },
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
      if (isDemoAdmin) {
        // In demo admin mode, use the default in-memory settings as demo data
        setIsLoading(false);
        return;
      }
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
    if (isDemoAdmin) {
      toast.info('Demo admin mode is read-only. Settings are not saved.');
      return;
    }
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

  const handleNestedInputChange = (section, subsection, field, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [subsection]: {
          ...(prev[section]?.[subsection] || {}),
          [field]: value
        }
      }
    }));
  };

  const handleNestedToggle = (section, subsection, field) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [subsection]: {
          ...(prev[section]?.[subsection] || {}),
          [field]: !prev[section]?.[subsection]?.[field]
        }
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
            className={`${styles.tab} ${activeTab === 'clock' ? styles.active : ''}`}
            onClick={() => setActiveTab('clock')}
          >
            🕐 Clock Settings
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
            className={`${styles.tab} ${activeTab === 'auth' ? styles.active : ''}`}
            onClick={() => setActiveTab('auth')}
          >
            🔐 Auth
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

          {/* Clock Settings */}
          {activeTab === 'clock' && (
            <div className={styles.settingsSection}>
              <h2 className={styles.sectionTitle}>Clock & Timezone Settings</h2>
              
              {/* Important Notice */}
              <div className={styles.infoBox}>
                <div className={styles.infoIcon}>ℹ️</div>
                <div className={styles.infoContent}>
                  <h3>Why Clock Settings Matter</h3>
                  <p>
                    <strong>UTC (Coordinated Universal Time)</strong> is used throughout the application to ensure consistency. 
                    All posts, comments, and trading activities are timestamped in UTC to avoid confusion across different timezones.
                  </p>
                  <ul>
                    <li>📝 <strong>Post Publishing:</strong> All posts are published with UTC timestamps</li>
                    <li>🔍 <strong>Post Checking:</strong> Post verification and moderation use UTC time</li>
                    <li>📊 <strong>Trading Data:</strong> Stock market data and analysis timestamps use UTC</li>
                    <li>🌍 <strong>Global Users:</strong> Users from different timezones see consistent timing</li>
                  </ul>
                </div>
              </div>

              {/* Clock Enable/Disable */}
              <div className={styles.toggleGroup}>
                <label>
                  <input
                    type="checkbox"
                    checked={settings.clock.clockEnabled}
                    onChange={() => handleToggle('clock', 'clockEnabled')}
                  />
                  <span>Enable Clock System</span>
                </label>
                <p className={styles.hint}>Enable or disable the clock system for the entire application</p>
              </div>

              {settings.clock.clockEnabled && (
                <>
                  {/* Timezone Selection */}
                  <div className={styles.formGroup}>
                    <label>System Timezone</label>
                    <select
                      value={settings.clock.timezone}
                      onChange={(e) => handleInputChange('clock', 'timezone', e.target.value)}
                      className={styles.select}
                    >
                      <option value="UTC">UTC (Coordinated Universal Time) - Recommended</option>
                      <option value="America/New_York">Eastern Time (ET)</option>
                      <option value="America/Chicago">Central Time (CT)</option>
                      <option value="America/Denver">Mountain Time (MT)</option>
                      <option value="America/Los_Angeles">Pacific Time (PT)</option>
                      <option value="Europe/London">London (GMT/BST)</option>
                      <option value="Europe/Paris">Paris (CET/CEST)</option>
                      <option value="Europe/Berlin">Berlin (CET/CEST)</option>
                      <option value="Asia/Tokyo">Tokyo (JST)</option>
                      <option value="Asia/Shanghai">Shanghai (CST)</option>
                      <option value="Asia/Dubai">Dubai (GST)</option>
                      <option value="Australia/Sydney">Sydney (AEST/AEDT)</option>
                    </select>
                    <p className={styles.hint}>
                      <strong>Recommended:</strong> Keep UTC for global trading platform consistency
                    </p>
                  </div>

                  {/* Display Options */}
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>Time Display Format</label>
                      <select
                        value={settings.clock.displayFormat}
                        onChange={(e) => handleInputChange('clock', 'displayFormat', e.target.value)}
                        className={styles.select}
                      >
                        <option value="full">Full (Date & Time with Timezone)</option>
                        <option value="short">Short (Date & Time)</option>
                        <option value="time-only">Time Only</option>
                      </select>
                    </div>

                    <div className={styles.toggleGroup}>
                      <label>
                        <input
                          type="checkbox"
                          checked={settings.clock.use24HourFormat}
                          onChange={() => handleToggle('clock', 'use24HourFormat')}
                        />
                        <span>24-Hour Format</span>
                      </label>
                      <p className={styles.hint}>Use 24-hour format (14:30) instead of 12-hour (2:30 PM)</p>
                    </div>
                  </div>

                  {/* Advanced Options */}
                  <div className={styles.toggleGrid}>
                    <div className={styles.toggleGroup}>
                      <label>
                        <input
                          type="checkbox"
                          checked={settings.clock.showTimezone}
                          onChange={() => handleToggle('clock', 'showTimezone')}
                        />
                        <span>Show Timezone</span>
                      </label>
                      <p className={styles.hint}>Display timezone abbreviation (UTC, EST, etc.)</p>
                    </div>

                    <div className={styles.toggleGroup}>
                      <label>
                        <input
                          type="checkbox"
                          checked={settings.clock.syncWithServer}
                          onChange={() => handleToggle('clock', 'syncWithServer')}
                        />
                        <span>Sync with Server</span>
                      </label>
                      <p className={styles.hint}>Synchronize client time with server time</p>
                    </div>

                    <div className={styles.toggleGroup}>
                      <label>
                        <input
                          type="checkbox"
                          checked={settings.clock.autoDetectTimezone}
                          onChange={() => handleToggle('clock', 'autoDetectTimezone')}
                        />
                        <span>Auto-detect User Timezone</span>
                      </label>
                      <p className={styles.hint}>Automatically detect user's local timezone for display</p>
                    </div>
                  </div>

                  {/* Current Time Preview */}
                  <div className={styles.previewBox}>
                    <h4>Current Time Preview</h4>
                    <div className={styles.timePreview}>
                      <div className={styles.timeDisplay}>
                        <span className={styles.currentTime}>
                          {new Date().toLocaleString('en-US', {
                            timeZone: settings.clock.timezone,
                            hour12: !settings.clock.use24HourFormat,
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            timeZoneName: settings.clock.showTimezone ? 'short' : undefined
                          })}
                        </span>
                      </div>
                      <p className={styles.previewNote}>
                        This is how timestamps will appear throughout the application
                      </p>
                    </div>
                  </div>
                </>
              )}
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

          {/* Auth Settings */}
          {activeTab === 'auth' && (
            <div className={styles.settingsSection}>
              <h2 className={styles.sectionTitle}>Authentication & Social Login</h2>

              <div className={styles.infoBox}>
                <div className={styles.infoIcon}>🔐</div>
                <div className={styles.infoContent}>
                  <h3>Google Login</h3>
                  <p>
                    Configure Google OAuth login for your users. Client ID is safe to use on the client side,
                    but the Client Secret is stored securely and only used on the server.
                  </p>
                </div>
              </div>

              <div className={styles.toggleGroup}>
                <label>
                  <input
                    type="checkbox"
                    checked={settings.auth?.google?.enabled}
                    onChange={() => handleNestedToggle('auth', 'google', 'enabled')}
                  />
                  <span>Enable Google Login</span>
                </label>
                <p className={styles.hint}>Allow users to sign in using their Google account</p>
              </div>

              {settings.auth?.google?.enabled && (
                <>
                  <div className={styles.formGroup}>
                    <label>Google Client ID</label>
                    <input
                      type="text"
                      value={settings.auth?.google?.clientId || ''}
                      onChange={(e) => handleNestedInputChange('auth', 'google', 'clientId', e.target.value)}
                      className={styles.input}
                      placeholder="YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Google Client Secret</label>
                    <input
                      type="password"
                      value={settings.auth?.google?.clientSecret || ''}
                      onChange={(e) => handleNestedInputChange('auth', 'google', 'clientSecret', e.target.value)}
                      className={styles.input}
                      placeholder="Google OAuth client secret"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Allowed Google Domains (optional)</label>
                    <input
                      type="text"
                      value={settings.auth?.google?.allowedDomains || ''}
                      onChange={(e) => handleNestedInputChange('auth', 'google', 'allowedDomains', e.target.value)}
                      className={styles.input}
                      placeholder="e.g. gmail.com, company.com"
                    />
                    <p className={styles.hint}>Leave empty to allow any Google account. Otherwise, only these domains will be allowed.</p>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Redirect URL</label>
                    <input
                      type="text"
                      readOnly
                      value={`${(settings.general.siteUrl || '').replace(/\/+$/, '')}/auth/callback/google`}
                      className={styles.input}
                    />
                    <p className={styles.hint}>Use this URL in your Google Cloud Console OAuth redirect URIs.</p>
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </AdminLayout>
  );
}
