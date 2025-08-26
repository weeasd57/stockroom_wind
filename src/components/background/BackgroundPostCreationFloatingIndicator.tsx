'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useBackgroundPostCreation } from '@/providers/BackgroundPostCreationProvider';
import { useCreatePostForm } from '@/providers/CreatePostFormProvider';
import { toast } from 'sonner';
import { X } from 'lucide-react';

export default function BackgroundPostCreationFloatingIndicator() {
  const { tasks, cancelTask, clearAllCompleted, clearTask } = useBackgroundPostCreation();
  const [collapsed, setCollapsed] = useState(false);
  const { setSubmitState, resetForm, openDialog, closeDialog, setGlobalStatus, setIsSubmitting } = useCreatePostForm();
  const processedRef = useRef<Set<string>>(new Set());

  const visibleTasks = tasks.slice(0, 5); // show latest 5
  const hasItems = tasks.length > 0;

  const overallProgress = useMemo(() => {
    if (tasks.length === 0) return 0;
    const sum = tasks.reduce((acc, t) => acc + (t.progress ?? 0), 0);
    return Math.round(sum / tasks.length);
  }, [tasks]);

  // React to terminal task statuses globally so behavior works even if the form dialog is closed
  useEffect(() => {
    for (const t of tasks) {
      if (!processedRef.current.has(t.id) && (t.status === 'success' || t.status === 'error' || t.status === 'canceled')) {
        processedRef.current.add(t.id);
        if (t.status === 'success') {
          try { setSubmitState('success'); } catch {}
          try { setIsSubmitting(false); } catch {}
          try { resetForm(); } catch {}
          try { closeDialog(); } catch {}
          toast.success(t.message || 'Post created successfully');
        } else if (t.status === 'error') {
          try { setSubmitState('error'); } catch {}
          try { setIsSubmitting(false); } catch {}
          try { setGlobalStatus({ type: 'error', message: t.error || t.message || 'Failed to create post. Please review and try again.' }); } catch {}
          try { openDialog(); } catch {}
          toast.error(t.error || t.message || 'Failed to create post');
        } else if (t.status === 'canceled') {
          try { setSubmitState('idle'); } catch {}
          try { setIsSubmitting(false); } catch {}
          try { openDialog(); } catch {}
          toast.info(t.message || 'Posting cancelled');
        }
      }
    }
  }, [tasks, setSubmitState, setIsSubmitting, resetForm, closeDialog, setGlobalStatus, openDialog]);

  if (!hasItems) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] space-y-2 w-[92vw] max-w-sm sm:max-w-md">
      <div className="flex items-center justify-between px-3 py-2 rounded-md bg-white/90 dark:bg-neutral-900/90 backdrop-blur shadow-lg border border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <button
            className="text-xs px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700"
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? 'Expand' : 'Collapse'}
          </button>
          <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
            Background posts ({tasks.length})
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="text-xs px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700"
            onClick={clearAllCompleted}
            title="Clear completed"
          >
            Clear done
          </button>
        </div>
      </div>

      {collapsed ? (
        <div className="p-3 rounded-md bg-white/90 dark:bg-neutral-900/90 backdrop-blur shadow-lg border border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <div className="text-xs text-neutral-700 dark:text-neutral-300">
              In progress: {tasks.filter(t => t.status !== 'success' && t.status !== 'canceled' && t.status !== 'error').length}
            </div>
            <div className="w-28 h-2 rounded bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
              <div className="h-2 bg-blue-500" style={{ width: `${overallProgress}%`, transition: 'width 200ms ease' }} />
            </div>
          </div>
        </div>
      ) : (
        <>
          {visibleTasks.map((t) => (
            <div key={t.id} className="p-3 rounded-md bg-white/90 dark:bg-neutral-900/90 backdrop-blur shadow-lg border border-neutral-200 dark:border-neutral-800">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                      {t.title || 'Creating post'}
                    </div>
                    <button
                      onClick={() => clearTask(t.id)}
                      className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
                      aria-label="Dismiss task"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                    {t.message || t.status}
                  </div>
                  <div className="mt-2 h-2 w-full rounded bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className={`h-2 rounded ${
                        t.status === 'error' ? 'bg-red-500' : t.status === 'canceled' ? 'bg-neutral-400' : 'bg-blue-500'
                      }`}
                      style={{ width: `${t.progress ?? 0}%`, transition: 'width 200ms ease' }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {t.status}
                </div>
                {t.canCancel && (
                  <button
                    onClick={() => cancelTask(t.id)}
                    className="text-xs px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}

          {tasks.length > visibleTasks.length && (
            <div className="text-[11px] text-right text-neutral-500 dark:text-neutral-400">
              +{tasks.length - visibleTasks.length} more in progress
            </div>
          )}
        </>
      )}
    </div>
  );
}
