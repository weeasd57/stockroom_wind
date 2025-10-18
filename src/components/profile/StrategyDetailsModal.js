'use client';

import { useState, useEffect } from 'react';
import styles from '@/styles/StrategyDetailsModal.module.css';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';

export default function StrategyDetailsModal({ strategy, isOpen, onClose, onSave }) {
  const { supabase, user } = useSupabase();
  const [description, setDescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [storageMethod, setStorageMethod] = useState('loading'); // 'supabase', 'localStorage', or 'loading'

  // Load strategy documentation when the modal opens
  useEffect(() => {
    if (isOpen && strategy && user) {
      loadStrategyDocumentation();
    }
  }, [isOpen, strategy, user]);

  // Load strategy documentation from Supabase only
  const loadStrategyDocumentation = async () => {
    try {
      if (!strategy || !user || !supabase) {
        setDescription('');
        setIsEditing(true);
        return;
      }
      
      // Try to get data from Supabase
      try {
        // Check if the table exists first
        const { data: tableCheck, error: tableError } = await supabase
          .from('user_strategies')
          .select('id')
          .limit(1);
          
        // If table doesn't exist, start in edit mode
        if (tableError && tableError.code === '42P01') { // Table doesn't exist error code
          setDescription('');
          setIsEditing(true);
          setStorageMethod('supabase');
          return;
        }
        
        // Try to find by strategy_name field (as seen in the database schema)
        const { data, error } = await supabase
          .from('user_strategies')
          .select('*')
          .eq('user_id', user.id)
          .eq('strategy_name', strategy)
          .maybeSingle();
        
        // If we found data, use it
        if (!error && data) {
          setDescription(data.description || '');
          setIsEditing(false); // Show view mode if we have documentation
          setStorageMethod('supabase');
        } else {
          // No data found, start in edit mode
          setDescription('');
          setIsEditing(true);
          setStorageMethod('supabase');
        }
      } catch (dbError) {
        console.error('Error fetching from Supabase:', dbError);
        setDescription('');
        setIsEditing(true);
        setStorageMethod('supabase');
        setError('Could not load strategy details from database');
      }
    } catch (err) {
      console.error('Error in loadStrategyDocumentation:', err);
      setDescription('');
      setIsEditing(true);
      setStorageMethod('supabase');
      setError('An unexpected error occurred');
    }
  };

  // Save strategy documentation to Supabase only
  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);

      if (!strategy || !user || !supabase) {
        throw new Error('Missing required data');
      }

      // Use upsert with unique (user_id, strategy_name)
      const { error: upsertError } = await supabase
        .from('user_strategies')
        .upsert({
          user_id: user.id,
          strategy_name: strategy,
          description,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,strategy_name' });

      if (upsertError) {
        throw new Error(`Failed to save strategy: ${upsertError.message}`);
      }

      if (onSave) onSave(strategy, description);
      setIsEditing(false);
    } catch (err) {
      console.error('Error saving strategy documentation:', err);
      setError(err.message || 'Failed to save documentation');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{strategy}</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        {error && (
          <div className={styles.errorMessage}>
            {error}
            <button onClick={() => setError(null)} className={styles.dismissError}>×</button>
          </div>
        )}

        <div className={styles.modalBody}>
          {isEditing ? (
            <>
              <label htmlFor="strategyDescription" className={styles.label}>
                Strategy Documentation
              </label>
              <textarea
                id="strategyDescription"
                className={styles.textarea}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter documentation for this trading strategy..."
                rows={8}
                disabled={isSaving}
              />
            </>
          ) : (
            <div className={styles.documentationDisplay}>
              <h3 className={styles.documentationTitle}>Documentation</h3>
              {description ? (
                <div className={styles.documentationText}>{description}</div>
              ) : (
                <div className={styles.emptyDocumentation}>
                  No documentation available for this strategy.
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          {isEditing ? (
            <>
              <button 
                className={styles.cancelButton} 
                onClick={() => {
                  setIsEditing(false);
                  loadStrategyDocumentation(); // Reload the original documentation
                }}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button 
                className={styles.saveButton} 
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Documentation'}
              </button>
            </>
          ) : (
            <button 
              className={styles.editButton} 
              onClick={() => setIsEditing(true)}
            >
              Edit Documentation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
