"use client";

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Navbar from '@/components/navbar';

export function ClientSideLayout({ children }) {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  // Define pages that don't need the navbar
  const pagesWithoutNavbar = ['/landing'];
  const shouldShowNavbar = !pagesWithoutNavbar.includes(pathname);

  useEffect(() => {
    // Set mounted state once the component is on the client
    setMounted(true);

    if (typeof document === 'undefined') return;

    // Preserve original SVG path 'd' attributes to prevent translator scripts from mangling them
    const originalPathD = new WeakMap();

    const captureOriginalSvgPaths = () => {
      try {
        document.querySelectorAll('svg path[d]').forEach((p) => {
          try {
            const d = p.getAttribute('d');
            if (d) originalPathD.set(p, d);
          } catch (e) {}
        });
      } catch (e) {}
    };

    const restoreSvgPaths = () => {
      try {
        document.querySelectorAll('svg path[d]').forEach((p) => {
          try {
            const orig = originalPathD.get(p);
            if (orig && p.getAttribute('d') !== orig) {
              p.setAttribute('d', orig);
            }
          } catch (e) {}
        });
      } catch (e) {}
    };

    // Remove translator UI elements in a targeted, safe way
    const removeTranslationElements = () => {
      try {
        // Hide only top-level translator banners inserted near the top of the body
        document.querySelectorAll('body > div').forEach((el) => {
          try {
            const txt = (el.textContent || '').toLowerCase();
            if ((txt.includes('translator') || txt.includes('translation')) && el.getBoundingClientRect().top < 120) {
              el.style.display = 'none';
            }
          } catch (e) {}
        });

        // Hide well-known translator selectors (safe, narrow list)
        const specificSelectors = [
          '.trans_controls',
          '.translate-tooltip-mtz',
          '.goog-te-banner-frame',
          '.skiptranslate',
          '#google_translate_element',
          '.header-wrapper',
          '.translated-text'
        ];

        specificSelectors.forEach((selector) => {
          try {
            document.querySelectorAll(selector).forEach((el) => {
              el.style.display = 'none';
            });
          } catch (e) {}
        });

        // Hide translate-related iframes
        document.querySelectorAll('iframe').forEach((iframe) => {
          try {
            const src = iframe.src || '';
            if (src.toLowerCase().includes('translate.google') || src.toLowerCase().includes('translator')) {
              iframe.style.display = 'none';
            }
          } catch (e) {}
        });
      } catch (e) {
        console.error('Error in translation removal:', e);
      }
    };

    // Capture original SVG data as early as possible
    captureOriginalSvgPaths();

    // Run actions a few times to defend against translator scripts that run after load
    const t1 = setTimeout(() => {
      captureOriginalSvgPaths();
      removeTranslationElements();
      restoreSvgPaths();
    }, 500);

    const t2 = setTimeout(() => {
      removeTranslationElements();
      restoreSvgPaths();
    }, 1500);

    const t3 = setTimeout(() => {
      removeTranslationElements();
      restoreSvgPaths();
    }, 3000);

    // Observe mutations on the body to quickly revert any SVG changes
    let observer;
    try {
      observer = new MutationObserver((mutations) => {
        let shouldRestore = false;
        for (const m of mutations) {
          if (m.type === 'attributes' && m.target && m.target.nodeName === 'path') {
            shouldRestore = true;
            break;
          }
          if (m.addedNodes && m.addedNodes.length) {
            shouldRestore = true;
            break;
          }
        }
        if (shouldRestore) restoreSvgPaths();
      });
      observer.observe(document.body, { attributes: true, childList: true, subtree: true });
    } catch (e) {}

    // Run once after a short delay to ensure the app has loaded
    const timeoutId = setTimeout(removeTranslationElements, 1000);

    // Clean up
    return () => {
      clearTimeout(timeoutId);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      if (observer) observer.disconnect();
    };
  }, []);

  // If not mounted yet, return null to avoid hydration issues
  if (!mounted) {
    return null;
  }

  // Only render the full layout on the client side
  return (
    <div 
      className="min-h-screen bg-background"
      suppressHydrationWarning
    >
      {shouldShowNavbar && <Navbar />}
      <main 
        className={`w-full transition-all duration-300 ease-in-out ${
          shouldShowNavbar 
            ? 'pt-[var(--navbar-height)]' // Use consistent padding for navbar height
            : 'pt-0'
        }`} 
        style={{ 
          minHeight: shouldShowNavbar ? 'calc(100vh - var(--navbar-height))' : '100vh',
          marginTop: 0 
        }}
      >
        <div className="animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
