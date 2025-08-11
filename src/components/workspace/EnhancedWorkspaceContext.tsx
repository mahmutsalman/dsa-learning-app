import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useLocalStorage } from '../../hooks/useLocalStorage';

// Enhanced workspace state interface
export interface EnhancedWorkspaceState {
  layout: {
    sidebarSize: number;      // Sidebar (problem panel) size percentage
    codeSize: number;         // Code editor size percentage (within editors container)
    editorsSize: number;      // Editors container size percentage
    notesSize: number;        // Notes editor size percentage (within editors container)
    isCollapsed: {
      sidebar: boolean;
      notes: boolean;
    };
  };
  ui: {
    theme: 'light' | 'dark';
    isResizing: boolean;
    lastResizeType: 'horizontal' | 'vertical' | null;
  };
  preferences: {
    minSidebarSize: number;
    maxSidebarSize: number;
    minEditorSize: number;
    autoSave: boolean;
    showResizeIndicators: boolean;
  };
}

// Enhanced workspace actions interface
export interface EnhancedWorkspaceActions {
  updateLayout: (layout: Partial<EnhancedWorkspaceState['layout']>) => void;
  toggleSidebar: () => void;
  toggleNotes: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setResizing: (isResizing: boolean, type?: 'horizontal' | 'vertical') => void;
  updatePreferences: (preferences: Partial<EnhancedWorkspaceState['preferences']>) => void;
  resetLayout: () => void;
  saveLayout: () => void;
  loadLayout: () => void;
}

// Context interface
export interface EnhancedWorkspaceContextValue {
  state: EnhancedWorkspaceState;
  actions: EnhancedWorkspaceActions;
}

// Default values
const DEFAULT_WORKSPACE_STATE: EnhancedWorkspaceState = {
  layout: {
    sidebarSize: 25,          // 25% for sidebar
    codeSize: 50,             // 50% for code editor within editors container
    editorsSize: 75,          // 75% for editors container
    notesSize: 50,            // 50% for notes editor within editors container
    isCollapsed: {
      sidebar: false,
      notes: false,
    },
  },
  ui: {
    theme: 'light',
    isResizing: false,
    lastResizeType: null,
  },
  preferences: {
    minSidebarSize: 15,       // 15% minimum for sidebar
    maxSidebarSize: 40,       // 40% maximum for sidebar
    minEditorSize: 20,        // 20% minimum for individual editors
    autoSave: true,
    showResizeIndicators: true,
  },
};

// Create context
const EnhancedWorkspaceContext = createContext<EnhancedWorkspaceContextValue | null>(null);

// Provider props
interface EnhancedWorkspaceProviderProps {
  children: ReactNode;
  initialState?: Partial<EnhancedWorkspaceState>;
}

