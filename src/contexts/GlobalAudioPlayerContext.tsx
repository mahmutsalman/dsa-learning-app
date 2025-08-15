import { createContext, useContext, ReactNode } from 'react';
import { useGlobalAudioPlayer, UseGlobalAudioPlayerReturn } from '../hooks/useGlobalAudioPlayer';
import GlobalAudioPlayer from '../components/GlobalAudioPlayer';

interface GlobalAudioPlayerContextType extends UseGlobalAudioPlayerReturn {}

const GlobalAudioPlayerContext = createContext<GlobalAudioPlayerContextType | undefined>(undefined);

export function useGlobalAudioPlayerContext(): GlobalAudioPlayerContextType {
  const context = useContext(GlobalAudioPlayerContext);
  if (context === undefined) {
    throw new Error('useGlobalAudioPlayerContext must be used within a GlobalAudioPlayerProvider');
  }
  return context;
}

interface GlobalAudioPlayerProviderProps {
  children: ReactNode;
}

export function GlobalAudioPlayerProvider({ children }: GlobalAudioPlayerProviderProps) {
  const audioPlayerHook = useGlobalAudioPlayer();

  return (
    <GlobalAudioPlayerContext.Provider value={audioPlayerHook}>
      {children}
      {/* Render the global audio player */}
      <GlobalAudioPlayer {...audioPlayerHook} />
    </GlobalAudioPlayerContext.Provider>
  );
}