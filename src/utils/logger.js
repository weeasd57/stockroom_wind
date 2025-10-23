/**
 * Development Logger Utility
 * Controls console logging based on environment and log levels
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1, 
  INFO: 2,
  DEBUG: 3,
  VERBOSE: 4
};

const LOG_COLORS = {
  ERROR: '#dc2626',
  WARN: '#f59e0b', 
  INFO: '#3b82f6',
  DEBUG: '#10b981',
  VERBOSE: '#6b7280'
};

class Logger {
  constructor() {
    // Set log level based on environment
    this.level = process.env.NODE_ENV === 'production' 
      ? LOG_LEVELS.WARN 
      : LOG_LEVELS.DEBUG;
    
    // Categories that can be toggled on/off
    this.enabledCategories = new Set([
      'DRAWER',
      'API', 
      'AUTH',
      'PERFORMANCE',
      'ERROR'
    ]);
    
    // Categories that are noisy and should be limited
    this.limitedCategories = new Set([
      'SERVICE_WORKER',
      'SUPABASE_REQUESTS', 
      'PROVIDERS',
      'TRADES'
    ]);
    
    // Categories that should be completely disabled in development
    this.disabledCategories = new Set([
      'SERVICE_WORKER' // Disable service worker logs by default
    ]);
    
    // Throttling for noisy logs
    this.throttledLogs = new Map();
    this.throttleDuration = 5000; // 5 seconds
  }
  
  shouldLog(level, category) {
    // Check log level
    if (LOG_LEVELS[level] > this.level) return false;
    
    // Check if category is completely disabled
    if (category && this.disabledCategories.has(category)) return false;
    
    // Check if category is enabled
    if (category && !this.enabledCategories.has(category)) return false;
    
    // Handle throttling for limited categories
    if (category && this.limitedCategories.has(category)) {
      const now = Date.now();
      const lastLog = this.throttledLogs.get(category);
      
      if (lastLog && (now - lastLog) < this.throttleDuration) {
        return false; // Throttled
      }
      
      this.throttledLogs.set(category, now);
    }
    
    return true;
  }
  
  formatMessage(level, category, message, data) {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = category ? `[${category}]` : '';
    const icon = this.getIcon(level);
    
    return {
      prefix: `${icon} ${timestamp} ${prefix}`,
      message,
      data
    };
  }
  
  getIcon(level) {
    switch (level) {
      case 'ERROR': return '❌';
      case 'WARN': return '⚠️';
      case 'INFO': return 'ℹ️';
      case 'DEBUG': return '🔧';
      case 'VERBOSE': return '📝';
      default: return '•';
    }
  }
  
  error(message, data, category = 'ERROR') {
    if (!this.shouldLog('ERROR', category)) return;
    
    const formatted = this.formatMessage('ERROR', category, message, data);
    console.error(formatted.prefix, formatted.message, formatted.data || '');
  }
  
  warn(message, data, category = 'WARN') {
    if (!this.shouldLog('WARN', category)) return;
    
    const formatted = this.formatMessage('WARN', category, message, data);
    console.warn(formatted.prefix, formatted.message, formatted.data || '');
  }
  
  info(message, data, category = 'INFO') {
    if (!this.shouldLog('INFO', category)) return;
    
    const formatted = this.formatMessage('INFO', category, message, data);
    console.info(formatted.prefix, formatted.message, formatted.data || '');
  }
  
  debug(message, data, category = 'DEBUG') {
    if (!this.shouldLog('DEBUG', category)) return;
    
    const formatted = this.formatMessage('DEBUG', category, message, data);
    console.log(formatted.prefix, formatted.message, formatted.data || '');
  }
  
  verbose(message, data, category = 'VERBOSE') {
    if (!this.shouldLog('VERBOSE', category)) return;
    
    const formatted = this.formatMessage('VERBOSE', category, message, data);
    console.log(formatted.prefix, formatted.message, formatted.data || '');
  }
  
  // Performance logging
  time(label, category = 'PERFORMANCE') {
    if (!this.shouldLog('DEBUG', category)) return;
    console.time(`⏱️ [${category}] ${label}`);
  }
  
  timeEnd(label, category = 'PERFORMANCE') {
    if (!this.shouldLog('DEBUG', category)) return;
    console.timeEnd(`⏱️ [${category}] ${label}`);
  }
  
  // Group logging for complex operations
  group(label, category = 'DEBUG') {
    if (!this.shouldLog('DEBUG', category)) return;
    console.group(`🔗 [${category}] ${label}`);
  }
  
  groupEnd() {
    console.groupEnd();
  }
  
  // Enable/disable categories dynamically
  enableCategory(category) {
    this.enabledCategories.add(category);
    this.info(`Category '${category}' enabled`, null, 'LOGGER');
  }
  
  disableCategory(category) {
    this.enabledCategories.delete(category);
    this.info(`Category '${category}' disabled`, null, 'LOGGER');
  }
  
  // Configuration helpers
  setLevel(level) {
    this.level = LOG_LEVELS[level] || this.level;
    this.info(`Log level set to: ${level}`, null, 'LOGGER');
  }
  
  getConfig() {
    return {
      level: Object.keys(LOG_LEVELS)[this.level],
      enabledCategories: Array.from(this.enabledCategories),
      limitedCategories: Array.from(this.limitedCategories)
    };
  }
}

// Create singleton instance
const logger = new Logger();

// Expose logger globally for debugging
if (typeof window !== 'undefined') {
  window.devLogger = {
    ...logger,
    config: () => logger.getConfig(),
    enable: (category) => logger.enableCategory(category),
    disable: (category) => logger.disableCategory(category),
    setLevel: (level) => logger.setLevel(level),
    help: () => {
      console.log('🔧 Development Logger Commands:');
      console.log('');
      console.log('Configuration:');
      console.log('  devLogger.config() - Show current configuration');
      console.log('  devLogger.setLevel("ERROR"|"WARN"|"INFO"|"DEBUG"|"VERBOSE")');
      console.log('  devLogger.enable("CATEGORY") - Enable a category');
      console.log('  devLogger.disable("CATEGORY") - Disable a category');
      console.log('');
      console.log('Available Categories:');
      console.log('  DRAWER, API, AUTH, PERFORMANCE, ERROR');
      console.log('  SERVICE_WORKER, SUPABASE_REQUESTS, PROVIDERS, TRADES');
    }
  };
  
  // Auto-show help in development
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Development Logger available! Type: devLogger.help()');
  }
}

export default logger;
