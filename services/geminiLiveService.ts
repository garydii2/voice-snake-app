import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { createPcmBlob, base64ToUint8Array, decodeAudioData } from './audioUtils';
import { ControlAction, Direction } from '../types';

interface LiveServiceConfig {
  onControlAction: (action: ControlAction) => void;
  onStatusChange: (isConnected: boolean) => void;
  onError: (error: string) => void;
  onAudioData?: (volume: number) => void;
}

// Define the tool for controlling the snake
const controlSnakeTool: FunctionDeclaration = {
  name: 'controlSnake',
  description: 'Control the movement and state of the snake game based on voice commands.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        description: 'The specific action to take: UP, DOWN, LEFT, RIGHT, START, STOP, RESTART, PAUSE.',
        enum: ['UP', 'DOWN', 'LEFT', 'RIGHT', 'START', 'STOP', 'RESTART', 'PAUSE']
      },
    },
    required: ['action'],
  },
};

export class GeminiLiveService {
  private ai: GoogleGenAI;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private config: LiveServiceConfig;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private session: any = null; // Holds the active session

  constructor(config: LiveServiceConfig) {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    this.config = config;
  }

  public async connect() {
    try {
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: {
        channelCount: 1,
        sampleRate: 16000,
      } });

      const sessionPromise = this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `You are an enthusiastic retro game announcer and controller for a Snake game. 
          Your main job is to listen for short commands like 'Up', 'Down', 'Left', 'Right', 'Start', 'Stop', 'Restart'.
          You also support Chinese commands: '上', '下', '左', '右', '开始', '停止'.
          When you hear a command, IMMEDIATELY call the 'controlSnake' tool. 
          Keep your spoken responses very short, energetic, and encouraging (e.g., "Turning left!", "Go!", "Oops!").`,
          tools: [{ functionDeclarations: [controlSnakeTool] }],
        },
        callbacks: {
          onopen: () => {
            console.log('Gemini Live Connected');
            this.config.onStatusChange(true);
            this.startAudioStreaming(sessionPromise);
          },
          onmessage: async (message: LiveServerMessage) => {
            await this.handleMessage(message, sessionPromise);
          },
          onclose: () => {
            console.log('Gemini Live Closed');
            this.config.onStatusChange(false);
            this.stop();
          },
          onerror: (err) => {
            console.error('Gemini Live Error', err);
            this.config.onError(err.message || 'Unknown error');
            this.stop();
          }
        }
      });
      
      this.session = sessionPromise;

    } catch (error: any) {
      this.config.onError(error.message);
      this.stop();
    }
  }

  private startAudioStreaming(sessionPromise: Promise<any>) {
    if (!this.inputAudioContext || !this.mediaStream) return;

    const source = this.inputAudioContext.createMediaStreamSource(this.mediaStream);
    const processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Simple volume calculation for visualization
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      if (this.config.onAudioData) {
        this.config.onAudioData(rms);
      }

      const blob = createPcmBlob(inputData);
      sessionPromise.then(session => {
        session.sendRealtimeInput({ media: blob });
      });
    };

    source.connect(processor);
    processor.connect(this.inputAudioContext.destination);
  }

  private async handleMessage(message: LiveServerMessage, sessionPromise: Promise<any>) {
    // Handle Tool Calls (Game Control)
    if (message.toolCall) {
      for (const call of message.toolCall.functionCalls) {
        if (call.name === 'controlSnake') {
          const action = (call.args as any).action as ControlAction;
          console.log(`[ToolCall] Action: ${action}`);
          
          // Execute app logic
          this.config.onControlAction(action);

          // Respond to model
          sessionPromise.then(session => {
            session.sendToolResponse({
              functionResponses: {
                id: call.id,
                name: call.name,
                response: { result: 'OK' }
              }
            });
          });
        }
      }
    }

    // Handle Audio Output (Model Voice)
    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (base64Audio && this.outputAudioContext) {
      try {
        const audioData = base64ToUint8Array(base64Audio);
        this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
        
        const audioBuffer = await decodeAudioData(
            audioData, 
            this.outputAudioContext, 
            24000, 
            1
        );
        
        const source = this.outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.outputAudioContext.destination);
        source.start(this.nextStartTime);
        this.nextStartTime += audioBuffer.duration;
        
        this.sources.add(source);
        source.onended = () => this.sources.delete(source);
      } catch (e) {
        console.error("Error decoding audio response", e);
      }
    }
  }

  public stop() {
    this.config.onStatusChange(false);
    
    // Stop tracks
    this.mediaStream?.getTracks().forEach(track => track.stop());
    
    // Stop Audio Contexts
    this.inputAudioContext?.close();
    this.outputAudioContext?.close();

    // Reset state
    this.inputAudioContext = null;
    this.outputAudioContext = null;
    this.mediaStream = null;
    this.session = null;
  }
}