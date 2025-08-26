// Solution Card API Service
//
// Pure API layer for solution card operations.
// No UI logic, only data fetching and manipulation.

import { invoke } from '@tauri-apps/api/core';
import {
  SolutionCard,
  SolutionCardResponse,
  SolutionCardToggleResponse,
  SolutionCardUpdateResponse
} from '../types';

export class SolutionCardApiError extends Error {
  constructor(message: string, public originalError?: unknown) {
    super(message);
    this.name = 'SolutionCardApiError';
  }
}

export const solutionCardApi = {
  /**
   * Get solution card for a problem
   */
  async get(problemId: string): Promise<SolutionCard | null> {
    try {
      const response = await invoke<SolutionCardResponse>('get_solution_card', {
        problemId
      });

      if (!response.success) {
        throw new SolutionCardApiError(
          response.error || 'Failed to get solution card'
        );
      }

      return response.card;
    } catch (error) {
      if (error instanceof SolutionCardApiError) {
        throw error;
      }
      throw new SolutionCardApiError(
        'Failed to get solution card',
        error
      );
    }
  },

  /**
   * Create solution card for a problem
   */
  async create(problemId: string): Promise<SolutionCard> {
    try {
      const response = await invoke<SolutionCardResponse>('create_solution_card', {
        problemId
      });

      if (!response.success || !response.card) {
        throw new SolutionCardApiError(
          response.error || 'Failed to create solution card'
        );
      }

      return response.card;
    } catch (error) {
      if (error instanceof SolutionCardApiError) {
        throw error;
      }
      throw new SolutionCardApiError(
        'Failed to create solution card',
        error
      );
    }
  },

  /**
   * Toggle solution view - get existing or create new
   */
  async toggle(problemId: string, createIfMissing: boolean = true): Promise<{
    isViewingSolution: boolean;
    card: SolutionCard | null;
  }> {
    try {
      const response = await invoke<SolutionCardToggleResponse>('toggle_solution_view', {
        problemId,
        createIfMissing
      });

      if (!response.success) {
        throw new SolutionCardApiError(
          response.error || 'Failed to toggle solution view'
        );
      }

      return {
        isViewingSolution: response.is_viewing_solution,
        card: response.card
      };
    } catch (error) {
      if (error instanceof SolutionCardApiError) {
        throw error;
      }
      throw new SolutionCardApiError(
        'Failed to toggle solution view',
        error
      );
    }
  },

  /**
   * Update solution card code
   */
  async updateCode(cardId: string, code: string, language: string): Promise<void> {
    try {
      const response = await invoke<SolutionCardUpdateResponse>('update_solution_card_code', {
        cardId,
        code,
        language
      });

      if (!response.success) {
        throw new SolutionCardApiError(
          response.error || 'Failed to update solution card code'
        );
      }
    } catch (error) {
      if (error instanceof SolutionCardApiError) {
        throw error;
      }
      throw new SolutionCardApiError(
        'Failed to update solution card code',
        error
      );
    }
  },

  /**
   * Update solution card notes
   */
  async updateNotes(cardId: string, notes: string): Promise<void> {
    try {
      const response = await invoke<SolutionCardUpdateResponse>('update_solution_card_notes', {
        cardId,
        notes
      });

      if (!response.success) {
        throw new SolutionCardApiError(
          response.error || 'Failed to update solution card notes'
        );
      }
    } catch (error) {
      if (error instanceof SolutionCardApiError) {
        throw error;
      }
      throw new SolutionCardApiError(
        'Failed to update solution card notes',
        error
      );
    }
  },

  /**
   * Check if solution card exists
   */
  async exists(problemId: string): Promise<boolean> {
    try {
      return await invoke<boolean>('solution_card_exists', {
        problemId
      });
    } catch (error) {
      throw new SolutionCardApiError(
        'Failed to check if solution card exists',
        error
      );
    }
  },

  /**
   * Get regular (non-solution) cards for a problem
   */
  async getRegularCards(problemId: string): Promise<SolutionCard[]> {
    try {
      return await invoke<SolutionCard[]>('get_regular_cards', {
        problemId
      });
    } catch (error) {
      throw new SolutionCardApiError(
        'Failed to get regular cards',
        error
      );
    }
  }
};