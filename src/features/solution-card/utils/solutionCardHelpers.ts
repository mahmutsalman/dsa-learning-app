// Solution Card Utility Functions
//
// Helper functions for solution card operations and logic.

import { SolutionCard } from '../types';
import { Card, CardStatus } from '../../../types';
import { DEFAULT_LANGUAGE } from '../../../constants/editor';

/**
 * Check if an event is a shift+click or shift+enter
 */
export const isShiftAction = (event: React.KeyboardEvent | React.MouseEvent): boolean => {
  return event.shiftKey && (
    ('type' in event && event.type === 'click') ||
    ('key' in event && (event.key === 'Enter' || event.key === ' '))
  );
};

/**
 * Filter out solution cards from regular card navigation
 */
export const filterRegularCards = (cards: Card[]): Card[] => {
  return cards.filter(card => !('is_solution' in card) || !card.is_solution);
};

/**
 * Find solution card in a list of cards
 */
export const findSolutionCard = (cards: Card[]): Card | null => {
  const solutionCard = cards.find(card => 
    'is_solution' in card && card.is_solution === true
  );
  return solutionCard || null;
};

/**
 * Convert solution card to regular card format for UI compatibility
 * Creates a new object to ensure React detects state changes
 */
export const solutionCardToCard = (solutionCard: SolutionCard): Card => {
  // Validate input data to ensure proper conversion
  if (!solutionCard) {
    console.warn('solutionCardToCard: null or undefined solution card provided');
    throw new Error('Invalid solution card provided for conversion');
  }

  // Ensure required fields have default values
  const convertedCard: Card = {
    id: solutionCard.id,
    problem_id: solutionCard.problem_id,
    card_number: solutionCard.card_number || 1,
    code: solutionCard.code || '', // Ensure code is never undefined
    language: solutionCard.language || DEFAULT_LANGUAGE, // Ensure language has default
    notes: solutionCard.notes || '', // Ensure notes is never undefined
    status: solutionCard.status as CardStatus,
    total_duration: solutionCard.total_duration || 0,
    created_at: solutionCard.created_at,
    last_modified: solutionCard.last_modified,
    is_solution: true, // Always mark as solution card for React key differentiation
    // Add a timestamp to ensure object uniqueness for React re-rendering
    _converted_at: Date.now()
  };

  // Debug validation in development
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    console.debug('[solutionCardHelpers] Converted solution card:', {
      originalId: solutionCard.id,
      convertedId: convertedCard.id,
      codeLength: convertedCard.code.length,
      notesLength: convertedCard.notes.length,
      language: convertedCard.language,
      dataPreservation: {
        codeMatches: solutionCard.code === convertedCard.code,
        notesMatches: solutionCard.notes === convertedCard.notes,
        languageMatches: solutionCard.language === convertedCard.language
      }
    });
  }

  return convertedCard;
};

/**
 * Get appropriate navigation context text
 */
export const getNavigationText = (
  isViewingSolution: boolean,
  regularCards: Card[],
  currentCardIndex?: number
): string => {
  if (isViewingSolution) {
    return '1/1 Solution';
  }

  if (regularCards.length === 0) {
    return '0/0';
  }

  const currentIndex = currentCardIndex !== undefined ? currentCardIndex : 0;
  const totalCards = regularCards.length;
  
  return `${Math.max(1, currentIndex + 1)}/${totalCards}`;
};

/**
 * Validate solution card data
 */
export const validateSolutionCard = (card: any): card is SolutionCard => {
  return (
    card &&
    typeof card === 'object' &&
    typeof card.id === 'string' &&
    typeof card.problem_id === 'string' &&
    typeof card.is_solution === 'boolean' &&
    card.is_solution === true
  );
};

/**
 * Debug helper to log solution card state
 */
export const debugSolutionCard = (
  prefix: string,
  isActive: boolean,
  card: SolutionCard | null,
  error?: string | null
) => {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    console.debug(`[SolutionCard] ${prefix}:`, {
      isActive,
      cardId: card?.id,
      problemId: card?.problem_id,
      error,
      timestamp: new Date().toISOString()
    });
  }
};
