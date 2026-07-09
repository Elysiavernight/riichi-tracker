import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { loginPlayer, registerPlayer, type Player } from "../api/client";
import { getItem, setItem, deleteItem } from "../lib/storage";

const STORAGE_KEY = "mj-tracker-player";

interface AuthContextValue {
  player: Player | null;
  isLoading: boolean;
  login: (name: string, pin: string) => Promise<void>;
  register: (name: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setPlayer(JSON.parse(raw));
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function persist(nextPlayer: Player) {
    await setItem(STORAGE_KEY, JSON.stringify(nextPlayer));
    setPlayer(nextPlayer);
  }

  async function login(name: string, pin: string) {
    const result = await loginPlayer(name, pin);
    await persist(result);
  }

  async function register(name: string, pin: string) {
    const result = await registerPlayer(name, pin);
    await persist(result);
  }

  async function logout() {
    await deleteItem(STORAGE_KEY);
    setPlayer(null);
  }

  return (
    <AuthContext.Provider
      value={{ player, isLoading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
