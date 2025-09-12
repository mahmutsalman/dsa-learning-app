import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  currentRecordingId?: string;
  recordingStartTime?: Date;
  elapsedRecordingTime: number; // in seconds
}

export interface RecordingInfo {
  filename: string;
  filepath: string;
}

export interface Recording {
  id: string;
  card_id: string;
  time_session_id?: string;
  audio_url: string;
  duration?: number;
  transcript?: string;
  created_at: string;
  filename: string;
  filepath: string;
  file_size?: number;
}

export interface UseRecordingReturn {
  recordingState: RecordingState;
  recordings: Recording[];
  recordingsCount: number;
  startRecording: (cardId: string) => Promise<void>;
  stopRecording: (cardId: string) => Promise<void>;
  pauseRecording: () => Promise<void>;
  resumeRecording: () => Promise<void>;
  refreshRecordingState: () => Promise<void>;
  loadRecordings: (cardId: string) => Promise<void>;
  clearRecordingState: () => void;
  isLoading: boolean;
  error: string | null;
}

export function useRecording(cardId?: string): UseRecordingReturn {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    elapsedRecordingTime: 0
  });
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Debug logging helper with card context - disabled to prevent memory leaks
  const debugLog = (_message: string, _data?: any) => {
    // Disabled to prevent memory leak when inspector is open
    // Uncomment only when actively debugging
    // console.log(`🎤 [Recording Debug Card:${cardId}] ${message}`, data ? data : '');
  };

  // Refresh recording state from backend
  const refreshRecordingState = useCallback(async () => {
    try {
      debugLog('Refreshing recording state...');
      setError(null);
      
      const backendState = await invoke<RecordingState>('get_recording_state');
      debugLog('Backend recording state received:', backendState);
      
      // Validate and sanitize backend state
      const sanitizedState = {
        ...backendState,
        elapsedRecordingTime: typeof backendState.elapsedRecordingTime === 'number' && !isNaN(backendState.elapsedRecordingTime) 
          ? backendState.elapsedRecordingTime 
          : 0,
        recordingStartTime: backendState.recordingStartTime 
          ? new Date(backendState.recordingStartTime) 
          : undefined,
        // Ensure all boolean fields are properly set
        isRecording: Boolean(backendState.isRecording),
        isPaused: Boolean(backendState.isPaused)
      };
      
      debugLog('Sanitized recording state:', sanitizedState);
      setRecordingState(sanitizedState);
    } catch (err) {
      setError(err as string);
      debugLog('Error refreshing recording state:', err);
    }
  }, []);

  // Start recording session
  const startRecording = useCallback(async (targetCardId: string) => {
    try {
      debugLog(`Starting recording for card: ${targetCardId}`);
      setIsLoading(true);
      setError(null);
      
      const recordingInfo = await invoke<RecordingInfo>('start_recording', { 
        cardId: targetCardId 
      });
      debugLog('Start recording response:', recordingInfo);
      
      // Update state to show recording is active
      setRecordingState({
        isRecording: true,
        isPaused: false,
        currentRecordingId: recordingInfo.filename,
        recordingStartTime: new Date(),
        elapsedRecordingTime: 0
      });
    } catch (err) {
      setError(err as string);
      debugLog('Error starting recording:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Stop recording session
  const stopRecording = useCallback(async (targetCardId: string) => {
    try {
      debugLog('Stopping recording session...');
      setIsLoading(true);
      setError(null);
      
      await invoke('stop_recording', { cardId: targetCardId });
      debugLog('Recording stop command completed');
      
      // Reset recording state
      setRecordingState({
        isRecording: false,
        isPaused: false,
        elapsedRecordingTime: 0
      });
      
      // Reload recordings list
      if (cardId) {
        await loadRecordings(cardId);
      }
      debugLog('Recording state reset and recordings refreshed');
    } catch (err) {
      setError(err as string);
      debugLog('Error stopping recording:', err);
    } finally {
      setIsLoading(false);
    }
  }, [cardId]);

  // Pause recording session
  const pauseRecording = useCallback(async () => {
    try {
      setError(null);
      await invoke('pause_recording');
      setRecordingState(prev => ({ ...prev, isPaused: true }));
    } catch (err) {
      setError(err as string);
    }
  }, []);

  // Resume recording session
  const resumeRecording = useCallback(async () => {
    try {
      setError(null);
      await invoke('resume_recording');
      setRecordingState(prev => ({ ...prev, isPaused: false }));
    } catch (err) {
      setError(err as string);
    }
  }, []);

  // Load recordings for a card
  const loadRecordings = useCallback(async (targetCardId: string) => {
    try {
      debugLog(`Loading recordings for card: ${targetCardId}`);
      const result = await invoke<Recording[]>('get_card_recordings', { cardId: targetCardId });
      debugLog('Recordings loaded:', result);
      setRecordings(result);
    } catch (err) {
      console.error('Failed to load recordings:', err);
      setRecordings([]);
    }
  }, []);

  // Clear recording state (useful when switching cards)
  const clearRecordingState = useCallback(() => {
    debugLog('Clearing recording state for card switch');
    setRecordingState({
      isRecording: false,
      isPaused: false,
      elapsedRecordingTime: 0
    });
    setRecordings([]);
    setError(null);
    
    // Clear any active recording timer
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Initialize recording state on mount and when cardId changes
  useEffect(() => {
    refreshRecordingState();
  }, [refreshRecordingState]);

  // Load recordings when cardId changes and clear previous state
  useEffect(() => {
    if (cardId) {
      // Clear previous card's recording state before loading new card's recordings
      clearRecordingState();
      loadRecordings(cardId);
    } else {
      setRecordings([]);
    }
  }, [cardId, loadRecordings, clearRecordingState]);

  // Set up real-time recording timer updates when recording
  useEffect(() => {
    debugLog('Recording interval effect triggered', {
      isRecording: recordingState.isRecording,
      isPaused: recordingState.isPaused,
      hasStartTime: !!recordingState.recordingStartTime,
      startTime: recordingState.recordingStartTime,
      currentElapsed: recordingState.elapsedRecordingTime
    });

    if (recordingState.isRecording && !recordingState.isPaused && recordingState.recordingStartTime) {
      debugLog('Starting recording timer interval');
      intervalRef.current = window.setInterval(() => {
        const now = new Date();
        const startTime = recordingState.recordingStartTime!;
        
        // Validate dates before calculation
        if (!startTime || isNaN(startTime.getTime()) || isNaN(now.getTime())) {
          debugLog('Invalid date detected in recording calculation', { startTime, now });
          return;
        }
        
        const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        
        // Validate elapsed time
        if (isNaN(elapsed) || elapsed < 0) {
          debugLog('Invalid elapsed time calculated', { elapsed, startTime, now });
          return;
        }
        
        debugLog(`Recording tick - elapsed: ${elapsed}s`);
        setRecordingState(prev => ({ ...prev, elapsedRecordingTime: elapsed }));
      }, 1000);
    } else {
      if (intervalRef.current) {
        debugLog('Clearing recording timer interval');
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        debugLog('Cleanup: clearing recording timer interval');
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [recordingState.isRecording, recordingState.isPaused, recordingState.recordingStartTime]);

  return {
    recordingState,
    recordings,
    recordingsCount: recordings.length,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    refreshRecordingState,
    loadRecordings,
    clearRecordingState,
    isLoading,
    error
  };
}