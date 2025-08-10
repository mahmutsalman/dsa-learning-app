import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
// Icons are now used in WorkspaceHeader component
import { Problem, Card } from '../types';
import { ResizableMonacoEditor } from '../components/ResizableMonacoEditor';
import { QuillEditor } from '../components/QuillEditor';
// LanguageSelector is now used in WorkspaceHeader component
// import ResizableProblemDescriptionPanel from '../components/ResizableProblemDescriptionPanel';
import ResizableWorkspace from '../components/workspace/ResizableWorkspace';
import WorkspaceProblemPanel from '../components/workspace/WorkspaceProblemPanel';
import { WorkspaceHeader } from '../components/WorkspaceHeader';
import { WorkspaceContext } from '../components/workspace/WorkspaceContext';
import { useWorkspaceLayout } from '../components/workspace/useWorkspaceLayout';
import DeleteCardModal from '../components/DeleteCardModal';
import SessionHistory from '../components/SessionHistory';
import { useAutoSave } from '../hooks/useAutoSave';
import { useTimer } from '../hooks/useTimer';
import { getSiblingCards } from '../utils/databaseAnalysis';

export default function ProblemCard() {
  const { problemId, cardId } = useParams();
  const navigate = useNavigate();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordingState, setRecordingState] = useState({ isRecording: false });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, isDeleting: false });
  const [sessionHistory, setSessionHistory] = useState({ isOpen: false });
  
  // Timer functionality - integrated with backend
  const timer = useTimer(currentCard?.id);

  // Helper function to format time display with validation
  const formatTimeDisplay = (seconds: number, showSeconds: boolean = true): string => {
    // Input validation and sanitization
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
      return showSeconds ? '0s' : '00:00';
    }
    
    // Ensure integer seconds
    const safeSeconds = Math.floor(Math.abs(seconds));
    
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const secs = safeSeconds % 60;
    
    // Validate calculated values
    if (isNaN(hours) || isNaN(minutes) || isNaN(secs)) {
      return showSeconds ? '0s' : '00:00';
    }
    
    if (showSeconds) {
      if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
      } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
      } else {
        return `${secs}s`;
      }
    } else {
      // For timer display, always show MM:SS format
      return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  };

  // Editor state
  const [code, setCode] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [language, setLanguage] = useState<string>('javascript');
  const [isDark, setIsDark] = useState<boolean>(false);

  // Ref for the main content container to help calculate dynamic constraints
  const contentContainerRef = useRef<HTMLDivElement>(null);

  // Workspace layout management
  const { state, actions } = useWorkspaceLayout({ 
    onLayoutChange: (layout) => {
      // Trigger Monaco Editor resize when workspace layout changes
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 100);
      // Optional: handle layout changes for debugging or analytics
      // console.debug('Workspace layout changed:', layout);
    }
  });

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

  // Problem description update handler
  const handleDescriptionUpdate = useCallback(async (problemId: string, newDescription: string): Promise<boolean> => {
    try {
      const updatedProblem = await invoke<Problem>('update_problem', {
        request: {
          id: problemId,
          description: newDescription
        }
      });
      
      // Update local problem state
      setProblem(updatedProblem);
      return true;
    } catch (err) {
      console.error('Failed to update problem description:', err);
      return false;
    }
  }, []);

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

  const refreshCardData = async () => {
    if (!problemId || !currentCard) return;
    
    try {
      // Reload cards to get updated total_duration
      const cardsResult = await invoke<Card[]>('get_cards_for_problem', { problemId });
      setCards(cardsResult);
      
      // Update the current card with refreshed data
      const updatedCurrentCard = cardsResult.find(c => c.id === currentCard.id);
      if (updatedCurrentCard) {
        setCurrentCard(updatedCurrentCard);
      }
      
      // Refresh timer state to update total duration display
      await timer.refreshTimerState();
    } catch (err) {
      console.error('Failed to refresh card data:', err);
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
      
      if (timer.timerState.isRunning) {
        await timer.stopTimer();
      } else {
        await timer.startTimer(currentCard.id);
      }
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
    <WorkspaceContext.Provider value={{ state, actions }}>
      <div className="flex-1 flex flex-col h-full relative">
        {/* Content - Unified Workspace */}
        <div className="flex-1 flex overflow-hidden">
          <ResizableWorkspace
          header={
            <WorkspaceHeader
              problem={problem}
              currentCard={currentCard}
              cards={cards}
              language={language}
              onLanguageChange={setLanguage}
              timer={timer}
              codeAutoSave={codeAutoSave}
              notesAutoSave={notesAutoSave}
              languageAutoSave={languageAutoSave}
              recordingState={recordingState}
              onToggleTimer={toggleTimer}
              onToggleRecording={toggleRecording}
              onNavigateCard={navigateToCard}
              onDeleteCard={() => setDeleteModal({ isOpen: true, isDeleting: false })}
              onOpenSessionHistory={() => setSessionHistory({ isOpen: true })}
              formatTimeDisplay={formatTimeDisplay}
              getSiblingCards={getSiblingCards}
            />
          }
          problemPanel={
            <WorkspaceProblemPanel 
              problem={problem} 
              onDescriptionUpdate={handleDescriptionUpdate}
            />
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
      
      {/* Session History Modal */}
      <SessionHistory
        cardId={currentCard?.id}
        isOpen={sessionHistory.isOpen}
        onClose={() => setSessionHistory({ isOpen: false })}
        onSessionDeleted={refreshCardData}
      />
    </div>
    </WorkspaceContext.Provider>
  );
}