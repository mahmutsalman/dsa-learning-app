import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { 
  ArrowLeftIcon, 
  ArrowRightIcon, 
  PlayIcon, 
  StopIcon,
  MicrophoneIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { Problem, Card } from '../types';
import { ResizableMonacoEditor } from '../components/ResizableMonacoEditor';
import { QuillEditor } from '../components/QuillEditor';
import { LanguageSelector } from '../components/LanguageSelector';
// import ResizableProblemDescriptionPanel from '../components/ResizableProblemDescriptionPanel';
import ResizableWorkspace from '../components/workspace/ResizableWorkspace';
import WorkspaceProblemPanel from '../components/workspace/WorkspaceProblemPanel';
import DeleteCardModal from '../components/DeleteCardModal';
import { useAutoSave } from '../hooks/useAutoSave';
import { logDatabaseAnalysis, getSiblingCards } from '../utils/databaseAnalysis';

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
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, isDeleting: false });

  // Editor state
  const [code, setCode] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [language, setLanguage] = useState<string>('javascript');
  const [isDark, setIsDark] = useState<boolean>(false);

  // Ref for the main content container to help calculate dynamic constraints
  const contentContainerRef = useRef<HTMLDivElement>(null);

  // Legacy state - kept for compatibility but not used in workspace mode
  // const [isProblemPanelCollapsed, setIsProblemPanelCollapsed] = useState(false);
  // const toggleProblemPanel = useCallback(() => {
  //   setIsProblemPanelCollapsed(prev => !prev);
  // }, []);
  // const handleProblemPanelWidthChange = useCallback((newWidth: number) => {
  //   setTimeout(() => {
  //     window.dispatchEvent(new Event('resize'));
  //   }, 100);
  // }, []);

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
      const updatedCard = await invoke<Card | null>('update_card', {
        cardId: currentCard.id,
        code: code !== currentCard.code ? code : null,
        notes: notes !== currentCard.notes ? notes : null,
        language: language !== currentCard.language ? language : null,
      });
      
      // Update the current card and cards array if we got a card back
      if (updatedCard) {
        setCurrentCard(updatedCard);
        setCards(prev => prev.map(card => 
          card.id === updatedCard.id ? updatedCard : card
        ));
      }
      
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

  const createChildCard = async () => {
    if (!problemId || !currentCard) return;
    
    try {
      // Determine parent card ID - if current card is already a child, use its parent
      const parentCardId = currentCard.parent_card_id || currentCard.id;
      
      const newCard = await invoke<Card>('create_card', {
        request: {
          problem_id: problemId,
          language: currentCard.language, // Inherit language from current card
          parent_card_id: parentCardId
        }
      });
      
      setCards(prev => [...prev, newCard]);
      setCurrentCard(newCard);
      navigate(`/problem/${problemId}/card/${newCard.id}`);
    } catch (err) {
      console.error('Failed to create child card:', err);
    }
  };

  const deleteCard = async () => {
    if (!currentCard || !currentCard.parent_card_id) {
      console.error('Cannot delete main card or no card selected');
      return;
    }

    try {
      setDeleteModal(prev => ({ ...prev, isDeleting: true }));

      // Call backend to delete the card
      await invoke('delete_card', { id: currentCard.id });

      // Update local state - remove the deleted card
      const updatedCards = cards.filter(card => card.id !== currentCard.id);
      setCards(updatedCards);

      // Navigate to appropriate card after deletion
      if (updatedCards.length > 0) {
        const allProblemCards = updatedCards
          .filter(card => card.problem_id === currentCard.problem_id)
          .sort((a, b) => a.card_number - b.card_number);

        if (allProblemCards.length > 0) {
          // Navigate to the first available card for this problem
          const targetCard = allProblemCards[0];
          setCurrentCard(targetCard);
          navigate(`/problem/${problemId}/card/${targetCard.id}`);
        } else {
          // No cards left for this problem, go back to dashboard
          navigate('/');
        }
      } else {
        // No cards left at all, go back to dashboard
        navigate('/');
      }

      // Close modal
      setDeleteModal({ isOpen: false, isDeleting: false });
      
    } catch (err) {
      console.error('Failed to delete card:', err);
      setDeleteModal(prev => ({ ...prev, isDeleting: false }));
      // Modal stays open on error so user can try again
    }
  };

  const navigateToCard = (direction: 'prev' | 'next') => {
    if (!currentCard) return;
    
    // Get all cards for this problem (now that getSiblingCards returns all cards)
    const allProblemCards = getSiblingCards(currentCard, cards);
    const currentIndex = allProblemCards.findIndex(c => c.id === currentCard.id);
    
    if (direction === 'prev') {
      if (currentIndex > 0) {
        // Navigate to previous card
        const targetCard = allProblemCards[currentIndex - 1];
        setCurrentCard(targetCard);
        navigate(`/problem/${problemId}/card/${targetCard.id}`);
      }
      // If at first card, do nothing
    } else {
      // direction === 'next'
      if (currentIndex < allProblemCards.length - 1) {
        // Navigate to next card
        const targetCard = allProblemCards[currentIndex + 1];
        setCurrentCard(targetCard);
        navigate(`/problem/${problemId}/card/${targetCard.id}`);
      } else {
        // At last card, create new card
        createNewCard();
      }
    }
  };

  const toggleTimer = async () => {
    try {
      if (!currentCard) return;
      
      console.warn('Timer functionality not implemented yet');
      // For now, just toggle local state
      setTimerState(prev => ({
        isRunning: !prev.isRunning,
        elapsedTime: prev.isRunning ? 0 : prev.elapsedTime
      }));
      
      // TODO: Implement when timer backend is ready
      // if (timerState.isRunning) {
      //   await invoke('stop_timer_session');
      // } else {
      //   await invoke('start_timer_session', { cardId: currentCard.id });
      // }
    } catch (err) {
      console.error('Timer error:', err);
    }
  };


  const toggleRecording = async () => {
    try {
      console.warn('Recording functionality not implemented yet');
      // For now, just toggle local state
      setRecordingState(prev => ({
        isRecording: !prev.isRecording
      }));
      
      // TODO: Implement when audio backend is ready
      // if (recordingState.isRecording) {
      //   await invoke('stop_recording');
      // } else {
      //   await invoke('start_recording');
      // }
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
                onClick={() => navigateToCard('next')}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Navigate to next card or create new card"
              >
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            </div>

            {/* Delete Button - Only show for child cards */}
            {currentCard?.parent_card_id && (
              <button
                onClick={() => setDeleteModal({ isOpen: true, isDeleting: false })}
                className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400"
                title="Delete child card"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            )}

            {/* Timer */}
            <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <button
                onClick={toggleTimer}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title="Timer (UI only - backend integration pending)"
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
              title="Recording (UI only - backend integration pending)"
            >
              <MicrophoneIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content - Unified Workspace */}
      <div className="flex-1 flex overflow-hidden">
        <ResizableWorkspace
          problemPanel={
            <WorkspaceProblemPanel problem={problem} />
          }
          codeEditor={
            <div className="bg-gray-50 dark:bg-gray-900 relative h-full">
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
                  containerRef={contentContainerRef}
                  siblingMinHeight={300}
                  useWorkspace={true}
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
          }
          notesEditor={
            <div className="bg-white dark:bg-gray-800 relative h-full">
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
          }
          onLayoutChange={(layout) => {
            // Optional: handle layout changes for debugging or analytics
            console.debug('Workspace layout changed:', layout);
          }}
        />
      </div>
      
      {/* Delete Card Modal */}
      <DeleteCardModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, isDeleting: false })}
        onConfirm={deleteCard}
        card={currentCard}
        isDeleting={deleteModal.isDeleting}
      />
    </div>
  );
}