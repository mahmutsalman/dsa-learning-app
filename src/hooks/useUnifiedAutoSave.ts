import { useRef, useCallback, useEffect, useState } from 'react';
import { Card } from '../types';
import { SolutionCard } from '../features/solution-card/types';
import { CardMode, EditorState } from './useCardModeStateMachine';

export interface AutoSaveConfig {
  regularCardDelay: number;
  solutionCardDelay: number;
  enableLogging: boolean;
}

export interface AutoSaveCallbacks {
  saveRegularCard: (card: Card, state: EditorState) => Promise<void>;
  saveSolutionCard: (card: SolutionCard, state: EditorState) => Promise<void>;
}

export interface AutoSaveState {
  isEnabled: boolean;
  lastSave: {
    cardId: string | null;
    mode: CardMode;
    timestamp: number;
  };
  pendingTasks: {
    regular: boolean;
    solution: boolean;
  };
}

export const useUnifiedAutoSave = (
  currentMode: CardMode,
  isTransitioning: boolean,
  currentCard: Card | null,
  solutionCard: SolutionCard | null,
  editorState: EditorState,
  callbacks: AutoSaveCallbacks,
  config: AutoSaveConfig = {
    regularCardDelay: 2500, // Unified to 2.5 seconds
    solutionCardDelay: 2500, // Unified to 2.5 seconds
    enableLogging: false
  }
) => {
  const timeoutRefs = useRef<{
    regular: number | null;
    solution: number | null;
  }>({ regular: null, solution: null });

  const lastValuesRef = useRef<{
    regular: EditorState | null;
    solution: EditorState | null;
  }>({ regular: null, solution: null });

  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>({
    isEnabled: true,
    lastSave: {
      cardId: null,
      mode: 'REGULAR',
      timestamp: 0
    },
    pendingTasks: {
      regular: false,
      solution: false
    }
  });

  const log = useCallback((message: string, data?: any) => {
    if (config.enableLogging) {
      console.debug(`UnifiedAutoSave: ${message}`, data);
    }
  }, [config.enableLogging]);

  const clearTimeouts = useCallback(() => {
    if (timeoutRefs.current.regular) {
      clearTimeout(timeoutRefs.current.regular);
      timeoutRefs.current.regular = null;
    }
    if (timeoutRefs.current.solution) {
      clearTimeout(timeoutRefs.current.solution);
      timeoutRefs.current.solution = null;
    }

    setAutoSaveState(prev => ({
      ...prev,
      pendingTasks: { regular: false, solution: false }
    }));
  }, []);

  const hasContentChanged = useCallback((
    currentState: EditorState,
    lastState: EditorState | null
  ): boolean => {
    if (!lastState) return true;

    return (
      currentState.code !== lastState.code ||
      currentState.notes !== lastState.notes ||
      currentState.language !== lastState.language
    );
  }, []);

  const scheduleRegularCardSave = useCallback(() => {
    if (!currentCard || !autoSaveState.isEnabled || isTransitioning) {
      return;
    }

    if (!hasContentChanged(editorState, lastValuesRef.current.regular)) {
      log('Skipping regular card save - no changes detected');
      return;
    }

    // Clear existing timeout
    if (timeoutRefs.current.regular) {
      clearTimeout(timeoutRefs.current.regular);
    }

    log('Scheduling regular card save', {
      cardId: currentCard.id,
      delay: config.regularCardDelay
    });

    setAutoSaveState(prev => ({
      ...prev,
      pendingTasks: { ...prev.pendingTasks, regular: true }
    }));

    timeoutRefs.current.regular = window.setTimeout(async () => {
      try {
        log('Executing regular card save', { cardId: currentCard.id });

        await callbacks.saveRegularCard(currentCard, editorState);

        lastValuesRef.current.regular = { ...editorState };
        setAutoSaveState(prev => ({
          ...prev,
          lastSave: {
            cardId: currentCard.id,
            mode: 'REGULAR',
            timestamp: Date.now()
          },
          pendingTasks: { ...prev.pendingTasks, regular: false }
        }));

        log('Regular card save completed successfully');

      } catch (error) {
        console.error('UnifiedAutoSave: Regular card save failed:', error);
        setAutoSaveState(prev => ({
          ...prev,
          pendingTasks: { ...prev.pendingTasks, regular: false }
        }));
      }

      timeoutRefs.current.regular = null;
    }, config.regularCardDelay);
  }, [currentCard, autoSaveState.isEnabled, isTransitioning, editorState, hasContentChanged, config.regularCardDelay, callbacks, log]);

  const scheduleSolutionCardSave = useCallback(() => {
    if (!solutionCard || !autoSaveState.isEnabled || isTransitioning) {
      return;
    }

    if (!hasContentChanged(editorState, lastValuesRef.current.solution)) {
      log('Skipping solution card save - no changes detected');
      return;
    }

    // Clear existing timeout
    if (timeoutRefs.current.solution) {
      clearTimeout(timeoutRefs.current.solution);
    }

    log('Scheduling solution card save', {
      cardId: solutionCard.id,
      delay: config.solutionCardDelay
    });

    setAutoSaveState(prev => ({
      ...prev,
      pendingTasks: { ...prev.pendingTasks, solution: true }
    }));

    timeoutRefs.current.solution = window.setTimeout(async () => {
      try {
        log('Executing solution card save', { cardId: solutionCard.id });

        await callbacks.saveSolutionCard(solutionCard, editorState);

        lastValuesRef.current.solution = { ...editorState };
        setAutoSaveState(prev => ({
          ...prev,
          lastSave: {
            cardId: solutionCard.id,
            mode: 'ANSWER',
            timestamp: Date.now()
          },
          pendingTasks: { ...prev.pendingTasks, solution: false }
        }));

        log('Solution card save completed successfully');

      } catch (error) {
        console.error('UnifiedAutoSave: Solution card save failed:', error);
        setAutoSaveState(prev => ({
          ...prev,
          pendingTasks: { ...prev.pendingTasks, solution: false }
        }));
      }

      timeoutRefs.current.solution = null;
    }, config.solutionCardDelay);
  }, [solutionCard, autoSaveState.isEnabled, isTransitioning, editorState, hasContentChanged, config.solutionCardDelay, callbacks, log]);

  // Schedule auto-save based on current mode
  useEffect(() => {
    if (currentMode === 'REGULAR') {
      scheduleRegularCardSave();
    } else if (currentMode === 'ANSWER') {
      scheduleSolutionCardSave();
    }
  }, [currentMode, editorState.code, editorState.notes, editorState.language]);

  // Clear timeouts when transitioning
  useEffect(() => {
    if (isTransitioning) {
      log('Clearing auto-save timeouts due to transition');
      clearTimeouts();
    }
  }, [isTransitioning, clearTimeouts, log]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeouts();
    };
  }, [clearTimeouts]);

  const enable = useCallback(() => {
    setAutoSaveState(prev => ({ ...prev, isEnabled: true }));
  }, []);

  const disable = useCallback(() => {
    clearTimeouts();
    setAutoSaveState(prev => ({ ...prev, isEnabled: false }));
  }, [clearTimeouts]);

  const forceFlush = useCallback(async (): Promise<void> => {
    log('Force flushing all pending auto-saves');

    const promises: Promise<void>[] = [];

    if (timeoutRefs.current.regular && currentCard) {
      clearTimeout(timeoutRefs.current.regular);
      timeoutRefs.current.regular = null;
      promises.push(callbacks.saveRegularCard(currentCard, editorState));
    }

    if (timeoutRefs.current.solution && solutionCard) {
      clearTimeout(timeoutRefs.current.solution);
      timeoutRefs.current.solution = null;
      promises.push(callbacks.saveSolutionCard(solutionCard, editorState));
    }

    await Promise.all(promises);

    setAutoSaveState(prev => ({
      ...prev,
      pendingTasks: { regular: false, solution: false }
    }));

    log('Force flush completed');
  }, [currentCard, solutionCard, editorState, callbacks, log]);

  return {
    state: autoSaveState,
    actions: {
      enable,
      disable,
      clearTimeouts,
      forceFlush
    }
  };
};