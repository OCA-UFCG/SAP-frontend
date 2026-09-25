export type SignupTier = "allowed" | "common";

function normalizeDomain(domain: string) {
  // A lista aceita tanto `ufcg.edu.br` quanto `@ufcg.edu.br`: quem preenche o
  // ambiente copia o domínio de um e-mail com frequência.
  return domain.trim().toLowerCase().replace(/^@/, "");
}

/**
 * Domínios que entram na plataforma sem passar pela aprovação do OCA. A lista é
 * lida do ambiente a cada chamada de propósito, como em `logs-access`: tirar um
 * domínio de `SIGNUP_ALLOWED_DOMAINS` passa a valer no request seguinte, sem
 * esperar cache nenhum.
 *
 * A variável não tem prefixo `NEXT_PUBLIC_` e nunca pode ganhar um: a lista
 * inteira vazaria no bundle. Quem precisa saber se um e-mail está nela pergunta
 * ao servidor, um endereço por vez.
 */
export function parseAllowedSignupDomains(
  value = process.env.SIGNUP_ALLOWED_DOMAINS,
) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((entry) => normalizeDomain(entry))
      .filter(Boolean),
  );
}

/**
 * Domínio de um e-mail, ou `null` quando o texto não é um endereço único e bem
 * formado. Um `@` a mais, nenhum `@`, ou parte vazia devolvem `null` — sempre
 * pelo caminho que nega, nunca pelo que libera.
 */
function extractEmailDomain(email?: string | null) {
  if (!email) return null;

  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2) return null;

  const [localPart, domain] = parts;
  if (!localPart || !domain) return null;

  return domain;
}

/**
 * Decide se um e-mail está na allowlist de domínios.
 *
 * O casamento é exato, nunca por sufixo: com `ufcg.edu.br` na lista,
 * `ccc.ufcg.edu.br` não entra — e `naoufcg.edu.br`, que um casamento por sufixo
 * deixaria passar, também não. Subdomínio que deva entrar é escrito na lista.
 *
 * isAllowedSignupDomain(email);
 */
export function isAllowedSignupDomain(email?: string | null) {
  const allowedDomains = parseAllowedSignupDomains();
  const domain = extractEmailDomain(email);

  if (!domain || allowedDomains.size === 0) {
    return false;
  }

  return allowedDomains.has(domain);
}

/**
 * Trilho que o cadastro segue. `allowed` entra assim que confirma o e-mail;
 * `common` precisa da intenção de uso e da aprovação manual do OCA.
 */
export function resolveSignupTier(email?: string | null): SignupTier {
  return isAllowedSignupDomain(email) ? "allowed" : "common";
}
