import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

const TELEGRAM_TOKEN = process.env.TELEGRAM_CONTACT_BOT_TOKEN || process.env.TELEGRAMBOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean)

async function getAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

async function ensureAdminAuth(request) {
  // Get user_id from query params (localStorage auth) or headers
  const { searchParams } = new URL(request.url)
  const userIdFromQuery = searchParams.get('user_id')
  const userIdFromHeader = request.headers.get('x-user-id')
  
  // Fallback to cookies if available
  const cookieStore = await cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data: { user: cookieUser } } = await supabase.auth.getUser()
  
  // Use user_id from query/header or cookies
  const userId = userIdFromQuery || userIdFromHeader || cookieUser?.id || null
  
  console.log('[Admin Auth] Check:', {
    hasUserIdFromQuery: !!userIdFromQuery,
    hasUserIdFromHeader: !!userIdFromHeader,
    hasUserFromCookie: !!cookieUser,
    finalUserId: userId
  })
  
  if (!userId) {
    return { ok: false, status: 401, error: 'Unauthorized - Please login first' }
  }
  
  // Create a user object for compatibility
  const user = cookieUser || { id: userId }
  
  // In development mode (no ADMIN_USER_IDS set), allow any authenticated user
  if (ADMIN_USER_IDS.length === 0) {
    console.log('⚠️ ADMIN_USER_IDS not configured - allowing any authenticated user (dev mode)')
    return { ok: true, user }
  }
  
  // In production mode, check if user is in admin list
  if (!ADMIN_USER_IDS.includes(userId)) {
    return { ok: false, status: 403, error: 'Forbidden - Admin access required' }
  }
  return { ok: true, user }
}

export async function GET(request) {
  try {
    const auth = await ensureAdminAuth(request)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const admin = await getAdminClient()
    if (!admin) return NextResponse.json({ error: 'Server admin configuration missing' }, { status: 500 })

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversation_id')

    if (conversationId) {
      const { data: conv, error: convErr } = await admin
        .from('contact_conversations')
        .select('*')
        .eq('id', conversationId)
        .single()
      if (convErr || !conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

      const { data: msgs, error: msgsErr } = await admin
        .from('contact_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (msgsErr) return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 })
      return NextResponse.json({ conversation: conv, messages: msgs || [] })
    }

    const { data: conversations, error } = await admin
      .from('contact_conversations')
      .select('*')
      .order('last_message_at', { ascending: false })
      .limit(100)

    if (error) return NextResponse.json({ error: 'Failed to load conversations' }, { status: 500 })
    return NextResponse.json({ conversations: conversations || [] })
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const auth = await ensureAdminAuth(request)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { conversation_id, body } = await request.json().catch(() => ({}))
    if (!conversation_id || !body || !String(body).trim()) {
      return NextResponse.json({ error: 'Missing conversation_id or body' }, { status: 400 })
    }

    const admin = await getAdminClient()
    if (!admin) return NextResponse.json({ error: 'Server admin configuration missing' }, { status: 500 })

    // Insert admin message
    const { data: msg, error: msgErr } = await admin
      .from('contact_messages')
      .insert({ conversation_id, sender: 'admin', body: String(body).trim(), admin_id: auth.user.id })
      .select('*')
      .single()

    if (msgErr) return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 })

    // Load conversation to get telegram ids
    const { data: conv } = await admin
      .from('contact_conversations')
      .select('*')
      .eq('id', conversation_id)
      .single()

    // Try to send telegram reply to user if we have a telegram_user_id
    if (TELEGRAM_TOKEN && conv?.telegram_user_id) {
      try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: Number(conv.telegram_user_id), text: body })
        })
      } catch {}
    }

    return NextResponse.json({ ok: true, messageId: msg.id })
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
