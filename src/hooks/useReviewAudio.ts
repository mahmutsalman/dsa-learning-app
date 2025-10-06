import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface ReviewRecordingState {
  isRecording: boolean;
  isPaused: boolean;
  recordingStartTime?: Date;
  elapsedRecordingTime: number;
  sourceCardId?: string;
  problemId?: string;
  pauseDuration: number; // Total seconds paused (for timer calculation)
}

export interface UseReviewAudioReturn {
  reviewRecordingState: ReviewRecordingState;
  isRecordingGlobally: boolean;
  isRecordingForProblem: boolean;
  isRecordingForCurrentCard: boolean;
  startReviewRecording: (sourceCardId: string) => Promise<void>;
  stopReviewRecording: () => Promise<void>;
  refreshReviewRecordingState: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const DEFAULT_STATE: ReviewRecordingState = {
  isRecording: false,
  isPaused: false,
  elapsedRecordingTime: 0,
  pauseDuration: 0,
  sourceCardId: undefined,
  problemId: undefined,
  recordingStartTime: undefined
};

export function useReviewAudio(problemId?: string, currentCardId?: string): UseReviewAudioReturn {
  const [reviewRecordingState, setReviewRecordingState] = useState<ReviewRecordingState>(DEFAULT_STATE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  const refreshReviewRecordingState = useCallback(async () => {
    try {
      setError(null);
      const backendState = await invoke<any>('get_recording_state');

      console.log('🔄 [Review Audio Debug] Backend state received:', backendState);

      const isReviewMode = backendState?.recordingMode === 'review';
      console.log('🔄 [Review Audio Debug] Is review mode?', isReviewMode, 'Is recording?', backendState?.isRecording);

      if (!isReviewMode || !backendState?.isRecording) {
        console.log('🔄 [Review Audio Debug] Setting to DEFAULT_STATE (not review or not recording)');
        setReviewRecordingState(DEFAULT_STATE);
        return;
      }

      const sanitizedState: ReviewRecordingState = {
        isRecording: Boolean(backendState.isRecording),
        isPaused: Boolean(backendState.isPaused),
        recordingStartTime: backendState.recordingStartTime ? new Date(backendState.recordingStartTime) : undefined,
        elapsedRecordingTime: typeof backendState.elapsedRecordingTime === 'number' && !isNaN(backendState.elapsedRecordingTime)
          ? backendState.elapsedRecordingTime
          : 0,
        pauseDuration: typeof backendState.pauseDuration === 'number' && !isNaN(backendState.pauseDuration)
          ? backendState.pauseDuration
          : 0,
        sourceCardId: typeof backendState.cardId === 'string' ? backendState.cardId : undefined,
        problemId: typeof backendState.problemId === 'string' ? backendState.problemId : undefined,
      };

      console.log('🔄 [Review Audio Debug] Setting sanitized review recording state:', sanitizedState);
      setReviewRecordingState(sanitizedState);
    } catch (err) {
      console.error('❌ [Review Audio Debug] Failed to refresh review recording state:', err);
      setError(String(err));
      setReviewRecordingState(DEFAULT_STATE);
    }
  }, []);

  const startReviewRecording = useCallback(async (sourceCardId: string) => {
    if (!problemId) {
      setError('Problem id is not available for review recording');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      await invoke('start_review_recording', {
        problemId,
        sourceCardId
      });

      setReviewRecordingState({
        isRecording: true,
        isPaused: false,
        recordingStartTime: new Date(),
        elapsedRecordingTime: 0,
        pauseDuration: 0,
        sourceCardId,
        problemId
      });
    } catch (err) {
      console.error('Failed to start review recording:', err);
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, [problemId]);

  const stopReviewRecording = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await invoke('stop_review_recording');
      setReviewRecordingState(DEFAULT_STATE);
    } catch (err) {
      console.error('Failed to stop review recording:', err);
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshReviewRecordingState();
  }, [refreshReviewRecordingState, problemId]);

  useEffect(() => {
    if (reviewRecordingState.isRecording && !reviewRecordingState.isPaused && reviewRecordingState.recordingStartTime) {
      intervalRef.current = window.setInterval(() => {
        const now = new Date();
        const startTime = reviewRecordingState.recordingStartTime!;
        if (isNaN(startTime.getTime()) || isNaN(now.getTime())) {
          return;
        }

        // Calculate elapsed time and subtract pause duration
        setReviewRecordingState(prev => {
          const rawElapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
          const elapsed = rawElapsed - prev.pauseDuration;

          if (isNaN(elapsed) || elapsed < 0) {
            return prev;
          }

          return { ...prev, elapsedRecordingTime: elapsed };
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [reviewRecordingState.isRecording, reviewRecordingState.isPaused, reviewRecordingState.recordingStartTime]);

  const derivedFlags = useMemo(() => {
    const isRecordingGlobally = reviewRecordingState.isRecording;
    const isRecordingForProblem = isRecordingGlobally && problemId === reviewRecordingState.problemId;
    const isRecordingForCurrentCard = isRecordingForProblem && currentCardId === reviewRecordingState.sourceCardId;
    return { isRecordingGlobally, isRecordingForProblem, isRecordingForCurrentCard };
  }, [reviewRecordingState, problemId, currentCardId]);

  return {
    reviewRecordingState,
    isRecordingGlobally: derivedFlags.isRecordingGlobally,
    isRecordingForProblem: derivedFlags.isRecordingForProblem,
    isRecordingForCurrentCard: derivedFlags.isRecordingForCurrentCard,
    startReviewRecording,
    stopReviewRecording,
    refreshReviewRecordingState,
    isLoading,
    error
  };
}
