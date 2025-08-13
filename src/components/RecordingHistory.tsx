import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { MicrophoneIcon, CalendarDaysIcon, PlayIcon, ClockIcon, TrashIcon } from '@heroicons/react/24/outline';

interface Recording {
  id: string;
  card_id: string;
  time_session_id?: string;
  audio_url: string;
  duration?: number;
  transcript?: string;
  created_at: string;
  filename: string;
  filepath: string;
  file_size?: number;
}

interface RecordingHistoryProps {
  cardId: string | undefined;
  isOpen: boolean;
  onClose: () => void;
  onRecordingPlay?: (recording: Recording) => void; // Callback to play recording
}

export default function RecordingHistory({ cardId, isOpen, onClose, onRecordingPlay }: RecordingHistoryProps) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null); // Track which recording is being deleted
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; recording: Recording | null }>({ isOpen: false, recording: null });

  useEffect(() => {
    if (isOpen && cardId) {
      loadRecordings();
    }
  }, [isOpen, cardId]);

  // Add keyboard navigation for delete confirmation modal
  useEffect(() => {
    if (!deleteConfirm.isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleDeleteConfirm();
      } else if (e.key === 'Escape') {
        handleDeleteCancel();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [deleteConfirm.isOpen]);

  const loadRecordings = async () => {
    if (!cardId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const recordingData = await invoke<Recording[]>('get_card_recordings', { cardId });
      setRecordings(recordingData);
    } catch (err) {
      console.error('Failed to load recordings:', err);
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number | undefined): string => {
    if (!seconds || seconds <= 0) return '0s';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatDateTime = (dateTime: string): string => {
    try {
      return new Date(dateTime).toLocaleString();
    } catch {
      return dateTime;
    }
  };

  const formatFileSize = (bytes: number | undefined): string => {
    if (!bytes) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getTotalDuration = (): number => {
    return recordings.reduce((total, recording) => total + (recording.duration || 0), 0);
  };

  const getTotalSize = (): number => {
    return recordings.reduce((total, recording) => total + (recording.file_size || 0), 0);
  };

  const handleDeleteClick = (recording: Recording) => {
    setDeleteConfirm({ isOpen: true, recording });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.recording) return;
    
    const recordingId = deleteConfirm.recording.id;
    setDeleting(recordingId);
    setDeleteConfirm({ isOpen: false, recording: null });
    
    try {
      await invoke<string>('delete_recording', { recordingId });
      
      // Remove recording from list immediately (optimistic update)
      setRecordings(prev => prev.filter(r => r.id !== recordingId));
    } catch (err) {
      console.error('Failed to delete recording:', err);
      setError(err as string);
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ isOpen: false, recording: null });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <MicrophoneIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recording History</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {recordings.length} recording{recordings.length !== 1 ? 's' : ''} • 
                Total: {formatDuration(getTotalDuration())} • 
                Size: {formatFileSize(getTotalSize())}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-500 dark:text-gray-400">Loading recordings...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <div className="text-red-600 dark:text-red-400">
                <p className="font-medium">Error loading recordings</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && recordings.length === 0 && (
            <div className="text-center py-12">
              <MicrophoneIcon className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No recordings yet</h3>
              <p className="text-gray-500 dark:text-gray-400">
                Start recording by clicking the microphone button to create your first recording.
              </p>
            </div>
          )}

          {!loading && !error && recordings.length > 0 && (
            <div className="space-y-4">
              {recordings.map((recording) => (
                <div
                  key={recording.id}
                  className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <MicrophoneIcon className="h-5 w-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {recording.filename}
                          </h4>
                          <div className="flex items-center space-x-4 mt-1">
                            <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                              <CalendarDaysIcon className="h-4 w-4" />
                              <span>{formatDateTime(recording.created_at)}</span>
                            </div>
                            {recording.duration && (
                              <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                                <ClockIcon className="h-4 w-4" />
                                <span>{formatDuration(recording.duration)}</span>
                              </div>
                            )}
                            {recording.file_size && (
                              <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                                <span>{formatFileSize(recording.file_size)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {recording.transcript && (
                        <div className="ml-8 mt-2">
                          <p className="text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 rounded p-2 border">
                            {recording.transcript}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      {onRecordingPlay && (
                        <button
                          onClick={() => onRecordingPlay(recording)}
                          className="p-2 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                          title="Play recording"
                        >
                          <PlayIcon className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteClick(recording)}
                        disabled={deleting === recording.id}
                        className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete recording"
                      >
                        {deleting === recording.id ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent"></div>
                        ) : (
                          <TrashIcon className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm.isOpen && deleteConfirm.recording && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                <TrashIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Delete Recording
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                Are you sure you want to delete this recording?
              </p>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {deleteConfirm.recording.filename}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {formatDateTime(deleteConfirm.recording.created_at)} • {formatDuration(deleteConfirm.recording.duration)}
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={handleDeleteCancel}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                autoFocus
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete Recording
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}