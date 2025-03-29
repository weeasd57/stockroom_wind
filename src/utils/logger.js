// Logger utility to control console output
const isDevelopment = process.env.NODE_ENV === 'development';

// Force all non-error logs to be disabled in production
const FORCE_LOGGING = false;

// Configure which log levels to show or hide
const CONFIG = {
  error: true,     // Always show errors in any environment
  warn: false,     // Only show warnings in development
  info: false,     // Only show info in development
  log: false,      // Only show logs in development
  debug: false,    // Only show debug in development
};

// Enable all logs in development environment only
if (isDevelopment) {
  CONFIG.warn = true;
  CONFIG.info = true;
  CONFIG.log = true;
  CONFIG.debug = true;
}

// Override console methods in production to ensure they never appear
if (!isDevelopment) {
  // Store original methods so they can be restored if needed
  const originalConsole = {
    log: console.log,
    info: console.info,
    debug: console.debug,
    warn: console.warn
  };
  
  // Replace with empty functions in production
  console.log = function() {};
  console.info = function() {};
  console.debug = function() {};
  
  // Keep console.warn for important warnings
  // console.warn will only appear in console if explicitly used,
  // our logger.warn will still be controlled by CONFIG
  
  // Add a way to restore console functionality if needed
  window._restoreConsole = function() {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.debug = originalConsole.debug;
    console.warn = originalConsole.warn;
    return "Console functions restored";
  };
}

// Create logger with controlled output
const logger = {
  error: (...args) => CONFIG.error && console.error(...args),
  warn: (...args) => CONFIG.warn && console.warn(...args),
  info: (...args) => CONFIG.info && console.info(...args),
  log: (...args) => CONFIG.log && console.log(...args),
  debug: (...args) => CONFIG.debug && console.debug(...args),
};

export default logger; 