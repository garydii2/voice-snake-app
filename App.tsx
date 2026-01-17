import React, { useState, useEffect, useRef } from 'react';
import { SnakeGame } from './components/SnakeGame';
import { GeminiLiveService } from './services/geminiLiveService';
import { ControlAction, Direction, GameStatus } from './types';
import { Mic, MicOff, Volume2, AlertTriangle, Smartphone, Key } from 'lucide-react';

const App: React.FC = () => {
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.IDLE);
  const [currentDirection, setCurrentDirection] = useState<Direction>(Direction.RIGHT);
  const [score, setScore] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSecureContext, setIsSecureContext] = useState(true);
  const [hasApiKey, setHasApiKey] = useState(true);
  
  const liveServiceRef = useRef<GeminiLiveService | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Check Secure Context and API Key on mount
  useEffect(() => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isHttps = window.location.protocol === 'https:';
    setIsSecureContext(isLocal || isHttps);

    // Check if API Key is configured
    if (!process.env.API_KEY) {
      setHasApiKey(false);
      setError("API Key is missing. Please configure it in Vercel settings.");
    }
  }, []);

  // Initialize Service (only if API Key exists)
  useEffect(() => {
    if (!process.env.API_KEY) return;

    try {
      liveServiceRef.current = new GeminiLiveService({
        onControlAction: (action) => {
          handleControlAction(action);
        },
        onStatusChange: (connected) => {
          setIsConnected(connected);
          if (!connected) {
              setAudioLevel(0);
              releaseWakeLock();
          } else {
              requestWakeLock();
          }
        },
        onError: (err) => {
          setError(err);
          setIsConnected(false);
        },
        onAudioData: (level) => {
          // Smooth dampening for visualization
          setAudioLevel(prev => prev * 0.8 + level * 0.2);
        }
      });
    } catch (e: any) {
      console.error("Failed to init service", e);
      setError(e.message);
    }

    return () => {
      liveServiceRef.current?.stop();
      releaseWakeLock();
    };
  }, []);

  const requestWakeLock = async () => {
    try {
        if ('wakeLock' in navigator) {
            wakeLockRef.current = await navigator.wakeLock.request('screen');
            console.log('Wake Lock active');
        }
    } catch (err) {
        console.warn('Wake Lock request failed:', err);
    }
  };

  const releaseWakeLock = () => {
      if (wakeLockRef.current) {
          wakeLockRef.current.release();
          wakeLockRef.current = null;
      }
  };

  const handleControlAction = (action: ControlAction) => {
    console.log('Received Action:', action);
    switch (action) {
      case 'UP':
      case 'DOWN':
      case 'LEFT':
      case 'RIGHT':
        if (gameStatus === GameStatus.PLAYING) {
          setCurrentDirection(Direction[action]);
        }
        break;
      case 'START':
      case 'RESTART':
        setGameStatus(GameStatus.PLAYING);
        setScore(0);
        setCurrentDirection(Direction.RIGHT);
        break;
      case 'STOP':
      case 'PAUSE':
        setGameStatus(GameStatus.PAUSED);
        break;
    }
  };

  const toggleConnection = async () => {
    if (isConnected) {
      liveServiceRef.current?.stop();
    } else {
      setError(null);
      await liveServiceRef.current?.connect();
    }
  };

  const handleGameOver = (finalScore: number) => {
    setGameStatus(GameStatus.GAME_OVER);
    setScore(finalScore);
  };

  // Render Missing API Key Screen
  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-slate-800 p-8 rounded-2xl border border-red-500/50 shadow-2xl max-w-md w-full">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Key className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">API Key Missing</h1>
          <p className="text-slate-300 mb-6 leading-relaxed">
            The app cannot start because the <code>API_KEY</code> environment variable is not set.
          </p>
          <div className="bg-slate-900 p-4 rounded-lg text-left text-sm text-slate-400 font-mono mb-6">
            1. Go to Vercel Project Settings<br/>
            2. Environment Variables<br/>
            3. Key: API_KEY<br/>
            4. Value: AIzaSy...<br/>
            5. <strong>Redeploy</strong>
          </div>
          <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer" className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors">
            Go to Vercel Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-2 sm:p-4 touch-none">
      
      {!isSecureContext && (
          <div className="w-full max-w-2xl mb-4 bg-amber-500/10 border border-amber-500/50 text-amber-200 p-3 rounded-lg flex items-start gap-3 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div>
                  <p className="font-bold">Microphone Access Warning</p>
                  <p>Your browser may block microphone access because this page is not served via <strong>HTTPS</strong> or <strong>localhost</strong>.</p>
                  <p className="mt-1 opacity-80">To run on mobile, please deploy to a secure host (like Vercel) or use a secure tunnel.</p>
              </div>
          </div>
      )}

      {/* Header */}
      <header className="w-full max-w-2xl flex justify-between items-center mb-4 sm:mb-8 bg-slate-800 p-3 sm:p-4 rounded-2xl shadow-lg border border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center shadow-inner shrink-0">
            <Volume2 className="text-white w-6 h-6" />
          </div>
          <div className="overflow-hidden">
            <h1 className="text-lg sm:text-xl font-bold text-white font-arcade whitespace-nowrap overflow-ellipsis">GEMINI SNAKE</h1>
            <p className="text-[10px] sm:text-xs text-slate-400">Powered by Gemini Live API</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
             <div className="text-right hidden xs:block">
                <p className="text-[10px] sm:text-xs text-slate-400 uppercase">Score</p>
                <p className="text-xl sm:text-2xl font-mono text-green-400 font-bold">{score.toString().padStart(3, '0')}</p>
             </div>

            <button
                onClick={toggleConnection}
                disabled={!isSecureContext}
                className={`flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3 rounded-full font-bold transition-all transform active:scale-95 text-sm sm:text-base ${
                !isSecureContext 
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    : isConnected
                        ? 'bg-red-500 hover:bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-[0_0_15px_rgba(79,70,229,0.5)]'
                }`}
            >
                {isConnected ? (
                <>
                    <MicOff className="w-4 h-4 sm:w-5 sm:h-5" /> <span className="hidden sm:inline">Stop</span>
                </>
                ) : (
                <>
                    <Mic className="w-4 h-4 sm:w-5 sm:h-5" /> <span className="hidden sm:inline">Start</span><span className="inline sm:hidden">Mic</span>
                </>
                )}
            </button>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="relative group w-full max-w-md">
        <div className="flex justify-between items-center sm:hidden mb-2 px-1">
             <span className="text-xs text-slate-400">SCORE: <span className="text-green-400 font-mono text-base">{score}</span></span>
        </div>

        <SnakeGame 
            status={gameStatus} 
            direction={currentDirection} 
            onGameOver={handleGameOver}
            onScoreUpdate={setScore}
        />
        
        {/* Connection Status / Visualizer */}
        <div className={`absolute -bottom-16 left-0 right-0 h-12 flex items-center justify-center transition-opacity duration-500 ${isConnected ? 'opacity-100' : 'opacity-30'}`}>
            <div className="flex items-end justify-center gap-1 h-8">
                {[...Array(5)].map((_, i) => (
                     <div 
                        key={i}
                        className="w-1.5 sm:w-2 bg-indigo-500 rounded-full transition-all duration-75"
                        style={{
                            height: isConnected ? `${Math.max(10, Math.min(100, audioLevel * 500 * (Math.random() + 0.5)))}%` : '20%',
                            opacity: isConnected ? 1 : 0.5
                        }}
                     />
                ))}
            </div>
        </div>
      </main>

      {/* Instructions */}
      <div className="mt-12 sm:mt-16 grid grid-cols-2 gap-2 sm:gap-4 max-w-lg w-full text-slate-400 text-xs sm:text-sm">
        <div className="bg-slate-800 p-3 sm:p-4 rounded-xl border border-slate-700 text-center">
             <p className="font-bold text-slate-200 mb-1">Commands (EN)</p>
             <p>Up, Down, Left, Right</p>
             <p>Start, Stop</p>
        </div>
        <div className="bg-slate-800 p-3 sm:p-4 rounded-xl border border-slate-700 text-center">
             <p className="font-bold text-slate-200 mb-1">Commands (中文)</p>
             <p>上, 下, 左, 右</p>
             <p>开始, 停止</p>
        </div>
      </div>

      <div className="mt-8 text-slate-600 text-[10px] flex items-center gap-1">
         <Smartphone className="w-3 h-3" />
         <span>Install on mobile: Menu &gt; Add to Home Screen</span>
      </div>
      
      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto bg-red-900 text-red-100 px-4 py-3 rounded-lg border border-red-700 shadow-xl max-w-md animate-bounce z-50">
            <p className="font-bold">Connection Error</p>
            <p className="text-sm">{error}</p>
        </div>
      )}

    </div>
  );
};

export default App;