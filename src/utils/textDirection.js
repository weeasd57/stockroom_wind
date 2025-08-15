/**
 * Utility functions for detecting and handling text direction (RTL/LTR)
 * Supports Arabic, Hebrew, and other RTL languages
 */

// RTL language codes and patterns
const RTL_LANGUAGES = [
  'ar', 'he', 'fa', 'ur', 'yi', 'ji', 'iw', 'ku', 'ps', 'sd'
];

// RTL Unicode ranges
const RTL_UNICODE_RANGES = [
  [0x0590, 0x05FF], // Hebrew
  [0x0600, 0x06FF], // Arabic
  [0x0700, 0x074F], // Syriac
  [0x0750, 0x077F], // Arabic Supplement
  [0x0780, 0x07BF], // Thaana
  [0x07C0, 0x07FF], // NKo
  [0x0800, 0x083F], // Samaritan
  [0x0840, 0x085F], // Mandaic
  [0x08A0, 0x08FF], // Arabic Extended-A
  [0xFB1D, 0xFB4F], // Hebrew Presentation Forms
  [0xFB50, 0xFDFF], // Arabic Presentation Forms-A
  [0xFE70, 0xFEFF], // Arabic Presentation Forms-B
];

/**
 * Check if a character is RTL
 * @param {string} char - Single character to check
 * @returns {boolean} - True if character is RTL
 */
export function isRTLChar(char) {
  if (!char || char.length !== 1) return false;
  
  const charCode = char.charCodeAt(0);
  
  return RTL_UNICODE_RANGES.some(([start, end]) => 
    charCode >= start && charCode <= end
  );
}

/**
 * Check if text contains RTL characters
 * @param {string} text - Text to analyze
 * @returns {boolean} - True if text contains RTL characters
 */
export function hasRTLChars(text) {
  if (!text || typeof text !== 'string') return false;
  
  return Array.from(text).some(char => isRTLChar(char));
}

/**
 * Detect the primary direction of text
 * @param {string} text - Text to analyze
 * @returns {'rtl'|'ltr'} - Primary text direction
 */
export function detectTextDirection(text) {
  if (!text || typeof text !== 'string') return 'ltr';
  
  // Remove whitespace and punctuation for better detection
  const cleanText = text.replace(/[\s\p{P}]/gu, '');
  
  if (cleanText.length === 0) return 'ltr';
  
  let rtlCount = 0;
  let ltrCount = 0;
  
  for (const char of cleanText) {
    if (isRTLChar(char)) {
      rtlCount++;
    } else if (/[\p{L}]/u.test(char)) { // Letter character
      ltrCount++;
    }
  }
  
  // If more than 30% of characters are RTL, consider it RTL text
  const rtlRatio = rtlCount / (rtlCount + ltrCount);
  return rtlRatio > 0.3 ? 'rtl' : 'ltr';
}

/**
 * Get text direction based on first strong directional character
 * @param {string} text - Text to analyze
 * @returns {'rtl'|'ltr'} - Text direction based on first strong character
 */
export function getFirstStrongDirection(text) {
  if (!text || typeof text !== 'string') return 'ltr';
  
  for (const char of text) {
    if (isRTLChar(char)) {
      return 'rtl';
    } else if (/[\p{L}]/u.test(char)) {
      return 'ltr';
    }
  }
  
  return 'ltr';
}

/**
 * Apply text direction to an element
 * @param {HTMLElement} element - Element to apply direction to
 * @param {string} text - Text to analyze for direction
 */
export function applyTextDirection(element, text) {
  if (!element || !text) return;
  
  const direction = detectTextDirection(text);
  element.dir = direction;
  element.style.textAlign = direction === 'rtl' ? 'right' : 'left';
}

/**
 * React hook for text direction detection
 * @param {string} text - Text to analyze
 * @returns {object} - Object with direction and helper functions
 */
export function useTextDirection(text) {
  const direction = detectTextDirection(text);
  const isRTL = direction === 'rtl';
  const isLTR = direction === 'ltr';
  
  return {
    direction,
    isRTL,
    isLTR,
    textAlign: isRTL ? 'right' : 'left',
    className: isRTL ? 'rtl' : 'ltr'
  };
}

/**
 * Get CSS properties for text direction
 * @param {string} text - Text to analyze
 * @returns {object} - CSS properties object
 */
export function getDirectionStyles(text) {
  const direction = detectTextDirection(text);
  const isRTL = direction === 'rtl';
  
  return {
    direction,
    textAlign: isRTL ? 'right' : 'left',
    unicodeBidi: 'plaintext' // Let browser handle mixed content
  };
}

/**
 * Format text with proper direction markers
 * @param {string} text - Text to format
 * @returns {string} - Text with direction markers
 */
export function formatTextWithDirection(text) {
  if (!text || typeof text !== 'string') return text;
  
  const direction = detectTextDirection(text);
  
  if (direction === 'rtl') {
    // Add RLM (Right-to-Left Mark) for RTL text
    return '\u200F' + text + '\u200F';
  } else {
    // Add LRM (Left-to-Right Mark) for LTR text
    return '\u200E' + text + '\u200E';
  }
}

/**
 * Check if browser supports RTL
 * @returns {boolean} - True if browser supports RTL
 */
export function supportsRTL() {
  if (typeof document === 'undefined') return false;
  
  const testElement = document.createElement('div');
  testElement.dir = 'rtl';
  testElement.style.direction = 'rtl';
  
  return testElement.dir === 'rtl';
}

/**
 * Get appropriate placeholder text based on direction
 * @param {string} ltrPlaceholder - LTR placeholder text
 * @param {string} rtlPlaceholder - RTL placeholder text
 * @param {string} currentText - Current text to analyze
 * @returns {string} - Appropriate placeholder
 */
export function getDirectionalPlaceholder(ltrPlaceholder, rtlPlaceholder, currentText = '') {
  const direction = detectTextDirection(currentText);
  return direction === 'rtl' ? rtlPlaceholder : ltrPlaceholder;
}