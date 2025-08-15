'use client';

import { useState, useEffect, useRef } from 'react';
import { detectTextDirection, applyTextDirection } from '@/utils/textDirection';
import styles from '@/styles/RTLTextArea.module.css';

export default function RTLTextArea({ 
  value, 
  onChange, 
  placeholder, 
  className = '', 
  id,
  rows = 3,
  maxLength,
  ...props 
}) {
  const textareaRef = useRef(null);
  const [textDirection, setTextDirection] = useState('ltr');

  // Update text direction when value changes
  useEffect(() => {
    if (value) {
      const direction = detectTextDirection(value);
      setTextDirection(direction);
      
      // Apply direction to textarea element
      if (textareaRef.current) {
        applyTextDirection(textareaRef.current, value);
      }
    } else {
      setTextDirection('ltr');
      if (textareaRef.current) {
        textareaRef.current.dir = 'ltr';
        textareaRef.current.style.textAlign = 'left';
      }
    }
  }, [value]);

  const handleChange = (e) => {
    const newValue = e.target.value;
    
    // Update text direction immediately
    const direction = detectTextDirection(newValue);
    setTextDirection(direction);
    
    // Apply direction to textarea
    if (textareaRef.current) {
      applyTextDirection(textareaRef.current, newValue);
    }
    
    // Call parent onChange
    if (onChange) {
      onChange(e);
    }
  };

  return (
    <div className={styles.rtlTextareaContainer}>
      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={`${styles.rtlTextarea} ${className}`}
        rows={rows}
        maxLength={maxLength}
        dir={textDirection}
        style={{
          direction: textDirection,
          textAlign: textDirection === 'rtl' ? 'right' : 'left',
          unicodeBidi: 'plaintext'
        }}
        {...props}
      />
      
      {/* Character counter if maxLength is provided */}
      {maxLength && (
        <div className={`${styles.charCounter} ${value?.length > maxLength * 0.8 ? styles.warning : ''} ${value?.length > maxLength * 0.95 ? styles.danger : ''}`}>
          {value?.length || 0} / {maxLength}
        </div>
      )}
      
      {/* Direction indicator */}
      {value && (
        <div className={styles.directionIndicator}>
          <span className={`${styles.directionBadge} ${styles[textDirection]}`}>
            {textDirection === 'rtl' ? 'العربية' : 'EN'}
          </span>
        </div>
      )}
    </div>
  );
}