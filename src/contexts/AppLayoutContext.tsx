import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

// App-level layout state interface
export interface AppLayoutState {
  sidebar: {
    isCollapsed: boolean;
    size: number;
    minSize: number;
    maxSize: number;
    collapsedSize: number;
  };
}

// App-level layout actions interface
export interface AppLayoutActions {
  toggleSidebar: () => void;
  setSidebarSize: (size: number) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

// Context interface
export interface AppLayoutContextValue {
  state: AppLayoutState;
  actions: AppLayoutActions;
}

// Default values
const DEFAULT_APP_LAYOUT_STATE: AppLayoutState = {
  sidebar: {
    isCollapsed: false,
    size: 25,           // 25% default width
    minSize: 15,        // 15% minimum width
    maxSize: 40,        // 40% maximum width
    collapsedSize: 4,   // 4% when collapsed
  },
};

// Create context
const AppLayoutContext = createContext<AppLayoutContextValue | null>(null);

// Provider props
interface AppLayoutProviderProps {
  children: ReactNode;
  initialState?: Partial<AppLayoutState>;
}

// App layout provider
export function AppLayoutProvider({ 
  children, 
  initialState 
}: AppLayoutProviderProps) {
  // Persistent storage for layout preferences
  const [storedSidebarSize, setStoredSidebarSize] = useLocalStorage(
    'app-sidebar-size',
    DEFAULT_APP_LAYOUT_STATE.sidebar.size
  );
  const [storedSidebarCollapsed, setStoredSidebarCollapsed] = useLocalStorage(
    'app-sidebar-collapsed',
    DEFAULT_APP_LAYOUT_STATE.sidebar.isCollapsed
  );

  // Initialize state with stored values and initial overrides
  const [state, setState] = useState<AppLayoutState>({
    ...DEFAULT_APP_LAYOUT_STATE,
    sidebar: {
      ...DEFAULT_APP_LAYOUT_STATE.sidebar,
      size: storedSidebarSize,
      isCollapsed: storedSidebarCollapsed,
      ...initialState?.sidebar,
    },
  });

  // Action handlers
  const actions: AppLayoutActions = {
    toggleSidebar: useCallback(() => {
      setState(prev => {
        const newCollapsed = !prev.sidebar.isCollapsed;
        setStoredSidebarCollapsed(newCollapsed);
        
        return {
          ...prev,
          sidebar: {
            ...prev.sidebar,
            isCollapsed: newCollapsed,
          },
        };
      });
    }, [setStoredSidebarCollapsed]),

    setSidebarSize: useCallback((size: number) => {
      // Clamp size to valid range
      const clampedSize = Math.max(
        state.sidebar.minSize,
        Math.min(state.sidebar.maxSize, size)
      );
      
      setState(prev => ({
        ...prev,
        sidebar: {
          ...prev.sidebar,
          size: clampedSize,
        },
      }));
      
      setStoredSidebarSize(clampedSize);
    }, [state.sidebar.minSize, state.sidebar.maxSize, setStoredSidebarSize]),

    setSidebarCollapsed: useCallback((collapsed: boolean) => {
      setState(prev => ({
        ...prev,
        sidebar: {
          ...prev.sidebar,
          isCollapsed: collapsed,
        },
      }));
      
      setStoredSidebarCollapsed(collapsed);
    }, [setStoredSidebarCollapsed]),
  };

  const contextValue: AppLayoutContextValue = {
    state,
    actions,
  };

  return (
    <AppLayoutContext.Provider value={contextValue}>
      {children}
    </AppLayoutContext.Provider>
  );
}

// Hook to use app layout context
export function useAppLayout(): AppLayoutContextValue {
  const context = useContext(AppLayoutContext);
  
  if (!context) {
    throw new Error('useAppLayout must be used within an AppLayoutProvider');
  }
  
  return context;
}

// Optional hook that doesn't throw if context is missing
export function useAppLayoutOptional(): AppLayoutContextValue | null {
  return useContext(AppLayoutContext);
}

// Convenience hooks for specific layout aspects
export function useAppSidebar() {
  const { state, actions } = useAppLayout();
  
  return {
    isCollapsed: state.sidebar.isCollapsed,
    size: state.sidebar.size,
    minSize: state.sidebar.minSize,
    maxSize: state.sidebar.maxSize,
    collapsedSize: state.sidebar.collapsedSize,
    toggle: actions.toggleSidebar,
    setSize: actions.setSidebarSize,
    setCollapsed: actions.setSidebarCollapsed,
  };
}

// Optional sidebar hook that doesn't throw
export function useAppSidebarOptional() {
  const context = useAppLayoutOptional();
  
  if (!context) {
    return null;
  }
  
  return {
    isCollapsed: context.state.sidebar.isCollapsed,
    size: context.state.sidebar.size,
    minSize: context.state.sidebar.minSize,
    maxSize: context.state.sidebar.maxSize,
    collapsedSize: context.state.sidebar.collapsedSize,
    toggle: context.actions.toggleSidebar,
    setSize: context.actions.setSidebarSize,
    setCollapsed: context.actions.setSidebarCollapsed,
  };
}