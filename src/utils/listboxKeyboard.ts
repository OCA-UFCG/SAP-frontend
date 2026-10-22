import type { KeyboardEvent } from "react";

/** As teclas que andam pela lista e para onde cada uma leva, a partir da opção atual. */
const MOVES: Record<string, (current: number, last: number) => number> = {
  ArrowDown: (current, last) => (current < 0 || current === last ? 0 : current + 1),
  ArrowUp: (current, last) => (current <= 0 ? last : current - 1),
  Home: () => 0,
  End: (_, last) => last,
};

/**
 * Move o foco entre as opções (`role="option"`) de uma lista aberta com as
 * setas, Home e End. O leitor de tela anuncia o controle como "lista", e quem
 * usa só o teclado espera andar por ela assim — antes só o Tab passava de uma
 * opção para a outra. Devolve `true` quando a tecla foi usada.
 *
 * @example
 * if (moveOptionFocus(listRef.current, event.key)) event.preventDefault();
 */
export function moveOptionFocus(
  listbox: HTMLElement | null,
  key: string,
): boolean {
  const move = MOVES[key];
  const options = listbox
    ? [...listbox.querySelectorAll<HTMLElement>('[role="option"]')]
    : [];
  if (!move || options.length === 0) return false;

  const current = options.indexOf(document.activeElement as HTMLElement);
  options[move(current, options.length - 1)].focus();
  return true;
}

/**
 * O `onKeyDown` de uma lista cujas opções recebem o foco.
 *
 * @example
 * <div role="listbox" onKeyDown={handleListboxKeyDown}>…</div>
 */
export function handleListboxKeyDown(event: KeyboardEvent<HTMLElement>): void {
  if (moveOptionFocus(event.currentTarget, event.key)) event.preventDefault();
}

/**
 * Seta para baixo no campo de busca abre a lista ou, já aberta, leva o foco à
 * primeira opção; Esc fecha. Devolve `true` quando a tecla foi usada.
 *
 * @example
 * if (handleComboboxInputKey(event.key, listRef.current, isOpen, setIsOpen)) event.preventDefault();
 */
export function handleComboboxInputKey(
  key: string,
  listbox: HTMLElement | null,
  isOpen: boolean,
  setOpen: (open: boolean) => void,
): boolean {
  if (key === "Escape" && isOpen) {
    setOpen(false);
    return true;
  }
  if (key !== "ArrowDown") return false;
  if (isOpen) moveOptionFocus(listbox, "Home");
  else setOpen(true);
  return true;
}

/**
 * O `onKeyDown` da lista de um campo de busca: as setas andam pelas opções e
 * Esc fecha a lista com o foco de volta no campo, onde a pessoa digitava.
 *
 * @example
 * <div role="listbox" onKeyDown={(event) => handleComboboxListKeyDown(event, inputRef.current, close)} />
 */
export function handleComboboxListKeyDown(
  event: KeyboardEvent<HTMLElement>,
  input: HTMLInputElement | null,
  close: () => void,
): void {
  if (event.key === "Escape") {
    event.preventDefault();
    // Focar antes de fechar: um campo que abre a lista ao ganhar foco a
    // reabriria se o fechamento viesse primeiro.
    input?.focus();
    close();
    return;
  }
  handleListboxKeyDown(event);
}
