'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from '@/styles/StrategyDetailsModal.module.css';
import '@/styles/StrategyDetailsGlobal.css';
import { useSupabase } from '@/providers/SimpleSupabaseProvider';

export default function StrategyDetailsModal({ strategy, isOpen, onClose, onSave, userId, readOnly = false, children, fullScreen = false }) {
  const { supabase, user: currentUser } = useSupabase();
  const [description, setDescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [storageMethod, setStorageMethod] = useState('loading'); // 'supabase', 'localStorage', or 'loading'
  const [mounted, setMounted] = useState(false);
  const targetUserId = userId || currentUser?.id;
  // Strategy image editing state
  const [imageUrl, setImageUrl] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load strategy documentation when the modal opens
  useEffect(() => {
    if (isOpen && strategy && targetUserId) {
      loadStrategyDocumentation();
    } else if (isOpen && readOnly) {
      // In read-only mode with no user ID, just show empty, non-editable view
      setDescription('');
      setIsEditing(false);
    }
  }, [isOpen, strategy, targetUserId, readOnly]);
  // Load strategy documentation from Supabase only
  const loadStrategyDocumentation = async () => {
    try {
      if (!strategy || !supabase || !targetUserId) {
        setDescription('');
        setIsEditing(false);
        return;
      }

      // Check table exists (ignore result, just catch 42P01)
      const { error: tableError } = await supabase
        .from('user_strategies')
        .select('id')
        .limit(1);
      if (tableError && tableError.code === '42P01') {
        setDescription('');
        setImageUrl(null);
        setIsEditing(false);
        setStorageMethod('supabase');
        return;
      }

      // Fetch strategy row
      const { data, error } = await supabase
        .from('user_strategies')
        .select('*')
        .eq('user_id', targetUserId)
        .eq('strategy_name', strategy)
        .maybeSingle();

      if (!error && data) {
        setDescription(data.description || '');
        setImageUrl(data.image_url || null);
        setIsEditing(false);
        setStorageMethod('supabase');
      } else {
        setDescription('');
        setImageUrl(null);
        setIsEditing(false);
        setStorageMethod('supabase');
      }
    } catch (err) {
      console.error('Error in loadStrategyDocumentation:', err);
      setDescription('');
      setIsEditing(false);
      setStorageMethod('supabase');
      setError('Could not load strategy details from database');
    }
  };

  // Image selection
  const handleSelectImage = (e) => {
    try {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        setUploadError('Please select a valid image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB
        setUploadError('Image must be less than 5MB');
        return;
      }
      setUploadError(null);
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target.result);
      reader.readAsDataURL(file);
    } catch (e) {
      setUploadError('Failed to read image');
    }
  };

  // Upload selected image to storage and upsert image_url
  const handleUploadImage = async () => {
    if (readOnly) return;
    if (!imageFile || !supabase || !targetUserId || !strategy) return;
    setIsUploadingImage(true);
    setUploadError(null);
    try {
      const ext = (imageFile.name.split('.').pop() || 'png').toLowerCase();
      const safeStrategy = String(strategy).trim().replace(/\s+/g, '_');
      const path = `${targetUserId}/strategy_${safeStrategy}.${ext}`;

      // Best-effort: remove any previous files for this strategy (different extensions or old timestamps)
      try {
        const { data: existingFiles } = await supabase.storage
          .from('strategy-images')
          .list(targetUserId);
        const toDelete = (existingFiles || [])
          .filter(f => f.name && (f.name.startsWith(`strategy_${safeStrategy}`)))
          .map(f => `${targetUserId}/${f.name}`);
        if (toDelete.length > 0) {
          try { await supabase.storage.from('strategy-images').remove(toDelete); } catch {}
        }
      } catch {}

      const { error: uploadErr } = await supabase.storage
        .from('strategy-images')
        .upload(path, imageFile, { cacheControl: '3600', upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from('strategy-images')
        .getPublicUrl(path);
      const publicUrl = urlData?.publicUrl || null;

      const { error: upsertError } = await supabase
        .from('user_strategies')
        .upsert({
          user_id: targetUserId,
          strategy_name: strategy,
          image_url: publicUrl,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,strategy_name' });
      if (upsertError) throw upsertError;

      setImageUrl(publicUrl);
      setImageFile(null);
      setImagePreview('');
      // Notify parent with new image URL so it can update view immediately
      if (onSave) onSave(strategy, description, { imageUrl: publicUrl, action: 'image-update' });
    } catch (e) {
      setUploadError(e?.message || 'Failed to upload');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Remove current strategy image
  const handleRemoveImage = async () => {
    if (readOnly) return;
    if (!supabase || !targetUserId || !strategy) return;
    setIsUploadingImage(true);
    setUploadError(null);
    try {
      // Best-effort: delete from storage if we can derive path
      if (imageUrl) {
        try {
          const urlObj = new URL(imageUrl);
          const segments = urlObj.pathname.split('/');
          // Expected pattern: /storage/v1/object/public/{bucket}/{...objectPath}
          const bucketName = segments[5] || 'strategy-images';
          const objectPath = segments.slice(6).join('/');
          if (objectPath) {
            await supabase.storage.from(bucketName).remove([objectPath]);
          }
        } catch {}
      }
      const { error: upsertError } = await supabase
        .from('user_strategies')
        .upsert({
          user_id: targetUserId,
          strategy_name: strategy,
          image_url: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,strategy_name' });
      if (upsertError) throw upsertError;
      setImageUrl(null);
      setImageFile(null);
      setImagePreview('');
      // Notify parent about removal
      if (onSave) onSave(strategy, description, { imageUrl: null, action: 'image-remove' });
    } catch (e) {
      setUploadError(e?.message || 'Failed to remove image');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Save documentation and upload image if a new file is selected
  const handleSave = async () => {
    try {
      if (readOnly) return;
      setIsSaving(true);
      setError(null);
      if (!strategy || !supabase || !targetUserId) throw new Error('Missing required data');

      // If user selected a new image but didn't click "Save Image", upload it now
      let latestImageUrl = imageUrl;
      if (imageFile) {
        const ext = (imageFile.name.split('.').pop() || 'png').toLowerCase();
        const safeStrategy = String(strategy).trim().replace(/\s+/g, '_');
        const path = `${targetUserId}/strategy_${safeStrategy}.${ext}`;

        // Remove old files for this strategy to keep a single object
        try {
          const { data: existingFiles } = await supabase.storage
            .from('strategy-images')
            .list(targetUserId);
          const toDelete = (existingFiles || [])
            .filter(f => f.name && (f.name.startsWith(`strategy_${safeStrategy}`)))
            .map(f => `${targetUserId}/${f.name}`);
          if (toDelete.length > 0) {
            try { await supabase.storage.from('strategy-images').remove(toDelete); } catch {}
          }
        } catch {}

        const { error: uploadErr } = await supabase.storage
          .from('strategy-images')
          .upload(path, imageFile, { cacheControl: '3600', upsert: true });
        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage
          .from('strategy-images')
          .getPublicUrl(path);
        latestImageUrl = urlData?.publicUrl || null;
      }

      const { error: upsertError } = await supabase
        .from('user_strategies')
        .upsert({
          user_id: targetUserId,
          strategy_name: strategy,
          description,
          image_url: latestImageUrl ?? null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,strategy_name' });
      if (upsertError) throw upsertError;

      // Clear pending image state after successful save
      setImageFile(null);
      setImagePreview('');

      if (onSave) onSave(strategy, description, { imageUrl: latestImageUrl });
      setIsEditing(false);
    } catch (err) {
      setError(err.message || 'Failed to save documentation');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div className={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true" aria-label={`${strategy} details`}>
      <div className={`${styles.modalContent} ${fullScreen ? styles.fullScreen : ''}`} onClick={(e) => e.stopPropagation()}>
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
          {/* View-only image preview at top. Hide if children provided to avoid duplication. */}
          {!isEditing && imageUrl && !children && (
            <div style={{ marginBottom: '16px' }}>
              <label className={styles.label}>Strategy Image</label>
              <div style={{ marginBottom: 8 }}>
                <img
                  src={imageUrl}
                  alt={`${strategy} image`}
                  style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12 }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
            </div>
          )}

          {isEditing ? (
            <>
              <label htmlFor="strategyDescription" className={styles.label}>Strategy Documentation</label>
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
                <div className={styles.emptyDocumentation}>No documentation available for this strategy.</div>
              )}
            </div>
          )}
        </div>

        {children && (
          <div className={styles.modalExtraSection}>{children}</div>
        )}

        {/* Editing section moved to the bottom to avoid clutter at the top */}
        {isEditing && !readOnly && (
          <div className={styles.modalExtraSection}>
            <label className={styles.label}>Strategy Image</label>
            {imagePreview ? (
              <div style={{ marginBottom: 8 }}>
                <img src={imagePreview} alt="Preview" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12 }} />
              </div>
            ) : imageUrl ? (
              <div style={{ marginBottom: 8 }}>
                <img
                  src={imageUrl}
                  alt={`${strategy} image`}
                  style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12 }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
            ) : (
              <div style={{ marginBottom: 8, padding: '12px', border: '1px dashed hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--muted-foreground))' }}>
                No image uploaded.
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input id="strategy-image-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleSelectImage} />
              <button type="button" className={styles.editButton} onClick={() => document.getElementById('strategy-image-input').click()} disabled={isUploadingImage}>
                {imageUrl || imagePreview ? 'Change Image' : 'Upload Image'}
              </button>
              {imagePreview && (
                <button type="button" className={styles.saveButton} onClick={handleUploadImage} disabled={isUploadingImage}>
                  {isUploadingImage ? 'Uploading...' : 'Save Image'}
                </button>
              )}
              {imageUrl && (
                <button type="button" className={styles.cancelButton} onClick={handleRemoveImage} disabled={isUploadingImage}>
                  Remove Image
                </button>
              )}
              {uploadError && (
                <span style={{ color: '#ef4444', fontSize: 12 }}>{uploadError}</span>
              )}
            </div>
          </div>
        )}

        {!readOnly && (
          <div className={styles.modalFooter}>
            {isEditing ? (
              <>
                <button
                  className={styles.cancelButton}
                  onClick={() => {
                    setIsEditing(false);
                    loadStrategyDocumentation();
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button className={styles.saveButton} onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Documentation'}
                </button>
              </>
            ) : (
              <button className={styles.editButton} onClick={() => setIsEditing(true)}>
                Edit
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
