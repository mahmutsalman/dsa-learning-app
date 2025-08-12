import React, { createContext, useContext, useState, ReactNode } from 'react';

interface StatsContextType {
  showStats: boolean;
  toggleStats: () => void;
}

const StatsContext = createContext<StatsContextType | undefined>(undefined);

interface StatsProviderProps {
  children: ReactNode;
}

export function StatsProvider({ children }: StatsProviderProps) {
  const [showStats, setShowStats] = useState(true);

  const toggleStats = () => {
    setShowStats(prev => !prev);
  };

  return (
    <StatsContext.Provider value={{ showStats, toggleStats }}>
      {children}
    </StatsContext.Provider>
  );
}

export function useStats() {
  const context = useContext(StatsContext);
  if (context === undefined) {
    throw new Error('useStats must be used within a StatsProvider');
  }
  return context;
}