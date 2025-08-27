// Solution Card Utility Functions
//
// Helper functions for solution card operations and logic.

import { SolutionCard } from '../types';
import { Card, CardStatus } from '../../../types';

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
 */
export const solutionCardToCard = (solutionCard: SolutionCard): Card => {
  return {
    id: solutionCard.id,
    problem_id: solutionCard.problem_id,
    card_number: solutionCard.card_number,
    code: solutionCard.code,
    language: solutionCard.language,
    notes: solutionCard.notes,
    status: solutionCard.status as CardStatus,
    total_duration: solutionCard.total_duration,
    created_at: solutionCard.created_at,
    last_modified: solutionCard.last_modified,
    is_solution: solutionCard.is_solution
  };
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