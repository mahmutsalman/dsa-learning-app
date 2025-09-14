import { useCallback } from 'react';
import { Card } from '../types';
import { SolutionCard } from '../features/solution-card/types';
import { CardMode, EditorState } from './useCardModeStateMachine';

export interface ForceSaveOptions {
  currentMode: CardMode;
  currentCard: Card | null;
  solutionCard: SolutionCard | null;
  editorState: EditorState;
  saveRegularCard: (card: Card, state: EditorState) => Promise<void>;
  saveSolutionCard: (card: SolutionCard, state: EditorState) => Promise<void>;
}

export interface ValidationResult {
  isValid: boolean;
  expectedCardId: string | null;
  actualTarget: 'regular' | 'solution' | null;
  error?: string;
}

export const useEnhancedForceSave = () => {
  const validateSaveTarget = useCallback((options: ForceSaveOptions): ValidationResult => {
    const { currentMode, currentCard, solutionCard } = options;

    // Validate we have the expected card for the current mode
    if (currentMode === 'REGULAR') {
      if (!currentCard) {
        return {
          isValid: false,
          expectedCardId: null,
          actualTarget: null,
          error: 'No regular card available for regular mode'
        };
      }

      return {
        isValid: true,
        expectedCardId: currentCard.id,
        actualTarget: 'regular'
      };
    } else if (currentMode === 'ANSWER') {
      if (!solutionCard) {
        return {
          isValid: false,
          expectedCardId: null,
          actualTarget: null,
          error: 'No solution card available for answer mode'
        };
      }

      return {
        isValid: true,
        expectedCardId: solutionCard.id,
        actualTarget: 'solution'
      };
    }

    return {
      isValid: false,
      expectedCardId: null,
      actualTarget: null,
      error: `Unknown mode: ${currentMode}`
    };
  }, []);

  const forceSave = useCallback(async (options: ForceSaveOptions): Promise<{
    success: boolean;
    error?: string;
    savedTo?: 'regular' | 'solution';
    cardId?: string;
  }> => {
    console.debug('EnhancedForceSave: Starting validated force save', {
      mode: options.currentMode,
      regularCardId: options.currentCard?.id,
      solutionCardId: options.solutionCard?.id,
      editorState: {
        codeLength: options.editorState.code.length,
        notesLength: options.editorState.notes.length,
        language: options.editorState.language
      }
    });

    // Validate the save target
    const validation = validateSaveTarget(options);
    if (!validation.isValid) {
      console.error('EnhancedForceSave: Validation failed:', validation.error);
      return {
        success: false,
        error: validation.error
      };
    }

    try {
      if (validation.actualTarget === 'regular' && options.currentCard) {
        console.debug('EnhancedForceSave: Saving to regular card', {
          cardId: options.currentCard.id
        });

        await options.saveRegularCard(options.currentCard, options.editorState);

        console.debug('EnhancedForceSave: Regular card saved successfully');
        return {
          success: true,
          savedTo: 'regular',
          cardId: options.currentCard.id
        };

      } else if (validation.actualTarget === 'solution' && options.solutionCard) {
        console.debug('EnhancedForceSave: Saving to solution card', {
          cardId: options.solutionCard.id
        });

        await options.saveSolutionCard(options.solutionCard, options.editorState);

        console.debug('EnhancedForceSave: Solution card saved successfully');
        return {
          success: true,
          savedTo: 'solution',
          cardId: options.solutionCard.id
        };
      }

      const error = 'No valid save target found';
      console.error('EnhancedForceSave:', error);
      return {
        success: false,
        error
      };

    } catch (saveError) {
      const error = saveError instanceof Error ? saveError.message : String(saveError);
      console.error('EnhancedForceSave: Save operation failed:', error);
      return {
        success: false,
        error: `Save failed: ${error}`
      };
    }
  }, [validateSaveTarget]);

  return {
    forceSave,
    validateSaveTarget
  };
};