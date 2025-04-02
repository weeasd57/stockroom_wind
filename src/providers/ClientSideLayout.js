"use client";

import { useState, useEffect } from 'react';
import Navbar from '@/components/navbar';
import Footer from '@/components/Footer';

export function ClientSideLayout({ children }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Set mounted state once the component is on the client
    setMounted(true);
    
    // Function to remove translation elements
    const removeTranslationElements = () => {
      if (typeof document === 'undefined') return;
      
      try {
        // More targeted approach - only remove specific translator UI elements
        // Rather than targeting all elements with certain classes
        
        // Target only specific top-level translator elements
        const topLevelTranslators = document.querySelectorAll('body > div:not(.flex)');
        topLevelTranslators.forEach(el => {
          // Only remove if it contains translator text and is positioned at the top
          if (el.textContent && 
              el.textContent.toLowerCase().includes('translator') && 
              el.getBoundingClientRect().top < 100) {
            el.style.display = 'none';
          }
        });
        
        // Target specific translation elements we know about
        const specificSelectors = [
          '.trans_controls',
          '.translate-tooltip-mtz',
          '.goog-te-banner-frame',
          '.skiptranslate',
          '#google_translate_element',
          '.header-wrapper',
          '.translated-text'
        ];
        
        specificSelectors.forEach(selector => {
          try {
            document.querySelectorAll(selector).forEach(el => {
              el.style.display = 'none';
            });
          } catch (e) {
            // Ignore errors
          }
        });
        
        // Remove only specific translation-related iframes
        document.querySelectorAll('iframe').forEach(iframe => {
          const src = iframe.src || '';
          if (src.toLowerCase().includes('translate.google') || 
              src.toLowerCase().includes('translator')) {
            iframe.style.display = 'none';
          }
        });
      } catch (e) {
        console.error('Error in translation removal:', e);
      }
    };
    
    // Run once after a short delay to ensure the app has loaded
    const timeoutId = setTimeout(removeTranslationElements, 1000);
    
    // Clean up
    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  // If not mounted yet, return null to avoid hydration issues
  if (!mounted) {
    return null;
  }

  // Only render the full layout on the client side
  return (
    <div 
      className="flex flex-col min-h-screen"
      suppressHydrationWarning
    >
      <Navbar />
      <main className="flex-grow pt-16 w-full">
        {children}
      </main>
      <Footer />
    </div>
  );
}
