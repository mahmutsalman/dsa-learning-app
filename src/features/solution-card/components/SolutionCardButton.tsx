// Solution Card Button Component
//
// Modular component for the solution card toggle button.
// Handles shift+click detection and visual states.

import React, { useCallback } from 'react';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { SolutionCardButtonProps } from '../types';
import styles from '../styles/SolutionCard.module.css';

export const SolutionCardButton: React.FC<SolutionCardButtonProps> = ({
  onSolutionToggle,
  isActive,
  disabled = false,
  className = ''
}) => {
  const handleClick = useCallback((event: React.MouseEvent) => {
    // Check for shift key
    if (event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      onSolutionToggle(event);
    } else {
      // Normal click - let parent handle regular navigation
      // Don't call onSolutionToggle for normal clicks
    }
  }, [onSolutionToggle]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    // Handle keyboard shortcuts
    if (event.key === 'Enter' || event.key === ' ') {
      if (event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        onSolutionToggle(event);
      }
    }
  }, [onSolutionToggle]);

  const buttonClasses = [
    'p-2 rounded-lg transition-colors relative',
    'hover:bg-gray-100 dark:hover:bg-gray-700',
    'focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
    styles.solutionButton,
    isActive ? styles.active : '',
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
      <ArrowRightIcon className="h-4 w-4" />
      
      {/* Hint tooltip */}
      <span className={styles.solutionHint}>
        {isActive ? 'Shift+Click to exit' : 'Shift+Click for solution'}
      </span>
    </button>
  );
};