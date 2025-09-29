"use client";

import React from 'react';
import { useBackgroundProfileUpdate } from '@/providers/BackgroundProfileUpdateProvider';
import { CheckCircle, XCircle, Upload, X, User } from 'lucide-react';

export default function BackgroundProfileUpdateIndicator() {
  const { tasks, cancelTask, clearTask } = useBackgroundProfileUpdate();

  // Only show active tasks (not completed ones)
  const activeTasks = tasks.filter(task => 
    task.status !== 'success' && task.status !== 'error' && task.status !== 'canceled'
  );

  const completedTasks = tasks.filter(task => 
    task.status === 'success' || task.status === 'error' || task.status === 'canceled'
  );

  if (tasks.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
        {/* Active Tasks */}
        {activeTasks.map((task) => (
          <div
            key={task.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 relative overflow-hidden animate-in slide-in-from-bottom-5 duration-300"
          >
            {/* Cancel button */}
            {task.canCancel && (
              <button
                onClick={() => cancelTask(task.id)}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Cancel"
              >
                <X size={16} />
              </button>
            )}

            {/* Content */}
            <div className="flex items-start space-x-3 rtl:space-x-reverse">
              {/* Icon */}
              <div className="flex-shrink-0 mt-1">
                {task.status === 'uploading_avatar' || task.status === 'uploading_background' ? (
                  <Upload className="w-5 h-5 text-blue-500 animate-bounce" />
                ) : task.status === 'updating_profile' ? (
                  <User className="w-5 h-5 text-green-500 animate-pulse" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-blue-500 animate-pulse" />
                )}
              </div>

              {/* Text Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                  {task.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  {task.message}
                </p>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-1">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {task.progress}%
                </p>
              </div>
            </div>
          </div>
        ))}

        {/* Completed Tasks (briefly shown) */}
        {completedTasks.map((task) => (
          <div
            key={task.id}
            className={`rounded-lg shadow-lg border p-4 relative animate-in slide-in-from-bottom-5 duration-300 ${
              task.status === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : task.status === 'error'
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                : 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700'
            }`}
          >
            {/* Close button */}
            <button
              onClick={() => clearTask(task.id)}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Close"
            >
              <X size={16} />
            </button>

            {/* Content */}
            <div className="flex items-start space-x-3 rtl:space-x-reverse">
              {/* Status Icon */}
              <div className="flex-shrink-0 mt-1">
                {task.status === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : task.status === 'error' ? (
                  <XCircle className="w-5 h-5 text-red-500" />
                ) : (
                  <X className="w-5 h-5 text-gray-500" />
                )}
              </div>

              {/* Text Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium mb-1">
                  <span 
                    className={
                      task.status === 'success'
                        ? 'text-green-800 dark:text-green-200'
                        : task.status === 'error'
                        ? 'text-red-800 dark:text-red-200'
                        : 'text-gray-800 dark:text-gray-200'
                    }
                  >
                    {task.title}
                  </span>
                </p>
                <p 
                  className={`text-xs ${
                    task.status === 'success'
                      ? 'text-green-600 dark:text-green-400'
                      : task.status === 'error'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {task.message}
                </p>
                {task.error && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                    {task.error}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
    </div>
  );
}
