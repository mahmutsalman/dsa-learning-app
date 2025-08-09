import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeftIcon, 
  ArrowRightIcon, 
  PlayIcon, 
  StopIcon,
  MicrophoneIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  TrashIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { LanguageSelector } from './LanguageSelector';
import type { Problem, Card } from '../types';
import type { UseTimerReturn } from '../hooks/useTimer';
import type { AutoSaveState } from '../hooks/useAutoSave';

interface WorkspaceHeaderProps {
  problem: Problem;
  currentCard: Card | null;
  cards: Card[];
  language: string;
  onLanguageChange: (language: string) => void;
  timer: UseTimerReturn;
  codeAutoSave: AutoSaveState & { isLoading: boolean; isSaved: boolean; error: string | null };
  notesAutoSave: AutoSaveState & { isLoading: boolean; isSaved: boolean; error: string | null };
  languageAutoSave: AutoSaveState & { isLoading: boolean; isSaved: boolean; error: string | null };
  recordingState: { isRecording: boolean };
  onToggleTimer: () => void;
  onToggleRecording: () => void;
  onNavigateCard: (direction: 'prev' | 'next') => void;
  onDeleteCard: () => void;
  onOpenSessionHistory: () => void;
  formatTimeDisplay: (seconds: number, showSeconds?: boolean) => string;
  getSiblingCards: (currentCard: Card, cards: Card[]) => Card[];
}

