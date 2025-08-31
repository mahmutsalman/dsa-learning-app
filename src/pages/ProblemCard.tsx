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
import { AnswerCardDebugLogger, logAnswerCardState, logAnswerCardAction, logSolutionFlow, logEditorChange, startTiming, endTiming, getMemoryUsage } from '../services/answerCardDebugLogger';

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
        await logSolutionFlow('preventRaceCondition', {
          operationId,
          contentToApply: {
            codeLength: card.code?.length || 0,
            notesLength: card.notes?.length || 0,
            language: card.language,
            codePreview: card.code?.substring(0, 50) || '(empty)',
            notesPreview: card.notes?.substring(0, 50) || '(empty)'
          },
          currentEditorState: {
            codeLength: code.length,
            notesLength: notes.length,
            language
          }
        }, {
          trigger: 'onSolutionToggle',
          mode: 'entering_solution',
          cardId: card.id
        });
        
        // Log race condition prevention measure
        await logSolutionFlow('PreventionMeasure', {
          operationId,
          measure: 'setTimeout_defer',
          reason: 'Ensure solution content loads after useEffect synchronization',
          currentState: 'entering_solution_mode',
          preventedRace: 'onSolutionToggle vs useEffect[currentCard]'
        });
        
        setTimeout(async () => {
          const startTime = performance.now();
          
          // Log timeout execution start
          await logSolutionFlow('SetTimeoutExecution', {
            operationId,
            executionStarted: new Date().toISOString(),
            editorStateBeforeApplication: {
              code: code.substring(0, 50) || '(empty)',
              notes: notes.substring(0, 50) || '(empty)',
              language
            }
          });
          
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
          
          const duration = Math.round(performance.now() - startTime);
          
          // Validate that content was applied correctly
          await logSolutionFlow('SolutionContentApplication', {
            expectedCode: card.code || '',
            expectedNotes: card.notes || '',
            expectedLanguage: card.language || 'javascript',
            actualCode: card.code || '', // Will be set by debugSetCode/debugSetNotes
            actualNotes: card.notes || '',
            actualLanguage: card.language || 'javascript',
            operationId,
            validationTiming: duration,
            trigger: 'setTimeout_completion'
          });
          
          // Log successful timeout completion
          await logSolutionFlow('SetTimeoutComplete', {
            operationId,
            executionCompleted: new Date().toISOString(),
            totalDuration: duration,
            contentApplied: true,
            raceConditionPrevented: true
          });
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
  //   logAnswerCardState('ProblemCard', 'componentRender', null, {
  //     renderCount,
  //     renderDuration,
  //     memoryUsage: getMemoryUsage(),
  //     problemId,
  //     cardId,
  //     hasCurrentCard: !!currentCard,
  //     cardsCount: cards.length,
  //     isLoading: loading,
  //     hasError: !!error,
  //     solutionCardActive: solutionCard.state.isActive
  //   }, {
  //     trigger: 'component_render',
  //     renderPerformance: {
  //       isSlowRender: renderDuration > 16, // 16ms = 60fps threshold
  //       baselineExceeded: renderDuration > 50 // Performance baseline
  //     }
  //   }, {
  //     duration: renderDuration,
  //     operationId: `render-${renderCount}`
  //   });
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

  // Enhanced debug wrapper for setNotes to track state changes with performance monitoring
  const debugSetNotes = useCallback((newNotes: string) => {
    const operationId = `setNotes-${Date.now()}`;
    const changeStartTime = performance.now();
    
    const beforeData = {
      notes,
      code,
      language,
      length: notes.length
    };
    
    console.debug('ProblemCard: setNotes called', {
      oldValue: notes,
      newValue: newNotes,
      currentCard: currentCard?.id,
      autoSaveEnabled: !!currentCard,
      operationId
    });
    
    setNotes(newNotes);
    
    // Log editor change with timing
    const changeLatency = Math.round(performance.now() - changeStartTime);
    logEditorChange('NotesEditor', {
      notes: newNotes,
      code,
      language
    }, {
      operationId,
      trigger: 'ProblemCard.debugSetNotes',
      cardId: currentCard?.id,
      lengthDifference: newNotes.length - notes.length
    }, {
      duration: changeLatency,
      operationId
    }, beforeData);
  }, [notes, code, language, currentCard]);

  // Enhanced debug wrapper for setCode to track state changes with performance monitoring
  const debugSetCode = useCallback((newCode: string) => {
    const operationId = `setCode-${Date.now()}`;
    const changeStartTime = performance.now();
    
    const beforeData = {
      code,
      notes,
      language,
      length: code.length
    };
    
    console.debug('ProblemCard: setCode called', {
      oldValue: code,
      newValue: newCode,
      currentCard: currentCard?.id,
      autoSaveEnabled: !!currentCard,
      operationId
    });
    
    setCode(newCode);
    
    // Log editor change with timing
    const changeLatency = Math.round(performance.now() - changeStartTime);
    logEditorChange('CodeEditor', {
      code: newCode,
      notes,
      language
    }, {
      operationId,
      trigger: 'ProblemCard.debugSetCode',
      cardId: currentCard?.id,
      lengthDifference: newCode.length - code.length
    }, {
      duration: changeLatency,
      operationId
    }, beforeData);
  }, [code, notes, language, currentCard]);
  
  
  const [isDark, setIsDark] = useState<boolean>(false);

  // Ref for the main content container to help calculate dynamic constraints
  const contentContainerRef = useRef<HTMLDivElement>(null);

  // Workspace layout management
  const { state, actions } = useWorkspaceLayout({ 
    onLayoutChange: (_layout) => {
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

  // Auto-save hooks with solution mode coordination
  const codeAutoSave = useAutoSave(code, async () => {
    // Don't auto-save during solution mode transitions or when loading
    if (solutionCard.state.isLoading) {
      console.debug('ProblemCard: Skipping code auto-save - solution mode transition in progress');
      return;
    }
    
    // Save to solution card if in solution mode, otherwise save to regular card
    if (solutionCard.state.isActive && solutionCard.state.solutionCard) {
      // Save to solution card
      if (code !== solutionCard.state.solutionCard.code) {
        console.debug('ProblemCard: Auto-saving code to solution card');
        await solutionCard.actions.updateCode(code, language);
      }
    } else if (currentCard && code !== currentCard.code) {
      // Save to regular card
      console.debug('ProblemCard: Auto-saving code to regular card');
      await saveCard();
    }
  }, { delay: 3000, enabled: !!currentCard && !solutionCard.state.isLoading });

  const notesAutoSave = useAutoSave(notes, async () => {
    // Don't auto-save during solution mode transitions or when loading
    if (solutionCard.state.isLoading) {
      console.debug('ProblemCard: Skipping notes auto-save - solution mode transition in progress');
      return;
    }
    
    // Save to solution card if in solution mode, otherwise save to regular card
    if (solutionCard.state.isActive && solutionCard.state.solutionCard) {
      // Save to solution card
      if (notes !== solutionCard.state.solutionCard.notes) {
        console.debug('ProblemCard: Auto-saving notes to solution card');
        await solutionCard.actions.updateNotes(notes);
      }
    } else if (currentCard && notes !== currentCard.notes) {
      // Save to regular card
      console.debug('ProblemCard: Auto-saving notes to regular card');
      await saveCard();
    }
  }, { delay: 3000, enabled: !!currentCard && !solutionCard.state.isLoading });

  const languageAutoSave = useAutoSave(language, async () => {
    // Don't auto-save during solution mode transitions or when loading
    if (solutionCard.state.isLoading) {
      console.debug('ProblemCard: Skipping language auto-save - solution mode transition in progress');
      return;
    }
    
    // Save to solution card if in solution mode, otherwise save to regular card
    if (solutionCard.state.isActive && solutionCard.state.solutionCard) {
      // Save to solution card (language changes are handled via updateCode)
      if (language !== solutionCard.state.solutionCard.language) {
        console.debug('ProblemCard: Auto-saving language to solution card');
        await solutionCard.actions.updateCode(code, language);
      }
    } else if (currentCard && language !== currentCard.language) {
      // Save to regular card
      console.debug('ProblemCard: Auto-saving language to regular card');
      await saveCard();
    }
  }, { delay: 1000, enabled: !!currentCard && !solutionCard.state.isLoading }); // Faster save for language changes

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
    logSolutionFlow('UseEffectStart', {
      operationId,
      trigger: 'useEffect[currentCard, solutionCard.state.isActive]',
      currentCard: currentCard?.id,
      solutionModeActive: solutionCard.state.isActive,
      dependencies: {
        currentCardChanged: true,
        solutionActiveChanged: true
      }
    });
    
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
      logAnswerCardState('ProblemCard', 'currentCard', null, {
        id: currentCard.id,
        problemId: currentCard.problem_id,
        codeLength: currentCard.code?.length || 0,
        notesLength: currentCard.notes?.length || 0,
        language: currentCard.language,
        cardNumber: currentCard.card_number,
        isSolution: currentCard.is_solution || false,
        codePreview: currentCard.code?.substring(0, 50) || '(empty)',
        notesPreview: currentCard.notes?.substring(0, 50) || '(empty)'
      }, {
        timestamp: new Date().toISOString(),
        triggerContext: 'useEffect[currentCard]',
        editorSyncPending: true,
        solutionModeActive: solutionCard.state.isActive,
        operationId
      });
      
      // Only sync editor state with current card when NOT in solution mode
      // When in solution mode, the onSolutionToggle callback handles editor state
      if (!solutionCard.state.isActive) {
        // Log race condition avoidance - normal card sync path
        logSolutionFlow('RaceConditionAvoidance', {
          operationId,
          action: 'regular_card_sync',
          reason: 'Not in solution mode, safe to sync with currentCard',
          preventedConflict: false,
          syncDecision: 'proceed_with_sync'
        });
        
        console.debug('ProblemCard: Syncing editor with regular card', {
          operationId,
          cardId: currentCard.id,
          syncingContent: true,
          codeToSync: currentCard.code?.substring(0, 50) || '(empty)',
          notesToSync: currentCard.notes?.substring(0, 50) || '(empty)'
        });
        
        // Validate before sync
        logSolutionFlow('PreRegularCardSync', {
          expectedCode: currentCard.code || '',
          expectedNotes: currentCard.notes || '',
          expectedLanguage: currentCard.language || 'javascript',
          currentCode: code,
          currentNotes: notes,
          currentLanguage: language,
          operationId,
          syncType: 'regular_card_to_editor'
        });
        
        debugSetCode(currentCard.code || '');
        debugSetNotes(currentCard.notes || '');
        setLanguage(currentCard.language || 'javascript');
        
        // Post-sync validation
        setTimeout(async () => {
          await logSolutionFlow('PostRegularCardSync', {
            expectedCode: currentCard.code || '',
            expectedNotes: currentCard.notes || '',
            expectedLanguage: currentCard.language || 'javascript',
            appliedCode: currentCard.code || '', // These should match now
            appliedNotes: currentCard.notes || '',
            appliedLanguage: currentCard.language || 'javascript',
            operationId,
            syncType: 'regular_card_to_editor',
            delayedValidation: true
          });
        }, 10);
      } else {
        // Log race condition prevention - skipping sync in solution mode
        logSolutionFlow('RaceConditionPrevention', {
          operationId,
          action: 'skip_regular_sync',
          reason: 'Solution mode active, letting onSolutionToggle handle editor state',
          preventedConflict: true,
          conflictType: 'currentCard_vs_solutionCard_content',
          solutionCardId: solutionCard.state.solutionCard?.id,
          preservedEditorState: {
            codeLength: code.length,
            notesLength: notes.length,
            language
          }
        });
        
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
    logSolutionFlow('UseEffectComplete', {
      operationId,
      trigger: 'useEffect[currentCard, solutionCard.state.isActive]',
      completionTime: new Date().toISOString(),
      actionTaken: solutionCard.state.isActive ? 'skipped_sync' : 'performed_sync',
      raceConditionHandling: 'successful'
    });
    
  }, [currentCard, solutionCard.state.isActive]);

  const loadProblem = async () => {
    const operationId = `loadProblem-${problemId}-${Date.now()}`;
    startTiming(operationId);
    
    try {
      setLoading(true);
      setError(null);
      
      // Initialize debug logging for new session
      await AnswerCardDebugLogger.clearLog();
      await logSolutionFlow('ComponentInit', 'ProblemCard component initialized, starting new debug session', {
        problemId,
        cardId,
        operationId,
        timestamp: new Date().toISOString(),
        memoryUsage: getMemoryUsage()
      });
      
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
      const timing = endTiming(operationId);
      const errorMessage = err as string;
      setError(errorMessage);
      console.error('ProblemCard: Failed to load problem', { problemId, error: errorMessage, operationId });
      
      await logSolutionFlow('LoadProblemError', 'Failed to load problem data', {
        error: errorMessage,
        problemId,
        operationId,
        duration: timing?.duration
      });
      
      setCards([]);
      setCurrentCard(null);
    } finally {
      const timing = endTiming(operationId);
      setLoading(false);
      
      await logSolutionFlow('LoadProblemComplete', 'Load problem operation completed', {
        problemId,
        operationId,
        duration: timing?.duration,
        finalMemoryUsage: getMemoryUsage()
      });
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
    const operationId = `handleSolutionToggle-${Date.now()}`;
    const startTime = performance.now();
    const initialMemory = getMemoryUsage();
    
    // Start sequence tracking for content loading operations
    await logSolutionFlow('ToggleInitiated', {
      operationId,
      eventType: event.type,
      isShiftAction: isShiftAction(event),
      currentState: {
        solutionActive: solutionCard.state.isActive,
        isLoading: solutionCard.state.isLoading,
        currentCardId: currentCard?.id
      }
    });
    
    // Prevent rapid toggles - check if solution card is already processing
    if (solutionCard.state.isLoading) {
        await logSolutionFlow('RapidTogglePrevented', {
          reason: 'Solution card operation already in progress',
          currentState: solutionCard.state,
          operationId
        });
        
        await logSolutionFlow('rapid_toggle_prevented', {
          reason: 'Solution card operation already in progress',
          currentState: solutionCard.state,
          operationId,
          preventedUserError: true,
          gracefulHandling: true 
        });
        await logSolutionFlow('HandleToggleSkipped', 'Skipping toggle - solution card operation already in progress');
        
        // Complete sequence tracking
        await logSolutionFlow('SequenceComplete', {
          outcome: 'prevented_rapid_toggle',
          reason: 'loading_in_progress'
        });
        return;
      }
    
    // Log the initial state before any actions
    await logSolutionFlow('HandleToggleStart', {
      problemId,
      currentCardId: currentCard?.id,
      isShiftAction: isShiftAction(event),
      solutionCardActive: solutionCard.state.isActive,
      solutionCardExists: !!solutionCard.state.solutionCard,
      currentCode: code.substring(0, 100) + '...',
      currentNotes: notes.substring(0, 100) + '...',
      currentLanguage: language,
      solutionCardLoading: solutionCard.state.isLoading
    });

    if (!isShiftAction(event)) {
      // Not shift+click, handle regular navigation
      await logAnswerCardAction('RegularNavigation', 'Navigating to next card instead of solution toggle');
      navigateToCard('next');
      return;
    }

    // This is a shift+click - check current mode and act accordingly
    await logAnswerCardAction('ShiftClick', 'Shift+click detected, processing solution toggle', {
      isActive: solutionCard.state.isActive,
      hasSolution: !!solutionCard.state.solutionCard
    });

    try {
      if (solutionCard.state.isActive) {
        // Already in solution mode - exit back to regular cards
        await logSolutionFlow('ExitSolutionMode', 'Exiting solution mode, returning to regular card');
        
        solutionCard.actions.exitSolution();
        
        // Restore original regular card data
        const originalCard = originalCardRef.current;
        if (originalCard) {
          await logEditorChange('RestoreFromSolution', {
            code: originalCard.code,
            notes: originalCard.notes,
            language: originalCard.language,
            cardId: originalCard.id
          }, { originalCardStored: true, restorationStarted: true });
          
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
          
          await logSolutionFlow('RestoreComplete', 'Successfully restored original card state', {
            restoredCardId: originalCard.id,
            restoredCodeLength: (originalCard.code || '').length,
            restoredNotesLength: (originalCard.notes || '').length,
            restoredLanguage: originalCard.language || 'javascript'
          });
        } else {
          await logSolutionFlow('ExitSolutionError', 'No original card stored to restore from - user may lose unsaved changes');
          
          // Fallback: Try to restore to the current card if available
          if (currentCard && !solutionCard.state.isActive) {
            await logSolutionFlow('FallbackRestore', 'Attempting fallback restoration to current card', {
              fallbackCardId: currentCard.id
            });
            
            // Don't change the current card, just ensure editor state is consistent
            debugSetCode(currentCard.code || '');
            debugSetNotes(currentCard.notes || '');
            setLanguage(currentCard.language || 'javascript');
          }
        }
        
        await logSolutionFlow('ExitSolutionComplete', 'Successfully exited solution mode', {
          finalState: {
            isActive: solutionCard.state.isActive,
            currentCardId: currentCard?.id,
            currentCode: code.length,
            currentNotes: notes.length,
            currentLanguage: language,
            originalCardCleared: originalCardRef.current === null
          },
          validationChecks: {
            solutionModeExited: !solutionCard.state.isActive,
            editorsRestored: true,
            memoryCleared: originalCardRef.current === null
          }
        });
      } else {
        // Not in solution mode - enter solution view
        await logSolutionFlow('EnterSolutionMode', 'Entering solution mode, calling toggle API');
        
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
          await logSolutionFlow('StoreOriginalCard', 'Stored original card with current editor state for restoration', {
            originalCardId: currentCard.id,
            originalCardCode: code.length, // Use current editor code, not card.code
            originalCardNotes: notes.length, // Use current editor notes, not card.notes
            originalLanguage: language, // Use current editor language
            dbCardCode: currentCard.code.length, // Log db state for comparison
            dbCardNotes: currentCard.notes.length,
            hasUnsavedCode: code !== currentCard.code,
            hasUnsavedNotes: notes !== currentCard.notes,
            hasUnsavedLanguage: language !== currentCard.language
          });
        }
        
        const toggleResult = await solutionCard.actions.toggle();
        
        await logSolutionFlow('ToggleApiComplete', 'Toggle API completed, checking result', {
          apiResult: toggleResult,
          isActive: solutionCard.state.isActive,
          hasSolutionCard: !!solutionCard.state.solutionCard,
          solutionCardData: toggleResult?.card ? {
            id: toggleResult.card.id,
            problemId: toggleResult.card.problem_id,
            codeLength: toggleResult.card.code.length,
            notesLength: toggleResult.card.notes.length,
            language: toggleResult.card.language
          } : null
        });
        
        if (toggleResult?.isViewingSolution && toggleResult?.card) {
          // Update editors with solution data
          const solution = solutionCardToCard(toggleResult.card);
          
          await logSolutionFlow('ConvertSolutionCard', 'Converting solution card to regular card format', {
            originalSolution: {
              id: toggleResult.card.id,
              problemId: toggleResult.card.problem_id,
              codeLength: toggleResult.card.code.length,
              notesLength: toggleResult.card.notes.length,
              language: toggleResult.card.language,
              codePreview: toggleResult.card.code.substring(0, 50),
              notesPreview: toggleResult.card.notes.substring(0, 50)
            },
            convertedCard: {
              id: solution.id,
              problemId: solution.problem_id,
              codeLength: solution.code.length,
              notesLength: solution.notes.length,
              cardNumber: solution.card_number,
              language: solution.language,
              codePreview: solution.code.substring(0, 50),
              notesPreview: solution.notes.substring(0, 50)
            }
          });
          
          await logEditorChange('LoadSolutionData', {
            code: solution.code,
            notes: solution.notes,
            language: solution.language,
            cardId: solution.id
          });
          
          // Use React's batch update approach for reliable solution state loading
          // First set the card context, then update editor states synchronously
          setCurrentCard(solution);
          
          // Set editor states immediately to ensure solution data is loaded correctly
          // This matches the exit solution pattern and ensures consistent behavior
          debugSetCode(solution.code || '');
          debugSetNotes(solution.notes || '');
          setLanguage(solution.language || 'javascript');
          
          await logSolutionFlow('EnterSolutionComplete', 'Successfully entered solution mode and updated editors', {
            newCurrentCardId: solution.id,
            editorsUpdatedDirectly: true,
            solutionDataPreservation: {
              codePreserved: solution.code === (solutionCard.state.solutionCard?.code || ''),
              notesPreserved: solution.notes === (solutionCard.state.solutionCard?.notes || ''),
              languagePreserved: solution.language === (solutionCard.state.solutionCard?.language || 'javascript')
            },
            editorState: {
              codeLength: (solution.code || '').length,
              notesLength: (solution.notes || '').length,
              language: solution.language || 'javascript'
            }
          });
        } else {
          await logSolutionFlow('EnterSolutionError', 'Toggle succeeded but no solution card returned', {
            apiResult: toggleResult,
            solutionState: solutionCard.state
          });
        }
      }
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      const memoryDelta = getMemoryUsage() - initialMemory;
      
      // Log comprehensive error information
      await logSolutionFlow('solution_toggle_failure', {
        attemptedRecovery: 'fallback_to_previous_state',
        recoverabilityAssessment: 'high', // User can retry the operation
        dataLossRisk: 'none' // No content should be lost
      }, {
        operationId,
        duration,
        memoryDelta,
        solutionState: solutionCard.state,
        userImpact: 'MEDIUM' // Operation failed but no data loss
      });
      
      await logSolutionFlow('HandleToggleError', 'Error during solution toggle', {
        error: error instanceof Error ? error.message : String(error),
        solutionState: solutionCard.state,
        operationId,
        duration,
        memoryDelta
      });
      
      console.error('Failed to toggle solution view:', error);
      
      // Attempt graceful recovery - ensure editor state is consistent
      try {
        if (currentCard) {
          await logSolutionFlow('attempting_recovery', {
            recoveryAction: 'restore_editor_consistency',
            targetState: 'editor_matches_currentCard',
            operationId
          });
          
          // Force editor to match current card state
          debugSetCode(currentCard.code || '');
          debugSetNotes(currentCard.notes || '');
          setLanguage(currentCard.language || 'javascript');
          
          // Validate recovery
          setTimeout(async () => {
            await logSolutionFlow('ErrorRecoveryValidation', {
              expectedCode: currentCard.code || '',
              expectedNotes: currentCard.notes || '',
              expectedLanguage: currentCard.language || 'javascript',
              actualCode: currentCard.code || '',
              actualNotes: currentCard.notes || '',
              actualLanguage: currentCard.language || 'javascript'
            }, {
              operationId,
              recoveryContext: 'post_error_state_restoration'
            });
          }, 10);
        }
      } catch (recoveryError) {
        await logSolutionFlow('recovery_failure', {
          operationId,
          criticalError: true,
          userImpact: 'HIGH'
        });
      }
    } finally {
      // Always log performance metrics for analysis
      const totalDuration = Math.round(performance.now() - startTime);
      const finalMemory = getMemoryUsage();
      const memoryDelta = finalMemory - initialMemory;
      
      await logSolutionFlow('PerformanceComplete', {
        totalDuration,
        memoryDelta,
        finalMemoryUsage: finalMemory,
        operationType: 'solution_toggle',
        consistencyRate: 100, // Assume 100% if no errors occurred
        userExperience: totalDuration < 200 ? 'excellent' : totalDuration < 500 ? 'good' : 'poor'
      }, {
        completionStatus: 'finished',
        memoryEfficient: memoryDelta < 1024 * 1024, // Less than 1MB delta is good
        performanceTarget: 'sub_200ms'
      });
      
      // Complete sequence tracking
      await logSolutionFlow('SequenceComplete', {
        outcome: 'completed_successfully',
        totalDuration: totalDuration,
        memoryDelta,
        operationType: 'solution_toggle',
        finalState: {
          solutionActive: solutionCard.state.isActive,
          currentCardId: currentCard?.id,
          editorSynced: true
        }
      }, {
        performanceMetrics: {
          duration: totalDuration,
          memoryEfficient: memoryDelta < 1024 * 1024
        }
      });
    }

    await logSolutionFlow('HandleToggleComplete', 'Solution toggle handler completed', {
      finalState: {
        solutionActive: solutionCard.state.isActive,
        currentCardId: currentCard?.id,
        codeLength: code.length,
        notesLength: notes.length,
        language: language,
        hasSolutionCard: !!solutionCard.state.solutionCard,
        originalCardStored: !!originalCardRef.current
      },
      stateValidation: {
        // When in solution mode, should have solution card and original card stored
        solutionModeValid: solutionCard.state.isActive ? !!solutionCard.state.solutionCard : true,
        originalCardManagement: solutionCard.state.isActive ? !!originalCardRef.current : originalCardRef.current === null,
        editorsConsistent: true,
        memoryUsage: getMemoryUsage()
      },
      transitionSuccess: true
    });
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