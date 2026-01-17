import React, { useState, useEffect, useRef } from 'react';
import { SnakeGame } from './components/SnakeGame';
import { GeminiLiveService } from './services/geminiLiveService';
import { ControlAction, Direction, GameStatus } from './types';
import { Mic, MicOff, Volume2 } from 'lucide-react';

const App: React.FC = () => {
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.IDLE);
  const [currentDirection, setCurrentDirection] = useState<Direction>(Direction.RIGHT);
  const [score, setScore] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const liveServiceRef = useRef<GeminiLiveService | null>(null);

  // Initialize Service (not connected yet)
  useEffect(() => {
    liveServiceRef.current = new GeminiLiveService({
      onControlAction: (action) => {
        handleControlAction(action);
      },
      onStatusChange: (connected) => {
        setIsConnected(connected);
        if (!connected) setAudioLevel(0);
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

    return () => {
      liveServiceRef.current?.stop();
    };
  }, []);

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

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <header className="w-full max-w-2xl flex justify-between items-center mb-8 bg-slate-800 p-4 rounded-2xl shadow-lg border border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center shadow-inner">
            <Volume2 className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white font-arcade">GEMINI SNAKE</h1>
            <p className="text-xs text-slate-400">Powered by Gemini Live API</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
             <div className="text-right hidden sm:block">
                <p className="text-xs text-slate-400 uppercase">Score</p>
                <p className="text-2xl font-mono text-green-400 font-bold">{score.toString().padStart(3, '0')}</p>
             </div>

            <button
                onClick={toggleConnection}
                className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all transform active:scale-95 ${
                isConnected
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-[0_0_15px_rgba(79,70,229,0.5)]'
                }`}
            >
                {isConnected ? (
                <>
                    <MicOff className="w-5 h-5" /> Stop
                </>
                ) : (
                <>
                    <Mic className="w-5 h-5" /> Start Voice
                </>
                )}
            </button>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="relative group">
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
                        className="w-2 bg-indigo-500 rounded-full transition-all duration-75"
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
      <div className="mt-16 grid grid-cols-2 gap-4 max-w-lg w-full text-slate-400 text-sm">
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
             <p className="font-bold text-slate-200 mb-1">Commands (English)</p>
             <p>Up, Down, Left, Right</p>
             <p>Start, Stop, Restart</p>
        </div>
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
             <p className="font-bold text-slate-200 mb-1">Commands (中文)</p>
             <p>上, 下, 左, 右</p>
             <p>开始, 停止</p>
        </div>
      </div>
      
      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-900 text-red-100 px-4 py-3 rounded-lg border border-red-700 shadow-xl max-w-md animate-bounce">
            <p className="font-bold">Connection Error</p>
            <p className="text-sm">{error}</p>
        </div>
      )}

    </div>
  );
};

export default App;