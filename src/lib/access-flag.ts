/**
 * Interruptor de implantação do bloqueio de acesso.
 *
 * Toda conta que existe hoje está sem o claim de liberação. Ligar isto antes do
 * backfill (`scripts/backfill-access-claims.mjs`) trancaria essas pessoas para
 * fora, então nasce desligado: sem a variável no ambiente, a plataforma se
 * comporta exatamente como antes.
 *
 * A ordem de implantação é: subir com a flag desligada → rodar o backfill →
 * ligar a flag.
 *
 * Mora sozinho, sem importar nada, porque três lugares muito diferentes
 * precisam dele: a criação da sessão, o guard das páginas, e a página de login
 * — que só quer saber se pode mostrar o link de cadastro.
 */
export function isAccessGuardEnabled() {
  return process.env.PLATFORM_ACCESS_GUARD_ENABLED === "true";
}

/**
 * O cadastro só é oferecido quando o bloqueio está ligado.
 *
 * Com o bloqueio desligado, a sessão nasce sem conferir o claim nem o e-mail
 * confirmado — então qualquer pessoa que se cadastrasse entraria direto, sem
 * confirmar nada e sem aprovação de ninguém. Oferecer o cadastro nesse estado
 * deixaria a plataforma **mais aberta do que era antes de tudo isto existir**.
 *
 * Amarrar as duas coisas remove a dependência de alguém lembrar de ligar a flag
 * no mesmo dia do deploy.
 */
export function isSignupOffered() {
  return isAccessGuardEnabled();
}
