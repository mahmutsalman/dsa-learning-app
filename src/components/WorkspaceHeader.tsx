import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import useHeaderResponsiveness from '../hooks/useHeaderResponsiveness';
import { 
  ArrowLeftIcon, 
  ArrowRightIcon, 
  PlayIcon, 
  StopIcon,
  MicrophoneIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  TrashIcon,
  ClockIcon,
  SpeakerWaveIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import { LanguageSelector } from './LanguageSelector';
import { FocusModeToggle } from './FocusModeToggle';
import type { Problem, Card } from '../types';
import type { UseTimerReturn } from '../hooks/useTimer';
import type { AutoSaveState } from '../hooks/useAutoSave';
import { SolutionCardButton, SolutionCardIndicator } from '../features/solution-card';

interface WorkspaceHeaderProps {
  problem: Problem;
  currentCard: Card | null;
  cards: Card[];
  language: string;
  onLanguageChange: (language: string) => void;
  timer: UseTimerReturn;
  codeAutoSave: AutoSaveState & { isLoading: boolean; isSaved: boolean; error: string | null };
  notesAutoSave: AutoSaveState & { isLoading: boolean; isSaved: boolean; error: string | null };
  languageAutoSave: AutoSaveState & { isLoading: boolean; isSaved: boolean; error: string | null };
  recordingState: { 
    isRecording: boolean; 
    isPaused: boolean; 
    elapsedRecordingTime: number; 
  };
  onToggleTimer: () => void;
  onToggleRecording: () => void;
  onNavigateCard: (direction: 'prev' | 'next') => void;
  onDeleteCard: () => void;
  onOpenSessionHistory: () => void;
  onOpenRecordingHistory: () => void;
  formatTimeDisplay: (seconds: number, showSeconds?: boolean) => string;
  getSiblingCards: (currentCard: Card, cards: Card[]) => Card[];
  previousProblemId?: string | null;
  onBackToPreviousProblem?: () => void;
  // Solution card props
  isViewingSolution?: boolean;
  onSolutionToggle?: (event: React.KeyboardEvent | React.MouseEvent) => void;
}

// Hook to measure container available width with enhanced stability controls
function useTimerContainerWidth(ref: React.RefObject<HTMLElement>) {
  const [availableWidth, setAvailableWidth] = useState<number>(200); // Default fallback
  const [screenSize, setScreenSize] = useState<'xs' | 'sm' | 'md' | 'lg' | 'xl'>('lg');
  const lastWidthRef = useRef<number>(200);
  const measurementTimeoutRef = useRef<number>();
  const stabilityTimeoutRef = useRef<number>();
  const measurementHistoryRef = useRef<number[]>([]);
  const lastStableWidthRef = useRef<number>(200);
  const stabilityCountRef = useRef<number>(0);
  
  const updateMeasurements = useCallback(() => {
    if (ref.current) {
      const containerWidth = ref.current.offsetWidth;
      const windowWidth = window.innerWidth;
      
      // Add to measurement history for averaging
      measurementHistoryRef.current.push(containerWidth);
      if (measurementHistoryRef.current.length > 5) {
        measurementHistoryRef.current.shift(); // Keep only last 5 measurements
      }
      
      // Calculate average width to smooth fluctuations
      const avgWidth = measurementHistoryRef.current.reduce((sum, w) => sum + w, 0) / measurementHistoryRef.current.length;
      
      // Enhanced stability check with larger hysteresis and averaging
      const widthDiff = Math.abs(avgWidth - lastStableWidthRef.current);
      const isSignificantChange = widthDiff > 15; // Increased from 5px to 15px
      const isInitial = lastWidthRef.current === 200;
      
      // Only update if change is significant or this is initial measurement
      if (isSignificantChange || isInitial) {
        // Reset stability counter on significant change
        stabilityCountRef.current = 0;
        
        // Clear any pending stability timeout
        clearTimeout(stabilityTimeoutRef.current);
        
        // Set a stability timeout - only apply change after width is stable
        stabilityTimeoutRef.current = window.setTimeout(() => {
          const finalWidth = Math.round(avgWidth);
          lastStableWidthRef.current = finalWidth;
          lastWidthRef.current = finalWidth;
          setAvailableWidth(finalWidth);
          
          if ((import.meta as any).env?.MODE === 'development') {
            console.log('Timer width stabilized:', { 
              finalWidth,
              avgWidth,
              widthDiff,
              measurements: measurementHistoryRef.current,
              windowWidth
            });
          }
        }, 200); // Wait 200ms for stability
      } else {
        stabilityCountRef.current++;
        
        if ((import.meta as any).env?.MODE === 'development' && stabilityCountRef.current % 10 === 0) {
          console.log('Timer width stable:', {
            currentWidth: containerWidth,
            avgWidth,
            lastStable: lastStableWidthRef.current,
            widthDiff,
            stabilityCount: stabilityCountRef.current
          });
        }
      }
      
      // Screen size detection for non-timer elements (less frequent)
      let newSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
      if (windowWidth < 480) newSize = 'xs';
      else if (windowWidth < 640) newSize = 'sm';
      else if (windowWidth < 900) newSize = 'md';
      else if (windowWidth < 1400) newSize = 'lg';
      else newSize = 'xl';
      
      setScreenSize(newSize);
    }
  }, [ref]);
  
  const debouncedUpdateMeasurements = useCallback(() => {
    clearTimeout(measurementTimeoutRef.current);
    measurementTimeoutRef.current = window.setTimeout(updateMeasurements, 100); // Reduced debounce for responsiveness
  }, [updateMeasurements]);
  
  useEffect(() => {
    // Initial measurement after component mount
    const initialTimeout = window.setTimeout(updateMeasurements, 50);
    
    // Set up ResizeObserver with debouncing to prevent feedback loops
    let resizeObserver: ResizeObserver | null = null;
    
    if (ref.current && 'ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(() => {
        // Debounce ResizeObserver to prevent infinite loops
        debouncedUpdateMeasurements();
      });
      
      // Use setTimeout to avoid immediate observation that can cause loops
      window.setTimeout(() => {
        if (ref.current && resizeObserver) {
          resizeObserver.observe(ref.current);
        }
      }, 100);
    }
    
    // Fallback window resize listener with longer debounce
    let windowTimeoutId: number;
    const throttledWindowUpdate = () => {
      clearTimeout(windowTimeoutId);
      windowTimeoutId = window.setTimeout(updateMeasurements, 300);
    };
    
    window.addEventListener('resize', throttledWindowUpdate);
    
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
  
  return { availableWidth, screenSize };
}

export function WorkspaceHeader({
  problem,
  currentCard,
  cards,
  language,
  onLanguageChange,
  timer,
  codeAutoSave,
  notesAutoSave,
  languageAutoSave,
  recordingState,
  onToggleTimer,
  onToggleRecording,
  onNavigateCard,
  onDeleteCard,
  onOpenSessionHistory,
  onOpenRecordingHistory,
  formatTimeDisplay,
  getSiblingCards,
  previousProblemId,
  onBackToPreviousProblem,
  isViewingSolution = false,
  onSolutionToggle,
}: WorkspaceHeaderProps) {
  const navigate = useNavigate();
  const timerButtonRef = useRef<HTMLButtonElement>(null);
  const headerContainerRef = useRef<HTMLDivElement>(null);
  
  // Dual measurement system: timer-specific and header-wide
  const { availableWidth, screenSize } = useTimerContainerWidth(timerButtonRef);
  const responsive = useHeaderResponsiveness(headerContainerRef);
  
  const [showTimerDropdown, setShowTimerDropdown] = useState(false);
  const [showRecordingDropdown, setShowRecordingDropdown] = useState(false);

  // Integrate CSS variables with responsive measurements
  useEffect(() => {
    // Calculate scale factor based on header breakpoint
    let scaleFactor = 1.0;
    switch (responsive.headerBreakpoint) {
      case 'ultra-compact':
        scaleFactor = 0.8;
        break;
      case 'compact':
        scaleFactor = 0.85;
        break;
      case 'normal':
        scaleFactor = 0.9;
        break;
      case 'spacious':
        scaleFactor = 1.0;
        break;
      case 'ultra-wide':
        scaleFactor = 1.1;
        break;
    }
    
    // Update CSS custom properties
    document.documentElement.style.setProperty('--header-scale-factor', scaleFactor.toString());
    
    if ((import.meta as any).env?.MODE === 'development') {
      console.log('Header CSS variables updated:', {
        breakpoint: responsive.headerBreakpoint,
        scaleFactor,
        containerWidth: responsive.containerWidth,
        isStable: responsive.isStable
      });
    }
  }, [responsive.headerBreakpoint, responsive.containerWidth, responsive.isStable]);
  
  // Smart dynamic timer display logic based on available container width
  const getTimerDisplayConfig = () => {
    const liveTotalDuration = timer.timerState.isRunning 
      ? timer.totalDuration + timer.timerState.elapsedTime
      : timer.totalDuration;
    
    // Determine compact level with enhanced hysteresis to prevent oscillation
    let compactLevel: number;
    let format: string;
    
    // Use much wider thresholds with large hysteresis gaps to prevent bouncing
    // Added buffer zones around problematic ranges (130-155px)
    if (availableWidth < 85) {
      // Level 0: Ultra compact - single time only
      compactLevel = 0;
      format = 'Single';
      return {
        showSingle: true,
        primaryTime: timer.timerState.isRunning ? timer.timerState.elapsedTime : liveTotalDuration,
        primaryLabel: '',
        showSeconds: false,
        compactLevel,
        format
      };
    } else if (availableWidth < 110) {
      // Level 1: Minutes format - "22m/0m"
      compactLevel = 1;
      format = 'Minutes';
      return {
        showSingle: false,
        primaryTime: liveTotalDuration,
        secondaryTime: timer.timerState.elapsedTime,
        primaryLabel: '',
        secondaryLabel: '',
        showSeconds: false,
        useMinutesFormat: true,
        compactLevel,
        format
      };
    } else if (availableWidth < 125) {
      // Level 2: Slash format - "22:45/0:00" (moved down from 135)
      compactLevel = 2;
      format = 'Slash';
      return {
        showSingle: false,
        primaryTime: liveTotalDuration,
        secondaryTime: timer.timerState.elapsedTime,
        primaryLabel: '',
        secondaryLabel: '',
        showSeconds: false,
        compactLevel,
        format
      };
    } else if (availableWidth < 165) {
      // Level 3: No-space abbreviated - "Tot:22:45 Now:0:00" (wider range to avoid 130-155 problem zone)
      compactLevel = 3;
      format = 'NoSpaceAbbrev';
      return {
        showSingle: false,
        primaryTime: liveTotalDuration,
        secondaryTime: timer.timerState.elapsedTime,
        primaryLabel: 'Tot:',
        secondaryLabel: 'Now:',
        showSeconds: false,
        noSpacing: true,
        compactLevel,
        format
      };
    } else if (availableWidth < 200) {
      // Level 4: Minimal abbreviated - "Tot: 22:45 Now: 0:00"
      compactLevel = 4;
      format = 'Abbreviated';
      return {
        showSingle: false,
        primaryTime: liveTotalDuration,
        secondaryTime: timer.timerState.elapsedTime,
        primaryLabel: 'Tot:',
        secondaryLabel: 'Now:',
        showSeconds: false,
        compactLevel,
        format
      };
    } else if (availableWidth < 240) {
      // Level 5: Full compact - "Total: 22:45 Current: 0:00"
      compactLevel = 5;
      format = 'Compact';
      return {
        showSingle: false,
        primaryTime: liveTotalDuration,
        secondaryTime: timer.timerState.elapsedTime,
        primaryLabel: 'Total:',
        secondaryLabel: 'Current:',
        showSeconds: false,
        compactLevel,
        format
      };
    } else {
      // Level 6: Spacious - "Total: 22:45    Current: 0:00"
      compactLevel = 6;
      format = 'Spacious';
      return {
        showSingle: false,
        primaryTime: liveTotalDuration,
        secondaryTime: timer.timerState.elapsedTime,
        primaryLabel: 'Total:',
        secondaryLabel: 'Current:',
        showSeconds: false,
        spacious: true,
        compactLevel,
        format
      };
    }
  };
  
  const timerConfig = getTimerDisplayConfig();

  // Helper function to format time based on timer config
  const formatTime = (seconds: number, useMinutes?: boolean, noSpacing?: boolean) => {
    if (useMinutes) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes}m`;
    }
    
    const formatted = formatTimeDisplay(seconds, false);
    return noSpacing ? formatted.replace(/\s/g, '') : formatted;
  };


  return (
    <div 
      ref={headerContainerRef}
      className="workspace-header-content bg-white dark:bg-gray-800 px-6 h-full flex items-center relative"
    >
      <div className="workspace-header-grid dynamic-scale">
        {/* Navigation Section - Critical */}
        <div className="header-navigation header-critical focus-hide">
          {previousProblemId && onBackToPreviousProblem ? (
            <div className="flex items-center gap-1">
              <button
                onClick={onBackToPreviousProblem}
                className="header-scale-button icon-only hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Back to previous related problem"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <span className="header-scale-text small header-optional text-gray-500 dark:text-gray-400 whitespace-nowrap">
                Back to related
              </span>
            </div>
          ) : (
            <button
              onClick={() => navigate('/')}
              className="header-scale-button icon-only hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Back to dashboard"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Title Section - Optional */}
        <div className="header-title header-optional focus-minimize">
          <div>
            <h1 className="header-scale-text large font-semibold text-gray-900 dark:text-white">
              {problem.title}
            </h1>
            <p className="header-scale-text small text-gray-500 dark:text-gray-400">
              {currentCard ? (() => {
                const allProblemCards = getSiblingCards(currentCard, cards);
                const currentIndex = allProblemCards.findIndex(c => c.id === currentCard.id);
                const cardType = currentCard.parent_card_id ? 'Child Card' : 'Main Card';
                
                return `${cardType} ${currentIndex + 1} / ${allProblemCards.length}`;
              })() : 'Card 1 / 1'}
            </p>
          </div>
        </div>

        {/* Language Selector Section - Important */}
        <div className={`header-language-selector header-important focus-minimize ${
          screenSize === 'xs' ? 'header-language-xs' : 
          screenSize === 'sm' ? 'header-language-sm' : ''
        }`}>
          <LanguageSelector
            value={language}
            onChange={onLanguageChange}
            className={`w-full ${
              screenSize === 'xs' ? 'max-w-[80px] text-xs' : 
              screenSize === 'sm' ? 'max-w-[100px] text-sm' : 'max-w-[120px]'
            }`}
          />
        </div>

        {/* Save Indicators Section - Important */}
        <div className={`header-save-indicators header-important focus-minimize ${
          screenSize === 'xs' ? 'header-save-xs' : 
          screenSize === 'sm' ? 'header-save-sm' : ''
        }`}>
          {(codeAutoSave.isLoading || notesAutoSave.isLoading || languageAutoSave.isLoading) && (
            <div className="flex items-center space-x-1 text-blue-600 dark:text-blue-400">
              <div className="animate-spin rounded-full h-3 w-3 border border-current border-t-transparent"></div>
              {screenSize !== 'xs' && <span className="header-scale-text small responsive-hide">Saving...</span>}
            </div>
          )}
          
          {(codeAutoSave.isSaved && notesAutoSave.isSaved && languageAutoSave.isSaved && 
            !codeAutoSave.isLoading && !notesAutoSave.isLoading && !languageAutoSave.isLoading) && (
            <div className="flex items-center space-x-1 text-green-600 dark:text-green-400">
              <CheckCircleIcon className="h-3 w-3" />
              {screenSize !== 'xs' && <span className="header-scale-text small responsive-hide">Saved</span>}
            </div>
          )}
          
          {(codeAutoSave.error || notesAutoSave.error || languageAutoSave.error) && (
            <div className="flex items-center space-x-1 text-red-600 dark:text-red-400">
              <ExclamationCircleIcon className="h-3 w-3" />
              {screenSize !== 'xs' && <span className="header-scale-text small responsive-hide">Error</span>}
            </div>
          )}
        </div>

        {/* Unified Controls Section - Navigation + Actions */}
        <div className={`header-controls-unified header-important focus-minimize ${
          screenSize === 'xs' ? 'header-controls-xs' : 
          screenSize === 'sm' ? 'header-controls-sm' : ''
        }`}>
          
          {/* Navigation Sub-Group */}
          <div className="controls-navigation">
            <button
              onClick={() => onNavigateCard('prev')}
              className={`header-scale-button icon-only ${screenSize === 'xs' ? 'compact' : ''} hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
              disabled={isViewingSolution || (currentCard ? (() => {
                const allProblemCards = getSiblingCards(currentCard, cards);
                const currentIndex = allProblemCards.findIndex(c => c.id === currentCard.id);
                return currentIndex === 0; // Disabled if at first card or in solution view
              })() : true)}
              title="Previous card"
            >
              <ArrowLeftIcon className={screenSize === 'xs' ? 'h-3 w-3' : 'h-4 w-4'} />
            </button>
            
            {/* Card count indicator - shows solution or regular navigation */}
            {isViewingSolution ? (
              <SolutionCardIndicator 
                isActive={true}
                screenSize={screenSize}
              />
            ) : (
              <span className={`${
                screenSize === 'xs' ? 'text-xs px-1' : 
                screenSize === 'sm' ? 'text-xs px-1' : 'text-sm px-2'
              } text-gray-500 dark:text-gray-400`}>
                {currentCard ? (() => {
                  const allProblemCards = getSiblingCards(currentCard, cards);
                  const currentIndex = allProblemCards.findIndex(c => c.id === currentCard.id);
                  
                  return `${currentIndex + 1}/${allProblemCards.length}`;
                })() : '1/1'}
              </span>
            )}
            
            {/* Solution-aware next button */}
            {onSolutionToggle ? (
              <SolutionCardButton
                onSolutionToggle={onSolutionToggle}
                isActive={isViewingSolution}
                className={screenSize === 'xs' ? 'p-1' : 'p-2'}
              />
            ) : (
              <button
                onClick={() => onNavigateCard('next')}
                className={`header-scale-button icon-only ${screenSize === 'xs' ? 'compact' : ''} hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}
                title="Navigate to next card or create new card"
              >
                <ArrowRightIcon className={screenSize === 'xs' ? 'h-3 w-3' : 'h-4 w-4'} />
              </button>
            )}
          </div>

          {/* Actions Sub-Group */}
          <div className="controls-actions">
            {/* Delete Button Container - Always reserves space */}
            <div className={`header-delete-container focus-minimize ${!currentCard?.parent_card_id ? 'hidden' : ''}`}>
              <button
                onClick={onDeleteCard}
                className="header-scale-button icon-only hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400"
                title="Delete child card"
                disabled={!currentCard?.parent_card_id}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>

            {/* Focus Mode Toggle */}
            <FocusModeToggle size="md" />

            {/* Timer with integrated Session History */}
            <div 
              className="relative focus-minimize" 
              onMouseLeave={(e) => {
                // Add small delay and check if mouse is moving to dropdown
                const rect = e.currentTarget.getBoundingClientRect();
                const mouseY = e.clientY;
                const mouseX = e.clientX;
                
                // If mouse is below the container (moving toward dropdown), delay closing
                if (mouseY > rect.bottom && mouseX >= rect.left && mouseX <= rect.right) {
                  window.setTimeout(() => {
                    setShowTimerDropdown(false);
                  }, 200);
                } else {
                  setShowTimerDropdown(false);
                }
              }}
              style={{ position: 'relative', zIndex: 1 }}
            >
              <div className="flex items-center">
                {/* Main Timer Button */}
                <button
                  ref={timerButtonRef}
                  onClick={onToggleTimer}
                  disabled={timer.isLoading}
                  className="header-scale-button header-timer-button with-icon bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                  style={{ gap: timerConfig.spacious ? '0.75rem' : timerConfig.noSpacing ? '0.25rem' : '0.5rem' }}
                  title={timer.timerState.isRunning ? "Stop timer session" : "Start timer session"}
                  aria-label={timer.timerState.isRunning ? "Stop timer session" : "Start timer session"}
                  aria-pressed={timer.timerState.isRunning}
                >
                  {/* Play/Stop Icon */}
                  <div className="flex-shrink-0">
                    {timer.timerState.isRunning ? (
                      <StopIcon className="h-4 w-4 text-red-500" />
                    ) : (
                      <PlayIcon className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                  
                  {/* Smart Dynamic Timer Display - 6 Levels */}
                  <div className={`flex ${timerConfig.showSingle ? 'items-center' : 'flex-col items-center'} min-w-0 ${timerConfig.compactLevel && timerConfig.compactLevel <= 4 ? 'gap-0' : timerConfig.spacious ? 'gap-1' : ''}`}>
                    {timerConfig.showSingle ? (
                      // Level 0: Single time display for ultra compact spaces (<80px)
                      <span className="text-xs font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {formatTime(timerConfig.primaryTime || 0)}
                      </span>
                    ) : (
                      // Multi-level displays based on available width
                      <>
                        {/* Primary time display */}
                        <span className={`text-xs font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap ${
                          timerConfig.compactLevel <= 4 ? 'leading-tight' : timerConfig.spacious ? 'leading-normal' : ''
                        }`}>
                          {(() => {
                            const primaryFormatted = formatTime(timerConfig.primaryTime || 0, timerConfig.useMinutesFormat, timerConfig.noSpacing);
                            const secondaryFormatted = formatTime(timerConfig.secondaryTime || 0, timerConfig.useMinutesFormat, timerConfig.noSpacing);
                            
                            // Level 1: Minutes format "22m/0m"
                            if (timerConfig.compactLevel === 1) {
                              return `${primaryFormatted}/${secondaryFormatted}`;
                            }
                            // Level 2: Slash format "22:45/0:00"
                            else if (timerConfig.compactLevel === 2) {
                              return `${primaryFormatted}/${secondaryFormatted}`;
                            }
                            // Level 3+: Label formats
                            else {
                              const spacing = timerConfig.noSpacing ? '' : ' ';
                              return `${timerConfig.primaryLabel}${spacing}${primaryFormatted}`;
                            }
                          })()} 
                        </span>
                        
                        {/* Secondary time display - only for levels 3+ */}
                        {timerConfig.compactLevel >= 3 && (
                          <span className={`text-xs font-mono transition-colors whitespace-nowrap ${
                            timer.timerState.isRunning 
                              ? 'text-red-500 dark:text-red-400' 
                              : 'text-gray-500 dark:text-gray-400'
                          } ${timerConfig.compactLevel <= 4 ? 'leading-tight' : timerConfig.spacious ? 'leading-normal' : ''}`}>
                            {(() => {
                              const secondaryFormatted = formatTime(timerConfig.secondaryTime || 0, timerConfig.useMinutesFormat, timerConfig.noSpacing);
                              const spacing = timerConfig.noSpacing ? '' : ' ';
                              return `${timerConfig.secondaryLabel}${spacing}${secondaryFormatted}`;
                            })()} 
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  
                  {/* Error and Debug Info - hidden on xs */}
                  {screenSize !== 'xs' && (
                    <div className="flex items-center space-x-1">
                      {timer.error && (
                        <div className="text-xs text-red-500" title={timer.error}>
                          ⚠️
                        </div>
                      )}
                    </div>
                  )}
                </button>
                
                {/* Session History Dropdown Trigger */}
                {(screenSize === 'md' || screenSize === 'lg' || screenSize === 'xl') && (
                  <button
                    onClick={() => setShowTimerDropdown(!showTimerDropdown)}
                    onMouseEnter={() => setShowTimerDropdown(true)}
                    className="header-scale-button compact icon-only hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ml-1"
                    title="Timer options"
                  >
                    <ChevronDownIcon className="h-3 w-3" />
                  </button>
                )}
              </div>
              
              {/* Session History Dropdown */}
              {showTimerDropdown && (
                <div 
                  className="absolute top-full right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl min-w-[120px]" 
                  style={{ 
                    zIndex: 'var(--z-dropdown)', 
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '0.125rem' // Reduced gap to make it easier to reach
                  }}
                  onMouseEnter={() => setShowTimerDropdown(true)}
                  onMouseLeave={() => setShowTimerDropdown(false)}
                >
                  <button
                    onClick={() => {
                      onOpenSessionHistory();
                      setShowTimerDropdown(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2"
                  >
                    <ClockIcon className="h-4 w-4" />
                    <span>Session History</span>
                  </button>
                </div>
              )}
              
              {/* Standalone Session History for small screens */}
              {(screenSize === 'xs' || screenSize === 'sm') && (
                <button
                  onClick={onOpenSessionHistory}
                  className="header-scale-button icon-only hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ml-1"
                  title="View session history"
                >
                  <ClockIcon className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Recording with integrated Recording History */}
            <div 
              className="relative focus-minimize" 
              onMouseLeave={(e) => {
                // Add small delay and check if mouse is moving to dropdown
                const rect = e.currentTarget.getBoundingClientRect();
                const mouseY = e.clientY;
                const mouseX = e.clientX;
                
                // If mouse is below the container (moving toward dropdown), delay closing
                if (mouseY > rect.bottom && mouseX >= rect.left && mouseX <= rect.right) {
                  window.setTimeout(() => {
                    setShowRecordingDropdown(false);
                  }, 200);
                } else {
                  setShowRecordingDropdown(false);
                }
              }}
              style={{ position: 'relative', zIndex: 1 }}
            >
              <div className="flex items-center">
                {/* Main Recording Button */}
                <button
                  onClick={onToggleRecording}
                  className={`header-scale-button header-timer-button with-icon transition-colors ${
                    recordingState.isRecording
                      ? 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                      : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                  title={recordingState.isRecording ? "Stop recording" : "Start recording"}
                  aria-label={recordingState.isRecording ? "Stop recording" : "Start recording"}
                  aria-pressed={recordingState.isRecording}
                >
                  {/* Mic Icon */}
                  <div className="flex-shrink-0">
                    <MicrophoneIcon className="h-4 w-4" />
                  </div>
                  
                  {/* Recording Timer Display - responsive */}
                  {recordingState.isRecording && (
                    <div className="flex flex-col items-center min-w-0">
                      <span className={`text-xs font-mono text-red-600 dark:text-red-400 whitespace-nowrap ${
                        screenSize === 'xs' ? 'hidden' : ''
                      }`}>
                        {screenSize === 'sm' ? formatTimeDisplay(recordingState.elapsedRecordingTime, false) : `Recording: ${formatTimeDisplay(recordingState.elapsedRecordingTime, false)}`}
                      </span>
                    </div>
                  )}
                </button>
                
                {/* Recording History Dropdown Trigger */}
                {(screenSize === 'md' || screenSize === 'lg' || screenSize === 'xl') && (
                  <button
                    onClick={() => setShowRecordingDropdown(!showRecordingDropdown)}
                    onMouseEnter={() => setShowRecordingDropdown(true)}
                    className="header-scale-button compact icon-only hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ml-1"
                    title="Recording options"
                  >
                    <ChevronDownIcon className="h-3 w-3" />
                  </button>
                )}
              </div>
              
              {/* Recording History Dropdown */}
              {showRecordingDropdown && (
                <div 
                  className="absolute top-full right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl min-w-[140px]" 
                  style={{ 
                    zIndex: 'var(--z-dropdown)', 
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '0.125rem' // Reduced gap to make it easier to reach
                  }}
                  onMouseEnter={() => setShowRecordingDropdown(true)}
                  onMouseLeave={() => setShowRecordingDropdown(false)}
                >
                  <button
                    onClick={() => {
                      onOpenRecordingHistory();
                      setShowRecordingDropdown(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2"
                  >
                    <SpeakerWaveIcon className="h-4 w-4" />
                    <span>Recording History</span>
                  </button>
                </div>
              )}
              
              {/* Standalone Recording History for small screens */}
              {(screenSize === 'xs' || screenSize === 'sm') && (
                <button
                  onClick={onOpenRecordingHistory}
                  className="header-scale-button icon-only hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ml-1"
                  title="View recording history"
                >
                  <SpeakerWaveIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}