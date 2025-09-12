import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface WorkedTodayStats {
  count: number;
  totalDuration: number; // in seconds
}

interface UseWorkedTodayStatsReturn {
  stats: WorkedTodayStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Custom hook for fetching problems worked today count and total duration
 * Includes automatic midnight refresh functionality
 */
export const useWorkedTodayStats = (): UseWorkedTodayStatsReturn => {
  const [stats, setStats] = useState<WorkedTodayStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const midnightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);

  // Fetch both count and duration from the backend
  const fetchStats = useCallback(async () => {
    if (isUnmountedRef.current) return;

    try {
      setError(null);
      
      // Fetch both count and duration in parallel
      const [countResult, durationResult] = await Promise.all([
        invoke<{ count: number; date: string }>('get_problems_worked_today'),
        invoke<number>('get_worked_today_total_duration')
      ]);
      
      if (!isUnmountedRef.current) {
        setStats({
          count: countResult.count,
          totalDuration: durationResult
        });
        setLoading(false);
      }
    } catch (err) {
      if (!isUnmountedRef.current) {
        console.error('Failed to fetch worked today stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch worked today stats');
        setLoading(false);
      }
    }
  }, []);

  // Refresh function that can be called externally
  const refresh = useCallback(async () => {
    if (isUnmountedRef.current) return;

    setLoading(true);
    await fetchStats();
  }, [fetchStats]);

  // Set up midnight refresh timer
  const setupMidnightTimer = useCallback(() => {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    if (midnightTimeoutRef.current) {
      clearTimeout(midnightTimeoutRef.current);
    }

    midnightTimeoutRef.current = setTimeout(() => {
      if (!isUnmountedRef.current) {
        // Refresh stats for the new day
        refresh();
        
        // Set up the next midnight timer
        setupMidnightTimer();
      }
    }, msUntilMidnight);
  }, [refresh]);

  // Initial data fetch and setup
  useEffect(() => {
    isUnmountedRef.current = false;
    
    fetchStats();
    setupMidnightTimer();

    return () => {
      isUnmountedRef.current = true;
      if (midnightTimeoutRef.current) {
        clearTimeout(midnightTimeoutRef.current);
      }
    };
  }, [fetchStats, setupMidnightTimer]);

  return {
    stats,
    loading,
    error,
    refresh,
  };
};