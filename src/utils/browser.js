"use client";

/**
 * Safely checks if the code is running in a browser environment
 * @returns {boolean} True if running in a browser, false if running on the server
 */
export const isBrowser = () => {
  return typeof window !== 'undefined';
};

/**
 * Safely runs a function only in browser environments
 * @param {Function} fn - The function to run
 * @returns {any} The result of the function or undefined if running on server
 */
export const runOnlyInBrowser = (fn) => {
  if (isBrowser()) {
    return fn();
  }
  return undefined;
};

/**
 * Creates a safe browser-only wrapper for a value
 * @param {any} value - The value to use client-side
 * @param {any} fallback - The fallback value to use server-side
 * @returns {any} The appropriate value based on the environment
 */
export const browserOnlyValue = (value, fallback = null) => {
  return isBrowser() ? value : fallback;
};
