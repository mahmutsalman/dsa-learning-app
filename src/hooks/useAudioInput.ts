import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface AudioDevice {
  name: string;
  is_default: boolean;
  is_current: boolean;
}

export interface AudioDeviceList {
  devices: AudioDevice[];
  current_device?: string | null;
}

const STORAGE_KEY = 'preferredAudioInput';
const LAST_LIST_KEY = 'lastAudioDeviceList';

export function useAudioInput() {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [preferred, setPreferred] = useState<string | null>(() => sessionStorage.getItem(STORAGE_KEY));
  const [changedSinceLastCheck, setChangedSinceLastCheck] = useState(false);
  const pollingRef = useRef<number | null>(null);

  const loadDevices = useCallback(async () => {
    try {
      const list = await invoke<AudioDeviceList>('get_audio_devices');
      const names = list.devices.map(d => d.name).sort();
      const last = sessionStorage.getItem(LAST_LIST_KEY);
      if (last) {
        const prevNames = JSON.parse(last) as string[];
        if (JSON.stringify(prevNames) !== JSON.stringify(names)) {
          setChangedSinceLastCheck(true);
        }
      }
      sessionStorage.setItem(LAST_LIST_KEY, JSON.stringify(names));
      setDevices(list.devices);
      setCurrent(list.current_device ?? list.devices.find(d => d.is_current)?.name ?? null);
    } catch (e) {
      console.error('Failed to load audio devices:', e);
      setDevices([]);
      setCurrent(null);
    }
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      const list = await invoke<AudioDeviceList>('refresh_audio_devices');
      const names = list.devices.map(d => d.name).sort();
      const last = sessionStorage.getItem(LAST_LIST_KEY);
      if (last) {
        const prevNames = JSON.parse(last) as string[];
        if (JSON.stringify(prevNames) !== JSON.stringify(names)) {
          setChangedSinceLastCheck(true);
        }
      }
      sessionStorage.setItem(LAST_LIST_KEY, JSON.stringify(names));
      setDevices(list.devices);
      setCurrent(list.current_device ?? list.devices.find(d => d.is_current)?.name ?? null);
    } catch (e) {
      console.error('Failed to refresh audio devices:', e);
    }
  }, []);

  const chooseDevice = useCallback(async (deviceName: string) => {
    try {
      await invoke<string>('switch_audio_device', { deviceName: deviceName });
      setPreferred(deviceName);
      sessionStorage.setItem(STORAGE_KEY, deviceName);
      // After switching, refresh list to reflect current
      await refreshDevices();
    } catch (e) {
      console.error('Failed to switch device:', e);
    }
  }, [refreshDevices]);

  const ensurePreferredSelected = useCallback(async () => {
    await refreshDevices();
    if (!preferred) return; // nothing to enforce
    const found = devices.find(d => d.name === preferred);
    if (!found) {
      // preferred no longer available -> switch to default if present
      const def = devices.find(d => d.is_default)?.name;
      if (def) await chooseDevice(def);
      return;
    }
    // switch to preferred if not current
    if (!found.is_current) await chooseDevice(preferred);
  }, [preferred, devices, chooseDevice, refreshDevices]);

  // devicechange listener (best-effort; not all envs)
  useEffect(() => {
    const media = (navigator as any).mediaDevices;
    if (media && typeof media.addEventListener === 'function') {
      const handler = () => {
        setChangedSinceLastCheck(true);
        refreshDevices();
      };
      media.addEventListener('devicechange', handler);
      return () => media.removeEventListener('devicechange', handler);
    }
  }, [refreshDevices]);

  // periodic polling as fallback
  useEffect(() => {
    pollingRef.current = window.setInterval(() => {
      refreshDevices();
    }, 10000);
    return () => {
      if (pollingRef.current) window.clearInterval(pollingRef.current);
    };
  }, [refreshDevices]);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  const defaultName = useMemo(() => devices.find(d => d.is_default)?.name ?? null, [devices]);

  return {
    devices,
    current,
    preferred,
    defaultName,
    changedSinceLastCheck,
    resetChangedFlag: () => setChangedSinceLastCheck(false),
    refreshDevices,
    chooseDevice,
    ensurePreferredSelected,
    setPreferred: (name: string | null) => {
      setPreferred(name);
      if (name) sessionStorage.setItem(STORAGE_KEY, name); else sessionStorage.removeItem(STORAGE_KEY);
    }
  };
}

