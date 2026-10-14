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
function absoluteUrl(path: string, baseUrl?: string) {
  const host =
    (baseUrl || process.env.EMAIL_LINKS_BASE_URL || process.env.NEXT_PUBLIC_HOST_URL)?.replace(
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
/**
 * A tela de Aprovações só existe no beta. A produção define
 * `ADMIN_LINKS_BASE_URL` com o endereço do beta, para o aviso de pedido novo
 * levar o OCA até lá. Beta e produção usam o mesmo Firebase, então a aprovação
 * feita no beta vale para a produção.
 */
export const approvalsUrl = () =>
  absoluteUrl(APPROVALS_PATH, process.env.ADMIN_LINKS_BASE_URL);
/**
 * Vai no aviso de decisão, que sai do beta (onde ficam as Aprovações). O beta
 * define `PUBLIC_LINKS_BASE_URL` com o endereço da produção, para quem foi
 * aprovado entrar na plataforma que a equipe divulga.
 */
export const loginUrl = () =>
  absoluteUrl(LOGIN_PATH, process.env.PUBLIC_LINKS_BASE_URL);
export const pendingApprovalUrl = () => absoluteUrl(PENDING_APPROVAL_PATH);
