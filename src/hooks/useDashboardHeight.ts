import { useMemo } from 'react';
import { useWindowSize } from './useWindowSize';

type ScreenSize = 'small' | 'medium' | 'large' | 'ultrawide';

interface HeightCalculation {
  containerHeight: number;
  screenSize: ScreenSize;
  availableHeight: number;
  utilizationRate: number;
}

interface DashboardHeightConfig {
  headerHeight?: number;
  paddingTotal?: number;
  minimumHeight?: number;
  maximumHeight?: number;
}

export const useDashboardHeight = (config: DashboardHeightConfig = {}): HeightCalculation => {
  const {
    headerHeight = 80,      // Header + stats section
    paddingTotal = 100,     // Top/bottom padding and margins
    minimumHeight = 400,    // Minimum usable height
    maximumHeight = 2000,   // Maximum height to prevent unwieldy layouts
  } = config;

  const { width, height } = useWindowSize();

  const calculation = useMemo(() => {
    // Classify screen size based on width
    let screenSize: ScreenSize;
    if (width <= 1366) {
      screenSize = 'small';
    } else if (width <= 1920) {
      screenSize = 'medium';
    } else if (width <= 2560) {
      screenSize = 'large';
    } else {
      screenSize = 'ultrawide';
    }

    // Define utilization rates for each screen size
    const utilizationRates = {
      small: 0.70,     // Conservative for laptops/tablets
      medium: 0.75,    // Balanced for standard desktops
      large: 0.80,     // Generous for large monitors
      ultrawide: 0.85  // Luxurious for ultrawide displays
    };

    // Calculate available height after fixed elements
    const availableHeight = height - headerHeight - paddingTotal;

    // Apply utilization rate based on screen size
    const utilizationRate = utilizationRates[screenSize];
    const targetHeight = Math.floor(availableHeight * utilizationRate);

    // Apply minimum and maximum constraints
    const containerHeight = Math.max(
      minimumHeight,
      Math.min(maximumHeight, targetHeight)
    );

    return {
      containerHeight,
      screenSize,
      availableHeight,
      utilizationRate,
    };
  }, [width, height, headerHeight, paddingTotal, minimumHeight, maximumHeight]);

  return calculation;
};