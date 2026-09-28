#!/usr/bin/env node
/**
 * Prova que a conta de envio funciona.
 *
 * É o primeiro passo do plano de arquitetura: gerar a senha de aplicativo e
 * mandar um e-mail de teste — "se chegar, a parte desconhecida do projeto
 * acabou". Os testes automatizados usam um dublê do nodemailer: eles provam a
 * nossa lógica, nunca que a credencial funciona contra o servidor do Google.
 *
 *   node scripts/send-test-email.mjs meu.email@ufcg.edu.br
 *
 * Lê SMTP_USER, SMTP_PASSWORD e SMTP_FROM do ambiente.
 */

import nodemailer from "nodemailer";

const SMTP_HOST = "smtp.gmail.com";
const SMTP_PORT = 465;

async function main() {
  const to = process.argv[2];

  if (!to) {
    console.error(
      "Informe o destinatário:\n  node scripts/send-test-email.mjs meu.email@ufcg.edu.br",
    );
    process.exit(1);
  }

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!user || !pass) {
    console.error(
      "SMTP_USER e SMTP_PASSWORD precisam estar no ambiente. A senha é uma senha de aplicativo do Google, não a senha da conta.",
    );
    process.exit(1);
  }

  // O Gmail só aceita como remetente a própria conta autenticada ou um alias
  // verificado nela. Um SMTP_FROM diferente disso faz o envio falhar ou perder
  // o alinhamento de DKIM — e aí a reputação do domínio, que é o motivo de
  // termos escolhido este caminho, deixa de valer.
  const from = process.env.SMTP_FROM || user;

  console.log(`Conectando em ${SMTP_HOST}:${SMTP_PORT} como ${user}...`);

  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: true,
    auth: { user, pass },
  });

  try {
    await transport.verify();
    console.log("Credencial aceita pelo servidor.");
  } catch (error) {
    console.error("\nO servidor recusou a credencial.");
    console.error(error instanceof Error ? error.message : error);
    console.error(
      "\nCausas comuns: a senha de aplicativo não foi gerada, a verificação em duas etapas está desligada na conta, ou o domínio bloqueia senhas de aplicativo por política.",
    );
    process.exit(1);
  }

  const sentAt = new Date().toISOString();

  await transport.sendMail({
    from,
    to,
    subject: "Teste de envio — SAP",
    text: [
      "Se você está lendo isto, a conta de envio do SAP funciona.",
      "",
      `Remetente: ${from}`,
      `Enviado em: ${sentAt}`,
    ].join("\n"),
    html: `<p>Se você está lendo isto, a conta de envio do SAP funciona.</p><p>Remetente: ${from}<br>Enviado em: ${sentAt}</p>`,
  });

  console.log(`\nEnviado para ${to}.`);
  console.log(
    "Confira a caixa de entrada E a de spam — cair no spam também é um resultado, e significa que o remetente precisa de ajuste.",
  );
}

main().catch((error) => {
  console.error("\nFalha ao enviar:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
