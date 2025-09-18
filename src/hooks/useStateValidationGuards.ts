import { useCallback, useRef } from 'react';
import { Card } from '../types';
import { DEFAULT_LANGUAGE } from '../constants/editor';
import { SolutionCard } from '../features/solution-card/types';
import { CardMode, EditorState, TransitionState } from './useCardModeStateMachine';

export interface StateValidationOptions {
  enableLogging: boolean;
  strictMode: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  canProceed: boolean;
}

export interface StateSnapshot {
  timestamp: number;
  mode: CardMode;
  transitionState: TransitionState;
  regularCard: Card | null;
  solutionCard: SolutionCard | null;
  editorState: EditorState;
  checksum: string;
}

export const useStateValidationGuards = (options: StateValidationOptions = {
  enableLogging: false,
  strictMode: false
}) => {
  const lastValidStateRef = useRef<StateSnapshot | null>(null);
  const validationHistoryRef = useRef<ValidationResult[]>([]);

  const log = useCallback((level: 'debug' | 'warn' | 'error', message: string, data?: any) => {
    if (options.enableLogging) {
      console[level](`StateValidationGuards: ${message}`, data);
    }
  }, [options.enableLogging]);

  const generateChecksum = useCallback((data: any): string => {
    // Simple checksum generation for state comparison
    return btoa(JSON.stringify(data)).slice(0, 16);
  }, []);

  const createStateSnapshot = useCallback((
    mode: CardMode,
    transitionState: TransitionState,
    regularCard: Card | null,
    solutionCard: SolutionCard | null,
    editorState: EditorState
  ): StateSnapshot => {
    const checksumData = {
      mode,
      transitionState,
      regularCardId: regularCard?.id,
      solutionCardId: solutionCard?.id,
      editorState
    };

    return {
      timestamp: Date.now(),
      mode,
      transitionState,
      regularCard,
      solutionCard,
      editorState,
      checksum: generateChecksum(checksumData)
    };
  }, [generateChecksum]);

  const validateStateConsistency = useCallback((
    mode: CardMode,
    transitionState: TransitionState,
    regularCard: Card | null,
    solutionCard: SolutionCard | null,
    editorState: EditorState
  ): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    log('debug', 'Validating state consistency', {
      mode,
      transitionState,
      regularCardId: regularCard?.id,
      solutionCardId: solutionCard?.id,
      editorCodeLength: editorState.code.length,
      editorNotesLength: editorState.notes.length
    });

    // Validate mode consistency
    if (mode === 'REGULAR') {
      if (!regularCard) {
        errors.push('Regular mode requires a regular card');
      }
      if (solutionCard && transitionState === 'IDLE') {
        warnings.push('Solution card exists but mode is REGULAR');
      }
    } else if (mode === 'ANSWER') {
      if (!solutionCard) {
        errors.push('Answer mode requires a solution card');
      }
      if (!regularCard) {
        warnings.push('Answer mode without a regular card (unusual but not critical)');
      }
    }

    // Validate transition state consistency
    if (transitionState !== 'IDLE') {
      if (transitionState === 'SWITCHING_TO_ANSWER' && mode === 'ANSWER') {
        errors.push('Already in answer mode but transition state indicates switching to answer');
      }
      if (transitionState === 'SWITCHING_TO_REGULAR' && mode === 'REGULAR') {
        errors.push('Already in regular mode but transition state indicates switching to regular');
      }
    }

    // Validate editor state
    if (typeof editorState.code !== 'string') {
      errors.push('Editor code must be a string');
    }
    if (typeof editorState.notes !== 'string') {
      errors.push('Editor notes must be a string');
    }
    if (typeof editorState.language !== 'string' || !editorState.language) {
      errors.push('Editor language must be a non-empty string');
    }

    // Validate card content consistency in strict mode
    if (options.strictMode && mode === 'REGULAR' && regularCard) {
      if (transitionState === 'IDLE') {
        if (editorState.code !== (regularCard.code || '')) {
          warnings.push('Editor code differs from regular card code outside of transition');
        }
        if (editorState.notes !== (regularCard.notes || '')) {
          warnings.push('Editor notes differ from regular card notes outside of transition');
        }
        if (editorState.language !== (regularCard.language || DEFAULT_LANGUAGE)) {
          warnings.push('Editor language differs from regular card language outside of transition');
        }
      }
    }

    const isValid = errors.length === 0;
    const canProceed = isValid && (options.strictMode ? warnings.length === 0 : true);

    const result: ValidationResult = {
      isValid,
      errors,
      warnings,
      canProceed
    };

    // Store validation history (keep last 10)
    validationHistoryRef.current.push(result);
    if (validationHistoryRef.current.length > 10) {
      validationHistoryRef.current.shift();
    }

    log(isValid ? 'debug' : 'error', 'State validation result', result);

    return result;
  }, [options.strictMode, log]);

  const validateTransition = useCallback((
    fromMode: CardMode,
    toMode: CardMode,
    currentCard: Card | null,
    solutionCard: SolutionCard | null
  ): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    log('debug', 'Validating transition', { fromMode, toMode });

    // Validate transition is valid
    if (fromMode === toMode) {
      errors.push(`Invalid transition: already in ${fromMode} mode`);
    }

    // Validate resources are available for transition
    if (toMode === 'REGULAR' && !currentCard) {
      errors.push('Cannot transition to regular mode without a current card');
    }

    if (toMode === 'ANSWER' && !solutionCard) {
      warnings.push('Transitioning to answer mode will create a new solution card');
    }

    const isValid = errors.length === 0;
    const canProceed = isValid;

    const result: ValidationResult = {
      isValid,
      errors,
      warnings,
      canProceed
    };

    log(isValid ? 'debug' : 'error', 'Transition validation result', result);

    return result;
  }, [log]);

  const captureValidState = useCallback((
    mode: CardMode,
    transitionState: TransitionState,
    regularCard: Card | null,
    solutionCard: SolutionCard | null,
    editorState: EditorState
  ) => {
    const validation = validateStateConsistency(mode, transitionState, regularCard, solutionCard, editorState);

    if (validation.isValid) {
      lastValidStateRef.current = createStateSnapshot(mode, transitionState, regularCard, solutionCard, editorState);
      log('debug', 'Captured valid state snapshot', {
        checksum: lastValidStateRef.current.checksum,
        timestamp: lastValidStateRef.current.timestamp
      });
    }
  }, [validateStateConsistency, createStateSnapshot, log]);

  const recoverToLastValidState = useCallback((): StateSnapshot | null => {
    const lastValid = lastValidStateRef.current;

    if (lastValid) {
      log('warn', 'Recovering to last valid state', {
        checksum: lastValid.checksum,
        timestamp: lastValid.timestamp,
        age: Date.now() - lastValid.timestamp
      });
    } else {
      log('error', 'No valid state available for recovery');
    }

    return lastValid;
  }, [log]);

  const getValidationHistory = useCallback(() => {
    return [...validationHistoryRef.current];
  }, []);

  const hasStateChanged = useCallback((
    mode: CardMode,
    transitionState: TransitionState,
    regularCard: Card | null,
    solutionCard: SolutionCard | null,
    editorState: EditorState
  ): boolean => {
    if (!lastValidStateRef.current) {
      return true;
    }

    const currentSnapshot = createStateSnapshot(mode, transitionState, regularCard, solutionCard, editorState);
    const hasChanged = currentSnapshot.checksum !== lastValidStateRef.current.checksum;

    if (hasChanged) {
      log('debug', 'State change detected', {
        oldChecksum: lastValidStateRef.current.checksum,
        newChecksum: currentSnapshot.checksum
      });
    }

    return hasChanged;
  }, [createStateSnapshot, log]);

  const createRecoveryPlan = useCallback((
    currentValidation: ValidationResult,
    lastValidState: StateSnapshot | null
  ): {
    action: 'none' | 'retry' | 'recover' | 'reset';
    reason: string;
    data?: any;
  } => {
    if (currentValidation.canProceed) {
      return { action: 'none', reason: 'State is valid, no recovery needed' };
    }

    if (currentValidation.errors.length === 0 && currentValidation.warnings.length > 0) {
      return { action: 'retry', reason: 'Only warnings present, safe to retry' };
    }

    if (lastValidState && (Date.now() - lastValidState.timestamp) < 30000) { // 30 seconds
      return {
        action: 'recover',
        reason: 'Recent valid state available for recovery',
        data: lastValidState
      };
    }

    return {
      action: 'reset',
      reason: 'Critical errors and no recent valid state, reset required'
    };
  }, []);

  return {
    validateStateConsistency,
    validateTransition,
    captureValidState,
    recoverToLastValidState,
    getValidationHistory,
    hasStateChanged,
    createRecoveryPlan
  };
};
