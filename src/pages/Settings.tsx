import { useEffect } from 'react';
import { useAudioInput } from '../hooks/useAudioInput';

export default function Settings() {
  const {
    devices,
    current,
    preferred,
    defaultName,
    refreshDevices,
    chooseDevice,
    setPreferred,
  } = useAudioInput();

  useEffect(() => { refreshDevices(); }, [refreshDevices]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>

      <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Audio Input</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Select which microphone to use for recordings. Your choice is remembered until the app closes.
        </p>

        <div className="space-y-2">
          {devices.length === 0 && (
            <div className="text-sm text-gray-500 dark:text-gray-400">No input devices detected.</div>
          )}
          {devices.map((d) => (
            <label key={d.name} className="flex items-center justify-between py-2 px-3 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="audio-device"
                  checked={preferred ? preferred === d.name : d.is_default}
                  onChange={async () => {
                    setPreferred(d.name);
                    await chooseDevice(d.name);
                  }}
                />
                <div>
                  <div className="text-sm text-gray-900 dark:text-white">{d.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {d.is_default && 'Default'}{d.is_default && d.is_current ? ' • ' : ''}{d.is_current && 'Current'}
                  </div>
                </div>
              </div>
            </label>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => refreshDevices()}
            className="px-3 py-1.5 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm"
          >Refresh</button>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Current: {current ?? 'Unknown'} • Default: {defaultName ?? 'Unknown'}
          </div>
        </div>
      </section>
    </div>
  );
}

