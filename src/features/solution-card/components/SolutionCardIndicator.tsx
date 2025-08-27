// Solution Card Indicator Component
//
// Modular component for displaying solution card status in the header.
// Shows "1/1 Solution" in red when active.

import React from 'react';
import { SolutionCardIndicatorProps } from '../types';
import styles from '../styles/SolutionCard.module.css';

export const SolutionCardIndicator: React.FC<SolutionCardIndicatorProps> = ({
  isActive,
  className = '',
  screenSize = 'lg'
}) => {
  if (!isActive) {
    return null; // Don't render anything when not in solution mode
  }

  const baseClasses = 'text-gray-500 dark:text-gray-400';
  const activeClasses = styles.solutionIndicator + ' ' + styles.active;
  
  const sizeClasses = {
    xs: 'text-xs px-2 py-1',
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1',
    lg: 'text-sm px-3 py-1',
    xl: 'text-sm px-3 py-1'
  };

  // Enhanced styling for solution mode indicator
  const enhancedClasses = [
    'inline-flex items-center rounded-md font-medium',
    'bg-red-50 dark:bg-red-900/20',
    'text-red-700 dark:text-red-300',
    'border border-red-200 dark:border-red-800',
    'shadow-sm',
    'transition-all duration-200 ease-in-out',
    sizeClasses[screenSize],
    isActive ? activeClasses : baseClasses,
    className
  ].filter(Boolean).join(' ');

  return (
    <span 
      className={enhancedClasses}
      title="Currently viewing solution card - Shift+Click to exit"
      aria-label="Solution card view active"
      role="status"
      aria-live="polite"
    >
      {/* Solution icon */}
      <svg 
        className={`${screenSize === 'xs' || screenSize === 'sm' ? 'w-3 h-3 mr-1' : 'w-4 h-4 mr-1.5'}`}
        fill="currentColor" 
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.236 4.53L7.73 10.36a.75.75 0 00-1.06 1.061l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
      </svg>
      1/1 Solution
    </span>
  );
};