import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Screen size categories based on window width
 */
export type ScreenSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Header-specific breakpoint categories based on container width
 */
export type HeaderBreakpoint = 'ultra-compact' | 'compact' | 'normal' | 'spacious' | 'ultra-wide';

/**
 * Responsive configuration object returned by the hook
 */
export interface ResponsiveConfig {
  /** Actual measured width of the header container */
  containerWidth: number;
  /** Window-based screen size category */
  screenSize: ScreenSize;
  /** Header-specific breakpoint category */
  headerBreakpoint: HeaderBreakpoint;
  /** Raw window width */
  windowWidth: number;
  /** Whether measurements are stable (not fluctuating) */
  isStable: boolean;
}

/**
 * Hook for measuring header container responsiveness
 * 
 * Based on the proven useTimerContainerWidth pattern from WorkspaceHeader.tsx.
 * Provides stable width measurements with debouncing and hysteresis to prevent
 * oscillation during resize operations.
 * 
 * @param ref - React ref to the header container element
 * @returns ResponsiveConfig object with current measurements and breakpoints
 * 
 * @example
 * ```tsx
 * const headerRef = useRef<HTMLDivElement>(null);
 * const responsive = useHeaderResponsiveness(headerRef);
 * 
 * // Use responsive.headerBreakpoint to make layout decisions
 * const shouldCompact = responsive.headerBreakpoint === 'ultra-compact';
 * ```
 */
