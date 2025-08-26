import { useEffect, useCallback } from 'react';
import { useEnhancedWorkspaceFocusMode } from '../components/workspace/EnhancedWorkspaceContext';

// Enhanced platform detection for cross-platform compatibility
const detectPlatform = () => {
  if (typeof navigator === 'undefined') return 'unknown';
  
  const platform = navigator.platform.toUpperCase();
  const userAgent = navigator.userAgent.toUpperCase();
  
  // macOS detection (including Safari on iOS using Meta key)
  if (platform.indexOf('MAC') >= 0 || userAgent.indexOf('MAC') >= 0) {
    return 'mac';
  }
  
  // Windows detection
  if (platform.indexOf('WIN') >= 0 || userAgent.indexOf('WIN') >= 0) {
    return 'windows';
  }
  
  // Linux detection
  if (platform.indexOf('LINUX') >= 0 || userAgent.indexOf('LINUX') >= 0) {
    return 'linux';
  }
  
  return 'unknown';
};

const currentPlatform = detectPlatform();
const isMac = currentPlatform === 'mac';
const isWindows = currentPlatform === 'windows';
const isLinux = currentPlatform === 'linux';

// Shortcut configuration
export interface FocusModeShortcuts {
  toggle: string[];
  exit: string[];
}

export const DEFAULT_SHORTCUTS: FocusModeShortcuts = {
  toggle: ['F11', isMac ? 'Meta+Shift+F' : 'Control+Shift+F'],
  exit: ['Escape'],
};

// Key combination matcher
interface KeyCombination {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
}

const parseShortcut = (shortcut: string): KeyCombination => {
  const parts = shortcut.split('+').map(part => part.trim());
  const key = parts[parts.length - 1];
  
  return {
    key,
    ctrl: parts.includes('Control') || parts.includes('Ctrl'),
    shift: parts.includes('Shift'),
    alt: parts.includes('Alt'),
    meta: parts.includes('Meta') || parts.includes('Cmd'),
  };
};

const matchesShortcut = (event: KeyboardEvent, shortcut: string): boolean => {
  const combo = parseShortcut(shortcut);
  
  return (
    event.key === combo.key &&
    !!event.ctrlKey === !!combo.ctrl &&
    !!event.shiftKey === !!combo.shift &&
    !!event.altKey === !!combo.alt &&
    !!event.metaKey === !!combo.meta
  );
};

export interface UseFocusModeShortcutsOptions {
  shortcuts?: Partial<FocusModeShortcuts>;
  enabled?: boolean;
  onShortcutTriggered?: (shortcut: string, action: 'toggle' | 'exit') => void;
}

/**
 * Custom hook for handling focus mode keyboard shortcuts
 * Supports F11 and Ctrl/Cmd+Shift+F for toggle, Escape for exit
 */
export function useFocusModeShortcuts(options: UseFocusModeShortcutsOptions = {}) {
  const {
    shortcuts = {},
    enabled = true,
    onShortcutTriggered,
  } = options;

  const { isActive, toggleFocusMode } = useEnhancedWorkspaceFocusMode();

  // Merge custom shortcuts with defaults
  const finalShortcuts: FocusModeShortcuts = {
    toggle: shortcuts.toggle || DEFAULT_SHORTCUTS.toggle,
    exit: shortcuts.exit || DEFAULT_SHORTCUTS.exit,
  };

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Prevent shortcuts when user is typing in input fields
    const activeElement = document.activeElement as HTMLElement;
    const isInputElement = activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.contentEditable === 'true' ||
      activeElement.classList.contains('monaco-editor') ||
      activeElement.closest('.monaco-editor') ||
      activeElement.closest('.ql-editor') // Quill editor
    );

    // Allow shortcuts in certain contexts even when in input elements
    const isGlobalShortcut = finalShortcuts.toggle.some(shortcut => 
      shortcut === 'F11' && matchesShortcut(event, shortcut)
    );

    // Only prevent in input elements for non-global shortcuts
    if (isInputElement && !isGlobalShortcut) {
      // Still allow Escape to exit focus mode even in inputs
      if (isActive && finalShortcuts.exit.some(shortcut => matchesShortcut(event, shortcut))) {
        event.preventDefault();
        toggleFocusMode();
        onShortcutTriggered?.(event.key, 'exit');
        return;
      }
      return;
    }

    // Check for toggle shortcuts
    for (const shortcut of finalShortcuts.toggle) {
      if (matchesShortcut(event, shortcut)) {
        event.preventDefault();
        
        // Special handling for F11 to prevent browser fullscreen
        if (shortcut === 'F11') {
          event.stopPropagation();
        }
        
        toggleFocusMode();
        onShortcutTriggered?.(shortcut, 'toggle');
        return;
      }
    }

    // Check for exit shortcuts (only when focus mode is active)
    if (isActive) {
      for (const shortcut of finalShortcuts.exit) {
        if (matchesShortcut(event, shortcut)) {
          event.preventDefault();
          toggleFocusMode();
          onShortcutTriggered?.(shortcut, 'exit');
          return;
        }
      }
    }
  }, [enabled, isActive, toggleFocusMode, finalShortcuts, onShortcutTriggered]);

  useEffect(() => {
    if (!enabled) return;

    // Add event listener to document for global shortcuts
    document.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [handleKeyDown, enabled]);

  return {
    shortcuts: finalShortcuts,
    isActive,
    toggleFocusMode,
    isMac,
    platform: currentPlatform,
    isWindows,
    isLinux,
  };
}

/**
 * Hook for displaying current shortcuts to users
 */
export function useFocusModeShortcutInfo(shortcuts?: Partial<FocusModeShortcuts>) {
  const finalShortcuts: FocusModeShortcuts = {
    toggle: shortcuts?.toggle || DEFAULT_SHORTCUTS.toggle,
    exit: shortcuts?.exit || DEFAULT_SHORTCUTS.exit,
  };

  const formatShortcut = (shortcut: string): string => {
    return shortcut
      .replace('Control', 'Ctrl')
      .replace('Meta', isMac ? '⌘' : 'Ctrl')
      .replace('+', isMac ? '' : '+');
  };

  return {
    toggle: finalShortcuts.toggle.map(formatShortcut),
    exit: finalShortcuts.exit.map(formatShortcut),
    primary: formatShortcut(finalShortcuts.toggle[0]),
    description: `Press ${formatShortcut(finalShortcuts.toggle[0])} to toggle focus mode, ${formatShortcut(finalShortcuts.exit[0])} to exit`,
    platform: currentPlatform,
    platformDisplay: {
      name: currentPlatform === 'mac' ? 'macOS' : currentPlatform === 'windows' ? 'Windows' : currentPlatform === 'linux' ? 'Linux' : 'Unknown',
      modifierKey: isMac ? '⌘' : 'Ctrl',
      shortcuts: {
        toggle: isMac ? '⌘⇧F or F11' : 'Ctrl+Shift+F or F11',
        exit: 'Escape'
      }
    }
  };
}