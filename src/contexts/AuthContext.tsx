"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

class SessionCreationError extends Error {
  constructor() {
    super("Erro ao criar sessão");
    this.name = "SessionCreationError";
  }
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error?: string;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setError("");
    let authenticatedUser: User | null = null;

    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      authenticatedUser = user;

      const token = await user.getIdToken();

      const sessionResponse = await fetch("/api/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      if (!sessionResponse.ok) {
        throw new SessionCreationError();
      }

      setUser(user);
      return true;
    } catch (err: unknown) {
      if (authenticatedUser) {
        await fetch("/api/session", { method: "DELETE" }).catch(
          () => undefined,
        );
        await firebaseSignOut(auth).catch(() => undefined);
        setUser(null);
      }

      const fbErr = err as { code?: string; message?: string };
      const messages: Record<string, string> = {
        "auth/too-many-requests":
          "Muitas tentativas. Tente novamente mais tarde",
      };

      setError(
        err instanceof SessionCreationError
          ? "Login validado, mas não foi possível criar a sessão da plataforma."
          : fbErr.code
          ? messages[fbErr.code] || "Login ou senha inválidos"
          : "Erro ao fazer login",
      );
      return false;
    }
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/session", { method: "DELETE" }).catch(() => undefined);
    await firebaseSignOut(auth);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
