/**
 * FilterManager - Centralized filter state management for Dashboard
 * Handles coordination of different filter types: search, tags, and worked today
 */
export type FilterType = 'search' | 'tags' | 'workedToday';

export interface FilterState {
  search: {
    active: boolean;
    query: string;
    type: 'name' | 'topic' | 'tags';
  };
  tags: {
    active: boolean;
    selectedTagIds: string[];
  };
  workedToday: {
    active: boolean;
    problemIds: string[];
  };
}

export class FilterManager {
  private state: FilterState;
  private listeners: Set<(state: FilterState) => void>;

  constructor() {
    this.state = {
      search: {
        active: false,
        query: '',
        type: 'name'
      },
      tags: {
        active: false,
        selectedTagIds: []
      },
      workedToday: {
        active: false,
        problemIds: []
      }
    };
    this.listeners = new Set();
  }

  /**
   * Subscribe to filter state changes
   */
  subscribe(listener: (state: FilterState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state changes
   */
  private notify(): void {
    this.listeners.forEach(listener => listener(this.state));
  }

  /**
   * Get current filter state
   */
  getState(): FilterState {
    return { ...this.state };
  }

  /**
   * Set search filter
   */
  setSearchFilter(query: string, type: 'name' | 'topic' | 'tags'): void {
    this.state.search = {
      active: query.trim() !== '',
      query: query.trim(),
      type
    };
    this.notify();
  }

  /**
   * Clear search filter
   */
  clearSearchFilter(): void {
    this.state.search = {
      active: false,
      query: '',
      type: 'name'
    };
    this.notify();
  }

  /**
   * Set tag filter
   */
  setTagFilter(tagIds: string[]): void {
    this.state.tags = {
      active: tagIds.length > 0,
      selectedTagIds: [...tagIds]
    };
    this.notify();
  }

  /**
   * Clear tag filter
   */
  clearTagFilter(): void {
    this.state.tags = {
      active: false,
      selectedTagIds: []
    };
    this.notify();
  }

  /**
   * Set worked today filter
   */
  setWorkedTodayFilter(problemIds: string[]): void {
    this.state.workedToday = {
      active: problemIds.length > 0,
      problemIds: [...problemIds]
    };
    this.notify();
  }

  /**
   * Toggle worked today filter
   */
  toggleWorkedTodayFilter(problemIds: string[]): void {
    if (this.state.workedToday.active) {
      this.clearWorkedTodayFilter();
    } else {
      this.setWorkedTodayFilter(problemIds);
    }
  }

  /**
   * Clear worked today filter
   */
  clearWorkedTodayFilter(): void {
    this.state.workedToday = {
      active: false,
      problemIds: []
    };
    this.notify();
  }

  /**
   * Clear all filters
   */
  clearAllFilters(): void {
    this.state = {
      search: {
        active: false,
        query: '',
        type: 'name'
      },
      tags: {
        active: false,
        selectedTagIds: []
      },
      workedToday: {
        active: false,
        problemIds: []
      }
    };
    this.notify();
  }

  /**
   * Check if any filters are active
   */
  hasActiveFilters(): boolean {
    return this.state.search.active || 
           this.state.tags.active || 
           this.state.workedToday.active;
  }

  /**
   * Get list of active filter types
   */
  getActiveFilterTypes(): FilterType[] {
    const activeTypes: FilterType[] = [];
    if (this.state.search.active) activeTypes.push('search');
    if (this.state.tags.active) activeTypes.push('tags');
    if (this.state.workedToday.active) activeTypes.push('workedToday');
    return activeTypes;
  }

  /**
   * Check if worked today filter is active
   */
  isWorkedTodayActive(): boolean {
    return this.state.workedToday.active;
  }

  /**
   * Get worked today problem IDs
   */
  getWorkedTodayProblemIds(): string[] {
    return [...this.state.workedToday.problemIds];
  }

  /**
   * Get human-readable description of active filters
   */
  getActiveFiltersDescription(): string {
    const descriptions: string[] = [];
    
    if (this.state.search.active) {
      descriptions.push(`Search: "${this.state.search.query}" in ${this.state.search.type}`);
    }
    
    if (this.state.tags.active) {
      descriptions.push(`Tags: ${this.state.tags.selectedTagIds.length} selected`);
    }
    
    if (this.state.workedToday.active) {
      descriptions.push(`Worked today: ${this.state.workedToday.problemIds.length} problems`);
    }
    
    return descriptions.join(' | ');
  }
}

// Export singleton instance
export const filterManager = new FilterManager();