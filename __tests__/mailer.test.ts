import { beforeEach, describe, expect, it, vi } from "vitest";

const { createTransportMock, sendMailMock } = vi.hoisted(() => {
  const sendMail = vi.fn();
  return {
    sendMailMock: sendMail,
    createTransportMock: vi.fn(() => ({ sendMail })),
  };
});

vi.mock("nodemailer", () => ({
  default: { createTransport: createTransportMock },
  createTransport: createTransportMock,
}));

import { escapeHtml, isMailerConfigured, resetMailer, sendMail } from "@/lib/mailer";

describe("mailer", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetMailer();
    createTransportMock.mockClear();
    sendMailMock.mockReset().mockResolvedValue({ messageId: "abc" });
    vi.restoreAllMocks();
  });

  function configure() {
    vi.stubEnv("SMTP_USER", "oca@lsd.ufcg.edu.br");
    vi.stubEnv("SMTP_PASSWORD", "senha-de-app");
    vi.stubEnv("SMTP_FROM", "SAP <oca@lsd.ufcg.edu.br>");
  }

  it("knows it is not configured when the credentials are missing", () => {
    expect(isMailerConfigured()).toBe(false);
  });

  it("sends through the configured account once it has credentials", async () => {
    configure();

    await sendMail({
      to: "fulano@ufcg.edu.br",
      subject: "Confirme seu e-mail",
      html: "<p>Oi</p>",
      text: "Oi",
    });

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "fulano@ufcg.edu.br",
        subject: "Confirme seu e-mail",
        from: "SAP <oca@lsd.ufcg.edu.br>",
      }),
    );
  });

  // Cliente de e-mail que não renderiza HTML precisa da versão em texto, e a
  // ausência dela também piora a pontuação de spam.
  it("always sends the plain text alongside the HTML", async () => {
    configure();

    await sendMail({
      to: "fulano@ufcg.edu.br",
      subject: "Confirme seu e-mail",
      html: "<p>Oi</p>",
      text: "Oi",
    });

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ html: "<p>Oi</p>", text: "Oi" }),
    );
  });

  // Sem credencial o desenvolvimento continua funcionando, mas o corpo carrega
  // o link de confirmação, que é uma credencial — ele não pode vazar para o log
  // por padrão.
  it("falls back to a log that names the message without printing its body", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await sendMail({
      to: "fulano@ufcg.edu.br",
      subject: "Confirme seu e-mail",
      html: "<p>https://sap.example/confirmar?oobCode=SEGREDO</p>",
      text: "https://sap.example/confirmar?oobCode=SEGREDO",
    });

    expect(sendMailMock).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalled();

    const logged = log.mock.calls.flat().join(" ");
    expect(logged).toContain("fulano@ufcg.edu.br");
    expect(logged).toContain("Confirme seu e-mail");
    expect(logged).not.toContain("SEGREDO");
  });

  it("prints the body only when the developer asks for it explicitly", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.stubEnv("MAIL_LOG_BODY", "true");

    await sendMail({
      to: "fulano@ufcg.edu.br",
      subject: "Confirme seu e-mail",
      html: "<p>link</p>",
      text: "https://sap.example/confirmar?oobCode=SEGREDO",
    });

    expect(log.mock.calls.flat().join(" ")).toContain("SEGREDO");
  });

  // A intenção é texto livre escrito por um estranho e termina dentro de um
  // e-mail HTML.
  // Em desenvolvimento, não enviar é o esperado. Em produção é falha grave e
  // silenciosa: o cadastro responde sucesso e ninguém nunca recebe nada.
  it("shouts instead of whispering when production has no credentials", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("NODE_ENV", "production");

    await sendMail({
      to: "fulano@ufcg.edu.br",
      subject: "Confirme seu e-mail",
      html: "<p>Oi</p>",
      text: "Oi",
    });

    expect(error).toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });

  it("reports that nothing was delivered, so callers can react", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    await expect(
      sendMail({
        to: "fulano@ufcg.edu.br",
        subject: "Confirme seu e-mail",
        html: "<p>Oi</p>",
        text: "Oi",
      }),
    ).resolves.toEqual({ delivered: false });
  });

  it("escapes text that came from a stranger", () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });
});
