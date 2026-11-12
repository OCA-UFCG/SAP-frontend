/**
 * Quem pode usar a página de chat.
 *
 * Sem SEDES_CHAT_EMAILS a página fica aberta, mas só escuta no próprio
 * computador (127.0.0.1): é o modo de teste local.
 *
 * Com SEDES_CHAT_EMAILS, é preciso estar logado no SEDES. A página fica no
 * mesmo domínio do site (o nginx manda /chat/ para cá), o navegador manda o
 * mesmo cookie de sessão, e ele é conferido com o Firebase como o site faz.
 * Só entra quem está na lista. A lista aceita e-mails e domínios inteiros
 * ("@lsd.ufcg.edu.br"), separados por vírgula.
 *
 * Variáveis de ambiente:
 *   SEDES_CHAT_EMAILS     lista de quem pode usar; vazia = modo local
 *   FIREBASE_PROJECT_ID   projeto do Firebase do site (para conferir o cookie)
 */
import { initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

export const COOKIE_SESSAO = "session";

export type Acesso =
  | { situacao: "liberado"; email?: string; cookieSessao?: string }
  | { situacao: "sem-login" }
  | { situacao: "sem-permissao"; email: string };

function lerLista(valor: string | undefined) {
  return (valor ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function cookieDe(cabecalho: string | undefined, nome: string) {
  for (const parte of (cabecalho ?? "").split(";")) {
    const [chave, ...resto] = parte.trim().split("=");
    if (chave === nome) return decodeURIComponent(resto.join("="));
  }
  return null;
}

export function criarAcesso(env = process.env) {
  const lista = lerLista(env.SEDES_CHAT_EMAILS);
  const comLogin = lista.length > 0;
  let app: App | undefined;
  // Cookie já conferido → e-mail. Evita uma ida ao Google por pergunta.
  const conferidos = new Map<string, { email: string | null; ate: number }>();

  function permitido(email: string) {
    return lista.some((item) =>
      item.startsWith("@") ? email.endsWith(item) : email === item,
    );
  }

  async function emailDoCookie(cookie: string) {
    const salvo = conferidos.get(cookie);
    if (salvo && salvo.ate > Date.now()) return salvo.email;
    app ??= initializeApp(
      {
        projectId:
          env.FIREBASE_PROJECT_ID ?? env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      },
      "sedes-chat",
    );
    let email: string | null = null;
    let ate = Date.now() + 60_000;
    try {
      // Sem conferir revogação: assim basta o id do projeto, sem a chave da
      // conta de serviço. Quem sai da lista perde o acesso na hora; a sessão
      // do site dura 24 h de qualquer jeito.
      const token = await getAuth(app).verifySessionCookie(cookie, false);
      email = token.email?.trim().toLowerCase() ?? null;
      ate = Math.min(token.exp * 1000, Date.now() + 10 * 60_000);
    } catch {
      email = null;
    }
    if (conferidos.size > 1000) conferidos.clear();
    conferidos.set(cookie, { email, ate });
    return email;
  }

  return {
    comLogin,
    async verificar(cabecalhoCookie: string | undefined): Promise<Acesso> {
      if (!comLogin) return { situacao: "liberado" };
      const cookie = cookieDe(cabecalhoCookie, COOKIE_SESSAO);
      if (!cookie) return { situacao: "sem-login" };
      const email = await emailDoCookie(cookie);
      if (!email) return { situacao: "sem-login" };
      if (!permitido(email)) return { situacao: "sem-permissao", email };
      return {
        situacao: "liberado",
        email,
        cookieSessao: `${COOKIE_SESSAO}=${encodeURIComponent(cookie)}`,
      };
    },
  };
}
