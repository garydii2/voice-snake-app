import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Direction, GameStatus, SnakeSegment } from '../types';

interface SnakeGameProps {
  status: GameStatus;
  direction: Direction;
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
}

const GRID_SIZE = 20;
const TICK_RATE = 150; // ms per frame

export const SnakeGame: React.FC<SnakeGameProps> = ({ status, direction, onGameOver, onScoreUpdate }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snake, setSnake] = useState<SnakeSegment[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<SnakeSegment>({ x: 15, y: 15 });
  const [currentDir, setCurrentDir] = useState<Direction>(Direction.RIGHT);
  
  // Keep track of the *requested* direction from props, but apply it on tick to avoid 180 turns
  const requestedDirRef = useRef<Direction>(Direction.RIGHT);

  // Sync props to ref
  useEffect(() => {
    // Prevent 180 degree turns
    const isOpposite = 
      (direction === Direction.UP && currentDir === Direction.DOWN) ||
      (direction === Direction.DOWN && currentDir === Direction.UP) ||
      (direction === Direction.LEFT && currentDir === Direction.RIGHT) ||
      (direction === Direction.RIGHT && currentDir === Direction.LEFT);

    if (!isOpposite) {
      requestedDirRef.current = direction;
    }
  }, [direction, currentDir]);

  const generateFood = useCallback((currentSnake: SnakeSegment[]) => {
    let newFood: SnakeSegment;
    let isColliding;
    do {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      // eslint-disable-next-line no-loop-func
      isColliding = currentSnake.some(seg => seg.x === newFood.x && seg.y === newFood.y);
    } while (isColliding);
    return newFood;
  }, []);

  // Reset game when status changes to PLAYING from IDLE/GAMEOVER
  useEffect(() => {
    if (status === GameStatus.IDLE) {
      setSnake([{ x: 10, y: 10 }]);
      setFood({ x: 15, y: 15 });
      setCurrentDir(Direction.RIGHT);
      requestedDirRef.current = Direction.RIGHT;
      onScoreUpdate(0);
    }
  }, [status, onScoreUpdate, generateFood]);

  // Game Loop
  useEffect(() => {
    if (status !== GameStatus.PLAYING) return;

    const tick = setInterval(() => {
      setSnake(prevSnake => {
        const head = { ...prevSnake[0] };
        const moveDir = requestedDirRef.current;
        setCurrentDir(moveDir); // Commit the direction

        switch (moveDir) {
          case Direction.UP: head.y -= 1; break;
          case Direction.DOWN: head.y += 1; break;
          case Direction.LEFT: head.x -= 1; break;
          case Direction.RIGHT: head.x += 1; break;
        }

        // Wall Collision
        if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
          onGameOver(prevSnake.length - 1);
          return prevSnake;
        }

        // Self Collision
        if (prevSnake.some(seg => seg.x === head.x && seg.y === head.y)) {
          onGameOver(prevSnake.length - 1);
          return prevSnake;
        }

        const newSnake = [head, ...prevSnake];

        // Food Collision
        if (head.x === food.x && head.y === food.y) {
          setFood(generateFood(newSnake));
          onScoreUpdate(newSnake.length - 1);
        } else {
          newSnake.pop(); // Remove tail
        }

        return newSnake;
      });
    }, TICK_RATE);

    return () => clearInterval(tick);
  }, [status, food, generateFood, onGameOver, onScoreUpdate]);

  // Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cellSize = width / GRID_SIZE;

    // Clear
    ctx.fillStyle = '#1e293b'; // slate-800
    ctx.fillRect(0, 0, width, height);

    // Draw Grid (Optional, subtle)
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, height);
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(width, i * cellSize);
    }
    ctx.stroke();

    // Draw Food
    ctx.fillStyle = '#ef4444'; // red-500
    ctx.beginPath();
    const foodRadius = cellSize / 2 - 2;
    ctx.arc(
      food.x * cellSize + cellSize / 2,
      food.y * cellSize + cellSize / 2,
      foodRadius,
      0,
      Math.PI * 2
    );
    ctx.fill();
    // Shine on food
    ctx.fillStyle = '#fca5a5';
    ctx.beginPath();
    ctx.arc(
      food.x * cellSize + cellSize / 2 - 2,
      food.y * cellSize + cellSize / 2 - 2,
      2,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Draw Snake
    snake.forEach((seg, index) => {
      // Head
      if (index === 0) {
        ctx.fillStyle = '#22c55e'; // green-500
      } else {
        // Gradient for body
        ctx.fillStyle = index % 2 === 0 ? '#4ade80' : '#86efac';
      }
      
      const padding = 1;
      ctx.fillRect(
        seg.x * cellSize + padding,
        seg.y * cellSize + padding,
        cellSize - padding * 2,
        cellSize - padding * 2
      );

      // Eyes for head
      if (index === 0) {
        ctx.fillStyle = 'black';
        const eyeSize = 3;
        let lx = 0, ly = 0, rx = 0, ry = 0;
        
        // Position eyes based on direction
        if (currentDir === Direction.UP) {
           lx = 4; ly = 4; rx = 12; ry = 4;
        } else if (currentDir === Direction.DOWN) {
           lx = 4; ly = 12; rx = 12; ry = 12;
        } else if (currentDir === Direction.LEFT) {
           lx = 4; ly = 4; rx = 4; ry = 12;
        } else { // RIGHT
           lx = 12; ly = 4; rx = 12; ry = 12;
        }

        ctx.fillRect(seg.x * cellSize + lx, seg.y * cellSize + ly, eyeSize, eyeSize);
        ctx.fillRect(seg.x * cellSize + rx, seg.y * cellSize + ry, eyeSize, eyeSize);
      }
    });

  }, [snake, food, currentDir]);

  return (
    <div className="relative rounded-xl overflow-hidden shadow-2xl border-4 border-slate-700">
        <canvas 
            ref={canvasRef} 
            width={400} 
            height={400}
            className="block max-w-full"
        />
        {status === GameStatus.GAME_OVER && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center flex-col animate-fade-in">
                <h2 className="text-4xl font-arcade text-red-500 mb-4">GAME OVER</h2>
                <p className="text-white text-lg mb-8">Say "Start" to play again</p>
            </div>
        )}
        {status === GameStatus.IDLE && (
             <div className="absolute inset-0 bg-black/60 flex items-center justify-center flex-col backdrop-blur-sm">
             <h2 className="text-3xl font-arcade text-green-400 mb-4 text-center px-4">VOICE SNAKE</h2>
             <p className="text-white text-md bg-slate-800 px-4 py-2 rounded-full border border-slate-600">
               Connect Mic & Say "Start"
             </p>
         </div>
        )}
    </div>
  );
};