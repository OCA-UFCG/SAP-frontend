import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserAuth } from "@/components/UserAuth/UserAuth";
import { useAuth } from "@/contexts/AuthContext";

const pushMock = vi.fn();
const usePathnameMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

const useAuthMock = vi.mocked(useAuth);

function mockAuthValue(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  const value: ReturnType<typeof useAuth> = {
    user: null,
    loading: false,
    error: "",
    signIn: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  };

  useAuthMock.mockReturnValue(value);

  return value;
}

describe("UserAuth", () => {
  beforeEach(() => {
    pushMock.mockReset();
    usePathnameMock.mockReset();
    useAuthMock.mockReset();
    usePathnameMock.mockReturnValue("/");
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the disconnected status and login action in the dropdown when there is no authenticated user", () => {
    mockAuthValue();

    render(<UserAuth />);

    fireEvent.click(screen.getByRole("button", { name: /menu do usuário/i }));

    expect(screen.getByText("Status da sessão")).toBeInTheDocument();
    expect(screen.getByText("Desconectado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /entrar/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sair/i })).not.toBeInTheDocument();
  });

  it("redirects to login when the disconnected user clicks Entrar", () => {
    mockAuthValue();

    render(<UserAuth />);

    fireEvent.click(screen.getByRole("button", { name: /menu do usuário/i }));
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

    expect(pushMock).toHaveBeenCalledWith("/login");
  });

  it("shows the email and redirects home after logout from the platform route", async () => {
    const signOutMock = vi.fn().mockResolvedValue(undefined);

    mockAuthValue({
      user: { email: "user@test.com" } as ReturnType<typeof useAuth>["user"],
      signOut: signOutMock,
    });
    usePathnameMock.mockReturnValue("/platform");

    render(<UserAuth />);

    fireEvent.click(screen.getByRole("button", { name: /menu do usuário/i }));

    expect(screen.getByText("Usuário conectado")).toBeInTheDocument();
    expect(screen.getByText("user@test.com")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /sair/i }));

    await waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1));
    expect(pushMock).toHaveBeenCalledWith("/login");
  });

  it("closes the dropdown when the pathname changes", async () => {
    mockAuthValue({
      user: { email: "user@test.com" } as ReturnType<typeof useAuth>["user"],
    });

    const { rerender } = render(<UserAuth />);

    fireEvent.click(screen.getByRole("button", { name: /menu do usuário/i }));

    expect(screen.getByText("user@test.com")).toBeInTheDocument();

    usePathnameMock.mockReturnValue("/sobre-o-sap");
    rerender(<UserAuth />);

    await waitFor(() => {
      expect(screen.queryByText("user@test.com")).not.toBeInTheDocument();
    });
  });
});
