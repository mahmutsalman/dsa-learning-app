import { NavLink } from 'react-router-dom';
import { 
  HomeIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  LinkIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Analytics', href: '/analytics', icon: ChartBarIcon },
  { name: 'Connections', href: '/connections', icon: LinkIcon },
  { name: 'Documentation', href: '/docs', icon: DocumentTextIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  return (
    <div className={`${
      isCollapsed ? 'w-16' : 'w-64'
    } bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ease-in-out`}>
      {/* Logo */}
      <div className={`flex items-center ${isCollapsed ? 'px-2 justify-center' : 'px-6'} py-4 border-b border-gray-200 dark:border-gray-700`}>
        <div className="flex items-center">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">D</span>
          </div>
          {!isCollapsed && (
            <span className="ml-2 font-medium text-gray-900 dark:text-white transition-opacity duration-300">
              DSA App
            </span>
          )}
        </div>
        
        {/* Toggle Button */}
        <button
          onClick={onToggle}
          className={`${
            isCollapsed ? 'ml-0' : 'ml-auto'
          } p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}
        >
          {isCollapsed ? (
            <ChevronRightIcon className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronLeftIcon className="h-4 w-4 text-gray-500" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 ${isCollapsed ? 'px-2' : 'px-4'} py-6 space-y-2`}>
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              `flex items-center ${
                isCollapsed ? 'justify-center px-3' : 'px-3'
              } py-2 text-sm font-medium rounded-lg transition-colors group relative ${
                isActive
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`
            }
            title={isCollapsed ? item.name : undefined}
          >
            <item.icon className={`h-5 w-5 ${!isCollapsed && 'mr-3'}`} />
            {!isCollapsed && (
              <span className="transition-opacity duration-300">
                {item.name}
              </span>
            )}
            
            {/* Tooltip for collapsed state */}
            {isCollapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                {item.name}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      {!isCollapsed && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 transition-opacity duration-300">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <p>Version 0.1.0</p>
            <p>Built with Tauri</p>
          </div>
        </div>
      )}
    </div>
  );
}