/**
 * Rotas do fluxo de acesso, num lugar que o servidor e o navegador podem ler.
 *
 * Elas viviam em `platform-access.ts`, que arrasta o Firebase Admin — importá-lo
 * de um componente de cliente levaria credencial de servidor para o bundle.
 */

/**
 * Destino de quem tem credencial válida mas ainda não foi liberado. Não pode ser
 * o `/login`: a senha está certa, e mandar logar de novo devolveria a pessoa
 * para o mesmo lugar.
 */
export const PENDING_APPROVAL_PATH = "/aguardando-liberacao";

export const LOGIN_PATH = "/login";
export const SIGNUP_PATH = "/cadastro";
export const APPROVALS_PATH = "/platform/aprovacoes";
