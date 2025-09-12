import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { filterManager } from '../services/FilterManager';

export interface WorkedTodayFilterState {
  isFiltered: boolean;
  problemIds: string[];
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook for managing "Worked Today" filter state
 * Integrates with FilterManager for centralized filter coordination
 */
export function useWorkedTodayFilter() {
  const [state, setState] = useState<WorkedTodayFilterState>({
    isFiltered: false,
    problemIds: [],
    loading: false,
    error: null
  });

  // Fetch problems worked today from backend
  const fetchWorkedTodayProblems = useCallback(async (): Promise<string[]> => {
    try {
      const problemIds = await invoke<string[]>('get_problems_worked_today_list');
      return problemIds;
    } catch (error) {
      console.error('Failed to fetch worked today problems:', error);
      throw error;
    }
  }, []);

  // Toggle the worked today filter
  const toggleFilter = useCallback(async () => {
    if (state.isFiltered) {
      // Clear the filter
      filterManager.clearWorkedTodayFilter();
      setState(prev => ({
        ...prev,
        isFiltered: false,
        problemIds: [],
        error: null
      }));
    } else {
      // Activate the filter
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      try {
        const problemIds = await fetchWorkedTodayProblems();
        
        if (problemIds.length === 0) {
          // No problems worked today
          setState(prev => ({
            ...prev,
            loading: false,
            error: 'No problems worked today'
          }));
          return;
        }
        
        // Set the filter in FilterManager
        filterManager.setWorkedTodayFilter(problemIds);
        
        setState(prev => ({
          ...prev,
          isFiltered: true,
          problemIds,
          loading: false,
          error: null
        }));
        
      } catch (error) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: error as string
        }));
      }
    }
  }, [state.isFiltered, fetchWorkedTodayProblems]);

  // Force refresh the filter (re-fetch problems)
  const refreshFilter = useCallback(async () => {
    if (!state.isFiltered) return;
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const problemIds = await fetchWorkedTodayProblems();
      
      // Update FilterManager with new data
      filterManager.setWorkedTodayFilter(problemIds);
      
      setState(prev => ({
        ...prev,
        problemIds,
        loading: false,
        error: null
      }));
      
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error as string
      }));
    }
  }, [state.isFiltered, fetchWorkedTodayProblems]);

  // Clear the filter manually
  const clearFilter = useCallback(() => {
    filterManager.clearWorkedTodayFilter();
    setState(prev => ({
      ...prev,
      isFiltered: false,
      problemIds: [],
      error: null
    }));
  }, []);

  // Listen to FilterManager changes
  useEffect(() => {
    const unsubscribe = filterManager.subscribe((filterState) => {
      setState(prev => ({
        ...prev,
        isFiltered: filterState.workedToday.active,
        problemIds: filterState.workedToday.problemIds
      }));
    });

    // Initialize state from FilterManager
    const currentFilterState = filterManager.getState();
    setState(prev => ({
      ...prev,
      isFiltered: currentFilterState.workedToday.active,
      problemIds: currentFilterState.workedToday.problemIds
    }));

    return unsubscribe;
  }, []);

  return {
    ...state,
    toggleFilter,
    refreshFilter,
    clearFilter,
    // Helper functions for convenience
    isActive: state.isFiltered,
    hasProblemsToday: state.problemIds.length > 0 || (!state.loading && !state.error && !state.isFiltered)
  };
}

/**
 * Simple hook that just returns the current worked today filter state without management functions
 * Useful for components that only need to read the filter state
 */
export function useWorkedTodayFilterState() {
  const [state, setState] = useState({
    isFiltered: false,
    problemIds: [] as string[]
  });

  useEffect(() => {
    const unsubscribe = filterManager.subscribe((filterState) => {
      setState({
        isFiltered: filterState.workedToday.active,
        problemIds: filterState.workedToday.problemIds
      });
    });

    // Initialize state from FilterManager
    const currentFilterState = filterManager.getState();
    setState({
      isFiltered: currentFilterState.workedToday.active,
      problemIds: currentFilterState.workedToday.problemIds
    });

    return unsubscribe;
  }, []);

  return state;
}