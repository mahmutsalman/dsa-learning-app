import { useState, useEffect, useCallback, useRef } from 'react';
import { WorkSessionService, WorkSessionStats } from '../services/WorkSessionService';

interface UseWorkSessionStatsReturn {
  yesterdayStats: WorkSessionStats | null;
  last7DaysStats: WorkSessionStats | null;
  last30DaysStats: WorkSessionStats | null;
  todayStats: WorkSessionStats | null;
  loading: {
    yesterday: boolean;
    last7Days: boolean;
    last30Days: boolean;
    today: boolean;
  };
  errors: {
    yesterday: string | null;
    last7Days: string | null;
    last30Days: string | null;
    today: string | null;
  };
  refresh: () => Promise<void>;
  refreshYesterday: () => Promise<void>;
  refreshLast7Days: () => Promise<void>;
  refreshLast30Days: () => Promise<void>;
  refreshToday: () => Promise<void>;
}

/**
 * Custom hook for fetching work session statistics
 * Includes automatic midnight refresh functionality and error handling
 */
export const useWorkSessionStats = (): UseWorkSessionStatsReturn => {
  const [yesterdayStats, setYesterdayStats] = useState<WorkSessionStats | null>(null);
  const [last7DaysStats, setLast7DaysStats] = useState<WorkSessionStats | null>(null);
  const [last30DaysStats, setLast30DaysStats] = useState<WorkSessionStats | null>(null);
  const [todayStats, setTodayStats] = useState<WorkSessionStats | null>(null);
  
  const [loading, setLoading] = useState({
    yesterday: true,
    last7Days: true,
    last30Days: true,
    today: true,
  });
  
  const [errors, setErrors] = useState({
    yesterday: null as string | null,
    last7Days: null as string | null,
    last30Days: null as string | null,
    today: null as string | null,
  });
  
  const midnightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);

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
        // Clear cache and refresh all stats for the new day
        WorkSessionService.clearCache();
        refresh();
        
        // Set up the next midnight timer
        setupMidnightTimer();
      }
    }, msUntilMidnight);
  }, []);

  // Fetch yesterday's stats
  const fetchYesterdayStats = useCallback(async () => {
    if (isUnmountedRef.current) return;
    
    setLoading(prev => ({ ...prev, yesterday: true }));
    setErrors(prev => ({ ...prev, yesterday: null }));
    
    try {
      const stats = await WorkSessionService.getYesterdayStats();
      if (!isUnmountedRef.current) {
        setYesterdayStats(stats);
      }
    } catch (error) {
      if (!isUnmountedRef.current) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch yesterday\'s stats';
        setErrors(prev => ({ ...prev, yesterday: errorMessage }));
        console.error('Error fetching yesterday stats:', error);
      }
    } finally {
      if (!isUnmountedRef.current) {
        setLoading(prev => ({ ...prev, yesterday: false }));
      }
    }
  }, []);

  // Fetch last 7 days stats
  const fetchLast7DaysStats = useCallback(async () => {
    if (isUnmountedRef.current) return;
    
    setLoading(prev => ({ ...prev, last7Days: true }));
    setErrors(prev => ({ ...prev, last7Days: null }));
    
    try {
      const stats = await WorkSessionService.getLast7DaysStats();
      if (!isUnmountedRef.current) {
        setLast7DaysStats(stats);
      }
    } catch (error) {
      if (!isUnmountedRef.current) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch last 7 days stats';
        setErrors(prev => ({ ...prev, last7Days: errorMessage }));
        console.error('Error fetching last 7 days stats:', error);
      }
    } finally {
      if (!isUnmountedRef.current) {
        setLoading(prev => ({ ...prev, last7Days: false }));
      }
    }
  }, []);

  // Fetch last 30 days stats
  const fetchLast30DaysStats = useCallback(async () => {
    if (isUnmountedRef.current) return;
    
    setLoading(prev => ({ ...prev, last30Days: true }));
    setErrors(prev => ({ ...prev, last30Days: null }));
    
    try {
      const stats = await WorkSessionService.getLast30DaysStats();
      if (!isUnmountedRef.current) {
        setLast30DaysStats(stats);
      }
    } catch (error) {
      if (!isUnmountedRef.current) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch last 30 days stats';
        setErrors(prev => ({ ...prev, last30Days: errorMessage }));
        console.error('Error fetching last 30 days stats:', error);
      }
    } finally {
      if (!isUnmountedRef.current) {
        setLoading(prev => ({ ...prev, last30Days: false }));
      }
    }
  }, []);

  // Fetch today's stats
  const fetchTodayStats = useCallback(async () => {
    if (isUnmountedRef.current) return;
    
    setLoading(prev => ({ ...prev, today: true }));
    setErrors(prev => ({ ...prev, today: null }));
    
    try {
      const stats = await WorkSessionService.getTodayStats();
      if (!isUnmountedRef.current) {
        setTodayStats(stats);
      }
    } catch (error) {
      if (!isUnmountedRef.current) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch today\'s stats';
        setErrors(prev => ({ ...prev, today: errorMessage }));
        console.error('Error fetching today stats:', error);
      }
    } finally {
      if (!isUnmountedRef.current) {
        setLoading(prev => ({ ...prev, today: false }));
      }
    }
  }, []);

  // Fetch all stats
  const fetchAllStats = useCallback(async () => {
    await Promise.all([
      fetchYesterdayStats(),
      fetchLast7DaysStats(),
      fetchLast30DaysStats(),
      fetchTodayStats(),
    ]);
  }, [fetchYesterdayStats, fetchLast7DaysStats, fetchLast30DaysStats, fetchTodayStats]);

  // Refresh functions
  const refresh = useCallback(async () => {
    WorkSessionService.clearCache();
    await fetchAllStats();
  }, [fetchAllStats]);

  const refreshYesterday = useCallback(async () => {
    WorkSessionService.clearCacheForPattern('yesterday');
    await fetchYesterdayStats();
  }, [fetchYesterdayStats]);

  const refreshLast7Days = useCallback(async () => {
    WorkSessionService.clearCacheForPattern('last-7-days');
    await fetchLast7DaysStats();
  }, [fetchLast7DaysStats]);

  const refreshLast30Days = useCallback(async () => {
    WorkSessionService.clearCacheForPattern('last-30-days');
    await fetchLast30DaysStats();
  }, [fetchLast30DaysStats]);

  const refreshToday = useCallback(async () => {
    WorkSessionService.clearCacheForPattern('today');
    await fetchTodayStats();
  }, [fetchTodayStats]);

  // Initial data fetch and setup
  useEffect(() => {
    isUnmountedRef.current = false;
    
    fetchAllStats();
    setupMidnightTimer();

    return () => {
      isUnmountedRef.current = true;
      if (midnightTimeoutRef.current) {
        clearTimeout(midnightTimeoutRef.current);
      }
    };
  }, [fetchAllStats, setupMidnightTimer]);

  return {
    yesterdayStats,
    last7DaysStats,
    last30DaysStats,
    todayStats,
    loading,
    errors,
    refresh,
    refreshYesterday,
    refreshLast7Days,
    refreshLast30Days,
    refreshToday,
  };
};