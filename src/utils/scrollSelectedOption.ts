/**
 * Rola a lista aberta de um dropdown até a opção marcada (`aria-selected`),
 * deixando-a no meio da lista. Sem isso a lista sempre abre no topo, e quem
 * está em julho de 2012 precisa rolar desde janeiro de 2001 para achar onde
 * estava.
 *
 * Mexe só no scroll da própria lista: `scrollIntoView` rolaria também o painel
 * lateral e a página. A lista precisa ser o `offsetParent` das opções (ela é
 * `absolute`), para que o `offsetTop` delas seja medido a partir dela.
 */
export function scrollSelectedOptionIntoView(listbox: HTMLElement | null) {
  const selected = listbox?.querySelector<HTMLElement>(
    '[aria-selected="true"]',
  );
  if (!listbox || !selected) return;

  listbox.scrollTop =
    selected.offsetTop - (listbox.clientHeight - selected.offsetHeight) / 2;
}
