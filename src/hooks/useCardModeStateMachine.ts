import { useState, useCallback, useRef } from 'react';
import { DEFAULT_LANGUAGE } from '../constants/editor';

export type CardMode = 'REGULAR' | 'ANSWER';
export type TransitionState =
  | 'IDLE'
  | 'SAVING_BEFORE_TRANSITION'
  | 'SWITCHING_TO_ANSWER'
  | 'SWITCHING_TO_REGULAR'
  | 'ERROR_RECOVERY';

export interface CardModeState {
  currentMode: CardMode;
  transitionState: TransitionState;
  isTransitioning: boolean;
  error: string | null;
}

export interface EditorState {
  code: string;
  notes: string;
  language: string;
}

export interface CardModeStateMachine {
  state: CardModeState;
  editorState: EditorState;
  actions: {
    startTransition: (targetMode: CardMode, currentEditorState: EditorState) => Promise<boolean>;
    completeTransition: (newEditorState: EditorState) => void;
    handleTransitionError: (error: string) => void;
    reset: () => void;
    updateEditorState: (newState: Partial<EditorState>) => void;
  };
}

export const useCardModeStateMachine = (
  initialMode: CardMode = 'REGULAR',
  initialEditorState: EditorState = { code: '', notes: '', language: DEFAULT_LANGUAGE }
): CardModeStateMachine => {
  const [state, setState] = useState<CardModeState>({
    currentMode: initialMode,
    transitionState: 'IDLE',
    isTransitioning: false,
    error: null
  });

  const [editorState, setEditorState] = useState<EditorState>(initialEditorState);

  // Store the state before transition for rollback purposes
  const preTransitionStateRef = useRef<{
    mode: CardMode;
    editorState: EditorState;
  } | null>(null);

  const startTransition = useCallback(async (
    targetMode: CardMode,
    currentEditorState: EditorState
  ): Promise<boolean> => {
    // Prevent concurrent transitions
    if (state.isTransitioning) {
      console.warn('CardModeStateMachine: Transition already in progress, ignoring new request');
      return false;
    }

    // Store current state for potential rollback
    preTransitionStateRef.current = {
      mode: state.currentMode,
      editorState: currentEditorState
    };

    // Update editor state to current values
    setEditorState(currentEditorState);

    console.debug('CardModeStateMachine: Starting transition', {
      from: state.currentMode,
      to: targetMode,
      editorState: {
        codeLength: currentEditorState.code.length,
        notesLength: currentEditorState.notes.length,
        language: currentEditorState.language
      }
    });

    setState(prev => ({
      ...prev,
      transitionState: 'SAVING_BEFORE_TRANSITION',
      isTransitioning: true,
      error: null
    }));

    // Move to the appropriate switching state
    const switchingState = targetMode === 'ANSWER' ? 'SWITCHING_TO_ANSWER' : 'SWITCHING_TO_REGULAR';

    setState(prev => ({
      ...prev,
      transitionState: switchingState
    }));

    return true;
  }, [state.currentMode, state.isTransitioning]);

  const completeTransition = useCallback((newEditorState: EditorState) => {
    setState(prev => {
      const newMode = prev.transitionState === 'SWITCHING_TO_ANSWER' ? 'ANSWER' : 'REGULAR';

      console.debug('CardModeStateMachine: Completing transition', {
        to: newMode,
        editorState: {
          codeLength: newEditorState.code.length,
          notesLength: newEditorState.notes.length,
          language: newEditorState.language
        }
      });

      return {
        ...prev,
        currentMode: newMode,
        transitionState: 'IDLE',
        isTransitioning: false,
        error: null
      };
    });

    setEditorState(newEditorState);
    preTransitionStateRef.current = null;
  }, []);

  const handleTransitionError = useCallback((error: string) => {
    console.error('CardModeStateMachine: Transition error:', error);

    setState(prev => ({
      ...prev,
      transitionState: 'ERROR_RECOVERY',
      error
    }));

    // Attempt to rollback to previous state
    if (preTransitionStateRef.current) {
      console.debug('CardModeStateMachine: Rolling back to previous state');

      setState(prev => ({
        ...prev,
        currentMode: preTransitionStateRef.current!.mode,
        transitionState: 'IDLE',
        isTransitioning: false
      }));

      setEditorState(preTransitionStateRef.current.editorState);
      preTransitionStateRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      currentMode: 'REGULAR',
      transitionState: 'IDLE',
      isTransitioning: false,
      error: null
    });

    setEditorState({ code: '', notes: '', language: DEFAULT_LANGUAGE });
    preTransitionStateRef.current = null;
  }, []);

  const updateEditorState = useCallback((newState: Partial<EditorState>) => {
    // Only allow editor state updates when not transitioning
    if (!state.isTransitioning) {
      setEditorState(prev => ({ ...prev, ...newState }));
    }
  }, [state.isTransitioning]);

  return {
    state,
    editorState,
    actions: {
      startTransition,
      completeTransition,
      handleTransitionError,
      reset,
      updateEditorState
    }
  };
};
