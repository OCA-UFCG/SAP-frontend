// Auditoria operacional da allowlist do catálogo e dos logs.
//
// O acesso passou a exigir e-mail verificado (ver src/lib/logs-access.ts), o que
// fecha a brecha de alguém registrar no Firebase um endereço da allowlist que
// ainda não tinha conta. O efeito colateral é que uma conta criada pelo console
// sem verificação perde o acesso, e o console do Firebase não tem botão para
// marcar como verificada — só o Admin SDK tem, e é o que este script faz.
//
//   npm run auth:catalog-access
//   npm run auth:catalog-access -- --mark-verified pessoa@exemplo.org
import admin from "firebase-admin";
import { loadDotEnv } from "../drive-contentful-pipeline/lib/contentful/env.mjs";

await loadDotEnv();

function getCredential() {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/gu, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Credenciais do Firebase Admin ausentes: preencha FIREBASE_PROJECT_ID (ou NEXT_PUBLIC_FIREBASE_PROJECT_ID), FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY.",
    );
  }

  return admin.credential.cert({ projectId, clientEmail, privateKey });
}

function getAllowedEmails() {
  const emails = (process.env.LOGS_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) {
    throw new Error("LOGS_ALLOWED_EMAILS está vazia; nada a auditar.");
  }

  return emails;
}

async function describeAccount(auth, email) {
  try {
    const user = await auth.getUserByEmail(email);
    return user.emailVerified
      ? `${email}: acesso ok (conta ${user.uid}, e-mail verificado)`
      : `${email}: SEM ACESSO — a conta ${user.uid} existe mas o e-mail não está verificado`;
  } catch (error) {
    return error?.code === "auth/user-not-found"
      ? `${email}: SEM CONTA — enquanto ninguém criar essa conta, o endereço fica reservado e sem acesso`
      : `${email}: falha ao consultar (${error?.code ?? error})`;
  }
}

async function markVerified(auth, email) {
  const user = await auth.getUserByEmail(email);
  await auth.updateUser(user.uid, { emailVerified: true });
  console.log(
    `${email}: e-mail marcado como verificado. A pessoa precisa sair e entrar de novo, porque o cookie de sessão guarda o estado do login.`,
  );
}

const emailToVerify = process.argv.includes("--mark-verified")
  ? process.argv[process.argv.indexOf("--mark-verified") + 1]
      ?.trim()
      .toLowerCase()
  : null;

admin.initializeApp({ credential: getCredential() });
const auth = admin.auth();

if (emailToVerify) {
  if (!getAllowedEmails().includes(emailToVerify)) {
    throw new Error(
      `${emailToVerify} não está em LOGS_ALLOWED_EMAILS; verifique o endereço antes de marcar a conta.`,
    );
  }

  await markVerified(auth, emailToVerify);
} else {
  for (const email of getAllowedEmails()) {
    console.log(await describeAccount(auth, email));
  }
}
