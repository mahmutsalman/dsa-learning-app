import React from 'react';
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';

export interface SaveIndicatorProps {
  codeAutoSave: {
    isLoading: boolean;
    isSaved: boolean;
    error: string | null;
  };
  notesAutoSave: {
    isLoading: boolean;
    isSaved: boolean;
    error: string | null;
  };
  languageAutoSave: {
    isLoading: boolean;
    isSaved: boolean;
    error: string | null;
  };
  /** Screen size for responsive display */
  screenSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Additional CSS classes */
  className?: string;
  /** Show full text labels or just icons */
  showLabels?: boolean;
}

/**
 * Unified Save Indicator Component
 * 
 * Provides consistent save state visual feedback for both regular and solution cards.
 * Displays loading, saved, and error states with proper accessibility support.
 */
export function SaveIndicator({
  codeAutoSave,
  notesAutoSave,
  languageAutoSave,
  screenSize = 'lg',
  className = '',
  showLabels = true
}: SaveIndicatorProps) {
  const isLoading = codeAutoSave.isLoading || notesAutoSave.isLoading || languageAutoSave.isLoading;
  const hasError = codeAutoSave.error || notesAutoSave.error || languageAutoSave.error;
  const isSaved = codeAutoSave.isSaved && notesAutoSave.isSaved && languageAutoSave.isSaved && !isLoading;

  const hideLabelsOnSmallScreens = screenSize === 'xs' || !showLabels;
  
  // Base container classes
  const containerClasses = [
    'flex items-center space-x-1',
    screenSize === 'xs' ? 'text-xs' : 'text-sm',
    className
  ].filter(Boolean).join(' ');

  // Loading state
  if (isLoading) {
    return (
      <div 
        className={containerClasses}
        role="status"
        aria-live="polite"
        aria-label="Saving changes"
      >
        <div className="animate-spin rounded-full h-3 w-3 border border-blue-600 dark:border-blue-400 border-t-transparent" />
        {!hideLabelsOnSmallScreens && (
          <span className="text-blue-600 dark:text-blue-400 font-medium">
            Saving...
          </span>
        )}
      </div>
    );
  }

  // Error state
  if (hasError) {
    const errorMessage = codeAutoSave.error || notesAutoSave.error || languageAutoSave.error;
    return (
      <div 
        className={containerClasses}
        role="alert"
        aria-live="assertive"
        title={errorMessage || 'Save error occurred'}
      >
        <ExclamationCircleIcon className="h-3 w-3 text-red-600 dark:text-red-400" />
        {!hideLabelsOnSmallScreens && (
          <span className="text-red-600 dark:text-red-400 font-medium">
            Error
          </span>
        )}
      </div>
    );
  }

  // Saved state
  if (isSaved) {
    return (
      <div 
        className={containerClasses}
        role="status"
        aria-live="polite"
        aria-label="All changes saved"
      >
        <CheckCircleIcon className="h-3 w-3 text-green-600 dark:text-green-400" />
        {!hideLabelsOnSmallScreens && (
          <span className="text-green-600 dark:text-green-400 font-medium">
            Saved
          </span>
        )}
      </div>
    );
  }

  // Default state - no indicator shown
  return null;
}

export default SaveIndicator;