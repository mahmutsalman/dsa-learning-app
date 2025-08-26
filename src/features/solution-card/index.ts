// Solution Card Feature - Public API
//
// Clean public interface for the solution card feature.
// Import only what you need from this single entry point.

// Components
export { SolutionCardButton } from './components/SolutionCardButton';
export { SolutionCardIndicator } from './components/SolutionCardIndicator';

// Hooks
export { useSolutionCard } from './hooks/useSolutionCard';

// Services
export { solutionCardApi, SolutionCardApiError } from './services/solutionCardApi';

// Types
export type {
  SolutionCard,
  SolutionCardState,
  SolutionCardHookReturn,
  SolutionCardButtonProps,
  SolutionCardIndicatorProps,
  SolutionCardResponse,
  SolutionCardToggleResponse,
  SolutionCardUpdateResponse,
  CardWithSolution
} from './types';

// Utilities
export {
  isShiftAction,
  filterRegularCards,
  findSolutionCard,
  solutionCardToCard,
  getNavigationText,
  validateSolutionCard,
  debugSolutionCard
} from './utils/solutionCardHelpers';