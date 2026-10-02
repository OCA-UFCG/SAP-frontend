/**
 * Piso local de senha, o mesmo no cadastro e na troca de senha. A regra que
 * vale é a password policy do Firebase Auth, que roda no servidor deles — esta
 * existe para a pessoa receber o erro antes de a tentativa sair.
 */
export const MIN_PASSWORD_LENGTH = 8;
