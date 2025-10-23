'use client';

import React, { useState, useEffect } from 'react';
import { useProfile } from '@/providers/ProfileProvider';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';

export default function SocialMediaDebug() {
  const { profile } = useProfile();
  const { supabase, user } = useSupabase();
  const [dbData, setDbData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchDirectFromDB = async () => {
    if (!user || !supabase) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, facebook_url, telegram_url, youtube_url')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.error('Error fetching from DB:', error);
      } else {
        setDbData(data);
        console.log('Direct DB query result:', data);
      }
    } catch (err) {
      console.error('Exception:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDirectFromDB();
    }
  }, [user]);

  const addTestData = async () => {
    if (!user || !supabase) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          facebook_url: 'https://facebook.com/testuser',
          telegram_url: 'https://t.me/testchannel',
          youtube_url: 'https://youtube.com/@testchannel'
        })
        .eq('id', user.id)
        .select();
      
      if (error) {
        console.error('Error updating:', error);
      } else {
        console.log('Update successful:', data);
        fetchDirectFromDB(); // Refresh
      }
    } catch (err) {
      console.error('Exception:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearTestData = async () => {
    if (!user || !supabase) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          facebook_url: null,
          telegram_url: null,
          youtube_url: null
        })
        .eq('id', user.id)
        .select();
      
      if (error) {
        console.error('Error clearing:', error);
      } else {
        console.log('Clear successful:', data);
        fetchDirectFromDB(); // Refresh
      }
    } catch (err) {
      console.error('Exception:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <div>Not authenticated</div>;

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      background: '#1a1a1a', 
      color: 'white', 
      padding: '15px', 
      borderRadius: '8px',
      fontSize: '12px',
      maxWidth: '400px',
      zIndex: 9999,
      border: '1px solid #333'
    }}>
      <h3 style={{ margin: '0 0 10px 0', color: '#00ff88' }}>🔍 Social Media Debug</h3>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>From ProfileProvider:</strong>
        <pre style={{ background: '#2a2a2a', padding: '5px', margin: '5px 0', fontSize: '10px' }}>
          {JSON.stringify({
            facebook_url: profile?.facebook_url,
            telegram_url: profile?.telegram_url,
            youtube_url: profile?.youtube_url
          }, null, 2)}
        </pre>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <strong>Direct from Database:</strong>
        <pre style={{ background: '#2a2a2a', padding: '5px', margin: '5px 0', fontSize: '10px' }}>
          {dbData ? JSON.stringify({
            facebook_url: dbData.facebook_url,
            telegram_url: dbData.telegram_url,
            youtube_url: dbData.youtube_url
          }, null, 2) : 'Loading...'}
        </pre>
      </div>

      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
        <button 
          onClick={fetchDirectFromDB}
          disabled={loading}
          style={{ 
            padding: '4px 8px', 
            fontSize: '10px', 
            background: '#0066cc',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          🔄 Refresh
        </button>
        
        <button 
          onClick={addTestData}
          disabled={loading}
          style={{ 
            padding: '4px 8px', 
            fontSize: '10px', 
            background: '#00cc66',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          ➕ Add Test Data
        </button>
        
        <button 
          onClick={clearTestData}
          disabled={loading}
          style={{ 
            padding: '4px 8px', 
            fontSize: '10px', 
            background: '#cc6600',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          🗑️ Clear Data
        </button>
      </div>
    </div>
  );
}
