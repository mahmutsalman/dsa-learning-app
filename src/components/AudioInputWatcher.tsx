import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAudioInput } from '../hooks/useAudioInput';
import { useRecording } from '../hooks/useRecording';
import { useToast } from '../contexts/ToastContext';

export default function AudioInputWatcher() {
  const audio = useAudioInput();
  const recording = useRecording();
  const { addToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (audio.changedSinceLastCheck && !recording.recordingState.isRecording) {
      addToast('Audio input devices changed. Review input settings?', 'info', 'Open Settings', () => navigate('/settings'));
      audio.resetChangedFlag();
    }
  }, [audio.changedSinceLastCheck, recording.recordingState.isRecording]);

  return null;
}

