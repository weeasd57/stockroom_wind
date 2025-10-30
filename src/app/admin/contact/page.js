'use client'

import { useEffect, useState, useMemo } from 'react'
import { useSupabase } from '@/providers/SimpleSupabaseProvider'

export default function AdminContactInboxPage() {
  const { user } = useSupabase()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [conversations, setConversations] = useState([])
  const [selectedConv, setSelectedConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter(c => (
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.subject || '').toLowerCase().includes(q)
    ))
  }, [search, conversations])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        // Add user_id to request for localStorage auth
        const url = user?.id ? `/api/contact/admin?user_id=${user.id}` : '/api/contact/admin'
        const res = await fetch(url, { method: 'GET' })
        const data = await res.json().catch(() => ({}))
        if (!alive) return
        if (!res.ok) throw new Error(data?.error || 'Failed to load')
        setConversations(data.conversations || [])
      } catch (e) {
        setError(e.message || 'Error')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [user?.id])

  const loadConversation = async (conv) => {
    setSelectedConv(conv)
    setMessages([])
    try {
      // Add user_id to request for localStorage auth
      const url = user?.id 
        ? `/api/contact/admin?conversation_id=${conv.id}&user_id=${user.id}`
        : `/api/contact/admin?conversation_id=${conv.id}`
      const res = await fetch(url)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to load conversation')
      setMessages(data.messages || [])
    } catch (e) {
      setError(e.message || 'Error')
    }
  }

  const sendReply = async () => {
    if (!reply.trim() || !selectedConv) return
    setSending(true)
    try {
      // Add user_id to request for localStorage auth
      const url = user?.id ? `/api/contact/admin?user_id=${user.id}` : '/api/contact/admin'
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: selectedConv.id, body: reply.trim() })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to send reply')
      setMessages(prev => [...prev, { sender: 'admin', body: reply.trim(), created_at: new Date().toISOString() }])
      setReply('')
    } catch (e) {
      setError(e.message || 'Error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Contact Inbox</h1>
        <p className="text-sm text-muted-foreground">Manage and respond to user inquiries</p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border-2 border-red-200 text-red-700 text-sm">
          ⚠️ {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 border-2 border-[hsl(var(--border))] rounded-xl p-4 bg-[hsl(var(--card))] shadow-sm">
          <div className="mb-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Search by name/email/subject"
              className="w-full rounded-lg border-2 border-[hsl(var(--border))] bg-transparent p-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div className="max-h-[70vh] overflow-auto space-y-2 pr-1">
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground">No conversations</div>
            ) : (
              filtered.map(c => (
                <button
                  key={c.id}
                  onClick={() => loadConversation(c)}
                  className={`w-full text-left rounded-lg p-3 border-2 transition-all ${
                    selectedConv?.id === c.id 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 shadow-md' 
                      : 'border-[hsl(var(--border))] hover:border-blue-300 hover:bg-[hsl(var(--accent))]/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-semibold text-sm">{c.name || '❓ Unknown'}</div>
                    <div className="text-[10px] opacity-70 bg-[hsl(var(--muted))] px-2 py-0.5 rounded-full">
                      {new Date(c.last_message_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-xs opacity-80 mb-1">📧 {c.email}</div>
                  {c.subject && (
                    <div className="text-xs mt-1 line-clamp-1 opacity-70 italic">💬 {c.subject}</div>
                  )}
                  <div className={`mt-2 text-[10px] font-semibold ${
                    c.status === 'open' ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {c.status === 'open' ? '🟢 Open' : '⚪ Closed'}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="md:col-span-2 border-2 border-[hsl(var(--border))] rounded-xl p-5 bg-[hsl(var(--card))] min-h-[60vh] flex flex-col shadow-sm">
          {!selectedConv ? (
            <div className="text-sm text-muted-foreground text-center py-20">
              <div className="text-4xl mb-3">💬</div>
              <div>Select a conversation to view messages</div>
            </div>
          ) : (
            <>
              <div className="mb-4 pb-3 border-b-2 border-[hsl(var(--border))]">
                <div className="text-sm mb-2">
                  <span className="text-muted-foreground">To:</span> 
                  <span className="font-bold ml-1">{selectedConv.name}</span>
                  <span className="text-muted-foreground ml-2">({selectedConv.email})</span>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-3">
                  <span>📱 TG: {selectedConv.telegram_user_id || '—'}</span>
                  {selectedConv.telegram_username && (
                    <span className="bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded">@{selectedConv.telegram_username}</span>
                  )}
                </div>
              </div>

              <div className="flex-1 min-h-[300px] max-h-[60vh] overflow-auto space-y-3 pr-2 mb-4 py-2">
                {messages.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-10">No messages yet.</div>
                ) : (
                  messages.map((m, idx) => (
                    <div key={idx} className={`flex ${m.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`${
                        m.sender === 'admin' 
                          ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white border-2 border-blue-400' 
                          : 'bg-gradient-to-br from-gray-500 to-gray-600 text-white border-2 border-gray-400'
                      } rounded-xl px-4 py-3 max-w-[80%] shadow-md hover:shadow-lg transition-shadow`}>
                        <div className="text-xs font-semibold mb-1.5 flex items-center gap-2">
                          <span>{m.sender === 'admin' ? '🛠️ You (Admin)' : '👤 User'}</span>
                          {m.created_at && (
                            <span className="opacity-75 text-[10px]">
                              {new Date(m.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <div className="text-sm whitespace-pre-wrap leading-relaxed">{m.body}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-end gap-3 border-t-2 border-[hsl(var(--border))] pt-4">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={3}
                  placeholder="✍️ Type your reply..."
                  className="flex-1 rounded-lg border-2 border-[hsl(var(--border))] bg-transparent p-3 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none"
                />
                <button
                  onClick={sendReply}
                  disabled={sending || !reply.trim()}
                  className="rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg"
                >
                  {sending ? '⏳ Sending...' : '📤 Send'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
