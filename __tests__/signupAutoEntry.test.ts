import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  announceSignupConfirmed,
  announceSignupEntered,
  onSignupEntered,
  watchSignupConfirmation,
} from "@/lib/signup-auto-entry";

/** BroadcastChannel em memória: entrega na hora para os outros canais de mesmo nome. */
class FakeChannel {
  static open = new Set<FakeChannel>();
  private listeners = new Set<(event: MessageEvent) => void>();

  constructor(readonly name: string) {
    FakeChannel.open.add(this);
  }

  addEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listeners.add(listener);
  }

  postMessage(data: unknown) {
    for (const channel of FakeChannel.open) {
      if (channel !== this && channel.name === this.name) {
        channel.listeners.forEach((listener) =>
          listener({ data } as MessageEvent),
        );
      }
    }
  }

  close() {
    FakeChannel.open.delete(this);
  }
}

type Reply = { status: number; body: unknown };

function mockAccountsApi({
  signIn = [{ status: 200, body: { idToken: "token-1" } }],
  lookup,
}: {
  signIn?: Reply[];
  lookup: Reply[];
}) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (url: string) => {
    const method = url.includes("signInWithPassword") ? "signIn" : "lookup";
    calls.push(method);
    const queue = method === "signIn" ? signIn : lookup;
    const reply = queue.length > 1 ? queue.shift()! : queue[0];
    return new Response(JSON.stringify(reply.body), { status: reply.status });
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

const verified = (value: boolean): Reply => ({
  status: 200,
  body: { users: [{ emailVerified: value }] },
});

describe("signup auto entry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("BroadcastChannel", FakeChannel);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    FakeChannel.open.clear();
  });

  it("signs in once, waits, and enters as soon as the e-mail is confirmed", async () => {
    const calls = mockAccountsApi({
      lookup: [verified(false), verified(false), verified(true)],
    });
    const onConfirmed = vi.fn();

    watchSignupConfirmation({
      email: "fulano@gmail.com",
      password: "segredo-123",
      onConfirmed,
      intervalMs: 5_000,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(onConfirmed).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(onConfirmed).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(["signIn", "lookup", "lookup", "lookup"]);

    // Depois de entrar, para de perguntar.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(calls).toHaveLength(4);
  });

  // Cadastro de um e-mail que já tinha conta com outra senha: o servidor
  // responde igual (anti-oráculo), mas aqui a senha não entra. Nada a esperar.
  it("stops quietly when Firebase refuses the password", async () => {
    const calls = mockAccountsApi({
      signIn: [
        { status: 400, body: { error: { message: "INVALID_LOGIN_CREDENTIALS" } } },
      ],
      lookup: [verified(true)],
    });
    const onConfirmed = vi.fn();

    watchSignupConfirmation({
      email: "fulano@gmail.com",
      password: "outra-senha",
      onConfirmed,
    });

    await vi.advanceTimersByTimeAsync(60_000);

    expect(onConfirmed).not.toHaveBeenCalled();
    expect(calls).toEqual(["signIn"]);
  });

  // A liberação revoga os tokens da conta, então o token guardado para de
  // servir justamente quando o e-mail é confirmado.
  it("signs in again right away when the saved token stops working", async () => {
    const calls = mockAccountsApi({
      signIn: [
        { status: 200, body: { idToken: "token-1" } },
        { status: 200, body: { idToken: "token-2" } },
      ],
      lookup: [
        verified(false),
        { status: 400, body: { error: { message: "TOKEN_EXPIRED" } } },
        verified(true),
      ],
    });
    const onConfirmed = vi.fn();

    watchSignupConfirmation({
      email: "fulano@gmail.com",
      password: "segredo-123",
      onConfirmed,
      intervalMs: 5_000,
    });

    await vi.advanceTimersByTimeAsync(5_000);

    expect(onConfirmed).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(["signIn", "lookup", "lookup", "signIn", "lookup"]);
  });

  it("gives up after the maximum wait and stops asking", async () => {
    const calls = mockAccountsApi({ lookup: [verified(false)] });
    const onConfirmed = vi.fn();
    const onExpire = vi.fn();

    watchSignupConfirmation({
      email: "fulano@gmail.com",
      password: "segredo-123",
      onConfirmed,
      onExpire,
      intervalMs: 5_000,
      maxMs: 15_000,
    });

    await vi.advanceTimersByTimeAsync(15_000);
    expect(onExpire).toHaveBeenCalledTimes(1);

    const callsAtExpiry = calls.length;
    await vi.advanceTimersByTimeAsync(60_000);

    expect(calls).toHaveLength(callsAtExpiry);
    expect(onConfirmed).not.toHaveBeenCalled();
  });

  it("checks right away when the confirmation page in this browser announces", async () => {
    mockAccountsApi({ lookup: [verified(false), verified(true)] });
    const onConfirmed = vi.fn();

    watchSignupConfirmation({
      email: "fulano@gmail.com",
      password: "segredo-123",
      onConfirmed,
      intervalMs: 60_000,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(onConfirmed).not.toHaveBeenCalled();

    announceSignupConfirmed();
    await vi.advanceTimersByTimeAsync(0);

    expect(onConfirmed).toHaveBeenCalledTimes(1);
  });

  it("stops when the caller stops it", async () => {
    const calls = mockAccountsApi({ lookup: [verified(false)] });

    const stop = watchSignupConfirmation({
      email: "fulano@gmail.com",
      password: "segredo-123",
      onConfirmed: vi.fn(),
      intervalMs: 5_000,
    });

    await vi.advanceTimersByTimeAsync(0);
    stop();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(calls).toEqual(["signIn", "lookup"]);
  });

  it("lets the confirmation page follow the signup tab once it entered", () => {
    const callback = vi.fn();
    const stopListening = onSignupEntered(callback);

    announceSignupEntered();
    expect(callback).toHaveBeenCalledTimes(1);

    stopListening();
    announceSignupEntered();
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
