import { useEffect, useState, useCallback } from 'react';
import { ApiError } from '../api/client';

const WS_URL = process.env.EXPO_PUBLIC_API_URL!; 

export interface GameState {
  currentScores: Record<number, number>;
  riichiDeclared: number[];
  honba: number;
  riichiPot: number;
  dealerSeat: number;
  roundWind: string;
  roundNumber: number;
  seatPlayers : Record<number,number>;
  pendingRonClaims?: Record<number, any[]>;
}


export function useGameSocket(roomId: number | null) { 
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    
    if (!roomId || Number.isNaN(roomId)) return;

    const cleanUrl = WS_URL.replace(/\/$/, ''); 
    
    let baseWsUrl = cleanUrl;
    if (cleanUrl.startsWith("https")) {
      baseWsUrl = cleanUrl.replace(/^https/, "wss");
    } else if (cleanUrl.startsWith("http")) {
      baseWsUrl = cleanUrl.replace(/^http/, "ws");
    }
    
  
    const url = `${baseWsUrl}/ws?roomId=${roomId}`; 
    
    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log("📸 Connected to Mahjong Server!");
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        console.log("Server says:", payload); 
        
        if (payload.type === 'SYNC_STATE' || payload.type === 'STATE_UPDATE') {
          setGameState(payload.state);
        } else if (payload.type === 'GAME_OVER') {
          setGameState(payload.state);
        }
      } catch (err) {
        console.error("Failed to parse websocket message", err);
      }
    };

    ws.onclose = () => {
      console.log("Disconnected from server.");
      setIsConnected(false);
    };

    setSocket(ws);
    return () => {
      ws.close();
    };
  }, [roomId]); 

  const sendAction = useCallback((actionPayload: object) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(actionPayload));
    }
  }, [socket]);

  return { gameState, isConnected, sendAction };
}