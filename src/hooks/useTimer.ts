import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface TimerState {
  isRunning: boolean;
  isPaused: boolean;
  currentSessionId?: string;
  sessionStartTime?: Date;
  elapsedTime: number; // in seconds
}

export interface UseTimerReturn {
  timerState: TimerState;
  totalDuration: number; // card's total_duration in seconds
  startTimer: (cardId: string) => Promise<void>;
  stopTimer: () => Promise<void>;
  pauseTimer: () => Promise<void>;
  resumeTimer: () => Promise<void>;
  refreshTimerState: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function useTimer(cardId?: string): UseTimerReturn {
  const [timerState, setTimerState] = useState<TimerState>({
    isRunning: false,
    isPaused: false,
    elapsedTime: 0
  });
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Debug logging helper - disabled to prevent memory leaks
  const debugLog = (_message: string, _data?: any) => {
    // Disabled to prevent memory leak when inspector is open
    // Uncomment only when actively debugging
    // console.log(`🕐 [Timer Debug] ${message}`, data ? data : '');
  };


  // Refresh timer state from backend
  const refreshTimerState = useCallback(async () => {
    try {
      debugLog('Refreshing timer state...');
      setError(null);
      
      const backendState = await invoke<TimerState>('get_timer_state');
      debugLog('Backend timer state received:', backendState);
      
      // Validate and sanitize backend state
      const sanitizedState = {
        ...backendState,
        elapsedTime: typeof backendState.elapsedTime === 'number' && !isNaN(backendState.elapsedTime) 
          ? backendState.elapsedTime 
          : 0,
        sessionStartTime: backendState.sessionStartTime 
          ? new Date(backendState.sessionStartTime) 
          : undefined,
        // Ensure all boolean fields are properly set
        isRunning: Boolean(backendState.isRunning),
        isPaused: Boolean(backendState.isPaused)
      };
      
      debugLog('Sanitized timer state:', sanitizedState);
      setTimerState(sanitizedState);
      
      // If we have a card, also get its total duration
      if (cardId) {
        debugLog(`Getting card data for cardId: ${cardId}`);
        const card = await invoke<any>('get_card_by_id', { id: cardId });
        debugLog('Card data received:', card);
        
        const cardDuration = typeof card?.total_duration === 'number' && !isNaN(card.total_duration)
          ? card.total_duration 
          : 0;
        
        debugLog(`Setting total duration: ${cardDuration}`);
        setTotalDuration(cardDuration);
      } else {
        debugLog('No cardId provided, setting total duration to 0');
        setTotalDuration(0);
      }
    } catch (err) {
      setError(err as string);
      debugLog('Error refreshing timer state:', err);
    }
  }, [cardId]);

  // Start timer session
  const startTimer = useCallback(async (targetCardId: string) => {
    try {
      debugLog(`Starting timer for card: ${targetCardId}`);
      setIsLoading(true);
      setError(null);
      
      const newState = await invoke<TimerState>('start_timer_session', { 
        cardId: targetCardId 
      });
      debugLog('Start timer response:', newState);
      
      // Validate and sanitize new state
      const sanitizedNewState = {
        ...newState,
        elapsedTime: typeof newState.elapsedTime === 'number' && !isNaN(newState.elapsedTime) 
          ? newState.elapsedTime 
          : 0,
        sessionStartTime: newState.sessionStartTime 
          ? new Date(newState.sessionStartTime) 
          : undefined,
        // Ensure all boolean fields are properly set
        isRunning: Boolean(newState.isRunning),
        isPaused: Boolean(newState.isPaused)
      };
      
      debugLog('Sanitized start timer state:', sanitizedNewState);
      setTimerState(sanitizedNewState);
    } catch (err) {
      setError(err as string);
      debugLog('Error starting timer:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Stop timer session
  const stopTimer = useCallback(async () => {
    try {
      debugLog('Stopping timer session...');
      setIsLoading(true);
      setError(null);
      
      await invoke('stop_timer_session');
      debugLog('Timer stop command completed');
      
      // Refresh state to get updated total_duration and timer state
      await refreshTimerState();
      debugLog('Timer state refreshed after stop');
    } catch (err) {
      setError(err as string);
      debugLog('Error stopping timer:', err);
    } finally {
      setIsLoading(false);
    }
  }, [refreshTimerState]);

  // Pause timer session
  const pauseTimer = useCallback(async () => {
    try {
      setError(null);
      await invoke('pause_timer_session');
      setTimerState(prev => ({ ...prev, isPaused: true }));
    } catch (err) {
      setError(err as string);
    }
  }, []);

  // Resume timer session
  const resumeTimer = useCallback(async () => {
    try {
      setError(null);
      await invoke('resume_timer_session');
      setTimerState(prev => ({ ...prev, isPaused: false }));
    } catch (err) {
      setError(err as string);
    }
  }, []);

  // Initialize timer state on mount and when cardId changes
  useEffect(() => {
    refreshTimerState();
  }, [refreshTimerState]);

  // Set up real-time timer updates when running
  useEffect(() => {
    debugLog('Timer interval effect triggered', {
      isRunning: timerState.isRunning,
      isPaused: timerState.isPaused,
      hasStartTime: !!timerState.sessionStartTime,
      startTime: timerState.sessionStartTime,
      currentElapsed: timerState.elapsedTime
    });

    if (timerState.isRunning && !timerState.isPaused && timerState.sessionStartTime) {
      debugLog('Starting timer interval');
      intervalRef.current = setInterval(() => {
        const now = new Date();
        const startTime = timerState.sessionStartTime!;
        
        // Validate dates before calculation
        if (!startTime || isNaN(startTime.getTime()) || isNaN(now.getTime())) {
          debugLog('Invalid date detected in timer calculation', { startTime, now });
          return;
        }
        
        const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        
        // Validate elapsed time
        if (isNaN(elapsed) || elapsed < 0) {
          debugLog('Invalid elapsed time calculated', { elapsed, startTime, now });
          return;
        }
        
        debugLog(`Timer tick - elapsed: ${elapsed}s`);
        setTimerState(prev => ({ ...prev, elapsedTime: elapsed }));
      }, 1000);
    } else {
      if (intervalRef.current) {
        debugLog('Clearing timer interval');
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        debugLog('Cleanup: clearing timer interval');
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [timerState.isRunning, timerState.isPaused, timerState.sessionStartTime]);

  return {
    timerState,
    totalDuration,
    startTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    refreshTimerState,
    isLoading,
    error
  };
}