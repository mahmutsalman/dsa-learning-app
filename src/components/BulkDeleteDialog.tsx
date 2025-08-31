import { useState } from 'react';
import { XMarkIcon, ExclamationTriangleIcon, TrashIcon } from '@heroicons/react/24/outline';

interface BulkDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  selectedCount: number;
  selectedProblems: Array<{ id: string; title: string; cardCount: number }>;
}

export default function BulkDeleteDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  selectedCount,
  selectedProblems 
}: BulkDeleteDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalCards = selectedProblems.reduce((sum, problem) => sum + problem.cardCount, 0);
  const isConfirmValid = confirmText === 'DELETE';

  const handleConfirm = async () => {
    if (!isConfirmValid) return;
    
    setIsDeleting(true);
    setError(null);
    
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err as string);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      setConfirmText('');
      setError(null);
      onClose();
    }
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
              Delete {selectedCount} Problem{selectedCount !== 1 ? 's' : ''}
            </h3>
          </div>
          <button
            onClick={handleClose}
            disabled={isDeleting}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              This action will <strong>permanently delete</strong> the following:
            </p>
            
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mb-4">
              <ul className="space-y-2 text-sm text-red-800 dark:text-red-200">
                <li>• <strong>{selectedCount}</strong> problem{selectedCount !== 1 ? 's' : ''}</li>
                <li>• <strong>{totalCards}</strong> card{totalCards !== 1 ? 's' : ''} with all code and notes</li>
                <li>• <strong>All audio recordings</strong> (files will be deleted from disk)</li>
                <li>• <strong>All time sessions</strong> and progress data</li>
                <li>• <strong>All tags and connections</strong></li>
                <li>• <strong>All images and attachments</strong></li>
              </ul>
            </div>

            {selectedProblems.length <= 5 ? (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Problems to be deleted:
                </p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {selectedProblems.map((problem) => (
                    <div key={problem.id} className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded px-2 py-1">
                      <span className="font-medium">{problem.title}</span>
                      <span className="text-gray-500 dark:text-gray-500 ml-2">
                        ({problem.cardCount} card{problem.cardCount !== 1 ? 's' : ''})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  And {selectedProblems.length - 3} other problems...
                </p>
                <div className="mt-2 space-y-1">
                  {selectedProblems.slice(0, 3).map((problem) => (
                    <div key={problem.id} className="text-sm text-gray-700 dark:text-gray-300">
                      • {problem.title} ({problem.cardCount} card{problem.cardCount !== 1 ? 's' : ''})
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                To confirm deletion, type <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-red-600 dark:text-red-400 font-mono">DELETE</code> below:
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={isDeleting}
                placeholder="Type DELETE to confirm"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClose}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isConfirmValid || isDeleting}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Deleting...
              </>
            ) : (
              <>
                <TrashIcon className="h-4 w-4" />
                Delete Permanently
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}