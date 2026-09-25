import {
  APPROVALS_PATH,
  LOGIN_PATH,
  PENDING_APPROVAL_PATH,
  SIGNUP_PATH,
} from "@/config/accessRoutes";

export const SIGNUP_CONFIRMATION_PATH = `${SIGNUP_PATH}/confirmacao`;


/**
 * Endereços absolutos para dentro dos e-mails. Link relativo não existe em
 * caixa de entrada — tem que ser a URL pública inteira.
 */
function absoluteUrl(path: string) {
  const host = process.env.NEXT_PUBLIC_HOST_URL?.replace(/\/$/, "") ?? "";
  return `${host}${path}`;
}

export const signupConfirmationUrl = () => absoluteUrl(SIGNUP_CONFIRMATION_PATH);
export const approvalsUrl = () => absoluteUrl(APPROVALS_PATH);
export const loginUrl = () => absoluteUrl(LOGIN_PATH);
export const pendingApprovalUrl = () => absoluteUrl(PENDING_APPROVAL_PATH);
