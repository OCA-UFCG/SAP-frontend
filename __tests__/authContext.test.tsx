import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";

vi.mock("@/lib/firebase", () => ({
  auth: {},
}));

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn((_auth, callback) => {
    callback(null);
    return vi.fn();
  }),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

const signInWithEmailAndPasswordMock = vi.mocked(signInWithEmailAndPassword);
const signOutMock = vi.mocked(signOut);

function AuthProbe() {
  const { error, loading, signIn, user } = useAuth();

  if (loading) return <span>Carregando</span>;

  return (
    <>
      <button type="button" onClick={() => void signIn("user@test", "secret")}>
        Entrar
      </button>
      <span data-testid="auth-state">{user ? "authenticated" : "anonymous"}</span>
      <span role="alert">{error}</span>
    </>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    signInWithEmailAndPasswordMock.mockReset();
    signOutMock.mockReset();
    signOutMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("does not create an HTTP session when Firebase rejects the credentials", async () => {
    signInWithEmailAndPasswordMock.mockRejectedValue({
      code: "auth/invalid-credential",
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText("Entrar")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Entrar"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Login ou senha inválidos",
      );
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("signs out from Firebase when the HTTP session cannot be created", async () => {
    const getIdToken = vi.fn().mockResolvedValue("firebase-id-token");
    signInWithEmailAndPasswordMock.mockResolvedValue({
      user: { getIdToken },
    } as Awaited<ReturnType<typeof signInWithEmailAndPassword>>);
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Unauthorized access." }), {
        status: 401,
      }),
    );
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText("Entrar")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Entrar"));

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledWith(auth);
    });

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "/api/session",
      expect.objectContaining({
        body: JSON.stringify({ token: "firebase-id-token" }),
        method: "POST",
      }),
    );
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/session", {
      method: "DELETE",
    });
    expect(screen.getByTestId("auth-state")).toHaveTextContent("anonymous");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Login validado, mas não foi possível criar a sessão da plataforma.",
    );
  });
});
