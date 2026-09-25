import { adminDb } from "@/lib/firebase-admin";
import type { SignupTier } from "@/lib/signup-domains";
import type { AccessTier } from "@/lib/access-claims";

/**
 * A trilha de auditoria do cadastro: um registro por pedido, com quem pediu, o
 * que escreveu, quem decidiu e quando.
 *
 * Ele **não autoriza**. Quem autoriza é o custom claim na conta do Firebase,
 * que viaja dentro do cookie e é lido sem consulta a banco. Se a autorização
 * dependesse de ler daqui, a plataforma pagaria uma ida ao Firestore em todo
 * request. Os dois papéis não se substituem:
 *
 *   claim  → autoriza (caminho quente, toda entrada)
 *   este   → audita (tela de aprovação e consulta depois)
 *
 * O registro é aberto para os dois trilhos, inclusive o institucional: quem
 * entrou por domínio também deixa rastro de quando pediu e do que escreveu.
 * Ele sobrevive à decisão — é o histórico, não uma fila temporária.
 */
export const DEFAULT_ACCESS_REQUESTS_COLLECTION = "access-requests-local";

/**
 * Separa a gaveta de desenvolvimento da de produção, como
 * `telemetryRepository` já faz com a dela. Sem isso, cada teste local escrevia
 * pedidos na mesma coleção da produção, e a tela de aprovação real passava a
 * mostrar cadastros de teste misturados com pedidos de verdade.
 *
 * O padrão é o de desenvolvimento de propósito: esquecer a variável em produção
 * cria uma coleção separada e visivelmente vazia, o que é muito melhor que
 * esquecê-la localmente e sujar a produção.
 */
export function resolveAccessRequestsCollectionName(
  value = process.env.FIREBASE_ACCESS_REQUESTS_COLLECTION,
) {
  return value?.trim() || DEFAULT_ACCESS_REQUESTS_COLLECTION;
}

export const ACCESS_REQUESTS_COLLECTION = resolveAccessRequestsCollectionName();
export const INTENTION_MAX_LENGTH = 1000;

export type AccessRequestStatus = "pending" | "approved" | "rejected";

export interface AccessRequestInput {
  email: string;
  tier: SignupTier;
  intention: string;
  /**
   * Idioma em que a pessoa se cadastrou. Fica guardado porque o e-mail de
   * decisão pode sair semanas depois, quando não há mais nenhuma requisição
   * dela por perto de onde tirar essa informação.
   */
  locale: string;
}

export interface AccessRequest extends AccessRequestInput {
  status: AccessRequestStatus;
  createdAt: string;
  decidedAt: string | null;
  /** E-mail de quem decidiu, ou `null` quando a regra de domínio decidiu. */
  decidedBy: string | null;
  /**
   * Quando a equipe foi avisada. O link de confirmação pode ser aberto várias
   * vezes — reencaminhamento, pré-carregamento do cliente de e-mail, a pessoa
   * clicando de novo por dúvida — e sem esta marca a caixa da equipe receberia
   * um aviso por clique.
   */
  notifiedAt: string | null;
}

export interface AccessDecision {
  status: Exclude<AccessRequestStatus, "pending">;
  decidedBy: string | null;
}

/**
 * Texto pronto para ser gravado e, mais tarde, colado num e-mail: sem espaço
 * sobrando, sem quebras de linha que o `textarea` deixou, e cortado no limite.
 * O corte aqui é o que vale — o `maxLength` do formulário é só cortesia.
 */
export function normalizeIntention(value: unknown) {
  if (typeof value !== "string") return "";

  return value.trim().replace(/\s+/g, " ").slice(0, INTENTION_MAX_LENGTH);
}

function requestDoc(uid: string) {
  return adminDb.collection(ACCESS_REQUESTS_COLLECTION).doc(uid);
}

export async function createAccessRequest(
  uid: string,
  { email, tier, intention, locale }: AccessRequestInput,
) {
  await requestDoc(uid).set({
    email,
    tier,
    intention,
    locale,
    status: "pending",
    createdAt: new Date().toISOString(),
    decidedAt: null,
    decidedBy: null,
    notifiedAt: null,
  });
}

