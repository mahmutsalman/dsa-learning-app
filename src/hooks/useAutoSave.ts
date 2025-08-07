import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from './useDebounce';

export interface AutoSaveState {
  isLoading: boolean;
  isSaved: boolean;
  error: string | null;
  lastSaved: Date | null;
}

export interface UseAutoSaveOptions {
  delay?: number;
  enabled?: boolean;
}

/**
 * Custom hook for auto-saving data with debouncing
 * @param value The value to auto-save
 * @param onSave Function to call when saving
 * @param options Configuration options
 * @returns Auto-save state and manual save function
 */
export function useAutoSave<T>(
  value: T,
  onSave: (value: T) => Promise<void>,
  options: UseAutoSaveOptions = {}
) {
  const { delay = 3000, enabled = true } = options;
  
  const [state, setState] = useState<AutoSaveState>({
    isLoading: false,
    isSaved: true,
    error: null,
    lastSaved: null
  });

  const debouncedValue = useDebounce(value, delay);
  const [initialValue, setInitialValue] = useState<T>(value);
  const [hasChanged, setHasChanged] = useState(false);

  // Track if the value has changed from initial
  useEffect(() => {
    const valueChanged = JSON.stringify(value) !== JSON.stringify(initialValue);
    setHasChanged(valueChanged);
    
    if (valueChanged && state.isSaved) {
      setState(prev => ({
        ...prev,
        isSaved: false,
        error: null
      }));
    }
  }, [value, initialValue, state.isSaved]);

  // Manual save function
  const save = useCallback(async (valueToSave?: T) => {
    const saveValue = valueToSave || value;
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      await onSave(saveValue);
      setState(prev => ({
        ...prev,
        isLoading: false,
        isSaved: true,
        error: null,
        lastSaved: new Date()
      }));
      
      // Update initial value after successful save
      setInitialValue(saveValue);
      setHasChanged(false);
      
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Save failed'
      }));
    }
  }, [value, onSave]);

  // Auto-save when debounced value changes
  useEffect(() => {
    if (!enabled || !hasChanged) return;
    
    // Only auto-save if the debounced value matches current value
    if (JSON.stringify(debouncedValue) === JSON.stringify(value)) {
      save(debouncedValue);
    }
  }, [debouncedValue, enabled, hasChanged, value, save]);

  return {
    ...state,
    save,
    hasUnsavedChanges: hasChanged && !state.isLoading
  };
}