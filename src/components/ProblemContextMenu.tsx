import { useEffect, useRef } from 'react';
import { TagIcon } from '@heroicons/react/24/outline';
import { ProblemContextMenuProps } from '../types';

export default function ProblemContextMenu({
  isOpen,
  onClose,
  onManageTags,
  position,
  problemId,
}: ProblemContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Calculate positioning to avoid viewport overflow
  const getMenuStyle = (): React.CSSProperties => {
    const menuWidth = 200;
    const menuHeight = 120;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let left = position.x;
    let top = position.y;

    // Horizontal overflow prevention
    if (left + menuWidth > windowWidth) {
      left = windowWidth - menuWidth - 10;
    }
    if (left < 10) {
      left = 10;
    }

    // Vertical overflow prevention
    if (top + menuHeight > windowHeight) {
      top = position.y - menuHeight - 10;
    }
    if (top < 10) {
      top = 10;
    }

    return {
      position: 'fixed',
      left: `${left}px`,
      top: `${top}px`,
      zIndex: 1000,
    };
  };

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      style={getMenuStyle()}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 min-w-[180px]"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onManageTags();
          onClose();
        }}
        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
      >
        <TagIcon className="h-4 w-4" />
        Manage Tags
      </button>
      
      {/* Future menu items can be added here */}
    </div>
  );
}