// Enhanced workspace provider
export function EnhancedWorkspaceProvider({ 
  children, 
  initialState 
}: EnhancedWorkspaceProviderProps) {
  // Persistent storage for layout preferences
  const [storedLayout, setStoredLayout] = useLocalStorage(
    'enhanced-workspace-layout',
    DEFAULT_WORKSPACE_STATE.layout
  );
  const [storedPreferences, setStoredPreferences] = useLocalStorage(
    'enhanced-workspace-preferences',
    DEFAULT_WORKSPACE_STATE.preferences
  );

  // Initialize state with stored values and initial overrides
  const [state, setState] = useState<EnhancedWorkspaceState>({
    ...DEFAULT_WORKSPACE_STATE,
    layout: { ...DEFAULT_WORKSPACE_STATE.layout, ...storedLayout },
    preferences: { ...DEFAULT_WORKSPACE_STATE.preferences, ...storedPreferences },
    ...initialState,
  });

  // Actions implementation
  const actions: EnhancedWorkspaceActions = {
    updateLayout: useCallback((layoutUpdates: Partial<EnhancedWorkspaceState['layout']>) => {
      setState(prev => {
        const newLayout = { ...prev.layout, ...layoutUpdates };
        
        // Automatically calculate complementary sizes
        if ('sidebarSize' in layoutUpdates) {
          newLayout.editorsSize = 100 - newLayout.sidebarSize;
        }
        if ('codeSize' in layoutUpdates) {
          newLayout.notesSize = 100 - newLayout.codeSize;
        }

        // Save to localStorage
        setStoredLayout(newLayout);
        
        return {
          ...prev,
          layout: newLayout,
        };
      });
    }, [setStoredLayout]),

    toggleSidebar: useCallback(() => {
      setState(prev => {
        const newCollapsed = !prev.layout.isCollapsed.sidebar;
        const newLayout = {
          ...prev.layout,
          isCollapsed: {
            ...prev.layout.isCollapsed,
            sidebar: newCollapsed,
          },
          // When collapsing, use minimum size (3%), when expanding restore saved size
          sidebarSize: newCollapsed ? 3 : (storedLayout.sidebarSize || DEFAULT_WORKSPACE_STATE.layout.sidebarSize),
          editorsSize: newCollapsed ? 97 : (100 - (storedLayout.sidebarSize || DEFAULT_WORKSPACE_STATE.layout.sidebarSize)),
        };
        
        setStoredLayout(newLayout);
        
        // Trigger resize events for Monaco Editor after layout change
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));
        }, 100);
        
        return { ...prev, layout: newLayout };
      });
    }, [storedLayout.sidebarSize, setStoredLayout]),

    toggleNotes: useCallback(() => {
      setState(prev => {
        const newCollapsed = !prev.layout.isCollapsed.notes;
        const newLayout = {
          ...prev.layout,
          isCollapsed: {
            ...prev.layout.isCollapsed,
            notes: newCollapsed,
          },
          // Adjust code editor size when notes is toggled
          codeSize: newCollapsed ? 100 : (storedLayout.codeSize || DEFAULT_WORKSPACE_STATE.layout.codeSize),
          notesSize: newCollapsed ? 0 : (100 - (storedLayout.codeSize || DEFAULT_WORKSPACE_STATE.layout.codeSize)),
        };
        
        setStoredLayout(newLayout);
        return { ...prev, layout: newLayout };
      });
    }, [storedLayout.codeSize, setStoredLayout]),

    setTheme: useCallback((theme: 'light' | 'dark') => {
      setState(prev => ({
        ...prev,
        ui: { ...prev.ui, theme },
      }));
      
      // Apply theme to document for immediate effect
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }, []),

    setResizing: useCallback((isResizing: boolean, type?: 'horizontal' | 'vertical') => {
      setState(prev => ({
        ...prev,
        ui: {
          ...prev.ui,
          isResizing,
          lastResizeType: isResizing ? (type || prev.ui.lastResizeType) : prev.ui.lastResizeType,
        },
      }));
    }, []),

    updatePreferences: useCallback((preferenceUpdates: Partial<EnhancedWorkspaceState['preferences']>) => {
      setState(prev => {
        const newPreferences = { ...prev.preferences, ...preferenceUpdates };
        setStoredPreferences(newPreferences);
        return {
          ...prev,
          preferences: newPreferences,
        };
      });
    }, [setStoredPreferences]),

    resetLayout: useCallback(() => {
      const defaultLayout = DEFAULT_WORKSPACE_STATE.layout;
      setState(prev => ({
        ...prev,
        layout: defaultLayout,
      }));
      setStoredLayout(defaultLayout);
    }, [setStoredLayout]),

    saveLayout: useCallback(() => {
      setStoredLayout(state.layout);
      setStoredPreferences(state.preferences);
    }, [state.layout, state.preferences, setStoredLayout, setStoredPreferences]),

    loadLayout: useCallback(() => {
      setState(prev => ({
        ...prev,
        layout: { ...DEFAULT_WORKSPACE_STATE.layout, ...storedLayout },
        preferences: { ...DEFAULT_WORKSPACE_STATE.preferences, ...storedPreferences },
      }));
    }, [storedLayout, storedPreferences]),
  };

  const contextValue: EnhancedWorkspaceContextValue = {
    state,
    actions,
  };

  return (
    <EnhancedWorkspaceContext.Provider value={contextValue}>
      {children}
    </EnhancedWorkspaceContext.Provider>
  );
}

// Custom hook to use the enhanced workspace context
export function useEnhancedWorkspace(): EnhancedWorkspaceContextValue {
  const context = useContext(EnhancedWorkspaceContext);
  if (!context) {
    throw new Error('useEnhancedWorkspace must be used within an EnhancedWorkspaceProvider');
  }
  return context;
}

// Utility hooks for specific functionality
export function useEnhancedWorkspaceLayout() {
  const { state, actions } = useEnhancedWorkspace();
  return {
    layout: state.layout,
    updateLayout: actions.updateLayout,
    toggleSidebar: actions.toggleSidebar,
    toggleNotes: actions.toggleNotes,
    resetLayout: actions.resetLayout,
  };
}

// Optional hook that doesn't throw if context is missing
export function useEnhancedWorkspaceLayoutOptional() {
  const context = useContext(EnhancedWorkspaceContext);
  
  if (!context) {
    return null;
  }
  
  const { state, actions } = context;
  return {
    layout: state.layout,
    updateLayout: actions.updateLayout,
    toggleSidebar: actions.toggleSidebar,
    toggleNotes: actions.toggleNotes,
    resetLayout: actions.resetLayout,
  };
}

export function useEnhancedWorkspacePreferences() {
  const { state, actions } = useEnhancedWorkspace();
  return {
    preferences: state.preferences,
    updatePreferences: actions.updatePreferences,
    theme: state.ui.theme,
    setTheme: actions.setTheme,
  };
}

export function useEnhancedWorkspaceResize() {
  const { state, actions } = useEnhancedWorkspace();
  return {
    isResizing: state.ui.isResizing,
    lastResizeType: state.ui.lastResizeType,
    setResizing: actions.setResizing,
  };
}