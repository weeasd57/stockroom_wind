'use client';

import React from 'react';
import { useBackgroundPostCreation } from '@/providers/BackgroundPostCreationProvider';
import { X } from 'lucide-react';

export default function BackgroundPostCreationFloatingIndicator() {
  const { tasks, cancelTask, clearAllCompleted, clearTask } = useBackgroundPostCreation();

  const visibleTasks = tasks.slice(0, 5); // show latest 5
  const hasItems = tasks.length > 0;

  if (!hasItems) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] space-y-2 w-[92vw] max-w-sm sm:max-w-md">
      <div className="flex items-center justify-between px-3 py-2 rounded-md bg-white/90 dark:bg-neutral-900/90 backdrop-blur shadow-lg border border-neutral-200 dark:border-neutral-800">
        <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Background posts</div>
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
    </div>
  );
}
