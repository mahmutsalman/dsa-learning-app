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
import { logSolutionFlow, logAnswerCardApi, logAnswerCardState } from '../../../services/answerCardDebugLogger';

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
    setState(prev => ({ ...prev, isLoading: loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
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

    setLoading(true);
    setError(null);

    try {
      const card = await solutionCardApi.get(problemId);
      
      setState(prev => ({
        ...prev,
        solutionCard: card,
        isActive: !!card,
        isLoading: false,
        error: null
      }));

      if (onSolutionToggle) {
        onSolutionToggle(!!card, card);
      }
    } catch (error) {
      handleApiError(error, 'Failed to load solution card');
      setLoading(false);
    }
  }, [problemId, onSolutionToggle, handleApiError, setLoading, setError]);

  /**
   * Create new solution card
   */
  const create = useCallback(async () => {
    if (!problemId) return;

    setLoading(true);
    setError(null);

    try {
      const card = await solutionCardApi.create(problemId);
      
      setState(prev => ({
        ...prev,
        solutionCard: card,
        isActive: true,
        isLoading: false,
        error: null
      }));

      if (onSolutionToggle) {
        onSolutionToggle(true, card);
      }
    } catch (error) {
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

    await logSolutionFlow('ToggleStart', 'Starting solution card toggle', {
      problemId,
      currentState: state
    });

    setLoading(true);
    setError(null);

    try {
      await logSolutionFlow('ToggleApiCall', 'Calling solutionCardApi.toggle', {
        problemId,
        createIfMissing: true
      });
      
      const result = await solutionCardApi.toggle(problemId, true);
      
      await logAnswerCardApi('toggle_solution_view', { problemId, createIfMissing: true }, result, {
        hookContext: 'useSolutionCard.toggle'
      });
      
      const newState = {
        ...state,
        solutionCard: result.card,
        isActive: result.isViewingSolution,
        isLoading: false,
        error: null
      };
      
      setState(newState);
      
      await logAnswerCardState('useSolutionCard', 'solutionCardState', state, newState, {
        trigger: 'toggle_complete',
        apiResult: result
      });

      if (onSolutionToggle) {
        await logSolutionFlow('ToggleCallback', 'Calling onSolutionToggle callback', {
          isViewingSolution: result.isViewingSolution,
          cardId: result.card?.id
        });
        onSolutionToggle(result.isViewingSolution, result.card);
      }
      
      await logSolutionFlow('ToggleComplete', 'Solution card toggle completed successfully', {
        isActive: result.isViewingSolution,
        hasCard: !!result.card,
        cardId: result.card?.id
      });
    } catch (error) {
      await logSolutionFlow('ToggleError', 'Error during solution card toggle', {
        error: error instanceof Error ? error.message : String(error),
        problemId
      });
      handleApiError(error, 'Failed to toggle solution view');
      setLoading(false);
    }
  }, [problemId, onSolutionToggle, handleApiError, setLoading, setError, state]);

  /**
   * Update solution card code with debounced auto-save
   */
  const updateCode = useCallback(async (code: string, language: string) => {
    if (!state.solutionCard) return;

    // Update local state immediately for responsive UI
    setState(prev => ({
      ...prev,
      solutionCard: prev.solutionCard ? {
        ...prev.solutionCard,
        code,
        language
      } : null
    }));

    // Clear existing timer
    if (codeTimerRef.current) {
      clearTimeout(codeTimerRef.current);
    }

    // Set new timer for auto-save
    codeTimerRef.current = window.setTimeout(async () => {
      try {
        await solutionCardApi.updateCode(state.solutionCard!.id, code, language);
        setError(null);
      } catch (error) {
        handleApiError(error, 'Failed to save solution code');
      }
    }, autoSaveDelay);
  }, [state.solutionCard, autoSaveDelay, handleApiError, setError]);

  /**
   * Update solution card notes with debounced auto-save
   */
  const updateNotes = useCallback(async (notes: string) => {
    if (!state.solutionCard) return;

    // Update local state immediately for responsive UI
    setState(prev => ({
      ...prev,
      solutionCard: prev.solutionCard ? {
        ...prev.solutionCard,
        notes
      } : null
    }));

    // Clear existing timer
    if (notesTimerRef.current) {
      clearTimeout(notesTimerRef.current);
    }

    // Set new timer for auto-save
    notesTimerRef.current = window.setTimeout(async () => {
      try {
        await solutionCardApi.updateNotes(state.solutionCard!.id, notes);
        setError(null);
      } catch (error) {
        handleApiError(error, 'Failed to save solution notes');
      }
    }, autoSaveDelay);
  }, [state.solutionCard, autoSaveDelay, handleApiError, setError]);

  /**
   * Exit solution view and return to regular cards
   */
  const exitSolution = useCallback(async () => {
    await logSolutionFlow('ExitSolutionStart', 'Starting to exit solution view', {
      currentState: state
    });
    
    const newState = {
      ...state,
      isActive: false,
      solutionCard: null,
      error: null
    };
    
    setState(newState);
    
    await logAnswerCardState('useSolutionCard', 'solutionCardState', state, newState, {
      trigger: 'exit_solution'
    });

    if (onSolutionToggle) {
      await logSolutionFlow('ExitSolutionCallback', 'Calling onSolutionToggle callback for exit', {
        isActive: false,
        card: null
      });
      onSolutionToggle(false, null);
    }
    
    await logSolutionFlow('ExitSolutionComplete', 'Successfully exited solution view');
  }, [onSolutionToggle, state]);

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