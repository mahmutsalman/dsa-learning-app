import { useRef, useEffect, useCallback } from 'react';
import AudioPlayer from 'react-h5-audio-player';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { UseGlobalAudioPlayerReturn } from '../hooks/useGlobalAudioPlayer';
import { useEnhancedWorkspaceFocusModeOptional } from './workspace/EnhancedWorkspaceContext';
import 'react-h5-audio-player/lib/styles.css';
import './GlobalAudioPlayer.css';

interface GlobalAudioPlayerProps extends UseGlobalAudioPlayerReturn {}

export default function GlobalAudioPlayer({
  playerState,
  currentRecording,
  closePlayer,
  updatePlayerState,
  setPlaybackRate,
  setAudioElementRef,
  setUIMode,
}: GlobalAudioPlayerProps) {

  const audioPlayerRef = useRef<AudioPlayer>(null);
  
  // Focus mode integration - audio player adapts to focus mode but remains fully functional
  // Use optional hook to avoid provider requirement outside of workspace context
  const focusMode = useEnhancedWorkspaceFocusModeOptional();
  const isFocusMode = focusMode?.isActive ?? false;

  // Format duration from seconds to MM:SS
  const formatTime = (seconds: number | undefined): string => {
    if (!seconds || seconds <= 0) return '0:00';
    
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Format file size
  const formatFileSize = (bytes: number | undefined): string => {
    if (!bytes) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Format creation date
  const formatDate = (dateTime: string): string => {
    try {
      return new Date(dateTime).toLocaleDateString();
    } catch {
      return dateTime;
    }
  };

  // Handle playback rate changes
  const handlePlaybackRateChange = useCallback((rate: number) => {
    setPlaybackRate(rate);
    if (audioPlayerRef.current?.audio?.current) {
      audioPlayerRef.current.audio.current.playbackRate = rate;
    }
  }, [setPlaybackRate]);

  // Set up audio element reference for direct manipulation
  useEffect(() => {
    if (audioPlayerRef.current?.audio?.current) {
      setAudioElementRef(audioPlayerRef.current.audio.current);
    }
  }, [currentRecording, setAudioElementRef]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!playerState.isOpen) return;
      
      switch (e.key) {
        case 'Escape':
          closePlayer();
          break;
        case ' ':
          e.preventDefault();
          if (audioPlayerRef.current?.audio?.current) {
            if (playerState.isPlaying) {
              audioPlayerRef.current.audio.current.pause();
            } else {
              audioPlayerRef.current.audio.current.play();
            }
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (audioPlayerRef.current?.audio?.current) {
            audioPlayerRef.current.audio.current.currentTime -= 10;
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (audioPlayerRef.current?.audio?.current) {
            audioPlayerRef.current.audio.current.currentTime += 10;
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [playerState.isOpen, playerState.isPlaying, closePlayer]);

  if (!playerState.isOpen || !currentRecording) {
    return null;
  }

  const playbackRates = [0.75, 1, 1.5, 2, 2.5, 3];

  return (
    <div className={`fixed inset-0 bg-black ${isFocusMode ? 'bg-opacity-30' : 'bg-opacity-50'} flex items-center justify-center z-50 transition-all duration-300`}>
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl mx-4 overflow-hidden transition-all duration-300 ${isFocusMode ? 'scale-95 opacity-95' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">🎵</div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Last Recording Player {playerState.isPlaying ? '(Playing)' : '(Paused)'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                {currentRecording.filename}
              </p>
            </div>
          </div>
          <button
            onClick={closePlayer}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Close player (Esc)"
          >
            <XMarkIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Metadata */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50">
          <div className="flex items-center justify-center space-x-8 text-sm text-gray-600 dark:text-gray-300">
            <div className="flex items-center space-x-2">
              <span>⏱️</span>
              <span>{formatTime(currentRecording.duration)}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>💾</span>
              <span>{formatFileSize(currentRecording.file_size)}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>📅</span>
              <span>{formatDate(currentRecording.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Audio Player */}
        <div className="px-6 py-6">
          {playerState.error ? (
            <div className="text-center py-8">
              <div className="text-red-600 dark:text-red-400">
                <p className="font-medium">Error loading audio</p>
                <p className="text-sm mt-1">{playerState.error}</p>
              </div>
            </div>
          ) : playerState.isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-500 dark:text-gray-400">Loading audio...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Custom Audio Player */}
              <div className="global-audio-player">
                <AudioPlayer
                  ref={audioPlayerRef}
                  src={currentRecording.audioUrl}
                  onPlay={() => { updatePlayerState({ isPlaying: true }); setUIMode('header'); }}
                  onPause={() => updatePlayerState({ isPlaying: false })}
                  onEnded={() => updatePlayerState({ isPlaying: false })}
                  customAdditionalControls={[]}
                  customVolumeControls={[]}
                  showJumpControls={true}
                  showSkipControls={true}
                  showDownloadProgress={false}
                />
              </div>

              {/* Playback Speed Controls */}
              <div className="flex items-center justify-center space-x-4">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Speed:</span>
                <div className="flex items-center space-x-2">
                  {playbackRates.map((rate) => (
                    <button
                      key={rate}
                      onClick={() => handlePlaybackRateChange(rate)}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                        Math.abs(playerState.playbackRate - rate) < 0.01
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
