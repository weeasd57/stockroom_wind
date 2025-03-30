import dynamic from 'next/dynamic';

/**
 * A utility function to dynamically import components with SSR disabled
 * This ensures components are only loaded on the client side
 * This helps prevent "window is not defined" errors during server-side rendering or static generation
 * 
 * @param {Function} importFunc - Import function that returns the component
 * @param {Object} options - Additional options for dynamic import
 * @returns {Component} Dynamically imported component with SSR disabled
 */
export function dynamicImport(importFunc, options = {}) {
  return dynamic(importFunc, {
    ssr: false, // Completely disable server-side rendering for this component
    loading: () => options.loading || null,
    ...options
  });
}

/**
 * Higher-order function that wraps a component to ensure it only renders on the client side
 * This is useful for components that use browser-specific APIs like window, document, localStorage, etc.
 * 
 * @param {Component} Component - React component to be wrapped
 * @param {Object} options - Options for dynamic import
 * @returns {Component} Wrapped component that only renders on client side
 */
export function withClientSideOnly(Component, options = {}) {
  return dynamic(() => Promise.resolve(Component), {
    ssr: false,
    loading: () => options.loading || null,
    ...options
  });
}

/**
 * A specific dynamic import for components that require Supabase browser client
 * This ensures auth-related components only load on the client side
 */
export const ClientOnlyAuth = (importFunc, options = {}) => {
  return dynamic(importFunc, {
    ssr: false,
    loading: () => options.loading || <div>Loading authentication...</div>,
    ...options
  });
};

/**
 * A specific dynamic import for components that require window/browser APIs
 * This ensures browser-dependent components only load on the client side
 */
export const ClientOnlyBrowser = (importFunc, options = {}) => {
  return dynamic(importFunc, {
    ssr: false,
    loading: () => options.loading || <div>Loading content...</div>,
    ...options
  });
};
