import React, { useEffect, useState } from 'react';
import AudioPlayerComponent, { RHAP_UI } from 'react-h5-audio-player';
import 'react-h5-audio-player/lib/styles.css';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';

interface Recording {
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

interface GlobalAudioPlayerProps {
  recording: Recording | null;
  isVisible: boolean;
  onClose: () => void;
}

export const GlobalAudioPlayer: React.FC<GlobalAudioPlayerProps> = ({
  recording,
  isVisible,
  onClose,
}) => {
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  // Load audio URL when component mounts or recording changes
  useEffect(() => {
    const loadAudioUrl = async () => {
      if (!recording?.filepath) return;
      
      setIsLoading(true);
      setError('');
      
      // Two strategies for loading audio
      const isProduction = !window.location.href.includes('localhost');
      const strategies = isProduction ? 
        ['dataUrl', 'convertFileSrc'] : 
        ['convertFileSrc', 'dataUrl'];
      
      for (const strategy of strategies) {
        try {
          let audioUrl: string;
          
          if (strategy === 'convertFileSrc') {
            // Strategy 1: Use Tauri's convertFileSrc (faster, less memory)
            // Get proper absolute path from PathResolver
            const absolutePath = await invoke<string>('get_absolute_path', { 
              relativePath: recording.filepath 
            });
            audioUrl = convertFileSrc(absolutePath);
          } else {
            // Strategy 2: Use data URL (more compatible, higher memory usage)
            audioUrl = await invoke<string>('get_audio_data', { 
              filepath: recording.filepath 
            });
          }
          
          setAudioUrl(audioUrl);
          setIsLoading(false);
          return;
        } catch (err) {
          console.error(`Strategy ${strategy} failed:`, err);
        }
      }
      
      setError('Failed to load audio file');
      setIsLoading(false);
    };

    if (recording && isVisible && !audioUrl) {
      loadAudioUrl();
    }
  }, [recording?.filepath, isVisible]);

  // Reset state when recording changes
  useEffect(() => {
    if (recording) {
      setAudioUrl('');
      setError('');
      setPlaybackSpeed(1.0);
    }
  }, [recording?.id]);

  if (!isVisible || !recording) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50 pb-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">🎵 Audio Player</h3>
            <p className="text-lg font-medium mt-1 text-gray-700 dark:text-gray-300">{recording.filename}</p>
            {recording.duration && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Duration: {Math.floor(recording.duration / 60)}:{(recording.duration % 60).toString().padStart(2, '0')}
              </p>
            )}
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Audio Player */}
        <div className="p-6">
          {isLoading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-500 dark:text-gray-400">Loading audio...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <div className="text-red-600 dark:text-red-400">
                <p className="font-medium">Error loading audio</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          {!isLoading && !error && audioUrl && (
            <>
              <AudioPlayerComponent
                src={audioUrl}
                autoPlay={false}
                onCanPlay={(e) => {
                  // Set playback speed when audio is ready
                  const audioElement = e.target as HTMLAudioElement;
                  audioElement.playbackRate = playbackSpeed;
                }}
                showSkipControls={false}
                showJumpControls={true}
                progressJumpSteps={{ backward: 5000, forward: 10000 }}
                customProgressBarSection={[
                  RHAP_UI.CURRENT_TIME,
                  RHAP_UI.PROGRESS_BAR,
                  RHAP_UI.DURATION
                ]}
                layout="horizontal-reverse"
                preload="metadata"
                className="custom-audio-player"
              />

              {/* Playback Speed Control */}
              <div className="mt-4 flex justify-center space-x-2">
                <span className="text-sm text-gray-600 dark:text-gray-400 self-center mr-2">Speed:</span>
                {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(speed => (
                  <button
                    key={speed}
                    onClick={() => {
                      setPlaybackSpeed(speed);
                      // Update playback rate of current audio if playing
                      const audioElements = document.querySelectorAll('audio');
                      audioElements.forEach(audio => {
                        audio.playbackRate = speed;
                      });
                    }}
                    className={`px-3 py-1 rounded transition-colors ${
                      playbackSpeed === speed 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Transcript */}
          {recording.transcript && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Transcript:</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">{recording.transcript}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalAudioPlayer;