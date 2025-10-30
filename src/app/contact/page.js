"use client";

import { useState, useEffect } from "react";
import { useSupabase } from "@/providers/SimpleSupabaseProvider";

export default function ContactPage() {
  const { user, getProfile } = useSupabase();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [telegramUserId, setTelegramUserId] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [messages, setMessages] = useState([]);
  const [convLoaded, setConvLoaded] = useState(false);

  const validate = () => {
    if (!name.trim()) return "Name is required";
    if (!email.trim()) return "Email is required";
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(email.trim())) return "Invalid email";
    if (!message.trim()) return "Message is required";
    return null;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setResult(null);
    const err = validate();
    if (err) {
      setResult({ ok: false, message: err });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name, 
          email, 
          subject, 
          message, 
          website,
          telegram_user_id: telegramUserId ? Number(telegramUserId) : null,
          telegram_username: telegramUsername,
          user_id: user?.id || null  // Send user_id from localStorage
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) {
        setResult({ ok: false, message: data?.error || "Failed to send message" });
      } else {
        setResult({ ok: true, message: "Message sent successfully" });
        setMessages((prev) => [...prev, { sender: "user", body: message, created_at: new Date().toISOString() }]);
        setMessage("");
        setWebsite("");
      }
    } catch (e) {
      setResult({ ok: false, message: "Network error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (user?.id) {
          const profile = await getProfile(user.id).catch(() => null);
          if (!alive) return;
          const fullName = profile?.full_name || profile?.username || "";
          setName((prev) => prev || fullName);
          setEmail((prev) => prev || user.email || "");
          const tgUrl = profile?.telegram_url || "";
          if (tgUrl && typeof tgUrl === "string") {
            const uname = tgUrl.replace(/^https?:\/\//, "").replace(/^t\.me\//, "").replace(/^@/, "");
            setTelegramUsername((prev) => prev || uname);
          }
        }
      } catch {}
    })();
    return () => { alive = false; };
  }, [user, getProfile]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!user?.id) {
          setConvLoaded(true);
          return;
        }
        // Send user_id as query parameter since auth is in localStorage
        const res = await fetch(`/api/contact?user_id=${user.id}`, { method: "GET" });
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (res.ok && data?.messages) {
          setMessages(data.messages);
        }
      } catch {}
      finally {
        if (alive) setConvLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, [user]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-2">Contact Us</h1>
      <p className="text-sm text-muted-foreground mb-6">Have a question or feedback? Send us a message.</p>

      {convLoaded && (
        <div className="mb-8 rounded-xl border-2 border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 pb-3 border-b border-[hsl(var(--border))]">Your Conversation</h2>
          {messages.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">No messages yet. Start a conversation below!</div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-auto pr-2 py-2">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.sender === 'admin' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`${
                    m.sender === 'admin' 
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white border-2 border-blue-400' 
                      : 'bg-gradient-to-br from-amber-500 to-amber-600 text-white border-2 border-amber-400'
                  } rounded-xl px-4 py-3 max-w-[80%] shadow-md hover:shadow-lg transition-shadow`}>
                    <div className="text-xs font-semibold mb-1.5 flex items-center gap-2">
                      <span>{m.sender === 'admin' ? '🛠️ Support' : '👤 You'}</span>
                      {m.created_at && (
                        <span className="opacity-75 text-[10px]">
                          {new Date(m.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">{m.body}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-5 bg-[hsl(var(--card))] border-2 border-[hsl(var(--border))] rounded-xl p-6 shadow-sm">
        <div className="pb-4 border-b border-[hsl(var(--border))]">
          <h3 className="text-xl font-semibold">Send us a message</h3>
          <p className="text-sm text-muted-foreground mt-1">Fill out the form below and we'll get back to you soon</p>
        </div>
        
        {/* Honeypot field (hidden) */}
        <div className="hidden">
          <label htmlFor="website" className="block text-sm font-medium">Website</label>
          <input
            id="website"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            type="text"
            className="mt-1 block w-full rounded-md border border-gray-300 bg-transparent p-2"
            autoComplete="off"
            tabIndex={-1}
          />
        </div>

        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1.5">Name *</label>
          <input
            id="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
            placeholder="Your name"
            className="mt-1 block w-full rounded-lg border-2 border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            required
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1.5">Email *</label>
          <input
            id="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="you@example.com"
            className="mt-1 block w-full rounded-lg border-2 border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            required
          />
        </div>

        <div>
          <label htmlFor="subject" className="block text-sm font-medium mb-1.5">Subject</label>
          <input
            id="subject"
            name="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            type="text"
            placeholder="How can we help?"
            className="mt-1 block w-full rounded-lg border-2 border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>

        <div>
          <label htmlFor="message" className="block text-sm font-medium mb-1.5">Message *</label>
          <textarea
            id="message"
            name="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            placeholder="Write your message here..."
            className="mt-1 block w-full rounded-lg border-2 border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 text-white font-semibold hover:from-blue-700 hover:to-blue-800 disabled:opacity-60 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all"
        >
          {loading ? "📤 Sending..." : "📨 Send Message"}
        </button>

        {result && (
          <div
            className={`p-4 rounded-lg border-2 text-sm font-medium ${
              result.ok 
                ? "bg-green-50 dark:bg-green-950 border-green-500 text-green-700 dark:text-green-300" 
                : "bg-red-50 dark:bg-red-950 border-red-500 text-red-700 dark:text-red-300"
            }`}
          >
            <span className="mr-2">{result.ok ? "✅" : "❌"}</span>
            {result.message}
          </div>
        )}
      </form>
    </div>
  );
}
