import { useFocusModeShortcuts } from '../hooks/useFocusModeShortcuts';

export interface FocusModeShortcutHandlerProps {
  enabled?: boolean;
}

/**
 * Component that handles focus mode keyboard shortcuts
 * Must be used within EnhancedWorkspaceProvider
 */
export function FocusModeShortcutHandler({ enabled = true }: FocusModeShortcutHandlerProps) {
  // Focus mode keyboard shortcuts
  useFocusModeShortcuts({
    enabled,
    onShortcutTriggered: (shortcut, action) => {
      console.debug('Focus mode shortcut triggered:', { shortcut, action });
    },
  });

  // This component doesn't render anything
  return null;
}