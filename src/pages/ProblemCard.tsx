import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { 
  ArrowLeftIcon, 
  ArrowRightIcon, 
  PlayIcon, 
  StopIcon,
  MicrophoneIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import { Problem, Card } from '../types';
import { ResizableMonacoEditor } from '../components/ResizableMonacoEditor';
import { QuillEditor } from '../components/QuillEditor';
import { LanguageSelector } from '../components/LanguageSelector';
import { useAutoSave } from '../hooks/useAutoSave';

export default function ProblemCard() {
  const { problemId, cardId } = useParams();
  const navigate = useNavigate();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timerState, setTimerState] = useState({ isRunning: false, elapsedTime: 0 });
  const [recordingState, setRecordingState] = useState({ isRecording: false });

  // Editor state
  const [code, setCode] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [language, setLanguage] = useState<string>('javascript');
  const [isDark, setIsDark] = useState<boolean>(false);

  // Detect dark mode from document
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    
    // Listen for theme changes
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  // Save functions
  const saveCard = useCallback(async () => {
    if (!currentCard) return;
    
    try {
      const updatedCard = await invoke<Card>('update_card', {
        cardId: currentCard.id,
        code: code !== currentCard.code ? code : null,
        notes: notes !== currentCard.notes ? notes : null,
        language: language !== currentCard.language ? language : null,
      });
      
      // Update the current card and cards array
      setCurrentCard(updatedCard);
      setCards(prev => prev.map(card => 
        card.id === updatedCard.id ? updatedCard : card
      ));
      
    } catch (err) {
      console.error('Failed to save card:', err);
      throw err;
    }
  }, [currentCard, code, notes, language]);

  // Auto-save hooks
  const codeAutoSave = useAutoSave(code, async () => {
    if (currentCard && code !== currentCard.code) {
      await saveCard();
    }
  }, { delay: 3000, enabled: !!currentCard });

  const notesAutoSave = useAutoSave(notes, async () => {
    if (currentCard && notes !== currentCard.notes) {
      await saveCard();
    }
  }, { delay: 3000, enabled: !!currentCard });

  const languageAutoSave = useAutoSave(language, async () => {
    if (currentCard && language !== currentCard.language) {
      await saveCard();
    }
  }, { delay: 1000, enabled: !!currentCard }); // Faster save for language changes

  // Manual save function
  const handleManualSave = useCallback(async () => {
    try {
      await saveCard();
    } catch (err) {
      // Error handling is done in the saveCard function
    }
  }, [saveCard]);

  useEffect(() => {
    if (problemId) {
      loadProblem();
    }
  }, [problemId]);

  useEffect(() => {
    if (cardId && cards.length > 0) {
      const card = cards.find(c => c.id === cardId);
      setCurrentCard(card || cards[0]);
    } else if (cards.length > 0) {
      setCurrentCard(cards[0]);
    }
  }, [cardId, cards]);

  // Sync editor state when current card changes
  useEffect(() => {
    if (currentCard) {
      setCode(currentCard.code || '');
      setNotes(currentCard.notes || '');
      setLanguage(currentCard.language || 'javascript');
    }
  }, [currentCard]);

  const loadProblem = async () => {
    try {
      setLoading(true);
      const [problemResult, cardsResult] = await Promise.all([
        invoke<Problem>('get_problem_by_id', { id: problemId }),
        invoke<Card[]>('get_cards_for_problem', { problemId })
      ]);
      
      setProblem(problemResult);
      setCards(cardsResult);
      
      // If no cards exist, create the first one
      if (cardsResult.length === 0) {
        await createNewCard();
      }
      
      setError(null);
    } catch (err) {
      setError(err as string);
      console.error('Failed to load problem:', err);
    } finally {
      setLoading(false);
    }
  };

  const createNewCard = async () => {
    if (!problemId) return;
    
    try {
      const newCard = await invoke<Card>('create_card', {
        request: {
          problem_id: problemId,
          language: 'javascript',
          parent_card_id: null
        }
      });
      
      setCards(prev => [...prev, newCard]);
      setCurrentCard(newCard);
      navigate(`/problem/${problemId}/card/${newCard.id}`);
    } catch (err) {
      console.error('Failed to create card:', err);
    }
  };

  const navigateToCard = (direction: 'prev' | 'next') => {
    if (!currentCard) return;
    
    const currentIndex = cards.findIndex(c => c.id === currentCard.id);
    let targetIndex: number;
    
    if (direction === 'prev') {
      targetIndex = currentIndex > 0 ? currentIndex - 1 : cards.length - 1;
    } else {
      targetIndex = currentIndex < cards.length - 1 ? currentIndex + 1 : 0;
    }
    
    if (targetIndex === cards.length && direction === 'next') {
      // Create new card
      createNewCard();
      return;
    }
    
    const targetCard = cards[targetIndex];
    setCurrentCard(targetCard);
    navigate(`/problem/${problemId}/card/${targetCard.id}`);
  };

  const toggleTimer = async () => {
    try {
      if (!currentCard) return;
      
      if (timerState.isRunning) {
        await invoke('stop_timer_session');
        setTimerState({ isRunning: false, elapsedTime: 0 });
      } else {
        await invoke('start_timer_session', { cardId: currentCard.id });
        setTimerState({ isRunning: true, elapsedTime: 0 });
        // Start timer update interval
        setInterval(updateTimer, 1000);
      }
    } catch (err) {
      console.error('Timer error:', err);
    }
  };

  const updateTimer = async () => {
    try {
      const state = await invoke<{isRunning: boolean; elapsedTime: number}>('get_timer_state');
      setTimerState(state);
    } catch (err) {
      console.error('Failed to update timer:', err);
    }
  };

  const toggleRecording = async () => {
    try {
      if (recordingState.isRecording) {
        await invoke('stop_recording');
        setRecordingState({ isRecording: false });
      } else {
        await invoke('start_recording');
        setRecordingState({ isRecording: true });
      }
    } catch (err) {
      console.error('Recording error:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-500 mb-4">Error loading problem: {error}</p>
          <button 
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                {problem.title}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Card {currentCard?.card_number || 1} of {cards.length}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-3">
            {/* Language Selector */}
            <div className="flex flex-col items-end">
              <LanguageSelector
                value={language}
                onChange={setLanguage}
                className="w-32"
              />
            </div>

            {/* Save Indicators */}
            <div className="flex items-center space-x-1">
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

            {/* Card Navigation */}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => navigateToCard('prev')}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                disabled={cards.length <= 1}
              >
                <ArrowLeftIcon className="h-4 w-4" />
              </button>
              
              <span className="text-sm text-gray-500 dark:text-gray-400 px-2">
                {currentCard?.card_number || 1} / {cards.length}
              </span>
              
              <button
                onClick={() => navigateToCard('next')}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            </div>

            {/* Timer */}
            <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <button
                onClick={toggleTimer}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {timerState.isRunning ? (
                  <StopIcon className="h-4 w-4 text-red-500" />
                ) : (
                  <PlayIcon className="h-4 w-4 text-green-500" />
                )}
              </button>
              <span className="text-sm font-mono">
                {Math.floor(timerState.elapsedTime / 60)}:
                {(timerState.elapsedTime % 60).toString().padStart(2, '0')}
              </span>
            </div>

            {/* Recording */}
            <button
              onClick={toggleRecording}
              className={`p-2 rounded-lg transition-colors ${
                recordingState.isRecording
                  ? 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <MicrophoneIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Problem Description */}
        <div className="w-1/3 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-auto">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Problem Description
            </h2>
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {problem.description}
              </p>
            </div>
            
            {problem.leetcode_url && (
              <div className="mt-6">
                <a
                  href={problem.leetcode_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 dark:text-primary-400 hover:underline text-sm"
                >
                  View on LeetCode →
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Editor and Notes */}
        <div className="flex-1 flex flex-col">
          {/* Monaco Code Editor */}
          <div className="bg-gray-50 dark:bg-gray-900 relative">
            <div className="absolute top-2 right-2 z-10">
              <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                <span>Code Editor</span>
                <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">Ctrl+S</kbd>
              </div>
            </div>
            {currentCard ? (
              <ResizableMonacoEditor
                value={code}
                language={language}
                theme={isDark ? 'vs-dark' : 'vs-light'}
                onChange={setCode}
                onSave={handleManualSave}
                initialHeight={400}
                minHeight={200}
                maxHeight={window.innerHeight * 0.8}
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <p className="text-gray-500 dark:text-gray-400">
                    Select a card to start coding
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* QuillJS Rich Text Editor */}
          <div className="h-1/3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 relative">
            <div className="absolute top-2 right-2 z-10">
              <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                <span>Notes</span>
                <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">Ctrl+S</kbd>
              </div>
            </div>
            {currentCard ? (
              <QuillEditor
                value={notes}
                theme={isDark ? 'dark' : 'light'}
                onChange={setNotes}
                onSave={handleManualSave}
                placeholder="Write your notes, observations, and thoughts here..."
                className="h-full"
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <p className="text-gray-500 dark:text-gray-400">
                    Select a card to start taking notes
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}