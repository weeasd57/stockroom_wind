import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// In production, these would be stored in database
let systemSettings = {
  general: {
    siteName: 'Sharks Zone',
    siteUrl: 'https://tradinghub.com',
    siteDescription: 'Professional Trading Platform',
    contactEmail: 'contact@tradinghub.com',
    supportEmail: 'support@tradinghub.com',
    timezone: 'UTC',
    language: 'en',
    maintenanceMode: false,
    maintenanceMessage: 'Site is under maintenance. Please check back later.'
  },
  email: {
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: process.env.SMTP_PORT || '587',
    smtpUser: process.env.SMTP_USER || '',
    smtpPassword: process.env.SMTP_PASSWORD || '',
    smtpSecure: process.env.SMTP_SECURE === 'true',
    fromName: process.env.EMAIL_FROM_NAME || 'TradingHub',
    fromEmail: process.env.EMAIL_FROM || 'noreply@tradinghub.com',
    emailEnabled: process.env.EMAIL_ENABLED === 'true'
  },
  paypal: {
    clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
    sandboxMode: process.env.PAYPAL_SANDBOX_MODE === 'true',
    monthlyPrice: '10',
    yearlyPrice: '99',
    currency: 'USD',
    paypalEnabled: process.env.PAYPAL_ENABLED === 'true'
  },
  api: {
    stockApiKey: process.env.STOCK_API_KEY || '',
    stockApiProvider: process.env.STOCK_API_PROVIDER || 'eodhd',
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
    googleAnalyticsId: process.env.NEXT_PUBLIC_GA_ID || '',
    recaptchaSiteKey: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '',
    recaptchaSecretKey: process.env.RECAPTCHA_SECRET_KEY || ''
  },
  auth: {
    google: {
      enabled: false,
      clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
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
    displayFormat: 'full'
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
    maxFileSize: '5',
    allowedFileTypes: 'jpg,jpeg,png,gif,webp',
    maxFollowers: '1000',
    maxFollowing: '1000'
  }
};

function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Supabase admin credentials are not configured');
  }

  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function verifyAdminFromHeader(request) {
  const adminEmail = request.headers.get('x-admin-email');

  if (!adminEmail) {
    return { ok: false, errorResponse: NextResponse.json({ error: 'Admin authentication required' }, { status: 401 }) };
  }

  const supabase = getSupabaseAdminClient();

  const { data: admin, error } = await supabase
    .from('admin_credentials')
    .select('id, admin_email, is_active')
    .eq('admin_email', adminEmail.toLowerCase().trim())
    .eq('is_active', true)
    .single();

  if (error || !admin) {
    return { ok: false, errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) };
  }

  return { ok: true, admin };
}

export async function GET(request) {
  try {
    const auth = await verifyAdminFromHeader(request);

    if (!auth.ok) {
      return auth.errorResponse;
    }

    const supabase = getSupabaseAdminClient();

    // Check if settings exist in database
    const { data: dbSettings, error } = await supabase
      .from('system_settings')
      .select('*')
      .single();

    if (!error && dbSettings) {
      // Merge database settings with defaults
      systemSettings = {
        ...systemSettings,
        ...dbSettings.settings
      };
    }

    // Remove sensitive data before sending to client
    const clientSettings = JSON.parse(JSON.stringify(systemSettings));
    
    // Mask sensitive fields
    if (clientSettings.email.smtpPassword) {
      clientSettings.email.smtpPassword = '********';
    }
    if (clientSettings.paypal.clientSecret) {
      clientSettings.paypal.clientSecret = '********';
    }
    if (clientSettings.api.telegramBotToken) {
      clientSettings.api.telegramBotToken = clientSettings.api.telegramBotToken.substring(0, 10) + '...';
    }
    if (clientSettings.api.recaptchaSecretKey) {
      clientSettings.api.recaptchaSecretKey = '********';
    }
    if (clientSettings.auth?.google?.clientSecret) {
      clientSettings.auth.google.clientSecret = '********';
    }

    return NextResponse.json({
      settings: clientSettings,
      success: true
    });

  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { settings } = await request.json();

    if (!settings) {
      return NextResponse.json(
        { error: 'Settings data required' },
        { status: 400 }
      );
    }

    const auth = await verifyAdminFromHeader(request);

    if (!auth.ok) {
      return auth.errorResponse;
    }

    const supabase = getSupabaseAdminClient();

    // Don't update masked fields
    const updatedSettings = { ...systemSettings };
    
    // Update only non-sensitive fields or fields that have changed
    Object.keys(settings).forEach(section => {
      if (!updatedSettings[section]) {
        updatedSettings[section] = {};
      }

      Object.keys(settings[section] || {}).forEach(key => {
        const value = settings[section][key];
        
        // Skip masked values
        if (value === '********' || (typeof value === 'string' && value.endsWith('...'))) {
          return;
        }
        
        updatedSettings[section][key] = value;
      });
    });

    // Save to database
    const { error: upsertError } = await supabase
      .from('system_settings')
      .upsert({
        id: 1, // Single row for settings
        settings: updatedSettings,
        updated_at: new Date().toISOString()
      });

    if (upsertError) {
      console.error('Settings save error:', upsertError);
      // Continue even if database save fails - settings are in memory
    }

    // Update in-memory settings
    systemSettings = updatedSettings;

    // Log the change (no direct relation to auth.users required)
    await supabase
      .from('admin_logs')
      .insert({
        action: 'settings_update',
        details: {
          admin_email: auth.admin.admin_email,
          sections_updated: Object.keys(settings)
        }
      });

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully'
    });

  } catch (error) {
    console.error('Settings POST error:', error);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}
