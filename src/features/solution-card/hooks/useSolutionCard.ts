// Solution Card Hook
//
// Encapsulates all solution card state management and business logic.
// Provides clean interface for components to interact with solution cards.

import { useState, useCallback, useRef } from 'react';
import { solutionCardApi, SolutionCardApiError } from '../services/solutionCardApi';
import {
  SolutionCard,
  SolutionCardState,
  SolutionCardHookReturn
} from '../types';
import { logSolutionFlow, logAnswerCardApi, logAnswerCardState, startTiming, endTiming, trackRender, getMemoryUsage } from '../../../services/answerCardDebugLogger';

interface UseSolutionCardOptions {
  problemId: string;
  onSolutionToggle?: (isActive: boolean, card: SolutionCard | null) => void;
  onError?: (error: string) => void;
  autoSaveDelay?: number;
}

export const useSolutionCard = ({
  problemId,
  onSolutionToggle,
  onError,
  autoSaveDelay = 1000
}: UseSolutionCardOptions): SolutionCardHookReturn => {
  const [state, setState] = useState<SolutionCardState>({
    isActive: false,
    solutionCard: null,
    isLoading: false,
    error: null
  });

  // Auto-save debouncing
  const codeTimerRef = useRef<number>();
  const notesTimerRef = useRef<number>();

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => {
      const newState = { ...prev, isLoading: loading };
      
      // Enhanced logging with performance tracking
      logAnswerCardState('useSolutionCard', 'isLoading', prev.isLoading, loading, {
        trigger: 'setLoading',
        componentRender: trackRender('useSolutionCard'),
        memoryUsage: getMemoryUsage()
      });
      
      return newState;
    });
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => {
      const newState = { ...prev, error };
      
      // Enhanced logging with error context
      logAnswerCardState('useSolutionCard', 'error', prev.error, error, {
        trigger: 'setError',
        hasError: !!error,
        errorType: error ? 'user_error' : 'cleared',
        componentRender: trackRender('useSolutionCard'),
        memoryUsage: getMemoryUsage()
      });
      
      return newState;
    });
    
    if (error && onError) {
      onError(error);
    }
  }, [onError]);

  const handleApiError = useCallback((error: unknown, defaultMessage: string) => {
    const errorMessage = error instanceof SolutionCardApiError 
      ? error.message 
      : defaultMessage;
    console.error(defaultMessage, error);
    setError(errorMessage);
  }, [setError]);

  /**
   * Load solution card for the current problem
   */
  const load = useCallback(async () => {
    if (!problemId) return;

    const operationId = `load-${problemId}-${Date.now()}`;
    startTiming(operationId);

    await logSolutionFlow('LoadStart', 'Starting solution card load', {
      problemId,
      operationId,
      memoryUsage: getMemoryUsage()
    });

    setLoading(true);
    setError(null);

    try {
      const card = await solutionCardApi.get(problemId);
      const timing = endTiming(operationId);
      
      await logAnswerCardApi('get_solution_card', { problemId }, card, {
        hookContext: 'useSolutionCard.load'
      }, timing);
      
      setState(prev => {
        const newState = {
          ...prev,
          solutionCard: card,
          isActive: !!card,
          isLoading: false,
          error: null
        };
        
        // Log comprehensive state change
        logAnswerCardState('useSolutionCard', 'fullState', prev, newState, {
          trigger: 'load_complete',
          operationId,
          hasCard: !!card,
          cardId: card?.id,
          componentRender: trackRender('useSolutionCard')
        }, timing);
        
        return newState;
      });

      if (onSolutionToggle) {
        await logSolutionFlow('LoadCallback', 'Calling onSolutionToggle callback', {
          isActive: !!card,
          cardId: card?.id,
          operationId
        });
        onSolutionToggle(!!card, card);
      }

      await logSolutionFlow('LoadComplete', 'Solution card load completed successfully', {
        hasCard: !!card,
        cardId: card?.id,
        operationId,
        duration: timing?.duration
      });
    } catch (error) {
      const timing = endTiming(operationId);
      await logSolutionFlow('LoadError', 'Error during solution card load', {
        error: error instanceof Error ? error.message : String(error),
        problemId,
        operationId,
        duration: timing?.duration
      });
      handleApiError(error, 'Failed to load solution card');
      setLoading(false);
    }
  }, [problemId, onSolutionToggle, handleApiError, setLoading, setError]);

  /**
   * Create new solution card
   */
  const create = useCallback(async () => {
    if (!problemId) return;

    const operationId = `create-${problemId}-${Date.now()}`;
    startTiming(operationId);

    await logSolutionFlow('CreateStart', 'Starting solution card creation', {
      problemId,
      operationId,
      memoryUsage: getMemoryUsage()
    });

    setLoading(true);
    setError(null);

    try {
      const card = await solutionCardApi.create(problemId);
      const timing = endTiming(operationId);
      
      await logAnswerCardApi('create_solution_card', { problemId }, card, {
        hookContext: 'useSolutionCard.create'
      }, timing);
      
      setState(prev => {
        const newState = {
          ...prev,
          solutionCard: card,
          isActive: true,
          isLoading: false,
          error: null
        };
        
        // Log comprehensive state change
        logAnswerCardState('useSolutionCard', 'fullState', prev, newState, {
          trigger: 'create_complete',
          operationId,
          cardCreated: true,
          cardId: card.id,
          componentRender: trackRender('useSolutionCard')
        }, timing);
        
        return newState;
      });

      if (onSolutionToggle) {
        await logSolutionFlow('CreateCallback', 'Calling onSolutionToggle callback', {
          isActive: true,
          cardId: card.id,
          operationId
        });
        onSolutionToggle(true, card);
      }

      await logSolutionFlow('CreateComplete', 'Solution card creation completed successfully', {
        cardId: card.id,
        operationId,
        duration: timing?.duration
      });
    } catch (error) {
      const timing = endTiming(operationId);
      await logSolutionFlow('CreateError', 'Error during solution card creation', {
        error: error instanceof Error ? error.message : String(error),
        problemId,
        operationId,
        duration: timing?.duration
      });
      handleApiError(error, 'Failed to create solution card');
      setLoading(false);
    }
  }, [problemId, onSolutionToggle, handleApiError, setLoading, setError]);

  /**
   * Toggle solution view - main action for shift+click
   */
  const toggle = useCallback(async () => {
    if (!problemId) {
      await logSolutionFlow('ToggleError', 'No problemId provided to toggle function');
      return;
    }

    const operationId = `toggle-${problemId}-${Date.now()}`;
    startTiming(operationId);

    // Capture current state for logging only
    const currentState = await new Promise<SolutionCardState>(resolve => {
      setState(prev => {
        resolve(prev);
        return prev;
      });
    });

    await logSolutionFlow('ToggleStart', 'Starting solution card toggle', {
      problemId,
      currentState,
      operationId,
      memoryUsage: getMemoryUsage(),
      renderCount: trackRender('useSolutionCard')
    });

    setLoading(true);
    setError(null);

    try {
      await logSolutionFlow('ToggleApiCall', 'Calling solutionCardApi.toggle', {
        problemId,
        createIfMissing: true,
        operationId
      });
      
      const result = await solutionCardApi.toggle(problemId, true);
      const timing = endTiming(operationId);
      
      await logAnswerCardApi('toggle_solution_view', { problemId, createIfMissing: true }, result, {
        hookContext: 'useSolutionCard.toggle'
      }, timing);
      
      // Use functional state update to avoid stale closure
      setState(prev => {
        const newState = {
          ...prev,
          solutionCard: result.card,
          isActive: result.isViewingSolution,
          isLoading: false,
          error: null
        };
        
        // Log comprehensive state change with timing
        logAnswerCardState('useSolutionCard', 'solutionCardState', prev, newState, {
          trigger: 'toggle_complete',
          apiResult: result,
          operationId,
          stateTransition: {
            wasActive: prev.isActive,
            nowActive: result.isViewingSolution,
            hadCard: !!prev.solutionCard,
            hasCard: !!result.card,
            cardChanged: prev.solutionCard?.id !== result.card?.id
          },
          componentRender: trackRender('useSolutionCard')
        }, timing);
        
        return newState;
      });

      if (onSolutionToggle) {
        await logSolutionFlow('ToggleCallback', 'Calling onSolutionToggle callback', {
          isViewingSolution: result.isViewingSolution,
          cardId: result.card?.id,
          operationId
        });
        onSolutionToggle(result.isViewingSolution, result.card);
      }
      
      await logSolutionFlow('ToggleComplete', 'Solution card toggle completed successfully', {
        isActive: result.isViewingSolution,
        hasCard: !!result.card,
        cardId: result.card?.id,
        operationId,
        duration: timing?.duration,
        finalMemoryUsage: getMemoryUsage()
      });
    } catch (error) {
      const timing = endTiming(operationId);
      await logSolutionFlow('ToggleError', 'Error during solution card toggle', {
        error: error instanceof Error ? error.message : String(error),
        problemId,
        operationId,
        duration: timing?.duration
      });
      handleApiError(error, 'Failed to toggle solution view');
      setLoading(false);
    }
  }, [problemId, onSolutionToggle, handleApiError, setLoading, setError]);

  /**
   * Update solution card code with debounced auto-save
   */
  const updateCode = useCallback(async (code: string, language: string) => {
    const operationId = `updateCode-${Date.now()}`;
    const changeStartTime = performance.now();
    
    // Capture the card ID and previous data before the async operation
    let cardId: string | null = null;
    let beforeData: any = null;
    
    setState(prev => {
      if (!prev.solutionCard) return prev;
      
      cardId = prev.solutionCard.id;
      beforeData = {
        code: prev.solutionCard.code,
        language: prev.solutionCard.language,
        notes: prev.solutionCard.notes
      };
      
      const newState = {
        ...prev,
        solutionCard: {
          ...prev.solutionCard,
          code,
          language
        }
      };
      
      // Log editor change with performance tracking
      const changeLatency = Math.round(performance.now() - changeStartTime);
      logEditorChange('CodeEditor', { code, language, notes: prev.solutionCard.notes }, {
        operationId,
        trigger: 'updateCode',
        cardId,
        componentRender: trackRender('useSolutionCard')
      }, {
        duration: changeLatency,
        operationId
      }, beforeData);
      
      return newState;
    });

    // If no card ID, exit early
    if (!cardId) return;

    // Clear existing timer
    if (codeTimerRef.current) {
      clearTimeout(codeTimerRef.current);
    }

    // Set new timer for auto-save with captured card ID
    const capturedCardId = cardId; // TypeScript closure capture
    codeTimerRef.current = window.setTimeout(async () => {
      const saveOperationId = `saveCode-${capturedCardId}-${Date.now()}`;
      startTiming(saveOperationId);
      
      try {
        await solutionCardApi.updateCode(capturedCardId, code, language);
        const timing = endTiming(saveOperationId);
        
        await logAnswerCardApi('update_solution_code', { 
          cardId: capturedCardId, 
          codeLength: code.length, 
          language 
        }, { success: true }, {
          hookContext: 'useSolutionCard.updateCode.autoSave',
          autoSaveDelay,
          operationId: saveOperationId
        }, timing);
        
        setError(null);
      } catch (error) {
        const timing = endTiming(saveOperationId);
        await logAnswerCardApi('update_solution_code', { 
          cardId: capturedCardId, 
          codeLength: code.length, 
          language 
        }, { success: false, error }, {
          hookContext: 'useSolutionCard.updateCode.autoSave',
          autoSaveDelay,
          operationId: saveOperationId
        }, timing);
        
        handleApiError(error, 'Failed to save solution code');
      }
    }, autoSaveDelay);
  }, [autoSaveDelay, handleApiError, setError]);

  /**
   * Update solution card notes with debounced auto-save
   */
  const updateNotes = useCallback(async (notes: string) => {
    const operationId = `updateNotes-${Date.now()}`;
    const changeStartTime = performance.now();
    
    // Capture the card ID and previous data before the async operation
    let cardId: string | null = null;
    let beforeData: any = null;
    
    setState(prev => {
      if (!prev.solutionCard) return prev;
      
      cardId = prev.solutionCard.id;
      beforeData = {
        code: prev.solutionCard.code,
        language: prev.solutionCard.language,
        notes: prev.solutionCard.notes
      };
      
      const newState = {
        ...prev,
        solutionCard: {
          ...prev.solutionCard,
          notes
        }
      };
      
      // Log editor change with performance tracking
      const changeLatency = Math.round(performance.now() - changeStartTime);
      logEditorChange('NotesEditor', { 
        code: prev.solutionCard.code, 
        language: prev.solutionCard.language, 
        notes 
      }, {
        operationId,
        trigger: 'updateNotes',
        cardId,
        componentRender: trackRender('useSolutionCard')
      }, {
        duration: changeLatency,
        operationId
      }, beforeData);
      
      return newState;
    });

    // If no card ID, exit early
    if (!cardId) return;

    // Clear existing timer
    if (notesTimerRef.current) {
      clearTimeout(notesTimerRef.current);
    }

    // Set new timer for auto-save with captured card ID
    const capturedCardId = cardId; // TypeScript closure capture
    notesTimerRef.current = window.setTimeout(async () => {
      const saveOperationId = `saveNotes-${capturedCardId}-${Date.now()}`;
      startTiming(saveOperationId);
      
      try {
        await solutionCardApi.updateNotes(capturedCardId, notes);
        const timing = endTiming(saveOperationId);
        
        await logAnswerCardApi('update_solution_notes', { 
          cardId: capturedCardId, 
          notesLength: notes.length 
        }, { success: true }, {
          hookContext: 'useSolutionCard.updateNotes.autoSave',
          autoSaveDelay,
          operationId: saveOperationId
        }, timing);
        
        setError(null);
      } catch (error) {
        const timing = endTiming(saveOperationId);
        await logAnswerCardApi('update_solution_notes', { 
          cardId: capturedCardId, 
          notesLength: notes.length 
        }, { success: false, error }, {
          hookContext: 'useSolutionCard.updateNotes.autoSave',
          autoSaveDelay,
          operationId: saveOperationId
        }, timing);
        
        handleApiError(error, 'Failed to save solution notes');
      }
    }, autoSaveDelay);
  }, [autoSaveDelay, handleApiError, setError]);

  /**
   * Exit solution view and return to regular cards
   */
  const exitSolution = useCallback(async () => {
    const operationId = `exitSolution-${Date.now()}`;
    startTiming(operationId);
    
    // Capture current state for logging only
    const currentState = await new Promise<SolutionCardState>(resolve => {
      setState(prev => {
        resolve(prev);
        return prev;
      });
    });
    
    await logSolutionFlow('ExitSolutionStart', 'Starting to exit solution view', {
      currentState,
      operationId,
      memoryUsage: getMemoryUsage(),
      renderCount: trackRender('useSolutionCard')
    });
    
    // Use functional state update to avoid stale closure
    setState(prev => {
      const newState = {
        ...prev,
        isActive: false,
        solutionCard: null,
        error: null
      };
      
      // Log comprehensive state change with timing
      const timing = endTiming(operationId);
      logAnswerCardState('useSolutionCard', 'solutionCardState', prev, newState, {
        trigger: 'exit_solution',
        operationId,
        stateTransition: {
          wasActive: prev.isActive,
          nowActive: false,
          hadCard: !!prev.solutionCard,
          hasCard: false,
          cardCleared: true
        },
        componentRender: trackRender('useSolutionCard')
      }, timing);
      
      return newState;
    });

    if (onSolutionToggle) {
      await logSolutionFlow('ExitSolutionCallback', 'Calling onSolutionToggle callback for exit', {
        isActive: false,
        card: null,
        operationId
      });
      onSolutionToggle(false, null);
    }
    
    const finalTiming = endTiming(operationId);
    await logSolutionFlow('ExitSolutionComplete', 'Successfully exited solution view', {
      operationId,
      duration: finalTiming?.duration,
      finalMemoryUsage: getMemoryUsage()
    });
  }, [onSolutionToggle]);

  return {
    state,
    actions: {
      toggle,
      create,
      load,
      updateCode,
      updateNotes,
      exitSolution
    }
  };
};