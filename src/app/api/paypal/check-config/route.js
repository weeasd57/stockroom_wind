import { NextResponse } from 'next/server';

// Use same fallback logic as PayPal API routes
function getCredentials() {
  const PAYPAL_MODE = process.env.PAYPAL_MODE || process.env.NEXT_PUBLIC_PAYPAL_MODE || 'sandbox';
  const isLive = PAYPAL_MODE === 'live';
  
  const clientId = isLive
    ? (process.env.PAYPAL_LIVE_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_LIVE || process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID)
    : (process.env.PAYPAL_SANDBOX_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX || process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID);
  
  const clientSecret = isLive
    ? (process.env.PAYPAL_LIVE_CLIENT_SECRET || process.env.PAYPAL_CLIENT_SECRET)
    : (process.env.PAYPAL_SANDBOX_CLIENT_SECRET || process.env.PAYPAL_CLIENT_SECRET);
    
  const webhookId = isLive
    ? (process.env.PAYPAL_LIVE_WEBHOOK_ID || process.env.PAYPAL_WEBHOOK_ID)
    : (process.env.PAYPAL_SANDBOX_WEBHOOK_ID || process.env.PAYPAL_WEBHOOK_ID);
  
  return { clientId, clientSecret, webhookId, mode: PAYPAL_MODE, isLive };
}

