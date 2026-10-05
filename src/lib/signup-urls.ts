import {
  APPROVALS_PATH,
  LOGIN_PATH,
  PASSWORD_RESET_PATH,
  PENDING_APPROVAL_PATH,
  SIGNUP_PATH,
} from "@/config/accessRoutes";

export const SIGNUP_CONFIRMATION_PATH = `${SIGNUP_PATH}/confirmacao`;


/**
 * Endereços absolutos para dentro dos e-mails. Link relativo não existe em
 * caixa de entrada — tem que ser a URL pública inteira.
 *
 * `EMAIL_LINKS_BASE_URL` existe porque a produção atende por mais de um
 * domínio e deixa `NEXT_PUBLIC_HOST_URL` vazia de propósito: com ela vazia, o
 * mapa chama o domínio em que a pessoa está. O e-mail precisa de um domínio só,
 * o que a equipe divulga. Onde ela não existe, vale `NEXT_PUBLIC_HOST_URL`.
 */
function absoluteUrl(path: string) {
  const host =
    (process.env.EMAIL_LINKS_BASE_URL || process.env.NEXT_PUBLIC_HOST_URL)?.replace(
      /\/$/,
      "",
    ) ?? "";
  return `${host}${path}`;
}

/**
 * Com o idioma no caminho, a pessoa cai direto na página no idioma em que se
 * cadastrou. Sem ele, o site escolhe o padrão (português).
 */
export const signupConfirmationUrl = (locale?: string) =>
  absoluteUrl(
    locale ? `/${locale}${SIGNUP_CONFIRMATION_PATH}` : SIGNUP_CONFIRMATION_PATH,
  );
export const passwordResetUrl = (locale?: string) =>
  absoluteUrl(locale ? `/${locale}${PASSWORD_RESET_PATH}` : PASSWORD_RESET_PATH);
export const approvalsUrl = () => absoluteUrl(APPROVALS_PATH);
export const loginUrl = () => absoluteUrl(LOGIN_PATH);
export const pendingApprovalUrl = () => absoluteUrl(PENDING_APPROVAL_PATH);
