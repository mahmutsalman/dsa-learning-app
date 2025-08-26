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
    xs: 'text-xs px-1',
    sm: 'text-xs px-1',
    md: 'text-sm px-2',
    lg: 'text-sm px-2',
    xl: 'text-sm px-2'
  };

  const indicatorClasses = [
    sizeClasses[screenSize],
    isActive ? activeClasses : baseClasses,
    className
  ].filter(Boolean).join(' ');

  return (
    <span 
      className={indicatorClasses}
      title="Currently viewing solution card"
      aria-label="Solution card view active"
    >
      1/1 Solution
    </span>
  );
};