// Solution Card Button Component
//
// Modular component for the solution card toggle button.
// Handles shift+click detection and visual states.

import React, { useCallback } from 'react';
import { ArrowRightIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { SolutionCardButtonProps } from '../types';
import styles from '../styles/SolutionCard.module.css';

export const SolutionCardButton: React.FC<SolutionCardButtonProps> = ({
  onSolutionToggle,
  isActive,
  disabled = false,
  className = ''
}) => {
  const handleClick = useCallback((event: React.MouseEvent) => {
    // Always forward click events to parent - let parent handle shift vs normal click logic
    onSolutionToggle(event);
  }, [onSolutionToggle]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    // Handle keyboard shortcuts
    if (event.key === 'Enter' || event.key === ' ') {
      // Always forward keyboard events to parent - let parent handle shift logic
      onSolutionToggle(event);
    }
  }, [onSolutionToggle]);

  const buttonClasses = [
    'p-2 rounded-lg transition-all duration-200 ease-in-out relative',
    'focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
    styles.solutionButton,
    isActive 
      ? `${styles.active} bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 shadow-md transform scale-105` 
      : 'hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 hover:shadow-sm',
    disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={buttonClasses}
      disabled={disabled}
      title={isActive ? "Exit solution view (Shift+Click)" : "View solution (Shift+Click) or Navigate to next card"}
      aria-label={isActive ? "Exit solution view" : "Navigate to next card or view solution"}
    >
      <div className="flex items-center">
        {/* Show different icon and text based on mode */}
        {isActive ? (
          <>
            <ArrowLeftIcon className="h-4 w-4" />
            <span className="ml-1 text-xs font-medium">Exit</span>
          </>
        ) : (
          <>
            <ArrowRightIcon className="h-4 w-4" />
            {/* Solution indicator dot */}
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 dark:bg-red-400 rounded-full opacity-75 animate-ping"></div>
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 dark:bg-red-400 rounded-full"></div>
          </>
        )}
      </div>
      
      {/* Enhanced hint tooltip */}
      <span className={`${styles.solutionHint} ${isActive ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-1 rounded' : ''}`}>
        {isActive ? 'Shift+Click to exit solution' : 'Shift+Click for solution'}
      </span>
    </button>
  );
};