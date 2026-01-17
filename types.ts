export enum Direction {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
}

export enum GameStatus {
  IDLE = 'IDLE',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
}

export interface SnakeSegment {
  x: number;
  y: number;
}

export type ControlAction = 'START' | 'STOP' | 'RESTART' | 'PAUSE' | Direction;

export interface AudioVisualizerData {
  volume: number;
}