import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
// Icons are now used in WorkspaceHeader component
import { Problem, Card } from '../types';
import { ResizableMonacoEditor } from '../components/ResizableMonacoEditor';
import { EnhancedMonacoEditor } from '../components/EnhancedMonacoEditor';
import { QuillEditor } from '../components/QuillEditor';
// LanguageSelector is now used in WorkspaceHeader component
// import ResizableProblemDescriptionPanel from '../components/ResizableProblemDescriptionPanel';
import ResizableWorkspace from '../components/workspace/ResizableWorkspace';
import EnhancedResizableWorkspace from '../components/workspace/EnhancedResizableWorkspace';
import WorkspaceProblemPanel from '../components/workspace/WorkspaceProblemPanel';
import EnhancedWorkspaceProblemPanel from '../components/workspace/EnhancedWorkspaceProblemPanel';
import { WorkspaceHeader } from '../components/WorkspaceHeader';
import { WorkspaceContext } from '../components/workspace/WorkspaceContext';
import { EnhancedWorkspaceProvider } from '../components/workspace/EnhancedWorkspaceContext';
import { useWorkspaceLayout } from '../components/workspace/useWorkspaceLayout';
import DeleteCardModal from '../components/DeleteCardModal';
import SessionHistory from '../components/SessionHistory';
import RecordingHistory from '../components/RecordingHistory';
import { useAutoSave } from '../hooks/useAutoSave';
import { useTimer } from '../hooks/useTimer';
import { useRecording } from '../hooks/useRecording';
import { getSiblingCards } from '../utils/databaseAnalysis';
import { useSolutionCard, solutionCardToCard, isShiftAction } from '../features/solution-card';
import { FocusModeShortcutHandler } from '../components/FocusModeShortcutHandler';

