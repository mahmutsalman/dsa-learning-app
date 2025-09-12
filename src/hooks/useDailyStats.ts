import { useState, useEffect, useCallback, useRef } from 'react';
import { StatsService, DailyWorkStats } from '../services/StatsService';

interface UseDailyStatsReturn {
  dailyStats: DailyWorkStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  problemsWorkedToday: number;
}

/**
 * Custom hook for managing daily statistics
 * Automatically refreshes at midnight and handles caching
 */
export const useDailyStats = (): UseDailyStatsReturn => {
  const [dailyStats, setDailyStats] = useState<DailyWorkStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const midnightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);

  // Fetch daily stats from the service
  const fetchDailyStats = useCallback(async () => {
    if (isUnmountedRef.current) return;

    try {
      setError(null);
      
      // Clear expired cache before fetching
      StatsService.checkAndClearExpiredDailyCache();
      
      const stats = await StatsService.getDailyWorkStats();
      
      if (!isUnmountedRef.current) {
        setDailyStats(stats);
        setLoading(false);
      }
    } catch (err) {
      if (!isUnmountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch daily stats');
        setLoading(false);
      }
    }
  }, []);

  // Refresh function that can be called externally
  const refresh = useCallback(async () => {
    if (isUnmountedRef.current) return;

    setLoading(true);
    StatsService.clearCacheForKey('daily-work-stats');
    await fetchDailyStats();
  }, [fetchDailyStats]);

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
        // Clear all daily caches at midnight
        StatsService.checkAndClearExpiredDailyCache();
        
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
    
    fetchDailyStats();
    setupMidnightTimer();

    return () => {
      isUnmountedRef.current = true;
      if (midnightTimeoutRef.current) {
        clearTimeout(midnightTimeoutRef.current);
      }
    };
  }, [fetchDailyStats, setupMidnightTimer]);

  return {
    dailyStats,
    loading,
    error,
    refresh,
    problemsWorkedToday: dailyStats?.problems_worked ?? 0,
  };
};

/**
 * Simplified hook that only returns the problems worked today count
 * Useful for components that only need the count without other stats
 */
export const useProblemsWorkedToday = () => {
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCount = useCallback(async () => {
    try {
      setError(null);
      StatsService.checkAndClearExpiredDailyCache();
      
      const result = await StatsService.getProblemsWorkedToday();
      setCount(result.count);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch problems count');
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    StatsService.clearCacheForKey('problems-worked-today');
    await fetchCount();
  }, [fetchCount]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  return {
    count,
    loading,
    error,
    refresh,
  };
};