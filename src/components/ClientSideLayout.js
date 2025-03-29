"use client";

import { useState, useEffect } from 'react';
import Navbar from '@/components/navbar';
import Footer from '@/components/Footer';
import { usePostForm } from '@/contexts/PostFormContext';

export function ClientSideLayout({ children }) {
  const [mounted, setMounted] = useState(false);
  const { formState, requestCancellation } = usePostForm();

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
      <style jsx>{`
        .floating-submission-indicator {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: #1a1a1a;
          color: white;
          padding: 12px 16px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          z-index: 1000;
          animation: slideIn 0.3s ease-out;
        }

        .indicator-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid #ffffff;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .indicator-text {
          font-size: 14px;
          white-space: nowrap;
        }

        .indicator-cancel-btn {
          background: transparent;
          border: none;
          color: #ffffff;
          padding: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.7;
          transition: opacity 0.2s;
          margin-left: 8px;
        }

        .indicator-cancel-btn:hover {
          opacity: 1;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes slideIn {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
      <Navbar />
      <main className="flex-grow pt-16">
        {children}
      </main>
      <Footer />

      {/* Floating Background Submission Indicator */}
      {formState?.backgroundSubmission && (
        <div className="jsx-c23a0dd426a71b58 floating-submission-indicator">
          <div className="indicator-spinner"></div>
          <div className="indicator-text">
            {formState.isCancelled 
              ? 'Cancelling submission...' 
              : formState.submissionProgress || 'Posting in progress...'}
          </div>
          {!formState.isCancelled && (
            <button 
              className="indicator-cancel-btn"
              onClick={() => {
                console.log('Cancelling from floating indicator');
                requestCancellation(true);
              }}
              aria-label="Cancel background post submission"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
}
