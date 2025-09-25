import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface ReviewTimerState {
  isRunning: boolean;
  isPaused: boolean;
  currentSessionId?: string;
  sessionStartTime?: Date;
  elapsedTime: number; // in seconds
}

export interface UseReviewTimerReturn {
  reviewTimerState: ReviewTimerState;
  totalReviewDuration: number; // card's total review_duration in seconds
  startReviewTimer: (cardId: string) => Promise<void>;
  stopReviewTimer: () => Promise<void>;
  pauseReviewTimer: () => Promise<void>;
  resumeReviewTimer: () => Promise<void>;
  refreshReviewTimerState: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function useReviewTimer(cardId?: string): UseReviewTimerReturn {
  const [reviewTimerState, setReviewTimerState] = useState<ReviewTimerState>({
    isRunning: false,
    isPaused: false,
    elapsedTime: 0
  });
  const [totalReviewDuration, setTotalReviewDuration] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Debug logging helper - disabled to prevent memory leaks
  const debugLog = (_message: string, _data?: any) => {
    // Disabled to prevent memory leak when inspector is open
    // Uncomment only when actively debugging
    // console.log(`🔶 [Review Timer Debug] ${message}`, data ? data : '');
  };

  // Refresh review timer state from backend
  const refreshReviewTimerState = useCallback(async () => {
    try {
      debugLog('Refreshing review timer state...');
      setError(null);

      const backendState = await invoke<ReviewTimerState>('get_review_timer_state');
      debugLog('Backend review timer state received:', backendState);

      // Validate and sanitize backend state
      const sanitizedState = {
        currentSessionId: backendState.current_session_id,
        elapsedTime: typeof backendState.elapsed_time === 'number' && !isNaN(backendState.elapsed_time)
          ? backendState.elapsed_time
          : 0,
        sessionStartTime: backendState.session_start_time
          ? new Date(backendState.session_start_time)
          : undefined,
        // Ensure all boolean fields are properly set
        isRunning: Boolean(backendState.is_running),
        isPaused: Boolean(backendState.is_paused)
      };

      debugLog('Sanitized review timer state:', sanitizedState);
      setReviewTimerState(sanitizedState);

      // If we have a card, also get its total review duration
      if (cardId) {
        debugLog(`Getting card data for cardId: ${cardId}`);
        const card = await invoke<any>('get_card_by_id', { id: cardId });
        debugLog('Card data received:', card);

        const cardReviewDuration = typeof card?.review_duration === 'number' && !isNaN(card.review_duration)
          ? card.review_duration
          : 0;

        debugLog(`Setting total review duration: ${cardReviewDuration}`);
        setTotalReviewDuration(cardReviewDuration);
      } else {
        debugLog('No cardId provided, setting total review duration to 0');
        setTotalReviewDuration(0);
      }
    } catch (err) {
      setError(err as string);
      debugLog('Error refreshing review timer state:', err);
    }
  }, [cardId]);

  // Start review timer session
  const startReviewTimer = useCallback(async (targetCardId: string) => {
    try {
      debugLog(`Starting review timer for card: ${targetCardId}`);
      setIsLoading(true);
      setError(null);

      const newState = await invoke<ReviewTimerState>('start_review_timer_session', {
        cardId: targetCardId
      });
      debugLog('Start review timer response:', newState);

      // Validate and sanitize new state
      const sanitizedNewState = {
        currentSessionId: newState.current_session_id,
        elapsedTime: typeof newState.elapsed_time === 'number' && !isNaN(newState.elapsed_time)
          ? newState.elapsed_time
          : 0,
        sessionStartTime: newState.session_start_time
          ? new Date(newState.session_start_time)
          : undefined,
        // Ensure all boolean fields are properly set
        isRunning: Boolean(newState.is_running),
        isPaused: Boolean(newState.is_paused)
      };

      debugLog('Sanitized start review timer state:', sanitizedNewState);
      setReviewTimerState(sanitizedNewState);
    } catch (err) {
      setError(err as string);
      debugLog('Error starting review timer:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Stop review timer session
  const stopReviewTimer = useCallback(async () => {
    try {
      debugLog('Stopping review timer session...');
      setIsLoading(true);
      setError(null);

      await invoke('stop_review_timer_session');
      debugLog('Review timer stop command completed');

      // Refresh state to get updated review_duration and timer state
      await refreshReviewTimerState();
      debugLog('Review timer state refreshed after stop');
    } catch (err) {
      setError(err as string);
      debugLog('Error stopping review timer:', err);
    } finally {
      setIsLoading(false);
    }
  }, [refreshReviewTimerState]);

  // Pause review timer session
  const pauseReviewTimer = useCallback(async () => {
    try {
      setError(null);
      await invoke('pause_review_timer_session');
      setReviewTimerState(prev => ({ ...prev, isPaused: true }));
    } catch (err) {
      setError(err as string);
    }
  }, []);

  // Resume review timer session
  const resumeReviewTimer = useCallback(async () => {
    try {
      setError(null);
      await invoke('resume_review_timer_session');
      setReviewTimerState(prev => ({ ...prev, isPaused: false }));
    } catch (err) {
      setError(err as string);
    }
  }, []);

  // Initialize review timer state on mount and when cardId changes
  useEffect(() => {
    refreshReviewTimerState();
  }, [refreshReviewTimerState]);

  // Set up real-time review timer updates when running
  useEffect(() => {
    debugLog('Review timer interval effect triggered', {
      isRunning: reviewTimerState.isRunning,
      isPaused: reviewTimerState.isPaused,
      hasStartTime: !!reviewTimerState.sessionStartTime,
      startTime: reviewTimerState.sessionStartTime,
      currentElapsed: reviewTimerState.elapsedTime
    });

    if (reviewTimerState.isRunning && !reviewTimerState.isPaused && reviewTimerState.sessionStartTime) {
      debugLog('Starting review timer interval');
      intervalRef.current = window.setInterval(() => {
        const now = new Date();
        const startTime = reviewTimerState.sessionStartTime!;

        // Validate dates before calculation
        if (!startTime || isNaN(startTime.getTime()) || isNaN(now.getTime())) {
          debugLog('Invalid date detected in review timer calculation', { startTime, now });
          return;
        }

        const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);

        // Validate elapsed time
        if (isNaN(elapsed) || elapsed < 0) {
          debugLog('Invalid elapsed time calculated in review timer', { elapsed, startTime, now });
          return;
        }

        debugLog(`Review timer tick - elapsed: ${elapsed}s`);
        setReviewTimerState(prev => ({ ...prev, elapsedTime: elapsed }));
      }, 1000);
    } else {
      if (intervalRef.current) {
        debugLog('Clearing review timer interval');
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        debugLog('Cleanup: clearing review timer interval');
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [reviewTimerState.isRunning, reviewTimerState.isPaused, reviewTimerState.sessionStartTime]);

  return {
    reviewTimerState,
    totalReviewDuration,
    startReviewTimer,
    stopReviewTimer,
    pauseReviewTimer,
    resumeReviewTimer,
    refreshReviewTimerState,
    isLoading,
    error
  };
}