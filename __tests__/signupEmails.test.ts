import { describe, expect, it } from "vitest";

import {
  buildAccessDecisionEmail,
  buildNewRequestEmail,
  buildVerificationEmail,
} from "@/lib/signup-emails";

const LINK = "https://sap.example/cadastro/confirmacao?oobCode=abc123";

describe("signup emails", () => {
  // O site tem três idiomas; os e-mails saíam só em português. Quem se
  // cadastrava em inglês recebia a confirmação numa língua que talvez não leia.
  describe("idioma de quem se cadastrou", () => {
    it("writes the verification email in the language of the signup", () => {
      expect(buildVerificationEmail({ link: LINK, locale: "en" }).subject).toBe(
        "Confirm your email address — SAP",
      );
      expect(buildVerificationEmail({ link: LINK, locale: "es" }).subject).toBe(
        "Confirma tu dirección de correo — SAP",
      );
    });

    it("writes the decision email in that same language", () => {
      expect(
        buildAccessDecisionEmail({
          status: "approved",
          loginUrl: "https://sap.example/login",
          locale: "en",
        }).html,
      ).toContain("Access granted");
    });

    // Um idioma desconhecido não pode virar e-mail vazio nem quebrar o envio.
    it("falls back to Portuguese for a language it does not have", () => {
      expect(
        buildVerificationEmail({ link: LINK, locale: "fr" }).subject,
      ).toBe("Confirme seu endereço de e-mail — SAP");
    });
  });

  describe("confirme seu endereço", () => {
    const email = buildVerificationEmail({ link: LINK, locale: "pt" });

    it("carries the link as a button and spelled out under it", () => {
      expect(email.html).toContain(`href="${LINK}"`);
      // Cliente que não renderiza o botão, ou pessoa que desconfia dele, precisa
      // conseguir ler e copiar a URL.
      expect(email.html.replace(`href="${LINK}"`, "")).toContain(LINK);
      expect(email.text).toContain(LINK);
    });

    it("has a plain text version that stands on its own", () => {
      expect(email.text.length).toBeGreaterThan(0);
      expect(email.text).not.toContain("<");
    });

    // Imagem bloqueada por padrão em muita caixa de entrada; se o e-mail
    // depender dela, a pessoa vê uma mensagem quebrada.
    it("does not depend on any image", () => {
      expect(email.html).not.toContain("<img");
    });

    it("styles inline, because e-mail clients drop stylesheets", () => {
      expect(email.html).not.toContain("<style");
      expect(email.html).toContain("style=");
    });
  });

  describe("novo pedido de acesso", () => {
    it("carries who asked and what they wrote", () => {
      const email = buildNewRequestEmail({
        email: "fulano@gmail.com",
        intention: "Pesquisa sobre seca no semiárido",
        approvalUrl: "https://sap.example/platform/aprovacoes",
      });

      expect(email.html).toContain("fulano@gmail.com");
      expect(email.html).toContain("Pesquisa sobre seca no semiárido");
      expect(email.text).toContain("fulano@gmail.com");
    });

    // A intenção é texto livre escrito por um estranho e termina dentro de um
    // e-mail HTML.
    it("treats the intention as text, never as markup", () => {
      const email = buildNewRequestEmail({
        email: "fulano@gmail.com",
        intention: '<img src=x onerror="alert(1)">',
        approvalUrl: "https://sap.example/platform/aprovacoes",
      });

      expect(email.html).not.toContain("<img");
      expect(email.html).toContain("&lt;img");
    });

    it("escapes the sender address too", () => {
      const email = buildNewRequestEmail({
        email: '<b>fulano</b>@gmail.com',
        intention: "Pesquisa",
        approvalUrl: "https://sap.example/platform/aprovacoes",
      });

      expect(email.html).not.toContain("<b>fulano</b>");
    });
  });

  describe("sua decisão saiu", () => {
    it("tells an approved person how to get in", () => {
      const email = buildAccessDecisionEmail({
        status: "approved",
        loginUrl: "https://sap.example/login",
      });

      expect(email.html).toContain("https://sap.example/login");
      expect(email.text).toContain("https://sap.example/login");
    });

    it("tells a refused person without pointing at a login they cannot use", () => {
      const email = buildAccessDecisionEmail({
        status: "rejected",
        loginUrl: "https://sap.example/login",
      });

      expect(email.subject.length).toBeGreaterThan(0);
      expect(email.html).not.toContain("https://sap.example/login");
    });
  });
});