export async function GET() {
  // Get actual resolved credentials using fallback logic
  const { clientId, clientSecret, webhookId, mode, isLive } = getCredentials();
  
  const config = {
    // Check PayPal environment variables
    paypal_mode: mode,
    
    // Server-side credentials
    has_sandbox_client_id: !!process.env.PAYPAL_SANDBOX_CLIENT_ID,
    has_sandbox_secret: !!process.env.PAYPAL_SANDBOX_CLIENT_SECRET,
    has_live_client_id: !!process.env.PAYPAL_LIVE_CLIENT_ID,
    has_live_secret: !!process.env.PAYPAL_LIVE_CLIENT_SECRET,
    
    // Legacy credentials
    has_legacy_client_id: !!process.env.PAYPAL_CLIENT_ID,
    has_legacy_secret: !!process.env.PAYPAL_CLIENT_SECRET,
    
    // Client-side credentials (for SDK)
    has_public_sandbox_client_id: !!process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX,
    has_public_live_client_id: !!process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_LIVE,
    has_public_legacy_client_id: !!process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID,
    
    // Webhook IDs
    has_sandbox_webhook_id: !!process.env.PAYPAL_SANDBOX_WEBHOOK_ID,
    has_live_webhook_id: !!process.env.PAYPAL_LIVE_WEBHOOK_ID,
    has_legacy_webhook_id: !!process.env.PAYPAL_WEBHOOK_ID,
    
    // Show actual client IDs for debugging (first 8 chars only)
    sandbox_client_id_preview: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX?.substring(0, 8) + '...',
    live_client_id_preview: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_LIVE?.substring(0, 8) + '...',
    legacy_client_id_preview: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.substring(0, 8) + '...',
    
    // Show resolved values using fallback logic
    resolved_client_id_preview: clientId?.substring(0, 8) + '...' || 'not_found',
    resolved_client_secret_exists: !!clientSecret,
    resolved_webhook_id_exists: !!webhookId,
  };

  // Use actual resolved credentials for status check
  const hasRequiredServerCredentials = !!(clientId && clientSecret);
  const hasRequiredClientCredentials = !!clientId;

  const status = {
    mode: isLive ? 'live' : 'sandbox',
    server_credentials_ok: hasRequiredServerCredentials,
    client_credentials_ok: hasRequiredClientCredentials,
    webhooks_configured: !!webhookId,
    overall_status: hasRequiredServerCredentials && hasRequiredClientCredentials ? 'ready' : 'incomplete',
    
    // Show which fallback was used
    fallback_info: {
      client_id_source: clientId ? (
        isLive 
          ? (process.env.PAYPAL_LIVE_CLIENT_ID ? 'PAYPAL_LIVE_CLIENT_ID' : 
             process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_LIVE ? 'NEXT_PUBLIC_PAYPAL_CLIENT_ID_LIVE' :
             process.env.PAYPAL_CLIENT_ID ? 'PAYPAL_CLIENT_ID (fallback)' : 'NEXT_PUBLIC_PAYPAL_CLIENT_ID (fallback)')
          : (process.env.PAYPAL_SANDBOX_CLIENT_ID ? 'PAYPAL_SANDBOX_CLIENT_ID' :
             process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX ? 'NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX' :
             process.env.PAYPAL_CLIENT_ID ? 'PAYPAL_CLIENT_ID (fallback)' : 'NEXT_PUBLIC_PAYPAL_CLIENT_ID (fallback)')
      ) : 'none',
      
      client_secret_source: clientSecret ? (
        isLive 
          ? (process.env.PAYPAL_LIVE_CLIENT_SECRET ? 'PAYPAL_LIVE_CLIENT_SECRET' : 'PAYPAL_CLIENT_SECRET (fallback)')
          : (process.env.PAYPAL_SANDBOX_CLIENT_SECRET ? 'PAYPAL_SANDBOX_CLIENT_SECRET' : 'PAYPAL_CLIENT_SECRET (fallback)')
      ) : 'none',
      
      webhook_id_source: webhookId ? (
        isLive 
          ? (process.env.PAYPAL_LIVE_WEBHOOK_ID ? 'PAYPAL_LIVE_WEBHOOK_ID' : 'PAYPAL_WEBHOOK_ID (fallback)')
          : (process.env.PAYPAL_SANDBOX_WEBHOOK_ID ? 'PAYPAL_SANDBOX_WEBHOOK_ID' : 'PAYPAL_WEBHOOK_ID (fallback)')
      ) : 'none'
    }
  };

  const recommendations = [];
  
  if (!hasRequiredServerCredentials) {
    if (isLive) {
      recommendations.push('Add PAYPAL_LIVE_CLIENT_ID and PAYPAL_LIVE_CLIENT_SECRET for production');
    } else {
      recommendations.push('Add PAYPAL_SANDBOX_CLIENT_ID and PAYPAL_SANDBOX_CLIENT_SECRET for sandbox');
    }
  }
  
  if (!hasRequiredClientCredentials) {
    if (isLive) {
      recommendations.push('Add NEXT_PUBLIC_PAYPAL_CLIENT_ID_LIVE for production frontend');
    } else {
      recommendations.push('Add NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX for sandbox frontend');
    }
  }
  
  if (!status.webhooks_configured) {
    if (isLive) {
      recommendations.push('Add PAYPAL_LIVE_WEBHOOK_ID for production webhooks');
    } else {
      recommendations.push('Add PAYPAL_SANDBOX_WEBHOOK_ID for sandbox webhooks');
    }
  }

  return NextResponse.json({
    config,
    status,
    recommendations,
    troubleshooting: {
      common_issues: [
        'Sandbox Client IDs typically start with "A" and are longer',
        'Make sure .env.local contains all required variables',
        'Restart the dev server after adding new environment variables',
        'Check that PayPal account is verified and has business features enabled'
      ],
      environment_example: `
# Example .env.local configuration for sandbox:
PAYPAL_MODE=sandbox
PAYPAL_SANDBOX_CLIENT_ID=your_sandbox_client_id
PAYPAL_SANDBOX_CLIENT_SECRET=your_sandbox_secret
NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX=your_sandbox_client_id
PAYPAL_SANDBOX_WEBHOOK_ID=your_webhook_id

# For production, use:
PAYPAL_MODE=live
PAYPAL_LIVE_CLIENT_ID=your_live_client_id
PAYPAL_LIVE_CLIENT_SECRET=your_live_secret
NEXT_PUBLIC_PAYPAL_CLIENT_ID_LIVE=your_live_client_id
PAYPAL_LIVE_WEBHOOK_ID=your_webhook_id
      `.trim()
    }
  });
}
