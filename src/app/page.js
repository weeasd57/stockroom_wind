"use client";

import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { useAuth } from "@/hooks/useAuth";

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [errorDetails, setErrorDetails] = useState(null);

  // Check authentication and redirect if needed
  useEffect(() => {
    if (loading) return;
    
    if (user) {
      router.push('/home');
    } else {
      router.push('/landing');
    }
  }, [user, loading, router]);

  // Animation effect
  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Show loading spinner while checking auth and redirecting
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="animate-spin h-10 w-10 border-t-2 border-b-2 border-primary rounded-full"></div>
    </div>
  );
}
