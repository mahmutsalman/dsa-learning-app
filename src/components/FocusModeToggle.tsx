import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useEnhancedWorkspaceFocusMode } from './workspace/EnhancedWorkspaceContext';
import { useFocusModeShortcutInfo } from '../hooks/useFocusModeShortcuts';

export interface FocusModeToggleProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

export function FocusModeToggle({ 
  className = '', 
  size = 'md',
  showTooltip = true 
}: FocusModeToggleProps) {
  const { isActive, toggleFocusMode } = useEnhancedWorkspaceFocusMode();
  const { primary: primaryShortcut } = useFocusModeShortcutInfo();

  // Size mappings for icon and padding
  const sizeClasses = {
    sm: 'p-1',
    md: 'p-2', 
    lg: 'p-3'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  return (
    <button
      onClick={toggleFocusMode}
      className={`
        ${sizeClasses[size]} 
        rounded-lg 
        transition-colors 
        focus:outline-none 
        focus:ring-2 
        focus:ring-blue-500 
        focus:ring-offset-2
        ${isActive 
          ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/30' 
          : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
        }
        ${className}
      `.trim()}
      title={showTooltip ? (isActive ? `Exit focus mode (${primaryShortcut})` : `Enter focus mode (${primaryShortcut})`) : undefined}
      aria-label={isActive ? "Exit focus mode" : "Enter focus mode"}
      aria-pressed={isActive}
      role="button"
    >
      <div className="flex items-center justify-center">
        {isActive ? (
          <EyeSlashIcon className={iconSizes[size]} />
        ) : (
          <EyeIcon className={iconSizes[size]} />
        )}
      </div>
    </button>
  );
}

// Optional: Compound component for more complex layouts
export function FocusModeToggleWithLabel({
  className = '',
  size = 'md',
  showLabel = true,
  orientation = 'horizontal'
}: FocusModeToggleProps & {
  showLabel?: boolean;
  orientation?: 'horizontal' | 'vertical';
}) {
  const { isActive } = useEnhancedWorkspaceFocusMode();

  return (
    <div 
      className={`
        flex 
        ${orientation === 'horizontal' ? 'flex-row items-center space-x-2' : 'flex-col items-center space-y-1'}
        ${className}
      `.trim()}
    >
      <FocusModeToggle size={size} showTooltip={!showLabel} />
      {showLabel && (
        <span className={`
          text-xs font-medium
          ${isActive 
            ? 'text-blue-600 dark:text-blue-400' 
            : 'text-gray-500 dark:text-gray-400'
          }
          ${orientation === 'vertical' ? 'text-center' : ''}
        `.trim()}>
          {isActive ? 'Focus On' : 'Focus Off'}
        </span>
      )}
    </div>
  );
}