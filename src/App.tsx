import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import ResizableLayout from "./components/ResizableLayout";
import { AppLayoutProvider } from "./contexts/AppLayoutContext";
import { StatsProvider } from "./contexts/StatsContext";
import { GlobalAudioPlayerProvider } from "./contexts/GlobalAudioPlayerContext";
import Dashboard from "./pages/Dashboard";
import ProblemCard from "./pages/ProblemCard";

function App() {
  const [isDark, setIsDark] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize app and check for dark mode preference
    const initApp = async () => {
      try {
        console.log("Connecting to database...");
        const result = await invoke("connect_database");
        console.log("Database connection:", result);
        
        // Check system dark mode preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          setIsDark(true);
          document.documentElement.classList.add('dark');
        }
        
        setIsAppReady(true);
      } catch (error) {
        console.error("Failed to initialize app:", error);
        setInitError(error as string);
        setIsAppReady(false);
      }
    };

    initApp();
  }, []);

  const toggleDarkMode = () => {
    setIsDark(!isDark);
    if (!isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Show loading screen while app initializes
  if (!isAppReady && !initError) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-200 ${
        isDark ? 'dark bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'
      }`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Connecting to DSA Learning App</h2>
          <p className="text-gray-600 dark:text-gray-400">Loading your learning environment...</p>
        </div>
      </div>
    );
  }

  // Show error screen if initialization failed
  if (initError) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-200 ${
        isDark ? 'dark bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'
      }`}>
        <div className="text-center max-w-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold mb-4 text-red-600 dark:text-red-400">
            Failed to Initialize App
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Error: {initError}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className={`min-h-screen transition-colors duration-200 ${
        isDark ? 'dark bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'
      }`}>
        <AppLayoutProvider>
          <StatsProvider>
            <GlobalAudioPlayerProvider>
              <ResizableLayout isDark={isDark} onToggleDarkMode={toggleDarkMode}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/problem/:problemId" element={<ProblemCard />} />
                  <Route path="/problem/:problemId/card/:cardId" element={<ProblemCard />} />
                </Routes>
              </ResizableLayout>
            </GlobalAudioPlayerProvider>
          </StatsProvider>
        </AppLayoutProvider>
      </div>
    </Router>
  );
}

export default App;