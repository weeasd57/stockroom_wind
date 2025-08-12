import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// دمج فئات CSS / Merge CSS classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// تنسيق التاريخ / Date formatting
export function formatDate(date: string | Date, locale = 'ar'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) {
    return 'تاريخ غير صالح';
  }

  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };

  return new Intl.DateTimeFormat(locale, options).format(d);
}

// تنسيق التاريخ النسبي / Relative date formatting
export function formatRelativeDate(date: string | Date, locale = 'ar'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return locale === 'ar' ? 'الآن' : 'now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return locale === 'ar' ? `منذ ${diffInMinutes} دقيقة` : `${diffInMinutes} minutes ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return locale === 'ar' ? `منذ ${diffInHours} ساعة` : `${diffInHours} hours ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return locale === 'ar' ? `منذ ${diffInDays} يوم` : `${diffInDays} days ago`;
  }

  return formatDate(d, locale);
}

// تنسيق الأرقام / Number formatting
export function formatNumber(num: number, locale = 'ar'): string {
  return new Intl.NumberFormat(locale).format(num);
}

// تنسيق العملة / Currency formatting
export function formatCurrency(
  amount: number, 
  currency = 'USD', 
  locale = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// تنسيق النسبة المئوية / Percentage formatting
export function formatPercentage(
  value: number, 
  decimals = 2,
  locale = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
}

// اختصار النص / Truncate text
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

// تنظيف النص / Clean text
export function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\n+/g, '\n') // Replace multiple newlines with single newline
    .trim();
}

// التحقق من صحة البريد الإلكتروني / Email validation
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// التحقق من صحة كلمة المرور / Password validation
export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// توليد معرف عشوائي / Generate random ID
export function generateId(length = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

// حفظ في التخزين المحلي / Save to localStorage
export function saveToLocalStorage(key: string, value: any): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }
}

// استرجاع من التخزين المحلي / Get from localStorage
export function getFromLocalStorage<T>(key: string, defaultValue: T): T {
  if (typeof window !== 'undefined') {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return defaultValue;
    }
  }
  return defaultValue;
}

// حذف من التخزين المحلي / Remove from localStorage
export function removeFromLocalStorage(key: string): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from localStorage:', error);
    }
  }
}

// تنزيل ملف / Download file
export function downloadFile(content: string, filename: string, type = 'text/plain'): void {
  if (typeof window !== 'undefined') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

// نسخ النص إلى الحافظة / Copy text to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      return false;
    }
  }
  return false;
}

// تأخير / Delay
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// تحويل الخطأ إلى رسالة مقروءة / Convert error to readable message
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  
  return 'An unknown error occurred';
}

// تحسين أداء الوظائف / Function debouncing
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// تحسين أداء الوظائف / Function throttling
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// فحص نوع الجهاز / Device type detection
export function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  
  const width = window.innerWidth;
  
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

// فحص دعم المتصفح لميزة معينة / Check browser feature support
export function isFeatureSupported(feature: string): boolean {
  if (typeof window === 'undefined') return false;
  
  switch (feature) {
    case 'webp':
      const canvas = document.createElement('canvas');
      return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    
    case 'clipboard':
      return !!navigator.clipboard;
    
    case 'notifications':
      return 'Notification' in window;
    
    case 'geolocation':
      return 'geolocation' in navigator;
    
    case 'localStorage':
      try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        return true;
      } catch {
        return false;
      }
    
    default:
      return false;
  }
}

// ضغط الصور / Image compression
export function compressImage(
  file: File,
  maxWidth = 1920,
  maxHeight = 1080,
  quality = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // حساب الأبعاد الجديدة
      let { width, height } = img;
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      canvas.width = width;
      canvas.height = height;

      // رسم الصورة المضغوطة
      ctx?.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

// تحويل الملف إلى Base64 / Convert file to Base64
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}