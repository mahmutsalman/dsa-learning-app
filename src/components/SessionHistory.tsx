import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ClockIcon, CalendarDaysIcon, ChatBubbleBottomCenterTextIcon, TrashIcon, AcademicCapIcon, BookOpenIcon } from '@heroicons/react/24/outline';
import { TimeSession, ReviewSession } from '../types';
import { WorkSessionService } from '../services/WorkSessionService';

interface SessionHistoryProps {
  cardId: string | undefined;
  isOpen: boolean;
  onClose: () => void;
  onSessionDeleted?: () => void; // Callback to refresh card data after deletion
}

type SessionType = 'study' | 'review';

export default function SessionHistory({ cardId, isOpen, onClose, onSessionDeleted }: SessionHistoryProps) {
  const [activeTab, setActiveTab] = useState<SessionType>('study');
  const [sessions, setSessions] = useState<TimeSession[]>([]);
  const [reviewSessions, setReviewSessions] = useState<ReviewSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ sessionId: string | null; isDeleting: boolean }>({
    sessionId: null,
    isDeleting: false
  });

  useEffect(() => {
    if (isOpen && cardId) {
      loadSessions();
    }
  }, [isOpen, cardId]);

  const loadSessions = async () => {
    if (!cardId) return;

    setLoading(true);
    setError(null);

    try {
      // Load both regular and review sessions
      const [sessionData, reviewSessionData] = await Promise.all([
        invoke<TimeSession[]>('get_card_sessions', { cardId }),
        invoke<ReviewSession[]>('get_card_review_sessions', { cardId })
      ]);

      setSessions(sessionData);
      setReviewSessions(reviewSessionData);
    } catch (err) {
      console.error('Failed to load sessions:', err);
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

  const formatDate = (date: string): string => {
    try {
      return new Date(date).toLocaleDateString();
    } catch {
      return date;
    }
  };

  const getTotalTime = (): number => {
    const activeSessions = activeTab === 'study' ? sessions : reviewSessions;
    return activeSessions.reduce((total, session) => total + (session.duration || 0), 0);
  };

  const getActiveSessionCount = (): number => {
    return activeTab === 'study' ? sessions.length : reviewSessions.length;
  };

  const getActiveSessions = (): (TimeSession | ReviewSession)[] => {
    return activeTab === 'study' ? sessions : reviewSessions;
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      setDeleteConfirm({ sessionId, isDeleting: true });

      // Delete either regular or review session based on active tab
      if (activeTab === 'study') {
        await invoke('delete_session', { sessionId });
        setSessions(prev => prev.filter(s => s.id !== sessionId));
      } else {
        await invoke('delete_review_session', { sessionId });
        setReviewSessions(prev => prev.filter(s => s.id !== sessionId));
      }

      // Clear the WorkSessionService cache to ensure stats are refreshed
      WorkSessionService.clearCache();

      // Call callback to refresh card data
      if (onSessionDeleted) {
        onSessionDeleted();
      }

      // Reset delete confirmation
      setDeleteConfirm({ sessionId: null, isDeleting: false });

    } catch (err) {
      console.error('Failed to delete session:', err);
      setError(`Failed to delete session: ${err}`);
      setDeleteConfirm({ sessionId: null, isDeleting: false });
    }
  };

  const confirmDelete = (sessionId: string) => {
    setDeleteConfirm({ sessionId, isDeleting: false });
  };

  const cancelDelete = () => {
    setDeleteConfirm({ sessionId: null, isDeleting: false });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Session History
              </h2>

              {/* Tab Navigation */}
              <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('study')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center space-x-1.5 ${
                    activeTab === 'study'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <BookOpenIcon className="h-4 w-4" />
                  <span>Study</span>
                  <span className="text-xs opacity-75">({sessions.length})</span>
                </button>
                <button
                  onClick={() => setActiveTab('review')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center space-x-1.5 ${
                    activeTab === 'review'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <AcademicCapIcon className="h-4 w-4" />
                  <span>Review</span>
                  <span className="text-xs opacity-75">({reviewSessions.length})</span>
                </button>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="text-2xl">&times;</span>
            </button>
          </div>
          
          {/* Summary */}
          <div className="mt-4 flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center space-x-2">
              <ClockIcon className="h-4 w-4" />
              <span>Total Time: {formatDuration(getTotalTime())}</span>
            </div>
            <div className="flex items-center space-x-2">
              <CalendarDaysIcon className="h-4 w-4" />
              <span>Sessions: {getActiveSessionCount()}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">Loading sessions...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500 mb-4">Error loading sessions: {error}</p>
              <button
                onClick={loadSessions}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : getActiveSessions().length === 0 ? (
            <div className="text-center py-12">
              <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No sessions found for this card.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {getActiveSessions().map((session) => (
                <div
                  key={session.id}
                  className={`rounded-lg p-4 border ${
                    activeTab === 'study'
                      ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                      : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-2">
                        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                          <CalendarDaysIcon className="h-4 w-4" />
                          <span>{formatDate(session.date)}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                          <ClockIcon className="h-4 w-4" />
                          <span>{formatDuration(session.duration)}</span>
                        </div>
                        {session.is_active && (
                          <span className={`px-2 py-1 text-xs rounded ${
                            activeTab === 'study'
                              ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
                              : 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200'
                          }`}>
                            Active
                          </span>
                        )}
                      </div>
                      
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        <div className="mb-1">
                          <strong>Started:</strong> {formatDateTime(session.start_time)}
                        </div>
                        {session.end_time && (
                          <div>
                            <strong>Ended:</strong> {formatDateTime(session.end_time)}
                          </div>
                        )}
                      </div>
                      
                      {session.notes && (
                        <div className={`mt-3 p-3 rounded border ${
                          activeTab === 'study'
                            ? 'bg-emerald-25 dark:bg-emerald-900/10 border-emerald-150 dark:border-emerald-800/50'
                            : 'bg-amber-25 dark:bg-amber-900/10 border-amber-150 dark:border-amber-800/50'
                        }`}>
                          <div className="flex items-center space-x-2 mb-2">
                            <ChatBubbleBottomCenterTextIcon className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Notes</span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                            {session.notes}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* Delete button */}
                    <div className="flex items-start ml-4">
                      <button
                        onClick={() => confirmDelete(session.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete session"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Delete Confirmation Dialog */}
      {deleteConfirm.sessionId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Delete Session?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete this {activeTab} session? This action cannot be undone and will update your total {activeTab} time.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                disabled={deleteConfirm.isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteSession(deleteConfirm.sessionId!)}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={deleteConfirm.isDeleting}
              >
                {deleteConfirm.isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}