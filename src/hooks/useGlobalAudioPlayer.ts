import { useState, useCallback, useRef } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';

export interface AudioPlayerState {
  isOpen: boolean;
  uiMode: 'overlay' | 'header';
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  error: string | null;
}

export interface PlayingRecording {
  id: string;
  filename: string;
  filepath: string;
  duration?: number;
  file_size?: number;
  created_at: string;
  audioUrl?: string; // Base64 data URL (fallback)
  fileUrl?: string;  // Streamable tauri file URL
}

export interface UseGlobalAudioPlayerReturn {
  playerState: AudioPlayerState;
  currentRecording: PlayingRecording | null;
  playRecording: (recording: PlayingRecording) => Promise<void>;
  closePlayer: () => void;
  updatePlayerState: (updates: Partial<AudioPlayerState>) => void;
  setUIMode: (mode: 'overlay' | 'header') => void;
  setCurrentTime: (time: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  setAudioElementRef: (element: HTMLAudioElement | null) => void;
}

export function useGlobalAudioPlayer(): UseGlobalAudioPlayerReturn {
  const [playerState, setPlayerState] = useState<AudioPlayerState>({
    isOpen: false,
    uiMode: 'header',
    isPlaying: false,
    isLoading: false,
    currentTime: 0,
    duration: 0,
    volume: 1.0,
    playbackRate: 1.0,
    error: null,
  });

  const [currentRecording, setCurrentRecording] = useState<PlayingRecording | null>(null);
  
  // Ref to store audio element for direct manipulation
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  const updatePlayerState = useCallback((updates: Partial<AudioPlayerState>) => {
    setPlayerState(prev => ({ ...prev, ...updates }));
  }, []);

  const setCurrentTime = useCallback((time: number) => {
    updatePlayerState({ currentTime: time });
    if (audioElementRef.current) {
      audioElementRef.current.currentTime = time;
    }
  }, [updatePlayerState]);

  const setVolume = useCallback((volume: number) => {
    updatePlayerState({ volume });
    if (audioElementRef.current) {
      audioElementRef.current.volume = volume;
    }
  }, [updatePlayerState]);

  const setPlaybackRate = useCallback((rate: number) => {
    updatePlayerState({ playbackRate: rate });
    if (audioElementRef.current) {
      audioElementRef.current.playbackRate = rate;
    }
  }, [updatePlayerState]);

  const playRecording = useCallback(async (recording: PlayingRecording) => {
    try {
      updatePlayerState({ isLoading: true, error: null });
      
      // Prefer streaming via file URL
      let fileUrl = recording.fileUrl;
      if (!fileUrl) {
        try {
          const absPath = await invoke<string>('resolve_recording_absolute_path', { filepath: recording.filepath });
          fileUrl = convertFileSrc(absPath);
        } catch (e) {
          console.warn('Failed to resolve file URL, will fallback to base64:', e);
        }
      }
      
      // Fallback: base64 data URL (last resort for small files)
      let audioUrl = recording.audioUrl;
      if (!fileUrl && !audioUrl) {
        audioUrl = await invoke<string>('get_audio_data', { filepath: recording.filepath });
      }

      // Create enhanced recording object
      const enhancedRecording: PlayingRecording = { ...recording, fileUrl, audioUrl };

      setCurrentRecording(enhancedRecording);
      updatePlayerState({ 
        isOpen: true, 
        uiMode: 'header',
        isLoading: false,
        currentTime: 0,
        error: null
      });

    } catch (error) {
      console.error('Failed to load audio:', error);
      updatePlayerState({ 
        isLoading: false, 
        error: `Failed to load audio: ${error}`,
        isOpen: true 
      });
    }
  }, [updatePlayerState]);

  const closePlayer = useCallback(() => {
    updatePlayerState({ 
      isOpen: false, 
      uiMode: 'header',
      isPlaying: false, 
      currentTime: 0,
      error: null 
    });
    setCurrentRecording(null);
    
    // Stop audio if playing
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }
  }, [updatePlayerState]);

  // Set audio element ref for direct manipulation
  const setAudioElementRef = useCallback((element: HTMLAudioElement | null) => {
    audioElementRef.current = element;
  }, []);

  const setUIMode = useCallback((mode: 'overlay' | 'header') => {
    updatePlayerState({ uiMode: mode });
  }, [updatePlayerState]);

  return {
    playerState,
    currentRecording,
    playRecording,
    closePlayer,
    updatePlayerState,
    setUIMode,
    setCurrentTime,
    setVolume,
    setPlaybackRate,
    setAudioElementRef,
  };
}
