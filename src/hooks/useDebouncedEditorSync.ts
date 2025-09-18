import { useRef, useCallback, useEffect } from 'react';
import { Card } from '../types';
import { CardMode, EditorState } from './useCardModeStateMachine';
import { DEFAULT_LANGUAGE } from '../constants/editor';

export interface EditorSyncOptions {
  debounceMs?: number;
  enableLogging?: boolean;
}

export const useDebouncedEditorSync = (
  currentCard: Card | null,
  currentMode: CardMode,
  isTransitioning: boolean,
  onSync: (editorState: EditorState) => void,
  options: EditorSyncOptions = {}
) => {
  const { debounceMs = 150, enableLogging = false } = options;

  const debounceTimeoutRef = useRef<number>();
  const lastSyncRef = useRef<{
    cardId: string | null;
    mode: CardMode;
    timestamp: number;
  }>({ cardId: null, mode: 'REGULAR', timestamp: 0 });

  const log = useCallback((message: string, data?: any) => {
    if (enableLogging) {
      console.debug(`DebouncedEditorSync: ${message}`, data);
    }
  }, [enableLogging]);

  const shouldSync = useCallback((card: Card | null, mode: CardMode): boolean => {
    // Don't sync during transitions
    if (isTransitioning) {
      log('Skipping sync - transition in progress');
      return false;
    }

    // Don't sync if no card
    if (!card) {
      log('Skipping sync - no card available');
      return false;
    }

    // Check if this is actually a new state that needs syncing
    const isSameCard = lastSyncRef.current.cardId === card.id;
    const isSameMode = lastSyncRef.current.mode === mode;

    if (isSameCard && isSameMode) {
      const timeSinceLastSync = Date.now() - lastSyncRef.current.timestamp;
      if (timeSinceLastSync < debounceMs) {
        log('Skipping sync - too soon since last sync', { timeSinceLastSync });
        return false;
      }
    }

    log('Sync approved', {
      cardId: card.id,
      mode,
      changed: !isSameCard || !isSameMode
    });

    return true;
  }, [isTransitioning, debounceMs, log]);

  const syncEditorState = useCallback(() => {
    if (!currentCard || !shouldSync(currentCard, currentMode)) {
      return;
    }

    const editorState: EditorState = {
      code: currentCard.code || '',
      notes: currentCard.notes || '',
      language: currentCard.language || DEFAULT_LANGUAGE
    };

    log('Syncing editor state', {
      cardId: currentCard.id,
      mode: currentMode,
      codeLength: editorState.code.length,
      notesLength: editorState.notes.length,
      language: editorState.language
    });

    onSync(editorState);

    // Update last sync tracking
    lastSyncRef.current = {
      cardId: currentCard.id,
      mode: currentMode,
      timestamp: Date.now()
    };
  }, [currentCard, currentMode, shouldSync, onSync, log]);

  const debouncedSync = useCallback(() => {
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout
    debounceTimeoutRef.current = window.setTimeout(syncEditorState, debounceMs);
  }, [syncEditorState, debounceMs]);

  // Trigger sync when dependencies change
  useEffect(() => {
    debouncedSync();

    // Cleanup on unmount
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [currentCard?.id, currentCard?.code, currentCard?.notes, currentCard?.language, currentMode, debouncedSync]);

  // Provide manual sync trigger for immediate syncing
  const syncImmediately = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    syncEditorState();
  }, [syncEditorState]);

  // Cancel any pending sync
  const cancelSync = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
  }, []);

  return {
    syncImmediately,
    cancelSync,
    isScheduled: !!debounceTimeoutRef.current
  };
};
