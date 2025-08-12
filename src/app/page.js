"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client for checking auth status
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Check if environment variables are set
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables. Redirecting to landing page.');
}

const supabase = supabaseUrl && supabaseAnonKey ? 
  createClient(supabaseUrl, supabaseAnonKey) : 
  null;

export default function RootPage() {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Check authentication status and redirect accordingly
  useEffect(() => {
    async function checkAuthAndRedirect() {
      try {
        // If no Supabase client, redirect to landing
        if (!supabase) {
          router.push('/landing');
          return;
        }

        // Get the current session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error checking auth status:', error.message);
          // If there's an error, redirect to landing page
          router.push('/landing');
          return;
        }
        
        // If user is authenticated, redirect to home
        if (session) {
          console.log('User is authenticated, redirecting to home');
          router.push('/home');
        } else {
          // If user is not authenticated, redirect to landing page
          console.log('User is not authenticated, redirecting to landing');
          router.push('/landing');
        }
      } catch (err) {
        console.error('Unexpected error checking auth:', err);
        // If there's an unexpected error, redirect to landing page
        router.push('/landing');
      } finally {
        setIsLoading(false);
      }
    }
    
    checkAuthAndRedirect();
  }, [router]);

  // Animation effect for the brief moment this page is visible
  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Show minimal loading UI while redirecting
  return (
    <div className="auth-loading-container">
      <div className={isVisible ? 'auth-fade-in' : ''}>
        <div className="auth-spinner large"></div>
        <p className="auth-loading-text">{isLoading ? 'Checking authentication...' : 'Redirecting...'}</p>
      </div>
    </div>
  );
}
