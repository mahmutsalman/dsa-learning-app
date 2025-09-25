import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  delay?: number;
  maxWidth?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  followCursor?: boolean;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  delay = 500,
  maxWidth = '300px',
  position = 'top',
  followCursor = false,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const handleMouseEnter = () => {
    // Clear any existing hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    // Start show delay
    timeoutRef.current = setTimeout(() => {
      setShouldShow(true);
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    // Clear show timeout if it hasn't fired yet
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Start hide delay - keep visible for a brief moment
    hideTimeoutRef.current = setTimeout(() => {
      setShouldShow(false);
      setIsVisible(false);
    }, 150);
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (followCursor) {
      setMousePosition({ x: event.clientX, y: event.clientY });
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  const getPositionClasses = () => {
    if (followCursor) {
      return ''; // We'll handle positioning with inline styles for cursor following
    }

    switch (position) {
      case 'top':
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
      case 'bottom':
        return 'top-full left-1/2 transform -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 transform -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 transform -translate-y-1/2 ml-2';
      default:
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
    }
  };

  const getCursorPositionStyle = () => {
    if (!followCursor) return {};

    // Get tooltip dimensions to calculate proper positioning
    const tooltipHeight = tooltipRef.current?.offsetHeight || 0;
    const tooltipWidth = tooltipRef.current?.offsetWidth || 0;

    // Calculate position with bottom-left corner at cursor
    let left = mousePosition.x;
    let top = mousePosition.y - tooltipHeight;

    // Boundary detection to keep tooltip within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 10; // Small margin from viewport edges

    // Adjust horizontal position if tooltip would go off-screen
    if (left + tooltipWidth > viewportWidth - margin) {
      left = viewportWidth - tooltipWidth - margin;
    }
    if (left < margin) {
      left = margin;
    }

    // Adjust vertical position if tooltip would go off-screen
    if (top < margin) {
      top = mousePosition.y + 20; // Position below cursor if not enough space above
    }
    if (top + tooltipHeight > viewportHeight - margin) {
      top = viewportHeight - tooltipHeight - margin;
    }

    return {
      position: 'fixed' as const,
      left: `${left}px`,
      top: `${top}px`,
      zIndex: 9999
    };
  };

  const getArrowClasses = () => {
    switch (position) {
      case 'top':
        return 'top-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-900 dark:border-t-gray-100';
      case 'bottom':
        return 'bottom-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-gray-900 dark:border-b-gray-100';
      case 'left':
        return 'left-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-gray-900 dark:border-l-gray-100';
      case 'right':
        return 'right-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-gray-900 dark:border-r-gray-100';
      default:
        return 'top-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-900 dark:border-t-gray-100';
    }
  };

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      {children}

      {shouldShow && (
        <div
          ref={tooltipRef}
          className={`
            ${followCursor ? 'fixed' : 'absolute'} z-50 px-3 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-lg shadow-lg
            transition-opacity duration-200 pointer-events-none
            ${getPositionClasses()}
            ${isVisible ? 'opacity-100' : 'opacity-0'}
          `}
          style={{
            maxWidth,
            ...getCursorPositionStyle()
          }}
        >
          <div className="relative whitespace-pre-line">
            {content}
            {/* Arrow - only show for non-cursor-following tooltips */}
            {!followCursor && (
              <div
                className={`
                  absolute w-0 h-0 border-4
                  ${getArrowClasses()}
                `}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};