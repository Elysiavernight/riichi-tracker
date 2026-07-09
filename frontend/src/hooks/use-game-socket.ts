import { useEffect, useState, useCallback } from 'react';
import { ApiError } from '../api/client';


const WS_URL = process.env.EXPO_PUBLIC_API_URL!; 

export interface GameState {
  scores: Record<number, number>;
  riichiDeclared: number[];
  honba: number;
  riichiPot: number;
  dealerSeat: number;
  roundWind: string;
  roundNumber: number;
}

export function useGameSocket() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'SYNC_STATE' || payload.type === 'STATE_UPDATE') {
          setGameState(payload.state);
        } else if (payload.type === 'GAME_OVER') {
          setGameState(payload.state);
          // You could trigger a cool game over modal here later!
        }
      } catch (err) {
        console.error("Failed to parse websocket message", err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    setSocket(ws);
    return () => {
      ws.close();
    };
  }, []);


  const sendAction = useCallback((actionPayload: object) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(actionPayload));
    }
  }, [socket]);

  return { gameState, isConnected, sendAction };
}