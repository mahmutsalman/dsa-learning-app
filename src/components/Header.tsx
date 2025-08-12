import { MoonIcon, SunIcon, Cog6ToothIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

interface HeaderProps {
  isDark: boolean;
  onToggleDarkMode: () => void;
  showStats: boolean;
  onToggleStatsView: () => void;
}

export default function Header({ isDark, onToggleDarkMode, showStats, onToggleStatsView }: HeaderProps) {
  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            DSA Learning App
          </h1>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Stats view toggle */}
          <button
            onClick={onToggleStatsView}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label={showStats ? "Hide dashboard stats" : "Show dashboard stats"}
          >
            {showStats ? (
              <EyeIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            ) : (
              <EyeSlashIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            )}
          </button>
          
          {/* Dark mode toggle */}
          <button
            onClick={onToggleDarkMode}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Toggle dark mode"
          >
            {isDark ? (
              <SunIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            ) : (
              <MoonIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            )}
          </button>
          
          {/* Settings */}
          <button
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Settings"
          >
            <Cog6ToothIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
      </div>
    </header>
  );
}