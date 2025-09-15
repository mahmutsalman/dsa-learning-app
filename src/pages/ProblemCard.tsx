import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
// Icons are now used in WorkspaceHeader component
import { Problem, Card } from '../types';
import { useCardImages } from '../hooks/useCardImages';
import { CardImageGallery } from '../components/CardImageGallery';
import { CardImageButton } from '../components/CardImageButton';
import { CardImageModal } from '../components/CardImageModal';
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
// Enhanced state management hooks
import { useCardModeStateMachine, EditorState, CardMode } from '../hooks/useCardModeStateMachine';
// import { useEnhancedForceSave } from '../hooks/useEnhancedForceSave'; // Available for future use
// import { useDebouncedEditorSync } from '../hooks/useDebouncedEditorSync'; // Available for future use
// import { useUnifiedAutoSave } from '../hooks/useUnifiedAutoSave';
import { useStateValidationGuards } from '../hooks/useStateValidationGuards';
import { answerCardLogger } from '../utils/answerCardLogger';
import { comprehensiveLogger } from '../utils/comprehensiveLogger';

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

  // Cache for regular card content to prevent overwriting when switching from answer mode
  const regularCardCacheRef = useRef<{
    code: string;
    notes: string;
    language: string;
    cardId: string;
  } | null>(null);

  // Track when we're intentionally switching modes to prevent race conditions
  const isSwitchingModesRef = useRef<boolean>(false);
  
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
        // Exiting solution mode - restoration now handled by handleSolutionToggle cache mechanism
        console.debug('Solution mode exited - restoration handled by cache mechanism', {
          cardId: currentCard.id,
          note: 'Content restoration is handled by handleSolutionToggle cache to prevent overwriting'
        });

        // IMPORTANT: Do not restore content here as it would override the cache restoration
        // The handleSolutionToggle function handles content restoration using regularCardCacheRef
        // to prevent answer card content from overwriting regular card content
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

  // Editor state (will be enhanced with state management below)
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

  // Card Images state and handlers
  const {
    images: cardImages,
    imageDataUrls: cardImageDataUrls,
    saveImage: saveCardImage,
    deleteImage: deleteCardImage,
    updatePositions: updateCardImagePositions,
  } = useCardImages(currentCard?.id ?? null);

  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [currentModalImageId, setCurrentModalImageId] = useState<string | null>(null);

  const openImageModal = useCallback((imageId: string) => {
    setCurrentModalImageId(imageId);
    setIsImageModalOpen(true);
  }, []);

  const closeImageModal = useCallback(() => {
    setIsImageModalOpen(false);
  }, []);

  const handleGalleryImageClick = useCallback((imageId: string, _imageUrl: string) => {
    openImageModal(imageId);
  }, [openImageModal]);

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
      // Avoid overwriting regular cards while viewing solution card
      if (solutionCard.state.isActive && solutionCard.state.solutionCard) {
        const solId = solutionCard.state.solutionCard.id;
        console.debug('saveCard: Routing to solution card save', {
          solId,
          hasCodeChange,
          hasNotesChange,
          hasLanguageChange
        });

        if (hasCodeChange || hasLanguageChange) {
          await solutionCard.actions.saveCodeImmediately(code, language);
        }
        if (hasNotesChange) {
          await solutionCard.actions.saveNotesImmediately(notes);
        }

        // Update last saved snapshot
        lastSavedValuesRef.current = {
          code: code || '',
          notes: notes || '',
          language: language || 'javascript'
        };

        return; // Do not update regular card state while in solution mode
      }
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
    if (solutionCard.state.isLoading || isSwitchingModesRef.current) {
      return;
    }

    // Only save if the code has actually changed from what we last saved
    if (code === lastSavedValuesRef.current.code) {
      return;
    }

    if (currentCard && code !== currentCard.code) {
      try {
        if (solutionCard.state.isActive && solutionCard.state.solutionCard) {
          // Route to solution API while viewing solution
          await solutionCard.actions.updateCode(code, language);
        } else if (currentCard.is_solution) {
          const startTime = Date.now();
          await comprehensiveLogger.logFrontendOperation(
            'ANSWER_CARD_AUTO_SAVE_CODE',
            'STARTING',
            {
              cardId: currentCard.id,
              codeLength: code.length,
              language,
              oldCode: lastSavedValuesRef.current.code,
              problemId: problemId || 'unknown'
            }
          );

          // Use the same saveCard function - it works for all cards!
          await saveCard();

          const executionTime = Date.now() - startTime;
          await comprehensiveLogger.logAnswerCardAutoSaveComplete(currentCard.id, 'code', code, true, undefined, executionTime);

          await answerCardLogger.logAutoSaveTriggered(
            problemId || 'unknown',
            problem?.title || 'Unknown Problem',
            currentCard.id,
            'code',
            code
          );
        } else {
          // Regular card - just save normally
          await saveCard();
        }

        lastSavedValuesRef.current.code = code;
      } catch (error) {
        if (currentCard.is_solution) {
          const executionTime = Date.now();
          const errorMessage = error instanceof Error ? error.message : String(error);
          await comprehensiveLogger.logAnswerCardAutoSaveComplete(currentCard.id, 'code', code, false, errorMessage, executionTime);
        }
        console.error('Auto-save failed:', error);
      }
    }
  }, { delay: 3000, enabled: !!currentCard && !solutionCard.state.isLoading });

  const notesAutoSave = useAutoSave(notes, async () => {
    // Don't auto-save during solution mode transitions or when loading
    if (solutionCard.state.isLoading || isSwitchingModesRef.current) {
      return;
    }

    // Only save if the notes have actually changed from what we last saved
    if (notes === lastSavedValuesRef.current.notes) {
      return;
    }

    if (currentCard && notes !== currentCard.notes) {
      try {
        if (solutionCard.state.isActive && solutionCard.state.solutionCard) {
          // Route to solution API while viewing solution
          await solutionCard.actions.updateNotes(notes);
        } else if (currentCard.is_solution) {
          const startTime = Date.now();
          await comprehensiveLogger.logFrontendOperation(
            'ANSWER_CARD_AUTO_SAVE_NOTES',
            'STARTING',
            {
              cardId: currentCard.id,
              notesLength: notes.length,
              oldNotes: lastSavedValuesRef.current.notes,
              problemId: problemId || 'unknown'
            }
          );

          // Use the same saveCard function - it works for all cards!
          await saveCard();

          const executionTime = Date.now() - startTime;
          await comprehensiveLogger.logAnswerCardAutoSaveComplete(currentCard.id, 'notes', notes, true, undefined, executionTime);

          await answerCardLogger.logAutoSaveTriggered(
            problemId || 'unknown',
            problem?.title || 'Unknown Problem',
            currentCard.id,
            'notes',
            notes
          );
        } else {
          // Regular card - just save normally
          await saveCard();
        }

        lastSavedValuesRef.current.notes = notes;
      } catch (error) {
        if (currentCard.is_solution) {
          const executionTime = Date.now();
          const errorMessage = error instanceof Error ? error.message : String(error);
          await comprehensiveLogger.logAnswerCardAutoSaveComplete(currentCard.id, 'notes', notes, false, errorMessage, executionTime);
        }
        console.error('Auto-save failed:', error);
      }
    }
  }, { delay: 3000, enabled: !!currentCard && !solutionCard.state.isLoading });

  const languageAutoSave = useAutoSave(language, async () => {
    // Don't auto-save during solution mode transitions or when loading
    if (solutionCard.state.isLoading || isSwitchingModesRef.current) {
      return;
    }

    // Only save if the language has actually changed from what we last saved
    if (language === lastSavedValuesRef.current.language) {
      return;
    }

    if (currentCard && language !== currentCard.language) {
      try {
        if (solutionCard.state.isActive && solutionCard.state.solutionCard) {
          await solutionCard.actions.updateCode(code, language);
        } else {
          await saveCard();
        }
        lastSavedValuesRef.current.language = language;
      } catch (error) {
        console.error('Language auto-save failed:', error);
      }
    }
  }, { delay: 2000, enabled: !!currentCard && !solutionCard.state.isLoading }); // Increased delay to prevent excessive saves

  // Force save function to ensure data is saved before card switching (legacy - replaced by unifiedAutoSave)
  /*
  const forceSave = useCallback(async () => {
    try {
      // Cancel all pending auto-saves first to prevent conflicts
      console.debug('Cancelling pending auto-saves before force save');
      codeAutoSave.cancel();
      notesAutoSave.cancel();
      languageAutoSave.cancel();

      if (solutionCard.state.isActive && solutionCard.state.solutionCard) {
        // Currently viewing solution card - save solution card data IMMEDIATELY
        console.debug('Force saving solution card data before switch', {
          cardId: solutionCard.state.solutionCard.id,
          codeLength: code.length,
          notesLength: notes.length,
          language
        });
        await solutionCard.actions.saveCodeImmediately(code, language);
        await solutionCard.actions.saveNotesImmediately(notes);
        console.debug('✅ Solution card data saved successfully before switch');
      } else if (currentCard) {
        // Currently viewing regular card - save regular card data
        console.debug('Force saving regular card data before switch');
        await saveCard();
        console.debug('✅ Regular card data saved successfully before switch');
      }
    } catch (err) {
      console.error('Force save failed:', err);
      // Don't throw - allow the switch to continue even if save fails
    }
  }, [solutionCard, currentCard, code, notes, language, saveCard, codeAutoSave, notesAutoSave, languageAutoSave]);
  */

  // Manual save function - SIMPLIFIED
  const handleManualSave = useCallback(async () => {
    if (!currentCard) return;

    try {
      // Route manual save appropriately
      if (solutionCard.state.isActive && solutionCard.state.solutionCard) {
        await solutionCard.actions.saveCodeImmediately(code, language);
        await solutionCard.actions.saveNotesImmediately(notes);
      } else if (currentCard.is_solution) {
        const startTime = Date.now();

        await comprehensiveLogger.logFrontendOperation(
          'ANSWER_CARD_MANUAL_SAVE',
          'STARTING',
          {
            cardId: currentCard.id,
            codeLength: code.length,
            notesLength: notes.length,
            language,
            problemId: problemId || 'unknown'
          }
        );

        // Use the same saveCard function - it works for all cards!
        await saveCard();

        const executionTime = Date.now() - startTime;
        await comprehensiveLogger.logAnswerCardAutoSaveComplete(currentCard.id, 'code', code, true, undefined, executionTime);
        await comprehensiveLogger.logAnswerCardAutoSaveComplete(currentCard.id, 'notes', notes, true, undefined, Math.floor(executionTime/2));

        await answerCardLogger.logAnswerCardSave(
          problemId || 'unknown',
          problem?.title || 'Unknown Problem',
          currentCard.id,
          code,
          notes
        );
      } else {
        // Regular card - just save normally
        await saveCard();
      }
    } catch (err) {
      if (currentCard.is_solution) {
        await answerCardLogger.logError(
          'Manual Save Failed (Answer Card)',
          err instanceof Error ? err : new Error(String(err)),
          {
            problemId: problemId || 'unknown',
            cardId: currentCard.id
          }
        );
      }
      console.error('Manual save failed:', err);
    }
  }, [saveCard, currentCard, code, notes, language, problemId, problem?.title]);

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
      // Prefer regular cards for initial selection; avoid selecting solution card by URL
      const card = cards.find(c => c.id === cardId);
      console.debug('ProblemCard: Found card by ID', {
        found: !!card,
        cardId: card?.id,
        hasNotes: !!card?.notes,
        notesContent: card?.notes
      });
      
      if (card) {
        if ((card as any).is_solution) {
          // If URL points to solution card, redirect to first regular card
          const regularCards = cards.filter(c => !(c as any).is_solution);
          const fallback = regularCards[0] || cards[0];
          console.warn('ProblemCard: URL points to solution card; redirecting to first regular card', {
            requestedCardId: cardId,
            redirectCardId: fallback?.id
          });
          if (fallback) {
            setCurrentCard(fallback);
            navigate(`/problem/${problemId}/card/${fallback.id}`, { replace: true });
          } else {
            setCurrentCard(card);
          }
        } else {
          setCurrentCard(card);
        }
      } else {
        console.warn('ProblemCard: Requested cardId not found, using first card', {
          requestedCardId: cardId,
          availableCardIds: cards.map(c => c.id),
          usingCard: cards[0].id
        });
        // Ensure we don't select a solution card as default
        const regularCards = cards.filter(c => !(c as any).is_solution);
        setCurrentCard(regularCards[0] || cards[0]);
      }
    } else if (cards.length > 0) {
      // Default to first regular card; avoid selecting solution card by default
      const regularCards = cards.filter(c => !(c as any).is_solution);
      const first = regularCards[0] || cards[0];
      console.debug('ProblemCard: Using first regular card', {
        firstCard: first.id,
        hasNotes: !!first.notes,
        notesContent: first.notes
      });
      setCurrentCard(first);
      
      // Auto-navigate to proper URL with card ID for consistency
      if (!cardId) {
        console.log('ProblemCard: Navigating to first card URL for consistency');
        navigate(`/problem/${problemId}/card/${first.id}`, { replace: true });
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

  // Enhanced state management with race condition prevention
  const currentMode: CardMode = useMemo(() =>
    solutionCard.state.isActive ? 'ANSWER' : 'REGULAR',
    [solutionCard.state.isActive]
  );

  // Initial state for state machine (stable values)
  const initialEditorState: EditorState = useMemo(() => ({
    code: '',
    notes: '',
    language: 'javascript'
  }), []);

  // State machine for safe mode transitions
  const stateMachine = useCardModeStateMachine(currentMode, initialEditorState);

  // Enhanced force save with validation
  // const { forceSave: enhancedForceSave } = useEnhancedForceSave(); // Available for future use

  // State validation guards for error prevention and recovery
  const validationGuards = useStateValidationGuards({
    enableLogging: true,
    strictMode: false
  });

  // Debounced editor sync to prevent race conditions (available for future use)
  /*
  const debouncedSync = useDebouncedEditorSync(
    currentCard,
    stateMachine.state.currentMode,
    stateMachine.state.isTransitioning,
    (editorState: EditorState) => {
      // Sync the legacy state with the new editor state
      setCode(editorState.code);
      setNotes(editorState.notes);
      setLanguage(editorState.language);
    },
    {
      debounceMs: 150,
      enableLogging: true
    }
  );
  */

  // Current editor state for auto-save
  const currentEditorState: EditorState = useMemo(() => ({
    code,
    notes,
    language
  }), [code, notes, language]);

  // DISABLED: Unified auto-save coordinator (removed complex auto-save mechanism)
  /*
  const unifiedAutoSave = useUnifiedAutoSave(
    stateMachine.state.currentMode,
    stateMachine.state.isTransitioning,
    currentCard,
    solutionCard.state.solutionCard,
    currentEditorState,
    {
      saveRegularCard: async (card: Card, state: EditorState) => {
        const updatedCard = await invoke<Card | null>('update_card', {
          cardId: card.id,
          code: state.code !== card.code ? state.code : null,
          notes: state.notes !== card.notes ? state.notes : null,
          language: state.language !== card.language ? state.language : null,
        });
        if (updatedCard) {
          setCurrentCard(updatedCard);
          setCards(prev => prev.map(c => c.id === updatedCard.id ? updatedCard : c));
        }
      },
      saveSolutionCard: async (_card: any, state: EditorState) => {
        await solutionCard.actions.saveCodeImmediately(state.code, state.language);
        await solutionCard.actions.saveNotesImmediately(state.notes);
      }
    },
    {
      regularCardDelay: 2500,
      solutionCardDelay: 2500,
      enableLogging: true
    }
  );
  */

  // Continuous state validation and recovery (DISABLED - causing infinite loop)
  /*
  useEffect(() => {
    const currentEditorState: EditorState = { code, notes, language };

    // Validate current state consistency
    const validation = validationGuards.validateStateConsistency(
      stateMachine.state.currentMode,
      stateMachine.state.transitionState,
      currentCard,
      solutionCard.state.solutionCard,
      currentEditorState
    );

    if (validation.canProceed) {
      // Capture valid state for potential recovery
      validationGuards.captureValidState(
        stateMachine.state.currentMode,
        stateMachine.state.transitionState,
        currentCard,
        solutionCard.state.solutionCard,
        currentEditorState
      );
    } else if (!validation.isValid) {
      // Critical error detected - attempt recovery
      console.error('State validation failed:', validation);

      const recoveryPlan = validationGuards.createRecoveryPlan(
        validation,
        validationGuards.recoverToLastValidState()
      );

      if (recoveryPlan.action === 'recover' && recoveryPlan.data) {
        console.warn('Attempting state recovery:', recoveryPlan.reason);

        const recoveryState = recoveryPlan.data;
        setCode(recoveryState.editorState.code);
        setNotes(recoveryState.editorState.notes);
        setLanguage(recoveryState.editorState.language);

        if (recoveryState.regularCard) {
          setCurrentCard(recoveryState.regularCard);
        }
      } else if (recoveryPlan.action === 'reset') {
        console.error('Critical state error - reset required:', recoveryPlan.reason);
        // In a real application, this might trigger a user notification
        setError('State consistency error detected. Please refresh the page if issues persist.');
      }
    }
  }, [
    code,
    notes,
    language,
    stateMachine.state.currentMode,
    stateMachine.state.transitionState,
    currentCard?.id,
    solutionCard.state.solutionCard?.id,
    validationGuards
  ]);
  */

  // Throttled state validation (safe implementation)
  const validationThrottleRef = useRef<number>();
  const isRecoveringRef = useRef<boolean>(false);

  useEffect(() => {
    // Skip validation during recovery to prevent loops
    if (isRecoveringRef.current) {
      return;
    }

    // Clear existing throttle
    if (validationThrottleRef.current) {
      clearTimeout(validationThrottleRef.current);
    }

    // Throttle validation to prevent rapid execution
    validationThrottleRef.current = window.setTimeout(() => {
      try {
        const validation = validationGuards.validateStateConsistency(
          currentMode,
          stateMachine.state.transitionState,
          currentCard,
          solutionCard.state.solutionCard,
          currentEditorState
        );

        if (validation.canProceed) {
          // Capture valid state for potential recovery
          validationGuards.captureValidState(
            currentMode,
            stateMachine.state.transitionState,
            currentCard,
            solutionCard.state.solutionCard,
            currentEditorState
          );
        } else if (!validation.isValid && !isRecoveringRef.current) {
          console.warn('State validation failed (throttled):', validation);
          // Don't attempt automatic recovery to prevent loops
          // Just log the issue for debugging
        }
      } catch (error) {
        console.error('Validation error:', error);
      }
    }, 1000); // 1 second throttle

    // Cleanup on unmount
    return () => {
      if (validationThrottleRef.current) {
        clearTimeout(validationThrottleRef.current);
      }
    };
  }, [currentMode, currentCard?.id, solutionCard.state.solutionCard?.id]);

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

      // Skip sync if we're intentionally switching modes to prevent race conditions
      if (isSwitchingModesRef.current) {
        console.debug('ProblemCard: Skipping editor sync - mode switch in progress', {
          operationId,
          cardId: currentCard.id,
          isSwitchingModes: true
        });
        return;
      }

      // Skip sync if we just restored from cache to prevent database override
      if (regularCardCacheRef.current && regularCardCacheRef.current.cardId === currentCard.id) {
        console.debug('ProblemCard: Skipping editor sync - cache restoration in progress', {
          operationId,
          cardId: currentCard.id,
          cacheCardId: regularCardCacheRef.current.cardId,
          note: 'Preventing database override of cached content'
        });
        return;
      }

      // Only sync editor state with current card when NOT in solution mode
      // When in solution mode, the onSolutionToggle callback handles editor state
      // Also check if the current card is NOT a solution card to prevent wrong content loading
      if (!solutionCard.state.isActive && !currentCard.is_solution) {
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

    // SAVE BEFORE CREATING NEW CARD: Prevent content loss
    if (currentCard) {
      try {
        await saveCard();
      } catch (error) {
        console.warn('Failed to save before creating new card, continuing anyway:', error);
      }
    }

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

  const navigateToCard = async (direction: 'prev' | 'next') => {
    if (!currentCard) return;

    // SAVE BEFORE NAVIGATION: Prevent content loss when switching cards
    try {
      await saveCard();
    } catch (error) {
      console.warn('Failed to save before navigation, continuing anyway:', error);
    }

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

  // Enhanced solution card toggle handler with state machine and validation
  const handleSolutionToggle = useCallback(async (event: React.KeyboardEvent | React.MouseEvent) => {
    console.debug('Enhanced handleSolutionToggle: Starting', {
      isShiftAction: isShiftAction(event),
      currentMode: stateMachine.state.currentMode,
      isTransitioning: stateMachine.state.isTransitioning,
      solutionCardActive: solutionCard.state.isActive
    });

    // Prevent rapid toggles during transitions
    if (stateMachine.state.isTransitioning || solutionCard.state.isLoading) {
      console.warn('Enhanced handleSolutionToggle: Transition in progress, ignoring request');
      return;
    }

    // In solution mode: regular click exits, shift+click also exits
    // Not in solution mode: regular click navigates, shift+click enters solution
    const isInSolutionMode = solutionCard.state.isActive;

    if (!isShiftAction(event) && !isInSolutionMode) {
      // Not shift+click and not in solution mode, handle regular navigation
      navigateToCard('next');
      return;
    }

    // Determine target mode
    const targetMode: CardMode = stateMachine.state.currentMode === 'REGULAR' ? 'ANSWER' : 'REGULAR';
    const currentEditorState: EditorState = {
      code,
      notes,
      language
    };

    try {
      // Validate transition before starting
      const transitionValidation = validationGuards.validateTransition(
        stateMachine.state.currentMode,
        targetMode,
        currentCard,
        solutionCard.state.solutionCard
      );

      if (!transitionValidation.canProceed) {
        console.error('Enhanced handleSolutionToggle: Transition validation failed', transitionValidation);
        setError(`Cannot switch modes: ${transitionValidation.errors.join(', ')}`);
        return;
      }

      if (transitionValidation.warnings.length > 0) {
        console.warn('Enhanced handleSolutionToggle: Transition warnings', transitionValidation.warnings);
      }

      // Start transition in state machine
      const transitionStarted = await stateMachine.actions.startTransition(targetMode, currentEditorState);
      if (!transitionStarted) {
        console.warn('Enhanced handleSolutionToggle: Failed to start transition');
        return;
      }

      if (targetMode === 'ANSWER') {
        // Switching to answer mode
        console.debug('Enhanced handleSolutionToggle: Switching to answer mode');

        // LOG: Switching to answer mode
        await answerCardLogger.logAnswerModeEnter(
          problemId || 'unknown',
          problem?.title || 'Unknown Problem',
          solutionCard.state.solutionCard?.id || 'unknown',
          solutionCard.state.solutionCard?.code || '',
          solutionCard.state.solutionCard?.notes || ''
        );

        // Set transition flag to prevent useEffect race conditions
        isSwitchingModesRef.current = true;

        // Cache the current regular card content before switching to answer mode
        if (currentCard) {
          // Store current editor content in cache to prevent overwriting
          regularCardCacheRef.current = {
            code: currentEditorState.code || '',
            notes: currentEditorState.notes || '',
            language: currentEditorState.language || 'javascript',
            cardId: currentCard.id
          };

          console.debug('Enhanced handleSolutionToggle: Cached regular card content', {
            cardId: currentCard.id,
            cachedCode: regularCardCacheRef.current.code?.substring(0, 50) || '(empty)',
            cachedNotes: regularCardCacheRef.current.notes?.substring(0, 50) || '(empty)',
            cachedLanguage: regularCardCacheRef.current.language
          });

          // Save the current editor content to the database
          try {
            await saveCard();
            console.debug('Enhanced handleSolutionToggle: Saved current card before switching to answer mode');
          } catch (saveError) {
            console.warn('Enhanced handleSolutionToggle: Failed to save current card before switch, continuing with cache:', saveError);
          }

          // Store reference for state restoration
          originalCardRef.current = {
            ...currentCard,
            code: regularCardCacheRef.current.code,
            notes: regularCardCacheRef.current.notes,
            language: regularCardCacheRef.current.language
          };
        }

        // Toggle to solution card
        const toggleResult = await solutionCard.actions.toggle();

        if (toggleResult?.isViewingSolution && toggleResult?.card) {
          const solution = solutionCardToCard(toggleResult.card);
          const solutionEditorState: EditorState = {
            code: solution.code || '',
            notes: solution.notes || '',
            language: solution.language || 'javascript'
          };

          console.debug('Enhanced handleSolutionToggle: Loading solution card content', {
            solutionCardId: solution.id,
            codeLength: solutionEditorState.code.length,
            notesLength: solutionEditorState.notes.length,
            language: solutionEditorState.language,
            codePreview: solutionEditorState.code.substring(0, 50) || '(empty)',
            notesPreview: solutionEditorState.notes.substring(0, 50) || '(empty)'
          });

          // Do NOT switch currentCard to solution card to avoid UI desync
          // Complete transition while keeping currentCard pointing to the regular card
          stateMachine.actions.completeTransition(solutionEditorState);

          // Directly update editor state to ensure solution content is loaded
          setCode(solutionEditorState.code);
          setNotes(solutionEditorState.notes);
          setLanguage(solutionEditorState.language);

          // Clear transition flag after state updates with longer delay to prevent race conditions
          setTimeout(() => {
            isSwitchingModesRef.current = false;
          }, 500);

          console.debug('Enhanced handleSolutionToggle: Successfully switched to answer mode');

          // LOG: Successfully entered answer mode with loaded content
          await answerCardLogger.logAnswerModeReopen(
            problemId || 'unknown',
            problem?.title || 'Unknown Problem',
            solution.id,
            solution.code || '',
            solution.notes || ''
          );
        } else {
          isSwitchingModesRef.current = false;
          throw new Error('Failed to get solution card after toggle');
        }

      } else {
        // Switching to regular mode
        console.debug('Enhanced handleSolutionToggle: Switching to regular mode');

        // LOG: Exiting answer mode - capture current answer card content
        if (solutionCard.state.solutionCard) {
          await answerCardLogger.logAnswerModeExit(
            problemId || 'unknown',
            problem?.title || 'Unknown Problem',
            solutionCard.state.solutionCard.id,
            code || '',  // Current editor content for answer card
            notes || ''  // Current editor content for answer card
          );
        }

        // SAVE BEFORE SWITCHING BACK: Prevent answer card content from overwriting regular card
        if (currentCard) {
          try {
            await saveCard();
            console.debug('Enhanced handleSolutionToggle: Saved answer card before switching back to regular mode');
          } catch (error) {
            console.warn('Failed to save answer card before switching back, continuing anyway:', error);
          }
        }

        // Set transition flag to prevent useEffect race conditions
        isSwitchingModesRef.current = true;

        // Exit solution mode
        solutionCard.actions.exitSolution();

        // Restore regular card content from cache to prevent overwriting
        const cachedContent = regularCardCacheRef.current;
        const originalCard = originalCardRef.current;

        if (cachedContent && originalCard && cachedContent.cardId === originalCard.id) {
          // Use cached content to restore exact content before switching to answer mode
          const regularEditorState: EditorState = {
            code: cachedContent.code,
            notes: cachedContent.notes,
            language: cachedContent.language
          };

          console.debug('Enhanced handleSolutionToggle: Restoring regular card content from cache', {
            originalCardId: originalCard.id,
            cacheCardId: cachedContent.cardId,
            codeLength: regularEditorState.code.length,
            notesLength: regularEditorState.notes.length,
            language: regularEditorState.language,
            codePreview: regularEditorState.code.substring(0, 50) || '(empty)',
            notesPreview: regularEditorState.notes.substring(0, 50) || '(empty)'
          });

          // CRITICAL: Update editor state FIRST to prevent answer content from overwriting regular card
          setCode(regularEditorState.code);
          setNotes(regularEditorState.notes);
          setLanguage(regularEditorState.language);

          // THEN update current card and complete transition
          setCurrentCard(originalCard);
          stateMachine.actions.completeTransition(regularEditorState);

          // Clear stored references
          originalCardRef.current = null;

          // Clear transition flag and cache after longer delay to prevent race conditions
          setTimeout(() => {
            isSwitchingModesRef.current = false;
            // Clear cache after transition is complete to ensure it protects during race conditions
            regularCardCacheRef.current = null;
          }, 1000); // Extended delay to ensure all useEffect cycles complete

          console.debug('Enhanced handleSolutionToggle: Successfully switched to regular mode');
        } else if (currentCard) {
          // Fallback to current card
          const fallbackEditorState: EditorState = {
            code: currentCard.code || '',
            notes: currentCard.notes || '',
            language: currentCard.language || 'javascript'
          };

          // Directly update editor state
          setCode(fallbackEditorState.code);
          setNotes(fallbackEditorState.notes);
          setLanguage(fallbackEditorState.language);

          stateMachine.actions.completeTransition(fallbackEditorState);

          // Clear transition flag after state updates with longer delay to prevent race conditions
          setTimeout(() => {
            isSwitchingModesRef.current = false;
          }, 500);

          console.debug('Enhanced handleSolutionToggle: Used fallback to current card');
        } else {
          isSwitchingModesRef.current = false;
          throw new Error('No card available for restoration');
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Enhanced handleSolutionToggle: Error during transition:', errorMessage);

      // Clear transition flag on error
      isSwitchingModesRef.current = false;

      // Handle transition error with rollback
      stateMachine.actions.handleTransitionError(errorMessage);

      // Attempt graceful recovery
      try {
        if (currentCard) {
          const recoveryState: EditorState = {
            code: currentCard.code || '',
            notes: currentCard.notes || '',
            language: currentCard.language || 'javascript'
          };

          setCode(recoveryState.code);
          setNotes(recoveryState.notes);
          setLanguage(recoveryState.language);

          console.debug('Enhanced handleSolutionToggle: Graceful recovery completed');
        }
      } catch (recoveryError) {
        console.error('Enhanced handleSolutionToggle: Recovery failed:', recoveryError);
      }
    }

  }, [stateMachine, solutionCard, currentCard, originalCardRef, navigateToCard, code, notes, language]);

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
                {/* Card Image Gallery between editors */}
                {currentCard && cardImages.length > 0 && (
                  <CardImageGallery
                    images={cardImages}
                    imageDataUrls={cardImageDataUrls}
                    onImageClick={handleGalleryImageClick}
                    onImageDelete={deleteCardImage}
                    onImageReorder={updateCardImagePositions}
                    className="border-t border-gray-200 dark:border-gray-700"
                  />
                )}
              </div>
            }
            notesEditor={
              <div className={`h-full flex flex-col transition-all duration-200 ease-in-out ${
                solutionCard.state.isActive
                  ? 'bg-red-50/30 dark:bg-red-950/10 border-l-4 border-red-300 dark:border-red-700'
                  : 'bg-white dark:bg-gray-800'
              }`}>
                {/* Notes container - takes remaining height */}
                <div className="relative flex-1 min-h-0">
                  {/* Paste Image Button in notes header area (top-right) */}
                  <div className="absolute right-3 top-3 z-10">
                    <CardImageButton
                      onImagePaste={async (data) => { await saveCardImage(data); }}
                      imageCount={cardImages.length}
                      disabled={!currentCard}
                    />
                  </div>
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
          
          {/* Card Image Modal */}
          <CardImageModal
            isOpen={isImageModalOpen}
            images={cardImages}
            imageDataUrls={cardImageDataUrls}
            currentImageId={currentModalImageId}
            onClose={closeImageModal}
            onNavigate={(id) => setCurrentModalImageId(id)}
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

              {/* Card Image Gallery between editors */}
              {currentCard && cardImages.length > 0 && (
                <CardImageGallery
                  images={cardImages}
                  imageDataUrls={cardImageDataUrls}
                  onImageClick={handleGalleryImageClick}
                  onImageDelete={deleteCardImage}
                  onImageReorder={updateCardImagePositions}
                  className="border-t border-gray-200 dark:border-gray-700"
                />
              )}
            </div>
          }
          notesEditor={
            <div className={`relative h-full transition-all duration-200 ease-in-out ${
              solutionCard.state.isActive
                ? 'bg-red-50/30 dark:bg-red-950/10 border-l-4 border-red-300 dark:border-red-700'
                : 'bg-white dark:bg-gray-800'
            }`}>
              {/* Paste Image Button in notes header area (top-right) */}
              <div className="absolute right-3 top-3 z-10">
                <CardImageButton
                  onImagePaste={async (data) => { await saveCardImage(data); }}
                  imageCount={cardImages.length}
                  disabled={!currentCard}
                />
              </div>
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

      {/* Card Image Modal */}
      <CardImageModal
        isOpen={isImageModalOpen}
        images={cardImages}
        imageDataUrls={cardImageDataUrls}
        currentImageId={currentModalImageId}
        onClose={closeImageModal}
        onNavigate={(id) => setCurrentModalImageId(id)}
      />
      
      {/* Global Audio Player - REMOVED FOR REBUILD */}
    </div>
    </WorkspaceContext.Provider>
  );
}
