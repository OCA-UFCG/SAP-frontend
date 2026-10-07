/**
 * Navega recarregando o documento inteiro, em vez da troca de tela do router.
 *
 * Existe para o logout: o router do Next guarda no navegador as páginas já
 * visitadas e as pré-carregadas (o link "Plataforma" pré-carrega a página
 * inteira). Depois de sair, um clique em "Plataforma" era atendido desse cache
 * e mostrava a plataforma sem sessão nenhuma. Recarregar descarta esse cache.
 *
 * navigateWithFullReload("/login");
 */
export function navigateWithFullReload(
  path: string,
  target: Pick<Location, "assign"> = window.location,
) {
  target.assign(path);
}