function useHeaderResponsiveness(ref: React.RefObject<HTMLElement>): ResponsiveConfig {
  // State management
  const [containerWidth, setContainerWidth] = useState<number>(800); // Default to normal size
  const [screenSize, setScreenSize] = useState<ScreenSize>('lg');
  const [windowWidth, setWindowWidth] = useState<number>(1200);
  const [isStable, setIsStable] = useState<boolean>(false);

  // Refs for stability and measurement tracking
  const lastWidthRef = useRef<number>(800);
  const measurementTimeoutRef = useRef<number>();
  const stabilityTimeoutRef = useRef<number>();
  const measurementHistoryRef = useRef<number[]>([]);
  const lastStableWidthRef = useRef<number>(800);
  const stabilityCountRef = useRef<number>(0);

  /**
   * Determines screen size category based on window width
   * Screen breakpoints: xs (<480px), sm (<640px), md (<900px), lg (<1400px), xl (1400px+)
   */
  const getScreenSize = useCallback((width: number): ScreenSize => {
    if (width < 480) return 'xs';
    if (width < 640) return 'sm';
    if (width < 900) return 'md';
    if (width < 1400) return 'lg';
    return 'xl';
  }, []);

  /**
   * Determines header breakpoint category based on container width
   * Header breakpoints: ultra-compact (<400px), compact (<600px), normal (<800px), spacious (<1000px), ultra-wide (1200px+)
   */
  const getHeaderBreakpoint = useCallback((width: number): HeaderBreakpoint => {
    if (width < 400) return 'ultra-compact';
    if (width < 600) return 'compact';
    if (width < 800) return 'normal';
    if (width < 1000) return 'spacious';
    return 'ultra-wide';
  }, []);

  /**
   * Core measurement update function
   * Implements stability controls with debouncing and hysteresis
   */
  const updateMeasurements = useCallback(() => {
    if (ref.current) {
      const currentContainerWidth = ref.current.offsetWidth;
      const currentWindowWidth = window.innerWidth;

      // Add to measurement history for averaging (last 5 measurements)
      measurementHistoryRef.current.push(currentContainerWidth);
      if (measurementHistoryRef.current.length > 5) {
        measurementHistoryRef.current.shift();
      }

      // Calculate average width to smooth fluctuations
      const avgWidth = measurementHistoryRef.current.reduce((sum, w) => sum + w, 0) / measurementHistoryRef.current.length;

      // Enhanced stability check with 15px hysteresis threshold
      const widthDiff = Math.abs(avgWidth - lastStableWidthRef.current);
      const isSignificantChange = widthDiff > 15; // 15px hysteresis to prevent oscillation
      const isInitial = lastWidthRef.current === 800;

      // Only update if change is significant or this is initial measurement
      if (isSignificantChange || isInitial) {
        // Reset stability counter on significant change
        stabilityCountRef.current = 0;
        setIsStable(false);

        // Clear any pending stability timeout
        clearTimeout(stabilityTimeoutRef.current);

        // Set a stability timeout - only apply change after width is stable
        stabilityTimeoutRef.current = setTimeout(() => {
          const finalWidth = Math.round(avgWidth);
          lastStableWidthRef.current = finalWidth;
          lastWidthRef.current = finalWidth;
          setContainerWidth(finalWidth);
          setIsStable(true);

          // Development mode logging
          if ((import.meta as any).env?.MODE === 'development') {
            console.log('Header width stabilized:', { 
              finalWidth,
              avgWidth,
              widthDiff,
              measurements: measurementHistoryRef.current,
              windowWidth: currentWindowWidth,
              breakpoint: getHeaderBreakpoint(finalWidth)
            });
          }
        }, 200); // Wait 200ms for stability
      } else {
        stabilityCountRef.current++;
        setIsStable(stabilityCountRef.current > 3); // Consider stable after a few consistent measurements

        // Periodic development logging for stable states
        if ((import.meta as any).env?.MODE === 'development' && stabilityCountRef.current % 10 === 0) {
          console.log('Header width stable:', {
            currentWidth: currentContainerWidth,
            avgWidth,
            lastStable: lastStableWidthRef.current,
            widthDiff,
            stabilityCount: stabilityCountRef.current,
            breakpoint: getHeaderBreakpoint(lastStableWidthRef.current)
          });
        }
      }

      // Update screen size based on window width
      const newScreenSize = getScreenSize(currentWindowWidth);
      setScreenSize(newScreenSize);
      setWindowWidth(currentWindowWidth);
    }
  }, [ref, getScreenSize, getHeaderBreakpoint]);

  /**
   * Debounced measurement update to prevent excessive calls
   * Uses 100ms debounce for responsive updates while preventing performance issues
   */
  const debouncedUpdateMeasurements = useCallback(() => {
    clearTimeout(measurementTimeoutRef.current);
    measurementTimeoutRef.current = setTimeout(updateMeasurements, 100);
  }, [updateMeasurements]);

  // Setup measurement system with ResizeObserver and window resize fallback
  useEffect(() => {
    // Initial measurement after component mount
    const initialTimeout = setTimeout(updateMeasurements, 50);

    // Set up ResizeObserver with debouncing to prevent feedback loops
    let resizeObserver: ResizeObserver | null = null;

    if (ref.current && 'ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(() => {
        // Debounce ResizeObserver to prevent infinite loops
        debouncedUpdateMeasurements();
      });

      // Use setTimeout to avoid immediate observation that can cause loops
      setTimeout(() => {
        if (ref.current && resizeObserver) {
          resizeObserver.observe(ref.current);
        }
      }, 100);
    }

    // Fallback window resize listener with longer debounce
    let windowTimeoutId: number;
    const throttledWindowUpdate = () => {
      clearTimeout(windowTimeoutId);
      windowTimeoutId = setTimeout(updateMeasurements, 300);
    };

    window.addEventListener('resize', throttledWindowUpdate);

    // Cleanup function
    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(measurementTimeoutRef.current);
      clearTimeout(stabilityTimeoutRef.current);
      clearTimeout(windowTimeoutId);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', throttledWindowUpdate);
    };
  }, [updateMeasurements, debouncedUpdateMeasurements]);

  // Calculate header breakpoint based on current container width
  const headerBreakpoint = getHeaderBreakpoint(containerWidth);

  return {
    containerWidth,
    screenSize,
    headerBreakpoint,
    windowWidth,
    isStable
  };
}

export default useHeaderResponsiveness;