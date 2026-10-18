import { adminAuth, adminDb } from "@/lib/firebase-admin";
import type { SignupTier } from "@/lib/signup-domains";
import type { AccessTier } from "@/lib/access-claims";
import { routing } from "@/translations/routing-config";

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

/**
 * `revoked` é o acesso que a equipe tirou depois de liberado. Ele precisa ficar
 * aqui, e não só no claim: sem ele, o login de uma conta institucional sem
 * pedido registrado abriria um pedido novo e a liberaria de novo sozinho
 * (`settleSignup`).
 */
export type AccessRequestStatus = "pending" | "approved" | "rejected" | "revoked";

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

export interface AccessRequest extends Omit<AccessRequestInput, "tier"> {
  /** `legacy` só aparece no registro aberto ao remover o acesso de uma conta antiga. */
  tier: AccessTier;
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
 * Quantas contas o Firebase aceita consultar de uma vez em `getUsers`.
 */
const GET_USERS_BATCH_SIZE = 100;

/**
 * Das contas informadas, as que já confirmaram o e-mail.
 *
 * O pedido nasce "pendente" no envio do formulário, antes da confirmação — e a
 * fonte de verdade sobre a confirmação é o Firebase Auth, não o pedido. Uma
 * conta que não existe mais também fica de fora.
 */
async function filterConfirmedUids(uids: string[]) {
  const confirmed = new Set<string>();

  for (let start = 0; start < uids.length; start += GET_USERS_BATCH_SIZE) {
    const batch = uids.slice(start, start + GET_USERS_BATCH_SIZE);
    const { users } = await adminAuth.getUsers(batch.map((uid) => ({ uid })));

    users
      .filter((user) => user.emailVerified)
      .forEach((user) => confirmed.add(user.uid));
  }

  return confirmed;
}

/**
 * O que a tela de aprovação mostra: só quem está esperando e já confirmou o
 * e-mail, mais antigo primeiro — quem pediu há mais tempo é quem está esperando
 * há mais tempo.
 *
 * Sem o filtro de confirmação, a tela listava quem só enviou o formulário. Um
 * operador podia então aprovar um endereço que ninguém provou ser dono — por
 * exemplo, alguém que se cadastrou com o e-mail de outra pessoa.
 */
export async function listPendingAccessRequests(): Promise<
  PendingAccessRequest[]
> {
  const snapshot = await adminDb
    .collection(ACCESS_REQUESTS_COLLECTION)
    .where("status", "==", "pending")
    .orderBy("createdAt", "asc")
    .get();

  const requests = snapshot.docs.map((doc) => ({
    uid: doc.id,
    ...(doc.data() as AccessRequest),
  }));

  if (requests.length === 0) return requests;

  const confirmed = await filterConfirmedUids(
    requests.map((request) => request.uid),
  );

  return requests.filter((request) => confirmed.has(request.uid));
}

/**
 * Quantos pedidos estão esperando decisão, para o número na trilha da
 * plataforma. Conta os mesmos pedidos que a tela mostra: um número que inclui
 * cadastros sem e-mail confirmado apontaria para pedidos que a tela não lista.
 */
export async function countPendingAccessRequests() {
  return (await listPendingAccessRequests()).length;
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

/**
 * Registra na trilha que a equipe tirou (ou devolveu) o acesso de alguém.
 *
 * Contas antigas, de antes do cadastro, não têm registro nenhum. Para elas o
 * registro é aberto agora, já decidido — e com `notifiedAt` preenchido, porque
 * não é um pedido e a equipe não precisa ser avisada de nada.
 */
export async function recordAccessChange(
  uid: string,
  {
    status,
    email,
    tier,
    decidedBy,
  }: {
    status: Extract<AccessRequestStatus, "approved" | "revoked">;
    email: string;
    tier: AccessTier;
    decidedBy: string | null;
  },
) {
  const now = new Date().toISOString();
  const existing = await requestDoc(uid).get();

  if (existing.exists) {
    await requestDoc(uid).update({ status, decidedBy, decidedAt: now });
    return;
  }

  await requestDoc(uid).set({
    email,
    tier,
    intention: "",
    locale: routing.defaultLocale,
    status,
    createdAt: now,
    decidedAt: now,
    decidedBy,
    notifiedAt: now,
  });
}

/**
 * Os registros de várias contas de uma vez, para a lista de quem tem acesso.
 * Uma leitura só, em vez de uma por linha.
 */
export async function readAccessRequests(uids: string[]) {
  const found = new Map<string, AccessRequest>();

  if (uids.length === 0) return found;

  const snapshots = await adminDb.getAll(...uids.map((uid) => requestDoc(uid)));

  snapshots
    .filter((snapshot) => snapshot.exists)
    .forEach((snapshot) =>
      found.set(snapshot.id, snapshot.data() as AccessRequest),
    );

  return found;
}

/**
 * Apaga o registro de uma conta que está sendo excluída. Ele guarda o e-mail e
 * a intenção de uso, que a pessoa escreveu com as próprias palavras — não faz
 * sentido manter isso depois de ela pedir para sair.
 */
export async function deleteAccessRequest(uid: string) {
  await requestDoc(uid).delete();
}
