import { XMarkIcon, ExclamationTriangleIcon, TrashIcon } from '@heroicons/react/24/outline';
import { DeleteProblemDialogProps } from '../types';

export default function DeleteProblemDialog({
  isOpen,
  onClose,
  onConfirm,
  problemTitle,
  deleteStats,
  isLoading,
}: DeleteProblemDialogProps) {
  
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Delete Problem
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Are you sure you want to delete "{problemTitle}"? This action cannot be undone.
          </p>

          {isLoading ? (
            <div className="flex items-center justify-center py-4 mb-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
              <span className="ml-2 text-sm text-gray-500">Loading deletion details...</span>
            </div>
          ) : deleteStats ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                The following data will be permanently deleted:
              </h4>
              <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                {deleteStats.total_cards > 0 && (
                  <li>
                    • {deleteStats.total_cards} card{deleteStats.total_cards !== 1 ? 's' : ''} 
                    {deleteStats.main_cards > 0 && deleteStats.child_cards > 0 && (
                      <span className="text-xs text-red-600 dark:text-red-400 ml-1">
                        ({deleteStats.main_cards} main, {deleteStats.child_cards} child)
                      </span>
                    )}
                  </li>
                )}
                {deleteStats.recordings_count > 0 && (
                  <li>• {deleteStats.recordings_count} audio recording{deleteStats.recordings_count !== 1 ? 's' : ''}</li>
                )}
                {deleteStats.images_count > 0 && (
                  <li>• {deleteStats.images_count} image{deleteStats.images_count !== 1 ? 's' : ''}</li>
                )}
                {deleteStats.total_duration > 0 && (
                  <li>• {formatDuration(deleteStats.total_duration)} of study time</li>
                )}
              </ul>
              {deleteStats.total_cards === 0 && deleteStats.recordings_count === 0 && deleteStats.images_count === 0 && (
                <p className="text-sm text-red-700 dark:text-red-300">
                  • Only the problem definition will be deleted
                </p>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Failed to load deletion details. The problem and all related data will still be deleted.
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              onClick={onConfirm}
              disabled={isLoading}
            >
              <TrashIcon className="h-4 w-4" />
              Delete Problem
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}