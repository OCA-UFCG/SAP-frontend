import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyCaptcha } from "@/lib/captcha";

const SECRET = "segredo-de-producao";

function siteverifyAnswers(body: object) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
}

describe("verifyCaptcha", () => {
  beforeEach(() => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", SECRET);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("accepts a token Cloudflare validated for the same action", async () => {
    siteverifyAnswers({ success: true, action: "signup", "error-codes": [] });

    await expect(
      verifyCaptcha("token-bom", {
        action: "signup",
        remoteIp: "203.0.113.10",
      }),
    ).resolves.toBe(true);
  });

  it("sends the secret, the token and the visitor address to Cloudflare", async () => {
    const fetchMock = siteverifyAnswers({ success: true, action: "signup" });

    await verifyCaptcha("token-bom", {
      action: "signup",
      remoteIp: "203.0.113.10",
    });

    const [url, init] = fetchMock.mock.calls[0];
    const sent = new URLSearchParams(String(init?.body));

    expect(url).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    );
    expect(sent.get("secret")).toBe(SECRET);
    expect(sent.get("response")).toBe("token-bom");
    expect(sent.get("remoteip")).toBe("203.0.113.10");
  });

  it("refuses a token Cloudflare rejected", async () => {
    siteverifyAnswers({
      success: false,
      "error-codes": ["invalid-input-response"],
    });

    await expect(
      verifyCaptcha("token-ruim", { action: "signup" }),
    ).resolves.toBe(false);
  });

  // Sem conferir a action, um token resolvido na tela de reenviar serviria
  // para criar conta.
  it("refuses a token solved for another screen", async () => {
    siteverifyAnswers({ success: true, action: "resend" });

    await expect(
      verifyCaptcha("token-bom", { action: "signup" }),
    ).resolves.toBe(false);
  });

  // Com Cloudflare fora do ar, deixar passar abriria a porta justamente quando
  // ninguém está olhando. Quem é gente tenta de novo.
  it("fails closed when Cloudflare cannot be reached", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("rede fora"));

    await expect(
      verifyCaptcha("token-bom", { action: "signup" }),
    ).resolves.toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  it("fails closed when Cloudflare answers something that is not JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html>erro</html>", { status: 502 }),
    );

    await expect(
      verifyCaptcha("token-bom", { action: "signup" }),
    ).resolves.toBe(false);
  });

  it("fails closed, without asking Cloudflare, when the secret is missing", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(
      verifyCaptcha("token-bom", { action: "signup" }),
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it("refuses an empty token without asking Cloudflare", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(verifyCaptcha("", { action: "signup" })).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe("chaves de teste da Cloudflare", () => {
    // A chave de teste não devolve action nenhuma. Exigir a action quebraria o
    // desenvolvimento local, que é para onde essa chave existe.
    it("accepts them outside production", async () => {
      vi.stubEnv("NODE_ENV", "development");
      siteverifyAnswers({
        success: true,
        metadata: { result_with_testing_key: true },
      });

      await expect(
        verifyCaptcha("XXXX.DUMMY.TOKEN.XXXX", { action: "signup" }),
      ).resolves.toBe(true);
    });

    // A chave de teste aprova qualquer coisa. Em produção, ela é o captcha
    // desligado sem ninguém saber.
    it("refuses them in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      siteverifyAnswers({
        success: true,
        metadata: { result_with_testing_key: true },
      });

      await expect(
        verifyCaptcha("XXXX.DUMMY.TOKEN.XXXX", { action: "signup" }),
      ).resolves.toBe(false);
      expect(console.error).toHaveBeenCalled();
    });
  });
});
