/**
 * Entrada automática depois do cadastro.
 *
 * A aba onde a pessoa se cadastrou espera o e-mail ser confirmado — no celular,
 * em outra aba, onde for — e então entra sozinha, com a senha que acabou de ser
 * digitada nela. O link do e-mail continua sem abrir sessão: só entra o
 * navegador que provou saber a senha.
 *
 * A senha fica só na memória desta aba, como já ficava no formulário, e é
 * esquecida quando a espera acaba (`SIGNUP_WATCH_MAX_MS`). A conferência usa a
 * API REST do Firebase, e não o `auth` da plataforma, para nada ser gravado no
 * navegador: quem fecha a aba sem confirmar não fica com um login pela metade.
 */

const ACCOUNTS_API = "https://identitytoolkit.googleapis.com/v1/accounts";
const CHANNEL_NAME = "sedes-cadastro";

export const SIGNUP_WATCH_INTERVAL_MS = 5_000;
/**
 * Teto da espera. Protege o computador compartilhado: quem se cadastra no
 * laboratório e confirma em casa não deixa a aba do laboratório entrar sozinha
 * horas depois.
 */
export const SIGNUP_WATCH_MAX_MS = 15 * 60_000;

type ChannelMessage = { type: "confirmed" } | { type: "entered" };

async function callAccounts(method: string, body: object) {
  const response = await fetch(
    `${ACCOUNTS_API}:${method}?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  return {
    status: response.status,
    body: (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null,
  };
}

/**
 * Token para consultar a conta, `"refused"` quando o Firebase recusa a senha
 * (a conta já existia com outra senha, ou foi apagada), ou `null` numa falha
 * passageira.
 */
async function signInForCheck(email: string, password: string) {
  const { status, body } = await callAccounts("signInWithPassword", {
    email,
    password,
    returnSecureToken: true,
  });

  if (status >= 400 && status < 500) return "refused" as const;
  return typeof body?.idToken === "string" ? body.idToken : null;
}

/** `null` quando a consulta falha — inclusive com o token revogado pela liberação. */
async function readEmailVerified(idToken: string) {
  const { status, body } = await callAccounts("lookup", { idToken });
  if (status !== 200) return null;

  const users = body?.users as { emailVerified?: boolean }[] | undefined;
  return users?.[0]?.emailVerified === true;
}

/**
 * Confere de tempos em tempos se o e-mail foi confirmado e chama
 * `onConfirmed` uma vez. Confere também na hora quando a aba volta a ficar
 * visível e quando a página de confirmação, aberta neste navegador, avisa.
 * Devolve a função que para a espera.
 *
 * const stop = watchSignupConfirmation({ email, password, onConfirmed });
 */
export function watchSignupConfirmation({
  email,
  password,
  onConfirmed,
  onExpire,
  intervalMs = SIGNUP_WATCH_INTERVAL_MS,
  maxMs = SIGNUP_WATCH_MAX_MS,
}: {
  email: string;
  password: string;
  onConfirmed: () => void;
  onExpire?: () => void;
  intervalMs?: number;
  maxMs?: number;
}) {
  let secret = password;
  let idToken: string | null = null;
  let stopped = false;
  let checking = false;

  async function isConfirmed() {
    // Um token guardado pode ter sido revogado pela liberação. Nesse caso
    // entra de novo na hora, em vez de esperar a próxima volta.
    for (let attempt = 0; attempt < 2; attempt++) {
      const hadToken = idToken !== null;

      if (!idToken) {
        const result = await signInForCheck(email, secret);
        if (result === "refused") {
          stop();
          return false;
        }
        idToken = result;
        if (!idToken) return false;
      }

      const verified = await readEmailVerified(idToken);
      if (verified !== null) return verified;

      idToken = null;
      if (!hadToken) return false;
    }

    return false;
  }

  async function check() {
    if (stopped || checking) return;
    checking = true;

    try {
      if ((await isConfirmed()) && !stopped) {
        stop();
        onConfirmed();
      }
    } catch {
      // Rede fora: a próxima volta tenta de novo.
    } finally {
      checking = false;
    }
  }

  function onVisible() {
    if (document.visibilityState === "visible") void check();
  }

  const channel =
    typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel(CHANNEL_NAME);

  channel?.addEventListener("message", (event: MessageEvent<ChannelMessage>) => {
    if (event.data?.type === "confirmed") void check();
  });

  const interval = setInterval(() => void check(), intervalMs);
  const expiry = setTimeout(() => {
    stop();
    onExpire?.();
  }, maxMs);

  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onVisible);

  function stop() {
    if (stopped) return;
    stopped = true;
    secret = "";
    clearInterval(interval);
    clearTimeout(expiry);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onVisible);
    channel?.close();
  }

  void check();

  return stop;
}

function post(message: ChannelMessage) {
  if (typeof BroadcastChannel === "undefined") return;

  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.postMessage(message);
  channel.close();
}

/** A página de confirmação avisa a aba do cadastro, se ela estiver aberta. */
export function announceSignupConfirmed() {
  post({ type: "confirmed" });
}

/** A aba do cadastro avisa que entrou, para a página de confirmação seguir junto. */
export function announceSignupEntered() {
  post({ type: "entered" });
}

/**
 * Chama `callback` quando a aba do cadastro entrar. Devolve a função que para
 * de escutar.
 */
export function onSignupEntered(callback: () => void) {
  if (typeof BroadcastChannel === "undefined") return () => undefined;

  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.addEventListener("message", (event: MessageEvent<ChannelMessage>) => {
    if (event.data?.type === "entered") callback();
  });

  return () => channel.close();
}
