// Utility to send a Telegram broadcast when a post is created
// This calls the existing Next.js API route at /api/telegram/send-broadcast
// Notes:
// - Requires the user to be authenticated (the route uses Supabase auth session via cookies)
// - Requires the user to have an active Telegram bot configured (checked server-side)
// - Recipient resolution (followers/all subscribers) is handled server-side

export type RecipientType = 'followers' | 'all_subscribers' | 'manual';

// Build a concise message to avoid duplication with server-side Selected posts block
// Include only the user's comment (What's on your mind?) and the post link.
function buildPostMessage(post: any): { title: string; message: string } {
  const symbol = post?.symbol || 'Unknown';
  const company = post?.company_name || '';
  const description = (post?.description || '').toString().trim();
  const link = typeof window !== 'undefined' ? `${window.location.origin}/posts/${post?.id}` : `/posts/${post?.id}`;

  const title = `New Post: ${symbol}${company ? ` - ${company}` : ''}`;

  const lines: string[] = [];
  if (description) {
    lines.push(description);
  }
  lines.push(`Link: ${link}`);

  return { title, message: lines.join('\n') };
}

export async function sendTelegramBroadcastForPost(
  post: any,
  options: { recipientType?: RecipientType; title?: string; message?: string } = {}
): Promise<{ success: boolean; broadcastId?: string; error?: string }> {
  try {
    if (!post?.id) {
      return { success: false, error: 'Invalid post payload (missing id)' };
    }

    const { title, message } = options.title || options.message
      ? { title: options.title || 'New Post', message: options.message || '' }
      : buildPostMessage(post);

    // Debug payload composition
    try {
      console.log('[TelegramService] Preparing broadcast', {
        postId: post?.id,
        recipientType: options.recipientType || 'followers',
        hasDescription: Boolean(post?.description),
        title,
        messagePreview: message?.slice(0, 140)
      });
    } catch {}

    const payload = {
      title,
      message,
      selectedPosts: [post.id],
      selectedRecipients: [],
      recipientType: options.recipientType || 'followers',
    };

    const res = await fetch('/api/telegram/send-broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });

    // Read raw body for better diagnostics
    let raw = '';
    try { raw = await res.text(); } catch {}
    let json: any = {};
    try { json = raw ? JSON.parse(raw) : {}; } catch {}
    try {
      console.log('[TelegramService] Broadcast response', {
        status: res.status,
        ok: res.ok,
        body: raw?.slice(0, 500)
      });
    } catch {}

    if (!res.ok) {
      return { success: false, error: json?.error || `HTTP ${res.status}` };
    }

    return { success: true, broadcastId: json?.broadcastId };
  } catch (e: any) {
    try {
      console.error('[TelegramService] Broadcast error', {
        message: e?.message,
        stack: e?.stack
      });
    } catch {}
    return { success: false, error: e?.message || 'Failed to send telegram broadcast' };
  }
}
