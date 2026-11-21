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

/**
 * Credenciais certas, acesso ainda não liberado. É um desfecho próprio: não é
 * falha de login nem de infraestrutura, e leva a pessoa à página de espera em
 * vez de repetir o formulário.
 */
class AccessPendingError extends Error {
  constructor(readonly revoked = false) {
    super(revoked ? "Acesso removido" : "Cadastro ainda não liberado");
    this.name = "AccessPendingError";
  }
}

export type SignInOutcome = "ok" | "pending" | "revoked" | "failed";

/** Por que o login falhou; a tela de login traduz (`Login.errors.<código>`). */
export type SignInError =
  | "tooManyRequests"
  | "sessionFailed"
  | "invalidCredentials"
  | "failed";

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  error?: SignInError | "";
  signIn: (email: string, password: string) => Promise<SignInOutcome>;
  signOut: () => Promise<void>;
}

/**
 * Exportado só para stories e testes darem uma sessão falsa: o AuthProvider
 * de verdade precisa do Firebase configurado.
 *
 * @example
 * <AuthContext.Provider value={signedOutSession}>{children}</AuthContext.Provider>
 */
export const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Troca o token do Firebase pelo cookie de sessão. Devolve `null` quando o
 * cookie foi criado, ou o código da recusa (`""` quando a resposta não trouxe
 * um).
 */
async function openSession(user: User): Promise<string | null> {
  const token = await user.getIdToken();

  const sessionResponse = await fetch("/api/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
  });

  if (sessionResponse.ok) return null;

  const body = (await sessionResponse.json().catch(() => null)) as {
    code?: string;
  } | null;

  return body?.code ?? "";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<SignInError | "">("");

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
      let { user } = await signInWithEmailAndPassword(auth, email, password);
      authenticatedUser = user;

      let sessionError = await openSession(user);

      // Este login acabou de liberar o cadastro (quem confirmou o e-mail fora da
      // nossa página). O token usado é de antes da liberação, então entra de
      // novo, uma vez, para pegar um que já tem a marca de acesso.
      if (sessionError === "access_granted") {
        ({ user } = await signInWithEmailAndPassword(auth, email, password));
        authenticatedUser = user;
        sessionError = await openSession(user);
      }

      if (sessionError !== null) {
        throw sessionError === "access_pending"
          ? new AccessPendingError()
          : sessionError === "access_revoked"
          ? new AccessPendingError(true)
          : new SessionCreationError();
      }

      setUser(user);
      return "ok";
    } catch (err: unknown) {
      if (authenticatedUser) {
        await fetch("/api/session", { method: "DELETE" }).catch(
          () => undefined,
        );
        await firebaseSignOut(auth).catch(() => undefined);
        setUser(null);
      }

      // A espera não é erro: quem cuida dela é a página de espera, e uma
      // mensagem vermelha no login só confundiria.
      if (err instanceof AccessPendingError) {
        return err.revoked ? "revoked" : "pending";
      }

      const fbErr = err as { code?: string; message?: string };

      setError(
        err instanceof SessionCreationError
          ? "sessionFailed"
          : fbErr.code === "auth/too-many-requests"
          ? "tooManyRequests"
          : fbErr.code
          ? "invalidCredentials"
          : "failed",
      );
      return "failed";
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
