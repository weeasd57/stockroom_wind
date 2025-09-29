// Global error handler for SVG and other client-side errors
export const setupGlobalErrorHandler = () => {
  if (typeof window === 'undefined') return; // Server-side guard

  // Handle SVG parsing errors and other uncaught errors
  window.addEventListener('error', (event) => {
    // Check if it's an SVG-related error
    if (event.message && event.message.includes('SVG') || 
        event.message.includes('path') || 
        event.message.includes('Expected number')) {
      console.warn('SVG parsing error caught and suppressed:', event.message);
      // Don't show this error to users, it's usually from browser extensions
      event.preventDefault();
      return false;
    }

    // Check if it's a Telegram protocol error
    if (event.message && (event.message.includes('tg://') || 
        event.message.includes('does not have a registered handler'))) {
      console.info('Telegram protocol handler not available (this is normal)');
      event.preventDefault();
      return false;
    }

    // Log other errors but don't suppress them
    console.error('Global error:', event);
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && typeof event.reason === 'string') {
      // Check for Telegram-related rejections
      if (event.reason.includes('tg://') || 
          event.reason.includes('registered handler')) {
        console.info('Telegram promise rejection suppressed:', event.reason);
        event.preventDefault();
        return;
      }
    }
    
    console.error('Unhandled promise rejection:', event);
  });

  console.log('Global error handler initialized');
};

// Suppress specific jQuery SVG errors if they occur
export const suppressSVGErrors = () => {
  if (typeof window === 'undefined') return;
  
  // Override console.error temporarily to catch jQuery SVG errors
  const originalConsoleError = console.error;
  console.error = function(...args) {
    const message = args.join(' ');
    
    // Skip SVG path errors from jQuery or other libraries
    if (message.includes('Expected number') && 
        (message.includes('path') || message.includes('SVG'))) {
      console.warn('SVG error suppressed:', message);
      return;
    }
    
    // Call original console.error for other messages
    originalConsoleError.apply(console, args);
  };
};