export interface PendingAccessRequest extends AccessRequest {
  uid: string;
}

/**
 * O que a tela de aprovação mostra: só quem está esperando, mais antigo
 * primeiro — quem pediu há mais tempo é quem está esperando há mais tempo.
 */
export async function listPendingAccessRequests(): Promise<
  PendingAccessRequest[]
> {
  const snapshot = await adminDb
    .collection(ACCESS_REQUESTS_COLLECTION)
    .where("status", "==", "pending")
    .orderBy("createdAt", "asc")
    .get();

  return snapshot.docs.map((doc) => ({
    uid: doc.id,
    ...(doc.data() as AccessRequest),
  }));
}

/**
 * Toma o direito de avisar a equipe, numa transação.
 *
 * O link de confirmação pode ser aberto várias vezes ao mesmo tempo — duplo
 * clique, o modo estrito do React em desenvolvimento, e principalmente os
 * programas de e-mail que abrem os links das mensagens sozinhos para checar
 * segurança, em paralelo com o clique da pessoa.
 *
 * Ler `notifiedAt` e depois gravá-lo eram operações separadas, então duas
 * chamadas simultâneas liam "ninguém avisou ainda" antes de qualquer uma
 * gravar o contrário, e a caixa da equipe recebia o pedido em duplicata.
 *
 * Devolve `true` para quem ganhou o direito de enviar; `false` para os demais.
 */
export async function claimTeamNotification(uid: string) {
  return adminDb.runTransaction(async (transaction) => {
    const doc = requestDoc(uid);
    const snapshot = await transaction.get(doc);

    if (!snapshot.exists) return false;
    if ((snapshot.data() as AccessRequest).notifiedAt) return false;

    transaction.update(doc, { notifiedAt: new Date().toISOString() });
    return true;
  });
}

export async function readAccessRequest(
  uid: string,
): Promise<AccessRequest | null> {
  const snapshot = await requestDoc(uid).get();

  if (!snapshot.exists) return null;

  return (snapshot.data() as AccessRequest | undefined) ?? null;
}

export type DecisionClaim =
  | { claimed: true; tier: AccessTier }
  | { claimed: false; status: AccessRequestStatus };

/**
 * Toma o direito de decidir um pedido, numa transação.
 *
 * Ler o status e depois gravar a decisão eram duas operações separadas — então
 * dois operadores clicando ao mesmo tempo passavam os dois pela checagem de
 * "ainda está pendente". Se um aprovasse e o outro recusasse, a pessoa ficava
 * com o acesso liberado e a trilha de auditoria dizendo que foi negada, que é o
 * pior desfecho possível para o artefato que existe justamente para responder
 * "quem liberou o fulano".
 *
 * Numa transação, o segundo a chegar lê o status já decidido e desiste.
 *
 * Devolve o `tier` gravado no cadastro porque quem chama precisa dele para
 * conceder o acesso — e ele nunca deve vir da tela.
 */
export async function claimPendingDecision(
  uid: string,
  { status, decidedBy }: AccessDecision,
): Promise<DecisionClaim> {
  return adminDb.runTransaction(async (transaction) => {
    const doc = requestDoc(uid);
    const snapshot = await transaction.get(doc);

    if (!snapshot.exists) {
      return { claimed: false, status: "pending" } as const;
    }

    const current = snapshot.data() as AccessRequest;

    if (current.status !== "pending") {
      return { claimed: false, status: current.status } as const;
    }

    transaction.update(doc, {
      status,
      decidedBy,
      decidedAt: new Date().toISOString(),
    });

    return { claimed: true, tier: current.tier } as const;
  });
}

/**
 * Fecha um pedido. O registro continua existindo — é ele que responde "quem
 * liberou o fulano, e quando" seis meses depois.
 */
export async function recordAccessDecision(
  uid: string,
  { status, decidedBy }: AccessDecision,
) {
  await requestDoc(uid).update({
    status,
    decidedBy,
    decidedAt: new Date().toISOString(),
  });
}
