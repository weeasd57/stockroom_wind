import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

const TELEGRAM_TOKEN = process.env.TELEGRAM_CONTACT_BOT_TOKEN || process.env.TELEGRAMBOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CONTACT_CHAT_ID = process.env.TELEGRAM_CONTACT_CHAT_ID;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getClientIp(headers) {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const realIp = headers.get('x-real-ip');
  return realIp || '';
}

function sanitize(input, max = 500) {
  if (!input || typeof input !== 'string') return '';
  return input.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '').trim().slice(0, max);
}

function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      name = '',
      email = '',
      subject = '',
      message = '',
      website = '',
      telegram_user_id = null,
      telegram_username = '',
      user_id = null  // User ID from client (localStorage)
    } = body || {};

    if (website) {
      return NextResponse.json({ ok: true });
    }

    const _name = sanitize(name, 120);
    const _email = sanitize(email, 160);
    const _subject = sanitize(subject, 160);
    const _message = sanitize(message, 2000);
    const _tgUsername = sanitize(telegram_username, 160);

    if (!_name || !_email || !_message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!isValidEmail(_email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Use user_id from request body (localStorage) as primary source
    // Fallback to cookies if available (but localStorage auth won't be in cookies)
    const cookieStore = await cookies();
    const userScoped = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: authData } = await userScoped.auth.getUser();
    const cookieUser = authData?.user || null;
    
    // Primary: user_id from request body (localStorage)
    // Fallback: user from cookies (if using cookie-based auth)
    const authenticatedUserId = user_id || cookieUser?.id || null;

    console.log('[Contact POST] Auth check:', {
      hasUserIdFromBody: !!user_id,
      hasUserFromCookie: !!cookieUser,
      finalUserId: authenticatedUserId,
      email: cookieUser?.email || _email,
      requestEmail: _email
    });

    let adminClient = null;
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const { createClient } = await import('@supabase/supabase-js');
      adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    }

    const supa = adminClient || userScoped;
    console.log('[Contact POST] Using client:', adminClient ? 'Admin (Service Role)' : 'User Scoped');

    // Find or create conversation
    let conversation = null;
    
    if (authenticatedUserId) {
      console.log('[Contact POST] Authenticated user detected, looking for existing conversation...');
      // Step 1: Look for conversation with user_id = authenticatedUserId
      const { data: userConv } = await supa
        .from('contact_conversations')
        .select('*')
        .eq('user_id', authenticatedUserId)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      conversation = userConv;
      console.log('[Contact POST] Step 1 result:', { foundUserConv: !!userConv, convId: userConv?.id });
      
      // Step 2: If not found, look for orphan conversation with same email (user_id IS NULL)
      if (!conversation) {
        console.log('[Contact POST] Step 2: Looking for orphan conversation with email:', _email);
        const { data: orphanConv } = await supa
          .from('contact_conversations')
          .select('*')
          .eq('email', _email)
          .is('user_id', null)
          .order('last_message_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        console.log('[Contact POST] Step 2 result:', { foundOrphan: !!orphanConv, convId: orphanConv?.id });
        
        // Step 3: If found orphan conversation, link it to current user
        if (orphanConv) {
          console.log('[Contact POST] Step 3: Linking orphan conversation to user:', authenticatedUserId);
          const { data: linkedConv, error: linkErr } = await supa
            .from('contact_conversations')
            .update({ 
              user_id: authenticatedUserId,
              name: _name,
              subject: _subject || orphanConv.subject
            })
            .eq('id', orphanConv.id)
            .select('*')
            .single();
          
          if (linkErr) {
            console.error('[Contact POST] Error linking conversation:', linkErr);
          } else {
            console.log('[Contact POST] Successfully linked conversation:', linkedConv?.id);
          }
          
          conversation = linkedConv || orphanConv;
        }
      }
    }
    
    // Step 4: If still no conversation found, create a new one
    if (!conversation) {
      console.log('[Contact POST] Step 4: Creating new conversation for user:', authenticatedUserId || 'null (unauthenticated)');
      const insertConv = {
        user_id: authenticatedUserId || null,
        email: _email,
        name: _name,
        subject: _subject || null,
        telegram_user_id: telegram_user_id ? Number(telegram_user_id) : null,
        telegram_username: _tgUsername || null,
        status: 'open'
      };
      const { data: newConv, error: convErr } = await supa
        .from('contact_conversations')
        .insert(insertConv)
        .select('*')
        .single();
      
      if (convErr) {
        console.error('Failed to create conversation:', convErr);
        return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
      }
      
      conversation = newConv;
    } else {
      console.log('[Contact POST] Using existing conversation:', conversation.id);
      // Update conversation details if provided
      await supa
        .from('contact_conversations')
        .update({
          subject: _subject || conversation.subject,
          telegram_user_id: telegram_user_id ? Number(telegram_user_id) : conversation.telegram_user_id,
          telegram_username: _tgUsername || conversation.telegram_username
        })
        .eq('id', conversation.id);
    }

    console.log('[Contact POST] Final conversation:', {
      id: conversation?.id,
      user_id: conversation?.user_id,
      email: conversation?.email
    });

    // Insert message
    const { data: msg, error: msgErr } = await supa
      .from('contact_messages')
      .insert({
        conversation_id: conversation.id,
        sender: 'user',
        body: _message
      })
      .select('*')
      .single();

    if (msgErr) {
      return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
    }

    // Send to Telegram (optional)
    if (TELEGRAM_TOKEN && TELEGRAM_CONTACT_CHAT_ID) {
      const ip = getClientIp(request.headers);
      const text = [
        'New contact message',
        '--------------------',
        `Name: ${_name}`,
        `Email: ${_email}`,
        `Subject: ${_subject || '-'}`,
        `IP: ${ip || '-'}`,
        telegram_user_id ? `TG ID: ${telegram_user_id}` : null,
        _tgUsername ? `TG Username: ${_tgUsername}` : null,
        '----',
        _message
      ].filter(Boolean).join('\n');

      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CONTACT_CHAT_ID, text })
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, conversationId: conversation.id, messageId: msg.id });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    // Get user_id from query parameters (localStorage auth)
    const { searchParams } = new URL(request.url);
    const userIdFromQuery = searchParams.get('user_id');
    
    // Fallback to cookies if available
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user: cookieUser } } = await supabase.auth.getUser();
    
    // Use user_id from query or cookies
    const authenticatedUserId = userIdFromQuery || cookieUser?.id || null;
    
    console.log('[Contact GET] Auth check:', {
      hasUserIdFromQuery: !!userIdFromQuery,
      hasUserFromCookie: !!cookieUser,
      finalUserId: authenticatedUserId
    });
    
    // Return empty response for unauthenticated users
    if (!authenticatedUserId) {
      return NextResponse.json({ conversation: null, messages: [] });
    }

    // Setup admin client for RLS bypass
    let adminClient = null;
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const { createClient } = await import('@supabase/supabase-js');
      adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    }
    
    const supa = adminClient || supabase;

    // Try to find conversation by user_id first
    let { data: conv } = await supa
      .from('contact_conversations')
      .select('*')
      .eq('user_id', authenticatedUserId)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log('[Contact GET] Conversation found:', { 
      found: !!conv, 
      convId: conv?.id,
      userId: conv?.user_id 
    });

    if (!conv) {
      console.log('[Contact GET] No conversation found for user:', authenticatedUserId);
      return NextResponse.json({ conversation: null, messages: [] });
    }

    let { data: messages, error: msgErr } = await supa
      .from('contact_messages')
      .select('*')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true });

    // If RLS blocks messages but we have admin client, try raw query
    if ((!messages || messages.length === 0) && adminClient) {
      console.log('[Contact GET] Trying raw SQL query for messages...');
      const { data: rawMessages } = await adminClient.rpc('get_conversation_messages', {
        conv_id: conv.id
      }).catch(() => ({ data: null }));
      
      if (rawMessages) {
        messages = rawMessages;
        msgErr = null;
      }
    }

    if (msgErr) {
      console.error('[Contact GET] Error loading messages:', msgErr);
    }

    console.log('[Contact GET] Messages query:', {
      conversationId: conv.id,
      messagesCount: messages?.length || 0,
      error: msgErr?.message,
      usingAdminClient: !!adminClient
    });

    return NextResponse.json({ conversation: conv, messages: messages || [] });
  } catch (err) {
    console.error('[Contact GET] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
