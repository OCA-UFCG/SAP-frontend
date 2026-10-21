"use client";

import { useEffect, useRef, type RefObject } from "react";

/** O que pode receber foco pelo Tab dentro de um diálogo. */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export interface DialogFocusOptions {
  /** Enquanto `false`, o hook não faz nada (o diálogo está fechado). */
  open?: boolean;
  onClose: () => void;
  /**
   * `true` (padrão) prende o Tab dentro do diálogo, como pede um diálogo modal.
   * Um menu suspenso que não bloqueia a página passa `false`: o Tab sai dele.
   */
  trapFocus?: boolean;
}

/**
 * Os elementos focáveis visíveis do contêiner, na ordem do Tab.
 *
 * @example
 * listFocusableElements(dialog)[0]?.focus();
 */
export function listFocusableElements(container: HTMLElement): HTMLElement[] {
  return [
    ...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ].filter((element) => !element.closest("[inert], [hidden]"));
}

/**
 * Dá a um diálogo o comportamento de teclado que o leitor de tela espera
 * (WCAG 2.1.2 e 2.4.3; LBI, art. 63): ao abrir, o foco entra no diálogo; o
 * Tab e o Shift+Tab circulam só por dentro dele; Esc fecha; ao fechar, o foco
 * volta para o botão que o abriu. Sem isso, quem navega pelo teclado abria o
 * diálogo e continuava andando pela página escondida atrás dele.
 *
 * @example
 * const dialogRef = useRef<HTMLDivElement>(null);
 * useDialogFocus(dialogRef, { open, onClose });
 * return <div ref={dialogRef} role="dialog" aria-modal="true" tabIndex={-1} />;
 */
export function useDialogFocus(
  dialogRef: RefObject<HTMLElement | null>,
  { open = true, onClose, trapFocus = true }: DialogFocusOptions,
): void {
  // Quem chama costuma passar uma função nova a cada render. Guardar a última
  // num ref evita reabrir o efeito — o que jogaria o foco de volta para o
  // primeiro campo a cada tecla digitada.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const dialog = dialogRef.current;
    focusInitialElement(dialog);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key === "Tab" && trapFocus && dialogRef.current) {
        keepTabInside(dialogRef.current, event);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      // O botão que abriu pode ter sumido (o menu fechou junto, por exemplo).
      if (opener?.isConnected && focusWasLeftBehind(dialog)) opener.focus();
    };
  }, [open, trapFocus, dialogRef]);
}

/**
 * Se o foco ficou no diálogo que fechou (ou caiu no `body` porque ele saiu da
 * página). Quando a pessoa fecha um menu clicando num campo fora dele, o foco
 * já está nesse campo, e devolvê-lo ao botão roubaria o que ela acabou de clicar.
 */
function focusWasLeftBehind(dialog: HTMLElement | null): boolean {
  const active = document.activeElement;
  return (
    !active || active === document.body || Boolean(dialog?.contains(active))
  );
}

/**
 * Foca o campo marcado com `data-autofocus` ou, sem ele, o próprio diálogo
 * (que precisa de `tabIndex={-1}`). Começar pelo diálogo, e não pelo botão de
 * fechar, faz o leitor de tela anunciar o título e ler o conteúdo do início.
 */
function focusInitialElement(dialog: HTMLElement | null): void {
  if (!dialog || dialog.contains(document.activeElement)) return;
  const preferred = dialog.querySelector<HTMLElement>("[data-autofocus]");
  const target = preferred ?? (dialog.hasAttribute("tabindex") ? dialog : null);
  (target ?? listFocusableElements(dialog)[0] ?? dialog).focus();
}

/** Leva o Tab do último elemento para o primeiro, e o Shift+Tab do primeiro para o último. */
function keepTabInside(dialog: HTMLElement, event: KeyboardEvent): void {
  const focusable = listFocusableElements(dialog);
  if (focusable.length === 0) {
    event.preventDefault();
    dialog.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  // O próprio diálogo (foco inicial) conta como "antes do primeiro".
  const outside = !dialog.contains(active) || active === dialog;

  if (event.shiftKey && (active === first || outside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || outside)) {
    event.preventDefault();
    first.focus();
  }
}
