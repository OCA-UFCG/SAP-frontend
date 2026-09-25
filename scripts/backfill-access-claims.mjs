#!/usr/bin/env node
/**
 * Libera todas as contas que já existem, antes de o guard de acesso ser ligado.
 *
 * Quem usa a plataforma hoje não tem o claim `sap.access` — ele só passa a ser
 * gravado pelo cadastro. Ligar `PLATFORM_ACCESS_GUARD_ENABLED` sem rodar isto
 * antes trancaria todo mundo para fora no deploy.
 *
 * A ordem de implantação é: subir com a flag desligada → rodar este script →
 * ligar a flag.
 *
 *   node scripts/backfill-access-claims.mjs --dry-run
 *   node scripts/backfill-access-claims.mjs --apply
 *
 * É idempotente: contas que já têm um claim válido são puladas, então rodar de
 * novo não revoga a sessão de ninguém.
 */

// Estas duas constantes espelham `src/lib/access-claims.ts`. Um teste
// (__tests__/backfillAccessClaims.test.ts) compara os dois formatos e quebra se
// eles divergirem — um backfill que grava um claim que o guard não reconhece
// trancaria a plataforma inteira.
const ACCESS_CLAIM_NAMESPACE = "sap";
const APPROVED_ACCESS = "approved";
const LEGACY_TIER = "legacy";

const VALID_TIERS = new Set(["allowed", "common", LEGACY_TIER]);

export function buildBackfillClaims(existingClaims = {}, atSeconds) {
  // `setCustomUserClaims` substitui o conjunto inteiro, não mescla: escrever só
  // o nosso apagaria qualquer claim que a conta já tivesse.
  return {
    ...existingClaims,
    [ACCESS_CLAIM_NAMESPACE]: {
      access: APPROVED_ACCESS,
      tier: LEGACY_TIER,
      at: atSeconds,
    },
  };
}

export function shouldBackfillUser(user) {
  const namespaced = user?.customClaims?.[ACCESS_CLAIM_NAMESPACE];

  if (!namespaced || typeof namespaced !== "object") return true;
  if (namespaced.access !== APPROVED_ACCESS) return true;
  if (!VALID_TIERS.has(namespaced.tier)) return true;

  return false;
}

function parseArgs(argv) {
  return {
    apply: argv.includes("--apply"),
    dryRun: !argv.includes("--apply"),
  };
}

async function main() {
  const { apply } = parseArgs(process.argv.slice(2));

  // Importado só aqui para o arquivo poder ser importado por um teste sem
  // exigir credencial de Firebase Admin no ambiente.
  const { default: admin } = await import("firebase-admin");

  const privateKey = process.env.FIREBASE_PRIVATE_KEY_BASE64
    ? Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64, "base64").toString(
        "utf8",
      )
    : process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      "Credenciais do Firebase Admin ausentes. Confira FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY (ou _BASE64).",
    );
    process.exit(1);
  }

  const app = admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
  const auth = app.auth();

  const atSeconds = Math.floor(Date.now() / 1000);
  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let pageToken;

  console.log(
    apply
      ? "Aplicando o claim de acesso nas contas existentes…"
      : "Simulação (--dry-run). Nada será gravado. Use --apply para valer.",
  );

  do {
    const page = await auth.listUsers(1000, pageToken);

    for (const user of page.users) {
      scanned += 1;

      if (!shouldBackfillUser(user)) {
        skipped += 1;
        continue;
      }

      console.log(`  ${apply ? "gravando" : "gravaria"}: ${user.email ?? user.uid}`);

      if (apply) {
        await auth.setCustomUserClaims(
          user.uid,
          buildBackfillClaims(user.customClaims, atSeconds),
        );
      }

      updated += 1;
    }

    pageToken = page.pageToken;
  } while (pageToken);

  console.log(
    `\n${scanned} conta(s) verificada(s) · ${updated} ${apply ? "liberada(s)" : "seriam liberadas"} · ${skipped} já com claim válido`,
  );

  if (!apply) {
    console.log("\nNada foi gravado. Rode de novo com --apply para aplicar.");
  }
}

// Só executa quando chamado direto pelo node; um import (o teste) não dispara.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
