import { adminAuth } from "@/lib/firebase-admin";
import type { SignupTier } from "@/lib/signup-domains";

export { isAccessGuardEnabled } from "@/lib/access-flag";

/**
 * Tudo que o SAP grava fica aninhado sob `sap`. O Firebase reserva os nomes de
 * topo do token (`sub`, `iat`, `exp`, entre outros) e recusa um custom claim que
 * colida com eles, então um namespace só nosso é o que mantém a gravação
 * previsível.
 */
export const ACCESS_CLAIM_NAMESPACE = "sap";
export const APPROVED_ACCESS = "approved";

/**
 * Como a pessoa ganhou acesso. `allowed` e `common` vêm do cadastro; `legacy`
 * marca quem já usava a plataforma antes de o cadastro existir e foi liberado
 * pelo backfill — nem um nem outro, e vale saber quantos são.
 */
export type AccessTier = SignupTier | "legacy";

const ACCESS_TIERS: readonly AccessTier[] = ["allowed", "common", "legacy"];

export interface AccessClaim {
  access: typeof APPROVED_ACCESS;
  tier: AccessTier;
  at: number;
}

function nowInSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function buildApprovedAccessClaims(
  tier: AccessTier,
  atSeconds = nowInSeconds(),
) {
  return {
    [ACCESS_CLAIM_NAMESPACE]: {
      access: APPROVED_ACCESS,
      tier,
      at: atSeconds,
    },
  };
}

/**
 * Lê o claim de acesso de um token já decodificado pelo Admin SDK.
 *
 * Devolve `null` para qualquer coisa que não seja um claim aprovado e bem
 * formado — token de conta antiga, que não tem claim nenhum, e claim malformado
 * caem juntos no mesmo caminho: o que nega.
 */
export function readAccessClaim(claims: unknown): AccessClaim | null {
  if (!claims || typeof claims !== "object") return null;

  const namespaced = (claims as Record<string, unknown>)[
    ACCESS_CLAIM_NAMESPACE
  ];
  if (!namespaced || typeof namespaced !== "object") return null;

  const { access, tier, at } = namespaced as Record<string, unknown>;

  if (access !== APPROVED_ACCESS) return null;
  if (!ACCESS_TIERS.includes(tier as AccessTier)) return null;

  return {
    access: APPROVED_ACCESS,
    tier: tier as AccessTier,
    at: typeof at === "number" ? at : 0,
  };
}

export function hasApprovedAccess(claims: unknown) {
  return readAccessClaim(claims) !== null;
}

/**
 * Libera o acesso de alguém. É o único ponto do projeto que chama
 * `setCustomUserClaims` — os dois trilhos (liberação automática por domínio e
 * aprovação manual do OCA) passam por aqui.
 *
 * A revogação não é opcional. O claim é carimbado no cookie de sessão no
 * momento em que ele é criado, e `verifySessionCookie` lê o cookie, não a conta:
 * sem revogar, um cookie já emitido continuaria valendo por até 24 h sem o
 * claim, e a pessoa aprovada só entraria no dia seguinte. Com a revogação, o
 * `checkRevoked` que o projeto já usa derruba a sessão antiga dentro do TTL do
 * cache de sessões verificadas (60 s por padrão).
 *
 * await approveAccess(uid, tier);
 */
export async function approveAccess(
  uid: string,
  tier: AccessTier,
  atSeconds = nowInSeconds(),
) {
  // `setCustomUserClaims` substitui o conjunto INTEIRO de claims, não mescla.
  // Escrever só o nosso apagaria qualquer outro que a conta tivesse — hoje não
  // há nenhum, mas no dia em que alguém criar um papel de administrador ele
  // evaporaria na primeira aprovação, e pareceria bug do Firebase.
  // (`scripts/backfill-access-claims.mjs` faz o mesmo cuidado.)
  const { customClaims } = await adminAuth.getUser(uid);

  await adminAuth.setCustomUserClaims(uid, {
    ...customClaims,
    ...buildApprovedAccessClaims(tier, atSeconds),
  });

  await adminAuth.revokeRefreshTokens(uid);
}
