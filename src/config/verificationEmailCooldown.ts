/**
 * Espera entre dois e-mails de confirmação para o mesmo endereço, a mesma no
 * botão de reenviar e no servidor.
 *
 * O Firebase recusa gerar um link novo para a mesma conta antes de cerca de um
 * minuto (medido em 28/10/2026: 43 s recusado, 65 s sempre aceito, sem teto por
 * hora em nove envios seguidos). A recusa dele é calada: a tela dizia
 * "enviado" e nada chegava. Esperar um pouco mais que ele faz o botão só
 * liberar quando o envio vai mesmo sair.
 */
export const VERIFICATION_EMAIL_COOLDOWN_SECONDS = 90;
