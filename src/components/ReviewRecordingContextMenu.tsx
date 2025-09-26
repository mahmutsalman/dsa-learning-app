import { useEffect, useRef } from 'react';
import {
  MicrophoneIcon,
  StopIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

interface ReviewRecordingContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onStartReviewRecording: () => void;
  onStopReviewRecording: () => void;
  onOpenHistory: () => void;
  canStart: boolean;
  canStop: boolean;
}

export default function ReviewRecordingContextMenu({
  isOpen,
  position,
  onClose,
  onStartReviewRecording,
  onStopReviewRecording,
  onOpenHistory,
  canStart,
  canStop,
}: ReviewRecordingContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

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

  if (!isOpen || !position) return null;

  const getMenuStyle = (): React.CSSProperties => {
    const menuWidth = 220;
    const menuHeight = 160;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let left = position.x;
    let top = position.y;

    if (left + menuWidth > windowWidth) {
      left = windowWidth - menuWidth - 10;
    }
    if (left < 10) {
      left = 10;
    }

    if (top + menuHeight > windowHeight) {
      top = Math.max(10, position.y - menuHeight - 10);
    }
    if (top < 10) {
      top = 10;
    }

    return {
      position: 'fixed',
      left,
      top,
      zIndex: 2000,
    };
  };

  return (
    <div
      ref={menuRef}
      style={getMenuStyle()}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 min-w-[200px]"
    >
      <button
        onClick={(event) => {
          event.stopPropagation();
          onStartReviewRecording();
          onClose();
        }}
        disabled={!canStart}
        className="w-full px-4 py-2 text-left text-sm flex items-center gap-3 text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <MicrophoneIcon className="h-4 w-4" />
        <span>Start Review Recording</span>
      </button>

      <button
        onClick={(event) => {
          event.stopPropagation();
          onStopReviewRecording();
          onClose();
        }}
        disabled={!canStop}
        className="w-full px-4 py-2 text-left text-sm flex items-center gap-3 text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <StopIcon className="h-4 w-4" />
        <span>Stop Review Recording</span>
      </button>

      <hr className="my-1 border-gray-200 dark:border-gray-700" />

      <button
        onClick={(event) => {
          event.stopPropagation();
          onOpenHistory();
          onClose();
        }}
        className="w-full px-4 py-2 text-left text-sm flex items-center gap-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <ClockIcon className="h-4 w-4" />
        <span>Open Review History</span>
      </button>
    </div>
  );
}
