// Solution Card Type Definitions
//
// Clean type definitions for the solution card feature.
// These extend existing types without breaking backward compatibility.

export interface SolutionCard {
  id: string;
  problem_id: string;
  card_number: number;
  code: string;
  language: string;
  notes: string;
  status: string;
  total_duration: number;
  created_at: string;
  last_modified: string;
  is_solution: boolean;
}

export interface SolutionCardState {
  isActive: boolean;
  solutionCard: SolutionCard | null;
  isLoading: boolean;
  error: string | null;
}

export interface SolutionCardHookReturn {
  state: SolutionCardState;
  actions: {
    toggle: () => Promise<void>;
    create: () => Promise<void>;
    load: () => Promise<void>;
    updateCode: (code: string, language: string) => Promise<void>;
    updateNotes: (notes: string) => Promise<void>;
    exitSolution: () => void;
  };
}

// API Response Types
export interface SolutionCardResponse {
  success: boolean;
  card: SolutionCard | null;
  error: string | null;
}

export interface SolutionCardToggleResponse {
  success: boolean;
  is_viewing_solution: boolean;
  card: SolutionCard | null;
  error: string | null;
}

export interface SolutionCardUpdateResponse {
  success: boolean;
  error: string | null;
}

// Component Props
export interface SolutionCardButtonProps {
  onSolutionToggle: (event: React.KeyboardEvent | React.MouseEvent) => void;
  isActive: boolean;
  disabled?: boolean;
  className?: string;
}

export interface SolutionCardIndicatorProps {
  isActive: boolean;
  className?: string;
  screenSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

// Extended Card type for backward compatibility
export interface CardWithSolution {
  id: string;
  problem_id: string;
  card_number: number;
  code: string;
  language: string;
  notes: string;
  status: string;
  total_duration: number;
  created_at: string;
  last_modified: string;
  parent_card_id?: string;
  is_solution?: boolean; // Optional for backward compatibility
}