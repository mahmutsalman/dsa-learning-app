import { useState, useCallback, useEffect } from 'react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { 
  WorkspaceState, 
  WorkspaceActions, 
  WorkspaceDimensions, 
  WorkspaceConstraints,
  LayoutMode,
  ResizeHandle 
} from './WorkspaceContext';

// Default values
const DEFAULT_PROBLEM_WIDTH = 320;
const DEFAULT_CODE_HEIGHT = 400;
const COLLAPSED_PROBLEM_WIDTH = 48;
const MIN_PROBLEM_WIDTH = 200;
const MIN_CODE_HEIGHT = 200;
const MIN_NOTES_HEIGHT = 200;

interface UseWorkspaceLayoutOptions {
  initialDimensions?: Partial<WorkspaceDimensions>;
  onLayoutChange?: (layout: WorkspaceState) => void;
}

export function useWorkspaceLayout(options: UseWorkspaceLayoutOptions = {}) {
  const { initialDimensions = {}, onLayoutChange } = options;

  // Persistent storage for layout preferences
  const [storedProblemWidth, setStoredProblemWidth] = useLocalStorage('workspace-problem-width', DEFAULT_PROBLEM_WIDTH);
  const [storedCodeHeight, setStoredCodeHeight] = useLocalStorage('workspace-code-height', DEFAULT_CODE_HEIGHT);
  const [storedLayoutMode, setStoredLayoutMode] = useLocalStorage<LayoutMode>('workspace-layout-mode', LayoutMode.STANDARD);
  const [storedCollapsedState, setStoredCollapsedState] = useLocalStorage('workspace-collapsed-state', {
    problemPanel: false,
    notesEditor: false,
  });

  // Calculate initial dimensions
  const getInitialDimensions = useCallback((): WorkspaceDimensions => {
    const totalWidth = window.innerWidth;
    const totalHeight = window.innerHeight;
    
    return {
      problemPanelWidth: storedCollapsedState.problemPanel ? COLLAPSED_PROBLEM_WIDTH : storedProblemWidth,
      codeEditorHeight: storedCodeHeight,
      totalWidth,
      totalHeight,
      ...initialDimensions,
    };
  }, [storedProblemWidth, storedCodeHeight, storedCollapsedState, initialDimensions]);

  // Calculate dynamic constraints based on viewport
  const calculateConstraints = useCallback((dimensions: WorkspaceDimensions): WorkspaceConstraints => {
    const { totalWidth, totalHeight } = dimensions;
    
    // Problem panel constraints
    const maxProblemWidth = Math.min(totalWidth * 0.6, 600); // Max 60% or 600px
    const minProblemWidth = MIN_PROBLEM_WIDTH;
    
    // Editor constraints  
    const availableHeight = totalHeight - 100; // Account for header/padding
    const maxCodeHeight = Math.max(availableHeight * 0.7, MIN_CODE_HEIGHT);
    const minCodeHeight = MIN_CODE_HEIGHT;
    const minNotesHeight = MIN_NOTES_HEIGHT;
    
    return {
      minProblemWidth,
      maxProblemWidth,
      minCodeHeight,
      maxCodeHeight,
      minNotesHeight,
    };
  }, []);

  // Initialize state
  const [state, setState] = useState<WorkspaceState>(() => {
    const dimensions = getInitialDimensions();
    const constraints = calculateConstraints(dimensions);
    
    return {
      dimensions,
      constraints,
      layout: {
        mode: storedLayoutMode,
        isCollapsed: storedCollapsedState,
      },
      activeResize: {
        handle: null,
        startPosition: null,
        startDimensions: null,
      },
    };
  });

  // Update constraints when dimensions change
  useEffect(() => {
    const constraints = calculateConstraints(state.dimensions);
    setState(prev => ({ ...prev, constraints }));
  }, [state.dimensions.totalWidth, state.dimensions.totalHeight, calculateConstraints]);

  // Handle window resize
  useEffect(() => {
    const handleWindowResize = () => {
      const totalWidth = window.innerWidth;
      const totalHeight = window.innerHeight;
      
      setState(prev => {
        const newDimensions = { ...prev.dimensions, totalWidth, totalHeight };
        const newConstraints = calculateConstraints(newDimensions);
        
        // Constrain current dimensions to new limits
        const constrainedProblemWidth = prev.layout.isCollapsed.problemPanel 
          ? COLLAPSED_PROBLEM_WIDTH 
          : Math.min(Math.max(prev.dimensions.problemPanelWidth, newConstraints.minProblemWidth), newConstraints.maxProblemWidth);
        
        const constrainedCodeHeight = Math.min(Math.max(prev.dimensions.codeEditorHeight, newConstraints.minCodeHeight), newConstraints.maxCodeHeight);
        
        return {
          ...prev,
          dimensions: {
            ...newDimensions,
            problemPanelWidth: constrainedProblemWidth,
            codeEditorHeight: constrainedCodeHeight,
          },
          constraints: newConstraints,
        };
      });
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [calculateConstraints]);

  // Actions
  const actions: WorkspaceActions = {
    updateDimensions: useCallback((newDimensions: Partial<WorkspaceDimensions>) => {
      setState(prev => {
        const updatedDimensions = { ...prev.dimensions, ...newDimensions };
        
        // Apply constraints
        const constrainedDimensions = {
          ...updatedDimensions,
          problemPanelWidth: prev.layout.isCollapsed.problemPanel 
            ? COLLAPSED_PROBLEM_WIDTH
            : Math.min(Math.max(updatedDimensions.problemPanelWidth, prev.constraints.minProblemWidth), prev.constraints.maxProblemWidth),
          codeEditorHeight: Math.min(Math.max(updatedDimensions.codeEditorHeight, prev.constraints.minCodeHeight), prev.constraints.maxCodeHeight),
        };

        // Save to localStorage
        if ('problemPanelWidth' in newDimensions && !prev.layout.isCollapsed.problemPanel) {
          setStoredProblemWidth(constrainedDimensions.problemPanelWidth);
        }
        if ('codeEditorHeight' in newDimensions) {
          setStoredCodeHeight(constrainedDimensions.codeEditorHeight);
        }

        return { ...prev, dimensions: constrainedDimensions };
      });
    }, [setStoredProblemWidth, setStoredCodeHeight]),

    updateConstraints: useCallback((newConstraints: Partial<WorkspaceConstraints>) => {
      setState(prev => ({ ...prev, constraints: { ...prev.constraints, ...newConstraints } }));
    }, []),

    togglePanel: useCallback((panel: 'problemPanel' | 'notesEditor') => {
      setState(prev => {
        const newCollapsedState = {
          ...prev.layout.isCollapsed,
          [panel]: !prev.layout.isCollapsed[panel],
        };

        // Update dimensions based on collapse state
        let updatedDimensions = { ...prev.dimensions };
        
        if (panel === 'problemPanel') {
          updatedDimensions.problemPanelWidth = newCollapsedState.problemPanel 
            ? COLLAPSED_PROBLEM_WIDTH 
            : storedProblemWidth;
        }

        // Save collapsed state
        setStoredCollapsedState(newCollapsedState);

        return {
          ...prev,
          dimensions: updatedDimensions,
          layout: {
            ...prev.layout,
            isCollapsed: newCollapsedState,
          },
        };
      });
    }, [storedProblemWidth, setStoredCollapsedState]),

    setLayoutMode: useCallback((mode: LayoutMode) => {
      setState(prev => ({ ...prev, layout: { ...prev.layout, mode } }));
      setStoredLayoutMode(mode);
    }, [setStoredLayoutMode]),

    startResize: useCallback((handle: ResizeHandle, startPosition: { x: number; y: number }) => {
      setState(prev => ({
        ...prev,
        activeResize: {
          handle,
          startPosition,
          startDimensions: { ...prev.dimensions },
        },
      }));
    }, []),

    updateResize: useCallback((delta: { x: number; y: number }) => {
      setState(prev => {
        if (!prev.activeResize.handle || !prev.activeResize.startDimensions) {
          return prev;
        }

        const { handle, startDimensions } = prev.activeResize;
        let newDimensions = { ...startDimensions };

        // Calculate new dimensions based on handle type
        if (handle.type === 'vertical') {
          // Vertical handle affects problem panel width
          if (handle.panels.before === 'problemPanel') {
            newDimensions.problemPanelWidth = startDimensions.problemPanelWidth + delta.x;
          }
        } else if (handle.type === 'horizontal') {
          // Horizontal handle affects code editor height
          if (handle.panels.before === 'codeEditor') {
            newDimensions.codeEditorHeight = startDimensions.codeEditorHeight + delta.y;
          }
        }

        // Apply constraints
        newDimensions.problemPanelWidth = Math.min(
          Math.max(newDimensions.problemPanelWidth, prev.constraints.minProblemWidth),
          prev.constraints.maxProblemWidth
        );
        
        newDimensions.codeEditorHeight = Math.min(
          Math.max(newDimensions.codeEditorHeight, prev.constraints.minCodeHeight),
          prev.constraints.maxCodeHeight
        );

        return { ...prev, dimensions: newDimensions };
      });
    }, []),

    endResize: useCallback(() => {
      setState(prev => {
        // Save final dimensions to localStorage
        if (!prev.layout.isCollapsed.problemPanel) {
          setStoredProblemWidth(prev.dimensions.problemPanelWidth);
        }
        setStoredCodeHeight(prev.dimensions.codeEditorHeight);

        return {
          ...prev,
          activeResize: {
            handle: null,
            startPosition: null,
            startDimensions: null,
          },
        };
      });
    }, [setStoredProblemWidth, setStoredCodeHeight]),

    resetLayout: useCallback(() => {
      const dimensions = {
        problemPanelWidth: DEFAULT_PROBLEM_WIDTH,
        codeEditorHeight: DEFAULT_CODE_HEIGHT,
        totalWidth: window.innerWidth,
        totalHeight: window.innerHeight,
      };
      
      const layout = {
        mode: LayoutMode.STANDARD,
        isCollapsed: {
          problemPanel: false,
          notesEditor: false,
        },
      };

      setState(prev => ({
        ...prev,
        dimensions,
        layout,
        constraints: calculateConstraints(dimensions),
      }));

      // Update localStorage
      setStoredProblemWidth(DEFAULT_PROBLEM_WIDTH);
      setStoredCodeHeight(DEFAULT_CODE_HEIGHT);
      setStoredLayoutMode(LayoutMode.STANDARD);
      setStoredCollapsedState({ problemPanel: false, notesEditor: false });
    }, [calculateConstraints, setStoredProblemWidth, setStoredCodeHeight, setStoredLayoutMode, setStoredCollapsedState]),
  };

  // Trigger layout change callback
  useEffect(() => {
    onLayoutChange?.(state);
  }, [state, onLayoutChange]);

  return { state, actions };
}