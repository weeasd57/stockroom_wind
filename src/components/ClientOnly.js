"use client";

import { useEffect, useState } from 'react';

/**
 * ClientOnly component wrapper
 * 
 * Use this component to wrap any client-side only code that relies on browser APIs like window, document, etc.
 * It only renders its children after the component has mounted on the client.
 * 
 * Example usage:
 * <ClientOnly>
 *   <ComponentThatUsesWindowOrDocument />
 * </ClientOnly>
 */
export default function ClientOnly({ children, fallback = null }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // If not mounted yet (during SSR), render the fallback or nothing
  if (!mounted) {
    return fallback || null;
  }

  // Once mounted on the client, render children
  return children;
}