export function WorkspaceHeader({
  problem,
  currentCard,
  cards,
  language,
  onLanguageChange,
  timer,
  codeAutoSave,
  notesAutoSave,
  languageAutoSave,
  recordingState,
  onToggleTimer,
  onToggleRecording,
  onNavigateCard,
  onDeleteCard,
  onOpenSessionHistory,
  formatTimeDisplay,
  getSiblingCards,
}: WorkspaceHeaderProps) {
  const navigate = useNavigate();

  const logDatabaseAnalysis = async () => {
    try {
      const { logDatabaseAnalysis } = await import('../utils/databaseAnalysis');
      logDatabaseAnalysis();
    } catch (err) {
      console.error('Failed to import database analysis:', err);
    }
  };

  return (
    <div className="workspace-header-content bg-white dark:bg-gray-800 px-6 h-full flex items-center">
      <div className="workspace-header-grid">
        {/* Navigation Section */}
        <div className="header-navigation">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          
          {/* Developer Debug Button - remove in production */}
          {(import.meta as any).env?.MODE === 'development' && (
            <button
              onClick={logDatabaseAnalysis}
              className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
              title="Analyze database structure (check console)"
            >
              DB Analysis
            </button>
          )}
        </div>

        {/* Title Section */}
        <div className="header-title">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              {problem.title}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {currentCard ? (() => {
                const allProblemCards = getSiblingCards(currentCard, cards);
                const currentIndex = allProblemCards.findIndex(c => c.id === currentCard.id);
                const cardType = currentCard.parent_card_id ? 'Child Card' : 'Main Card';
                
                return `${cardType} ${currentIndex + 1} / ${allProblemCards.length}`;
              })() : 'Card 1 / 1'}
            </p>
          </div>
        </div>

        {/* Language Selector Section */}
        <div className="header-language-selector">
          <LanguageSelector
            value={language}
            onChange={onLanguageChange}
            className="w-full max-w-[120px]"
          />
        </div>

        {/* Save Indicators Section */}
        <div className="header-save-indicators">
          {(codeAutoSave.isLoading || notesAutoSave.isLoading || languageAutoSave.isLoading) && (
            <div className="flex items-center space-x-1 text-blue-600 dark:text-blue-400">
              <div className="animate-spin rounded-full h-3 w-3 border border-current border-t-transparent"></div>
              <span className="text-xs">Saving...</span>
            </div>
          )}
          
          {(codeAutoSave.isSaved && notesAutoSave.isSaved && languageAutoSave.isSaved && 
            !codeAutoSave.isLoading && !notesAutoSave.isLoading && !languageAutoSave.isLoading) && (
            <div className="flex items-center space-x-1 text-green-600 dark:text-green-400">
              <CheckCircleIcon className="h-3 w-3" />
              <span className="text-xs">Saved</span>
            </div>
          )}
          
          {(codeAutoSave.error || notesAutoSave.error || languageAutoSave.error) && (
            <div className="flex items-center space-x-1 text-red-600 dark:text-red-400">
              <ExclamationCircleIcon className="h-3 w-3" />
              <span className="text-xs">Error</span>
            </div>
          )}
        </div>

        {/* Card Navigation Section */}
        <div className="header-card-navigation">
          <button
            onClick={() => onNavigateCard('prev')}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={currentCard ? (() => {
              const allProblemCards = getSiblingCards(currentCard, cards);
              const currentIndex = allProblemCards.findIndex(c => c.id === currentCard.id);
              return currentIndex === 0; // Disabled if at first card
            })() : true}
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </button>
          
          <span className="text-sm text-gray-500 dark:text-gray-400 px-2">
            {currentCard ? (() => {
              const allProblemCards = getSiblingCards(currentCard, cards);
              const currentIndex = allProblemCards.findIndex(c => c.id === currentCard.id);
              
              return `${currentIndex + 1} / ${allProblemCards.length}`;
            })() : '1 / 1'}
          </span>
          
          <button
            onClick={() => onNavigateCard('next')}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Navigate to next card or create new card"
          >
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Actions Section */}
        <div className="header-actions">
          {/* Delete Button Container - Always reserves space */}
          <div className={`header-delete-container ${!currentCard?.parent_card_id ? 'hidden' : ''}`}>
            <button
              onClick={onDeleteCard}
              className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400"
              title="Delete child card"
              disabled={!currentCard?.parent_card_id}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Timer - Fully Clickable */}
          <button
            onClick={onToggleTimer}
            disabled={timer.isLoading}
            className="flex items-center space-x-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            title={timer.timerState.isRunning ? "Stop timer session" : "Start timer session"}
            aria-label={timer.timerState.isRunning ? "Stop timer session" : "Start timer session"}
            aria-pressed={timer.timerState.isRunning}
          >
            {/* Play/Stop Icon */}
            <div className="flex-shrink-0">
              {timer.timerState.isRunning ? (
                <StopIcon className="h-4 w-4 text-red-500" />
              ) : (
                <PlayIcon className="h-4 w-4 text-green-500" />
              )}
            </div>
            
            {/* Timer Display */}
            <div className="flex flex-col items-center min-w-0">
              {/* Total duration on top - Live during recording */}
              <span className="text-xs font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap">
                {(() => {
                  // Show live total duration when timer is running
                  const liveTotalDuration = timer.timerState.isRunning 
                    ? timer.totalDuration + timer.timerState.elapsedTime
                    : timer.totalDuration;
                  
                  return formatTimeDisplay(liveTotalDuration);
                })()}
              </span>
              {/* Current session below in red and smaller */}
              <span className={`text-xs font-mono transition-colors whitespace-nowrap ${
                timer.timerState.isRunning 
                  ? 'text-red-500 dark:text-red-400' 
                  : 'text-gray-500 dark:text-gray-400'
              }`}>
                {formatTimeDisplay(timer.timerState.elapsedTime, false)}
              </span>
            </div>
            
            {/* Error and Debug Info */}
            <div className="flex items-center space-x-1">
              {timer.error && (
                <div className="text-xs text-red-500" title={timer.error}>
                  ⚠️
                </div>
              )}
              {/* Debug info - remove in production */}
              {(import.meta as any).env?.MODE === 'development' && (
                <div className="text-xs text-blue-500" title={`Debug: totalDuration=${timer.totalDuration}, elapsedTime=${timer.timerState.elapsedTime}, isRunning=${timer.timerState.isRunning}`}>
                  🔍
                </div>
              )}
            </div>
          </button>

          {/* Session History */}
          <button
            onClick={onOpenSessionHistory}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="View session history"
          >
            <ClockIcon className="h-4 w-4" />
          </button>

          {/* Recording */}
          <button
            onClick={onToggleRecording}
            className={`p-2 rounded-lg transition-colors ${
              recordingState.isRecording
                ? 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title="Recording (UI only - backend integration pending)"
          >
            <MicrophoneIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}