import { useEffect, useRef } from 'react';
import { PlayIcon, PauseIcon, XMarkIcon, SpeakerWaveIcon } from '@heroicons/react/24/solid';
import { useGlobalAudioPlayerContext } from '../contexts/GlobalAudioPlayerContext';

export default function HeaderMiniAudioPlayer() {
  const {
    playerState,
    currentRecording,
    closePlayer,
    updatePlayerState,
    setPlaybackRate,
    setAudioElementRef,
  } = useGlobalAudioPlayerContext();

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!currentRecording) return;
    if (!audioRef.current) return;

    const el = audioRef.current;
    setAudioElementRef(el);
    el.playbackRate = playerState.playbackRate || 1.0;

    const onPlay = () => updatePlayerState({ isPlaying: true });
    const onPause = () => updatePlayerState({ isPlaying: false });
    const onEnded = () => updatePlayerState({ isPlaying: false });
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnded);

    return () => {
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnded);
    };
  }, [currentRecording, setAudioElementRef, updatePlayerState, playerState.playbackRate]);

  if (!playerState.isOpen || playerState.uiMode !== 'header' || !currentRecording) {
    return null;
  }

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.play();
    } else {
      el.pause();
    }
  };

  const stopPlayback = () => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    closePlayer();
  };

  const cycleSpeed = () => {
    const rates = [0.75, 1, 1.25, 1.5, 2];
    const idx = rates.findIndex(r => Math.abs(r - playerState.playbackRate) < 0.01);
    const next = rates[(idx + 1) % rates.length];
    setPlaybackRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const rateLabel = `${playerState.playbackRate}x`;

  return (
    <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg px-2 py-1 space-x-2">
      <audio ref={audioRef} src={currentRecording.fileUrl || currentRecording.audioUrl} preload="metadata" />
      <SpeakerWaveIcon className="h-4 w-4 text-gray-700 dark:text-gray-200" />
      <span className="max-w-[220px] truncate text-xs text-gray-700 dark:text-gray-200">
        {currentRecording.filename}
      </span>
      <button
        onClick={togglePlay}
        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
        title={playerState.isPlaying ? 'Pause' : 'Play'}
      >
        {playerState.isPlaying ? (
          <PauseIcon className="h-4 w-4" />
        ) : (
          <PlayIcon className="h-4 w-4" />
        )}
      </button>
      <button
        onClick={cycleSpeed}
        className="px-2 py-0.5 rounded text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
        title="Change speed"
      >
        {rateLabel}
      </button>
      <button
        onClick={stopPlayback}
        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
        title="Stop"
      >
        <XMarkIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