export default function ProblemCard() {
  // Track component renders for performance monitoring
  // const renderCount = 1; // Static value to prevent infinite render loop - unused
  // const componentStartTime = performance.now(); // Unused tracking variable
  
  const { problemId, cardId } = useParams();
  const navigate = useNavigate();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, isDeleting: false });
  const [sessionHistory, setSessionHistory] = useState({ isOpen: false });
  const [recordingHistory, setRecordingHistory] = useState({ isOpen: false });
  const [previousProblemId, setPreviousProblemId] = useState<string | null>(null);
  
  // Store original regular card when entering solution mode
  const originalCardRef = useRef<Card | null>(null);
  
  // Enhanced workspace feature flag
  const [useEnhancedWorkspace] = useState(true);
  
  // Timer functionality - integrated with backend
  const timer = useTimer(currentCard?.id);
  
  // Recording functionality - integrated with backend
  const recording = useRecording(currentCard?.id);

  // Solution card functionality
  const solutionCard = useSolutionCard({
    problemId: problemId || '',
    onSolutionToggle: async (isActive, card) => {
      console.debug('Solution card toggled:', { isActive, card });
      
      // Update editor state when solution card is toggled
      if (isActive && card) {
        // Entering solution mode - load solution card content
        console.debug('Loading solution card content into editor', {
          cardId: card.id,
          codeLength: card.code?.length || 0,
          notesLength: card.notes?.length || 0,
          language: card.language,
          codePreview: card.code?.substring(0, 50) || '(empty)',
          notesPreview: card.notes?.substring(0, 50) || '(empty)'
        });
        
        // Update editor state with solution card content
        // Use setTimeout to ensure this runs after any synchronous state updates
        // This prevents race conditions between onSolutionToggle and useEffect[currentCard]
        const operationId = `solutionToggle-enter-${Date.now()}`;
        
        // Log the setTimeout usage for race condition prevention analysis
        
        // Log race condition prevention measure
        
        setTimeout(async () => {
          
          // Log timeout execution start
          
          console.debug('Applying solution card content to editor (after timeout)', {
            operationId,
            codeToApply: card.code?.substring(0, 50) || '(empty)',
            notesToApply: card.notes?.substring(0, 50) || '(empty)',
            languageToApply: card.language
          });
          
          // Apply the content changes
          debugSetCode(card.code || '');
          debugSetNotes(card.notes || '');
          setLanguage(card.language || 'javascript');
          
          // Performance tracking removed
          
          // Validate that content was applied correctly
          
          // Log successful timeout completion
        }, 0);
      } else if (!isActive && currentCard) {
        // Exiting solution mode - restore regular card content
        console.debug('Restoring regular card content to editor', {
          cardId: currentCard.id,
          codeLength: currentCard.code?.length || 0,
          notesLength: currentCard.notes?.length || 0,
          language: currentCard.language
        });
        
        // Update editor state with regular card content
        debugSetCode(currentCard.code || '');
        debugSetNotes(currentCard.notes || '');
        setLanguage(currentCard.language || 'javascript');
      }
    },
    onError: (error) => {
      console.error('Solution card error:', error);
      setError(error);
    }
  });

  // Track component renders and performance - DISABLED to prevent infinite loops
  // useEffect(() => {
  //   const renderDuration = Math.round(performance.now() - componentStartTime);
  //   
  // });

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

  // Throttled debug wrapper for setNotes - prevents excessive logging during typing
  const debugSetNotes = useCallback((newNotes: string) => {
    setNotes(newNotes);
  }, [notes, code, language, currentCard]);

  // Throttled debug wrapper for setCode - prevents excessive logging during typing
  const debugSetCode = useCallback((newCode: string) => {
    setCode(newCode);
  }, [code, notes, language, currentCard]);
  
  
  const [isDark, setIsDark] = useState<boolean>(false);

  // Ref for the main content container to help calculate dynamic constraints
  const contentContainerRef = useRef<HTMLDivElement>(null);
  
  // Throttle Monaco Editor resize events to prevent infinite loops
  const resizeThrottleRef = useRef<{ lastResize: number; timeoutId?: number }>({ lastResize: 0 });
  
  const throttledResizeDispatch = useCallback(() => {
    const now = Date.now();
    
    if (now - resizeThrottleRef.current.lastResize > 500) { // Throttle to max once per 500ms
      if (resizeThrottleRef.current.timeoutId) {
        clearTimeout(resizeThrottleRef.current.timeoutId);
      }
      
      resizeThrottleRef.current.timeoutId = window.setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        resizeThrottleRef.current.lastResize = now;
      }, 100);
    }
  }, []);

  // Workspace layout management
  const { state, actions } = useWorkspaceLayout({ 
    onLayoutChange: useCallback((_layout: any) => {
      // Trigger Monaco Editor resize when workspace layout changes (throttled)
      throttledResizeDispatch();
    }, [throttledResizeDispatch])
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
    
    // Check if anything actually needs to be saved
    const hasCodeChange = code !== currentCard.code;
    const hasNotesChange = notes !== currentCard.notes;
    const hasLanguageChange = language !== currentCard.language;
    
    if (!hasCodeChange && !hasNotesChange && !hasLanguageChange) {
      return; // Nothing to save
    }
    
    try {
      const updatedCard = await invoke<Card | null>('update_card', {
        cardId: currentCard.id,
        code: hasCodeChange ? code : null,
        notes: hasNotesChange ? notes : null,
        language: hasLanguageChange ? language : null,
      });
      
      // Only update state if we got a card back and it's actually different
      if (updatedCard && (
        updatedCard.code !== currentCard.code || 
        updatedCard.notes !== currentCard.notes || 
        updatedCard.language !== currentCard.language ||
        (updatedCard as any).updated_at !== (currentCard as any).updated_at
      )) {
        setCurrentCard(updatedCard);
        setCards(prev => prev.map(card => 
          card.id === updatedCard.id ? updatedCard : card
        ));
        
        // Update our tracking reference
        lastSavedValuesRef.current = {
          code: updatedCard.code || '',
          notes: updatedCard.notes || '',
          language: updatedCard.language || 'javascript'
        };
      }
      
    } catch (err) {
      console.error('Failed to save card:', err);
      throw err;
    }
  }, [currentCard, code, notes, language]);

  // Create a stable reference to prevent unnecessary saves
  const lastSavedValuesRef = useRef({ code: '', notes: '', language: '' });
  
  // Initialize the saved values reference when currentCard changes
  useEffect(() => {
    if (currentCard) {
      lastSavedValuesRef.current = {
        code: currentCard.code || '',
        notes: currentCard.notes || '',
        language: currentCard.language || 'javascript'
      };
    }
  }, [currentCard?.id, currentCard?.code, currentCard?.notes, currentCard?.language]);
  
  // Auto-save hooks with solution mode coordination and improved change detection
  const codeAutoSave = useAutoSave(code, async () => {
    // Don't auto-save during solution mode transitions or when loading
    if (solutionCard.state.isLoading) {
      return;
    }
    
    // Only save if the code has actually changed from what we last saved
    if (code === lastSavedValuesRef.current.code) {
      return;
    }
    
    // Save to solution card if in solution mode, otherwise save to regular card
    if (solutionCard.state.isActive && solutionCard.state.solutionCard) {
      // Save to solution card
      if (code !== solutionCard.state.solutionCard.code) {
        await solutionCard.actions.updateCode(code, language);
        lastSavedValuesRef.current.code = code;
      }
    } else if (currentCard && code !== currentCard.code) {
      // Save to regular card
      await saveCard();
      lastSavedValuesRef.current.code = code;
    }
  }, { delay: 3000, enabled: !!currentCard && !solutionCard.state.isLoading });

  const notesAutoSave = useAutoSave(notes, async () => {
    // Don't auto-save during solution mode transitions or when loading
    if (solutionCard.state.isLoading) {
      return;
    }
    
    // Only save if the notes have actually changed from what we last saved
    if (notes === lastSavedValuesRef.current.notes) {
      return;
    }
    
    // Save to solution card if in solution mode, otherwise save to regular card
    if (solutionCard.state.isActive && solutionCard.state.solutionCard) {
      // Save to solution card
      if (notes !== solutionCard.state.solutionCard.notes) {
        await solutionCard.actions.updateNotes(notes);
        lastSavedValuesRef.current.notes = notes;
      }
    } else if (currentCard && notes !== currentCard.notes) {
      // Save to regular card
      await saveCard();
      lastSavedValuesRef.current.notes = notes;
    }
  }, { delay: 3000, enabled: !!currentCard && !solutionCard.state.isLoading });

  const languageAutoSave = useAutoSave(language, async () => {
    // Don't auto-save during solution mode transitions or when loading
    if (solutionCard.state.isLoading) {
      return;
    }
    
    // Only save if the language has actually changed from what we last saved
    if (language === lastSavedValuesRef.current.language) {
      return;
    }
    
    // Save to solution card if in solution mode, otherwise save to regular card
    if (solutionCard.state.isActive && solutionCard.state.solutionCard) {
      // Save to solution card (language changes are handled via updateCode)
      if (language !== solutionCard.state.solutionCard.language) {
        await solutionCard.actions.updateCode(code, language);
        lastSavedValuesRef.current.language = language;
      }
    } else if (currentCard && language !== currentCard.language) {
      // Save to regular card
      await saveCard();
      lastSavedValuesRef.current.language = language;
    }
  }, { delay: 2000, enabled: !!currentCard && !solutionCard.state.isLoading }); // Increased delay to prevent excessive saves

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

  // Cleanup originalCardRef when problem changes or component unmounts
  useEffect(() => {
    // Clear stored original card when switching problems to prevent memory leaks
    return () => {
      if (originalCardRef.current) {
        console.debug('ProblemCard: Cleaning up originalCardRef on problem change/unmount');
        originalCardRef.current = null;
      }
    };
  }, [problemId]);

  // Check for previous problem in session storage (for back navigation from related problems)
  useEffect(() => {
    const previousId = sessionStorage.getItem('previousProblem');
    if (previousId && previousId !== problemId) {
      setPreviousProblemId(previousId);
    } else {
      setPreviousProblemId(null);
    }
  }, [problemId]);

  useEffect(() => {
    console.debug('ProblemCard: Selecting card from cards array', {
      cardId,
      cardsLength: cards.length,
      cardIds: cards.map(c => c.id),
      cardsWithNotes: cards.filter(c => c.notes).map(c => ({ id: c.id, notesLength: c.notes?.length }))
    });
    
    // Production logging for card selection issues
    if (cards.length === 0) {
      console.warn('ProblemCard: No cards available for selection', {
        problemId,
        cardId,
        loadingState: loading
      });
      // Ensure currentCard is null when no cards available
      setCurrentCard(null);
      return;
    }
    
    if (cardId && cards.length > 0) {
      const card = cards.find(c => c.id === cardId);
      console.debug('ProblemCard: Found card by ID', {
        found: !!card,
        cardId: card?.id,
        hasNotes: !!card?.notes,
        notesContent: card?.notes
      });
      
      if (card) {
        setCurrentCard(card);
      } else {
        console.warn('ProblemCard: Requested cardId not found, using first card', {
          requestedCardId: cardId,
          availableCardIds: cards.map(c => c.id),
          usingCard: cards[0].id
        });
        setCurrentCard(cards[0]);
      }
    } else if (cards.length > 0) {
      console.debug('ProblemCard: Using first card', {
        firstCard: cards[0].id,
        hasNotes: !!cards[0].notes,
        notesContent: cards[0].notes
      });
      setCurrentCard(cards[0]);
      
      // Auto-navigate to proper URL with card ID for consistency
      if (!cardId) {
        console.log('ProblemCard: Navigating to first card URL for consistency');
        navigate(`/problem/${problemId}/card/${cards[0].id}`, { replace: true });
      }
    } else {
      console.warn('ProblemCard: No cards available and no fallback possible', {
        cardsLength: cards.length,
        problemId,
        cardId
      });
      setCurrentCard(null);
    }
  }, [cardId, cards, problemId, loading, navigate]);

  // Sync editor state when current card changes
  useEffect(() => {
    const operationId = `useEffect-currentCard-${Date.now()}`;
    
    // Log the start of this critical useEffect for race condition analysis
    
    console.debug('ProblemCard: Card changed, syncing editor state', {
      operationId,
      cardId: currentCard?.id,
      cardNotes: currentCard?.notes,
      cardCode: currentCard?.code,
      cardLanguage: currentCard?.language,
      notesLength: currentCard?.notes?.length || 0,
      isSolutionCard: currentCard?.is_solution || false,
      codePreview: currentCard?.code?.substring(0, 50) || '(empty)',
      solutionModeActive: solutionCard.state.isActive
    });
    
    if (currentCard) {
      
      // Only sync editor state with current card when NOT in solution mode
      // When in solution mode, the onSolutionToggle callback handles editor state
      if (!solutionCard.state.isActive) {
        // Log race condition avoidance - normal card sync path
        
        console.debug('ProblemCard: Syncing editor with regular card', {
          operationId,
          cardId: currentCard.id,
          syncingContent: true,
          codeToSync: currentCard.code?.substring(0, 50) || '(empty)',
          notesToSync: currentCard.notes?.substring(0, 50) || '(empty)'
        });
        
        // Validate before sync
        
        debugSetCode(currentCard.code || '');
        debugSetNotes(currentCard.notes || '');
        setLanguage(currentCard.language || 'javascript');
        
        // Post-sync validation
        setTimeout(async () => {
        }, 10);
      } else {
        // Log race condition prevention - skipping sync in solution mode
        
        console.debug('ProblemCard: Skipping editor sync - solution mode active', {
          operationId,
          solutionCardId: solutionCard.state.solutionCard?.id,
          preservingContent: true,
          currentEditorCode: code?.substring(0, 50) || '(empty)',
          currentEditorNotes: notes?.substring(0, 50) || '(empty)',
          raceConditionPrevented: true
        });
      }
    }
    
    // Log completion of this useEffect execution
    
  }, [currentCard, solutionCard.state.isActive]);

  const loadProblem = async () => {
    const operationId = `loadProblem-${problemId}-${Date.now()}`;    try {
      setLoading(true);
      setError(null);
      
      // Debug logging removed for performance
      
      console.log('ProblemCard: Loading problem and cards', { problemId, operationId });
      
      const [problemResult, cardsResult] = await Promise.all([
        invoke<Problem>('get_problem_by_id', { id: problemId }),
        invoke<Card[]>('get_cards_for_problem', { problemId })
      ]);
      
      console.log('ProblemCard: Loaded from backend', {
        problemId,
        problemTitle: problemResult.title,
        cardCount: cardsResult.length,
        cardsData: cardsResult.map(c => ({
          id: c.id,
          hasNotes: !!c.notes,
          notesLength: c.notes?.length || 0,
          notesPreview: c.notes ? c.notes.substring(0, 50) + '...' : 'empty'
        }))
      });
      
      setProblem(problemResult);
      
      // If no cards exist, create the first one before setting cards
      if (cardsResult.length === 0) {
        console.warn('ProblemCard: No cards found, creating first card');
        try {
          const newCard = await invoke<Card>('create_card', {
            request: {
              problem_id: problemId,
              language: 'javascript',
              parent_card_id: null
            }
          });
          
          console.log('ProblemCard: Created first card', {
            cardId: newCard.id,
            problemId: newCard.problem_id
          });
          
          setCards([newCard]);
          setCurrentCard(newCard);
          
          // Navigate to the new card URL
          navigate(`/problem/${problemId}/card/${newCard.id}`, { replace: true });
        } catch (createErr) {
          console.error('ProblemCard: Failed to create first card', createErr);
          setError(`Failed to create card: ${createErr}`);
          setCards([]);
        }
      } else {
        setCards(cardsResult);
      }
      
    } catch (err) {
      const errorMessage = err as string;
      setError(errorMessage);
      console.error('ProblemCard: Failed to load problem', { problemId, error: errorMessage, operationId });
      
      
      setCards([]);
      setCurrentCard(null);
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
      console.log('ProblemCard: Creating new card', { problemId });
      
      const newCard = await invoke<Card>('create_card', {
        request: {
          problem_id: problemId,
          language: 'javascript',
          parent_card_id: null
        }
      });
      
      console.log('ProblemCard: New card created successfully', {
        cardId: newCard.id,
        problemId: newCard.problem_id
      });
      
      setCards(prev => [...prev, newCard]);
      setCurrentCard(newCard);
      navigate(`/problem/${problemId}/card/${newCard.id}`);
    } catch (err) {
      console.error('ProblemCard: Failed to create new card:', err);
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

  // Solution card toggle handler with comprehensive error handling and performance monitoring
  const handleSolutionToggle = useCallback(async (event: React.KeyboardEvent | React.MouseEvent) => {
    // Start sequence tracking for content loading operations
    
    // Prevent rapid toggles - check if solution card is already processing
    if (solutionCard.state.isLoading) {
        
        
        // Complete sequence tracking
        return;
      }
    
    // Log the initial state before any actions

    if (!isShiftAction(event)) {
      // Not shift+click, handle regular navigation
      navigateToCard('next');
      return;
    }

    // This is a shift+click - check current mode and act accordingly

    try {
      if (solutionCard.state.isActive) {
        // Already in solution mode - exit back to regular cards
        
        solutionCard.actions.exitSolution();
        
        // Restore original regular card data
        const originalCard = originalCardRef.current;
        if (originalCard) {
          
          // Use React's batch update approach for more reliable state restoration
          // First restore the card context, then update editor states synchronously
          setCurrentCard(originalCard);
          
          // Set editor states immediately to avoid timing issues
          // These will trigger re-renders but ensure consistent state
          debugSetCode(originalCard.code || '');
          debugSetNotes(originalCard.notes || '');
          setLanguage(originalCard.language || 'javascript');
          
          // Clear the stored original card to prevent memory leaks
          originalCardRef.current = null;
          
        } else {
          
          // Fallback: Try to restore to the current card if available
          if (currentCard && !solutionCard.state.isActive) {
            
            // Don't change the current card, just ensure editor state is consistent
            debugSetCode(currentCard.code || '');
            debugSetNotes(currentCard.notes || '');
            setLanguage(currentCard.language || 'javascript');
          }
        }
        
      } else {
        // Not in solution mode - enter solution view
        
        // Store the current regular card before switching to solution
        // CRITICAL: Store the current editor state, not just the card database state
        if (currentCard) {
          originalCardRef.current = { 
            ...currentCard,
            // Override with current editor state to preserve unsaved changes
            code: code,
            notes: notes,
            language: language
          };
        }
        
        const toggleResult = await solutionCard.actions.toggle();
        
        
        if (toggleResult?.isViewingSolution && toggleResult?.card) {
          // Update editors with solution data
          const solution = solutionCardToCard(toggleResult.card);
          
          
          
          // Use React's batch update approach for reliable solution state loading
          // First set the card context, then update editor states synchronously
          setCurrentCard(solution);
          
          // Set editor states immediately to ensure solution data is loaded correctly
          // This matches the exit solution pattern and ensures consistent behavior
          debugSetCode(solution.code || '');
          debugSetNotes(solution.notes || '');
          setLanguage(solution.language || 'javascript');
          
        } else {
        }
      }
    } catch (error) {
      // Error handling without performance tracking
      
      // Log comprehensive error information
      
      
      console.error('Failed to toggle solution view:', error);
      
      // Attempt graceful recovery - ensure editor state is consistent
      try {
        if (currentCard) {
          
          // Force editor to match current card state
          debugSetCode(currentCard.code || '');
          debugSetNotes(currentCard.notes || '');
          setLanguage(currentCard.language || 'javascript');
          
          // Validate recovery
          setTimeout(async () => {
          }, 10);
        }
      } catch (recoveryError) {
      }
    } finally {
      // Performance tracking removed
      
      
      // Complete sequence tracking
    }

  }, [solutionCard, currentCard, navigateToCard, problemId, code, notes, language]);

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
      if (!currentCard) {
        console.error('No card selected for recording');
        return;
      }

      if (recording.recordingState.isRecording) {
        await recording.stopRecording(currentCard.id);
      } else {
        await recording.startRecording(currentCard.id);
      }
    } catch (err) {
      console.error('Recording error:', err);
    }
  };

  // Handle back navigation to previous related problem
  const handleBackToPreviousProblem = () => {
    if (previousProblemId) {
      // Clear the session storage to avoid navigation loops
      sessionStorage.removeItem('previousProblem');
      navigate(`/problem/${previousProblemId}`);
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

  // Render enhanced workspace if enabled, otherwise fallback to original
  if (useEnhancedWorkspace) {
    return (
      <EnhancedWorkspaceProvider>
        <FocusModeShortcutHandler />
        <div className={`flex-1 flex flex-col h-full relative transition-all duration-200 ease-in-out ${
          solutionCard.state.isActive 
            ? 'bg-gradient-to-br from-red-50/30 via-white to-red-50/20 dark:from-red-950/10 dark:via-gray-900 dark:to-red-950/5' 
            : ''
        }`}>
          {/* Enhanced Workspace */}
          <EnhancedResizableWorkspace
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
                recordingState={recording.recordingState}
                recordingsCount={recording.recordingsCount}
                onToggleTimer={toggleTimer}
                onToggleRecording={toggleRecording}
                onNavigateCard={navigateToCard}
                onDeleteCard={() => setDeleteModal({ isOpen: true, isDeleting: false })}
                onOpenSessionHistory={() => setSessionHistory({ isOpen: true })}
                onOpenRecordingHistory={() => setRecordingHistory({ isOpen: true })}
                formatTimeDisplay={formatTimeDisplay}
                getSiblingCards={getSiblingCards}
                previousProblemId={previousProblemId}
                onBackToPreviousProblem={handleBackToPreviousProblem}
                isViewingSolution={solutionCard.state.isActive}
                onSolutionToggle={handleSolutionToggle}
              />
            }
            problemPanel={
              <EnhancedWorkspaceProblemPanel 
                problem={problem} 
                onDescriptionUpdate={handleDescriptionUpdate}
              />
            }
            codeEditor={
              <div className={`h-full flex flex-col transition-all duration-200 ease-in-out ${
                solutionCard.state.isActive
                  ? 'bg-red-50/50 dark:bg-red-950/20 border-l-4 border-red-300 dark:border-red-700'
                  : 'bg-gray-50 dark:bg-gray-900'
              }`}>
                {/* Editor container - takes remaining height */}
                <div className="flex-1 min-h-0">
                  {currentCard ? (
                    <EnhancedMonacoEditor
                      value={code}
                      language={language}
                      theme={isDark ? 'vs-dark' : 'vs-light'}
                      onChange={setCode}
                      onSave={handleManualSave}
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
              </div>
            }
            notesEditor={
              <div className={`h-full flex flex-col transition-all duration-200 ease-in-out ${
                solutionCard.state.isActive
                  ? 'bg-red-50/30 dark:bg-red-950/10 border-l-4 border-red-300 dark:border-red-700'
                  : 'bg-white dark:bg-gray-800'
              }`}>
                {/* Notes container - takes remaining height */}
                <div className="flex-1 min-h-0">
                  {currentCard ? (
                    <QuillEditor
                      value={notes}
                      theme={isDark ? 'dark' : 'light'}
                      onChange={debugSetNotes}
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
              </div>
            }
            onLayoutChange={(layout) => {
              // Optional: Handle layout changes
              console.debug('Enhanced workspace layout changed:', layout);
            }}
          />
          
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
          
          {/* Recording History Modal */}
          <RecordingHistory
            cardId={currentCard?.id}
            isOpen={recordingHistory.isOpen}
            onClose={() => setRecordingHistory({ isOpen: false })}
          />
          
          {/* Global Audio Player - REMOVED FOR REBUILD */}
        </div>
      </EnhancedWorkspaceProvider>
    );
  }

  // Fallback to original workspace system
  return (
    <WorkspaceContext.Provider value={{ state, actions }}>
      <div className={`flex-1 flex flex-col h-full relative transition-all duration-200 ease-in-out ${
        solutionCard.state.isActive 
          ? 'bg-gradient-to-br from-red-50/30 via-white to-red-50/20 dark:from-red-950/10 dark:via-gray-900 dark:to-red-950/5' 
          : ''
      }`}>
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
              recordingState={recording.recordingState}
              recordingsCount={recording.recordingsCount}
              onToggleTimer={toggleTimer}
              onToggleRecording={toggleRecording}
              onNavigateCard={navigateToCard}
              onDeleteCard={() => setDeleteModal({ isOpen: true, isDeleting: false })}
              onOpenSessionHistory={() => setSessionHistory({ isOpen: true })}
              onOpenRecordingHistory={() => setRecordingHistory({ isOpen: true })}
              formatTimeDisplay={formatTimeDisplay}
              getSiblingCards={getSiblingCards}
              previousProblemId={previousProblemId}
              onBackToPreviousProblem={handleBackToPreviousProblem}
              isViewingSolution={solutionCard.state.isActive}
              onSolutionToggle={handleSolutionToggle}
            />
          }
          problemPanel={
            <WorkspaceProblemPanel 
              problem={problem} 
              onDescriptionUpdate={handleDescriptionUpdate}
            />
          }
          codeEditor={
            <div className={`relative h-full transition-all duration-200 ease-in-out ${
              solutionCard.state.isActive
                ? 'bg-red-50/50 dark:bg-red-950/20 border-l-4 border-red-300 dark:border-red-700'
                : 'bg-gray-50 dark:bg-gray-900'
            }`}>
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
            <div className={`relative h-full transition-all duration-200 ease-in-out ${
              solutionCard.state.isActive
                ? 'bg-red-50/30 dark:bg-red-950/10 border-l-4 border-red-300 dark:border-red-700'
                : 'bg-white dark:bg-gray-800'
            }`}>
              {currentCard ? (
                <QuillEditor
                  value={notes}
                  theme={isDark ? 'dark' : 'light'}
                  onChange={debugSetNotes}
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
      
      {/* Recording History Modal */}
      <RecordingHistory
        cardId={currentCard?.id}
        isOpen={recordingHistory.isOpen}
        onClose={() => setRecordingHistory({ isOpen: false })}
      />
      
      {/* Global Audio Player - REMOVED FOR REBUILD */}
    </div>
    </WorkspaceContext.Provider>
  );
}