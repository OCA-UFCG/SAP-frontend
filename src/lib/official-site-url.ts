/**
 * O endereço do SEDES que a equipe divulga, sem barra no fim.
 *
 * A produção responde por cinco domínios, e o Google tratava cada um como um
 * site à parte: escolheu o mais antigo para mostrar na busca. O canonical, o
 * robots.txt e o sitemap.xml usam este endereço para dizer qual é o oficial.
 *
 * O beta define `PUBLIC_LINKS_BASE_URL` com o endereço da produção, e a
 * produção define `EMAIL_LINKS_BASE_URL` com o dela mesma. Sem nenhum dos dois
 * (máquina local), não há endereço oficial e nada é anunciado.
 *
 * Mora sozinho porque o middleware roda no Edge e também lê daqui.
 */
export function officialSiteUrl(): string | null {
  const url =
    process.env.PUBLIC_LINKS_BASE_URL || process.env.EMAIL_LINKS_BASE_URL;
  return url ? url.replace(/\/+$/, "") : null;
}
