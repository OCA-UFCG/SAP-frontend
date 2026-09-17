const MIN_SCROLL_DURATION = 500;
const MAX_SCROLL_DURATION = 1200;
const SCROLL_MS_PER_PIXEL = 0.5;

let cancelRunningScroll: (() => void) | null = null;

export function findScrollableAncestor(element: HTMLElement | null) {
  for (let node = element; node; node = node.parentElement) {
    if (node.scrollHeight <= node.clientHeight) continue;
    const overflowY = getComputedStyle(node).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return node;
  }

  return null;
}

function easeInOutQuint(progress: number) {
  return progress < 0.5 ? 16 * progress ** 5 : 1 - (-2 * progress + 2) ** 5 / 2;
}

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Rolagem suave dentro da caixa do relatório. A âncora nativa e o
 * `scrollIntoView` alinham o alvo em *todos* os ancestrais roláveis, inclusive
 * a janela, o que puxava o rodapé da plataforma para dentro da tela.
 *
 * @example easeScrollTo(findScrollableAncestor(section)!, 0)
 */
export function easeScrollTo(scrollable: HTMLElement, top: number) {
  cancelRunningScroll?.();

  const from = scrollable.scrollTop;
  const distance = top - from;
  if (distance === 0) return;

  if (prefersReducedMotion()) {
    scrollable.scrollTop = top;
    return;
  }

  const duration = Math.min(
    MAX_SCROLL_DURATION,
    Math.max(MIN_SCROLL_DURATION, Math.abs(distance) * SCROLL_MS_PER_PIXEL),
  );

  let frame = 0;
  let startedAt: number | null = null;

  const stop = () => {
    cancelAnimationFrame(frame);
    scrollable.removeEventListener("wheel", stop);
    scrollable.removeEventListener("touchstart", stop);
    cancelRunningScroll = null;
  };

  const step = (now: number) => {
    startedAt ??= now;

    const progress = Math.min(1, (now - startedAt) / duration);
    scrollable.scrollTop = from + distance * easeInOutQuint(progress);

    if (progress < 1) {
      frame = requestAnimationFrame(step);
      return;
    }

    stop();
  };

  cancelRunningScroll = stop;
  scrollable.addEventListener("wheel", stop, { passive: true });
  scrollable.addEventListener("touchstart", stop, { passive: true });
  frame = requestAnimationFrame(step);
}
