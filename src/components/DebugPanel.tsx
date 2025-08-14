import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface PathDebugInfo {
  is_debug_mode: boolean;
  path_resolver_base_dir: string;
  recordings_dir: string;
  images_dir: string;
  sample_resolved_path: string;
  cfg_debug_assertions: boolean;
}

export const DebugPanel: React.FC = () => {
  const [pathInfo, setPathInfo] = useState<PathDebugInfo | null>(null);
  const [recordingTest, setRecordingTest] = useState<string>('');
  const [audioLoadingTest, setAudioLoadingTest] = useState<string>('');
  const [micPermissionTest, setMicPermissionTest] = useState<string>('');
  const [testPath, setTestPath] = useState('app-data/recordings/recording_20250814_171917.wav');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debugPaths = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<PathDebugInfo>('debug_paths');
      setPathInfo(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const testRecordingPath = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<string>('debug_recording_paths', { relativePath: testPath });
      setRecordingTest(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const testAudioLoading = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<string>('debug_audio_loading', { relativePath: testPath });
      setAudioLoadingTest(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const testMicrophonePermission = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<string>('check_microphone_permission');
      setMicPermissionTest(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed top-4 right-4 bg-gray-800 text-white p-4 rounded-lg shadow-lg max-w-md z-50 text-sm">
      <h3 className="text-lg font-bold mb-3">🔍 Path Debug Tool</h3>
      
      {/* Debug Buttons */}
      <div className="mb-4 space-y-2">
        <div>
          <button 
            onClick={debugPaths}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-sm mr-2"
          >
            {loading ? 'Loading...' : 'Debug Paths'}
          </button>
        </div>
        <div>
          <button 
            onClick={testMicrophonePermission}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded text-sm"
          >
            🎤 Check Microphone Permission
          </button>
        </div>
      </div>

      {/* Path Info Display */}
      {pathInfo && (
        <div className="mb-4 p-3 bg-gray-700 rounded text-xs">
          <div><strong>Debug Mode:</strong> {pathInfo.is_debug_mode ? 'true' : 'false'}</div>
          <div><strong>cfg!(debug):</strong> {pathInfo.cfg_debug_assertions ? 'true' : 'false'}</div>
          <div className="mt-2"><strong>Base Dir:</strong></div>
          <div className="break-all text-gray-300">{pathInfo.path_resolver_base_dir}</div>
          <div className="mt-2"><strong>Recordings:</strong></div>
          <div className="break-all text-gray-300">{pathInfo.recordings_dir}</div>
          <div className="mt-2"><strong>Sample Resolution:</strong></div>
          <div className="break-all text-gray-300">{pathInfo.sample_resolved_path}</div>
        </div>
      )}

      {/* Test Recording Path */}
      <div className="mb-4">
        <input
          value={testPath}
          onChange={(e) => setTestPath(e.target.value)}
          placeholder="Recording path to test"
          className="w-full p-2 text-black rounded text-xs mb-2"
        />
        <button 
          onClick={testRecordingPath}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded text-sm mr-2"
        >
          Test Recording Path
        </button>
        <button 
          onClick={testAudioLoading}
          disabled={loading}
          className="bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded text-sm"
        >
          Debug Audio Loading
        </button>
      </div>

      {/* Recording Test Result */}
      {recordingTest && (
        <div className="mb-4 p-3 bg-gray-700 rounded text-xs">
          <strong>Path Test:</strong>
          <div className="break-all text-gray-300">{recordingTest}</div>
        </div>
      )}

      {/* Audio Loading Test Result */}
      {audioLoadingTest && (
        <div className="mb-4 p-3 bg-purple-700 rounded text-xs">
          <strong>Audio Loading Debug:</strong>
          <pre className="whitespace-pre-wrap text-gray-300 mt-2">{audioLoadingTest}</pre>
        </div>
      )}

      {/* Microphone Permission Test Result */}
      {micPermissionTest && (
        <div className="mb-4 p-3 bg-red-700 rounded text-xs">
          <strong>🎤 Microphone Permission:</strong>
          <div className="text-gray-300 mt-2">{micPermissionTest}</div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-700 rounded text-xs">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {/* Instructions */}
      <div className="text-xs text-gray-400 mt-4">
        <div><strong>Expected for Production:</strong></div>
        <div>• debug_mode: false</div>
        <div>• Path: ~/Library/.../com.dsalearning.dsaapp/</div>
      </div>
    </div>
  );
};