"use client";

import { flushSync } from "react-dom";

// Troca entre Monitoramento, Comunicação e Priorização.
//
// A tela antiga não some antes da troca. O navegador tira uma foto dela (View
// Transitions), a seção troca por baixo e a foto afunda enquanto os blocos da
// tela nova pousam. Montar o formulário da Priorização ou a prévia do relatório
// leva centenas de milissegundos: com a foto por cima, esse tempo não vira
// tela vazia.
//
// Quem pousa é marcado com `data-stage` (`panel`, `form` ou `main`), e os
// controles do mapa que entram um por um, com `data-stage-pop`. O CSS da foto
// fica em globals.css, junto do resto do movimento da plataforma.

const OLIVE = "152, 159, 67";

// Cada bloco desce como um cartão erguido, assenta e solta um anel oliva.
const LAND: Keyframe[] = [
  {
    offset: 0,
    opacity: 0,
    transform: "translateY(28px) scale(0.96)",
    boxShadow: `0 40px 70px -20px rgba(30,35,10,0.45), 0 0 0 0 rgba(${OLIVE},0)`,
  },
  {
    offset: 0.55,
    opacity: 1,
    transform: "translateY(-3px) scale(1.004)",
    boxShadow: `0 28px 50px -18px rgba(30,35,10,0.35), 0 0 0 0 rgba(${OLIVE},0.6)`,
  },
  {
    offset: 0.75,
    transform: "none",
    boxShadow: `0 6px 14px -8px rgba(30,35,10,0.2), 0 0 0 6px rgba(${OLIVE},0.28)`,
  },
  {
    offset: 1,
    opacity: 1,
    transform: "none",
    boxShadow: `0 0 0 0 rgba(30,35,10,0), 0 0 0 12px rgba(${OLIVE},0)`,
  },
];

const POP: Keyframe[] = [
  { opacity: 0, transform: "translateY(14px) scale(0.9)" },
  { opacity: 1, transform: "none" },
];

const RING: Keyframe[] = [
  { boxShadow: `0 0 0 0 rgba(${OLIVE},0.55)` },
  { boxShadow: `0 0 0 12px rgba(${OLIVE},0)` },
];

// Mesma duração e curva da transição de CSS que encolhe a moldura do mapa.
const MORPH_MS = 560;
const MORPH_EASING = "cubic-bezier(0.65, 0, 0.35, 1)";

// Em Priorização a moldura do mapa começa depois da trilha (132px) e do
// formulário (531px), com o respiro de 24px da área (PlatformMap).
const ANALYSIS_FRAME_INSET = "inset(24px 24px 24px 687px round 12px)";

/** Entre Monitoramento e Priorização o mapa é o mesmo e só muda de moldura. */
function isMapMorph(from: string, to: string) {
  const pair = new Set([from, to]);
  return pair.has("monitoring") && pair.has("analysis");
}

function canAnimate(el: Element) {
  return typeof el.animate === "function";
}

function landStage(morph: boolean) {
  document.querySelectorAll<HTMLElement>("[data-stage]").forEach((el) => {
    if (!canAnimate(el)) return;
    // O mapa que muda de moldura não pousa: ele encolhe ou cresce no lugar.
    if (morph && el.dataset.stage === "main") return;
    // Na Priorização o painel fecha, e sai de cena pela própria largura.
    if (el.closest('[data-panel-open="false"]')) return;
    el.animate(LAND, {
      duration: 640,
      delay: el.dataset.stage === "main" ? 170 : 60,
      easing: "ease-out",
      fill: "backwards",
    });
  });

  document
    .querySelectorAll<HTMLElement>("[data-stage-pop] > *")
    .forEach((el, index) => {
      if (!canAnimate(el)) return;
      el.animate(POP, {
        duration: 440,
        delay: 420 + index * 80,
        easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        fill: "backwards",
      });
    });
}

function morphMap(to: string) {
  const frame = document.querySelector<HTMLElement>(
    '[data-platform-map-area] > [data-stage="main"]',
  );
  if (!frame || !canAnimate(frame)) return;

  if (to === "monitoring") {
    // Crescer a moldura deixaria uma faixa branca, porque o canvas do MapLibre
    // acompanha o tamanho com atraso. O mapa já nasce do tamanho final e é
    // revelado a partir do cartão.
    frame.animate(
      [
        { clipPath: ANALYSIS_FRAME_INSET },
        { clipPath: "inset(0px 0px 0px 0px round 0px)" },
      ],
      { duration: MORPH_MS, easing: MORPH_EASING },
    );
    return;
  }

  // Encolher é a transição de CSS da área; ao chegar, o cartão solta o anel.
  frame.animate(RING, {
    duration: 700,
    delay: MORPH_MS - 60,
    easing: "ease-out",
  });
}

let transitionId = 0;

/**
 * Troca a seção com a transição da plataforma. `commit` aplica a troca no
 * estado; sem suporte a View Transitions (ou com menos movimento pedido no
 * sistema), ele roda direto, como antes.
 */
export function runSectionTransition(
  from: string,
  to: string,
  commit: () => void,
) {
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (from === to || reduceMotion || !document.startViewTransition) {
    commit();
    return;
  }

  const id = ++transitionId;
  const morph = isMapMorph(from, to);
  const root = document.documentElement;
  // Os nomes da foto só existem durante a troca; `shrink` liga a transição de
  // CSS que encolhe a moldura do mapa até o cartão da Priorização.
  root.dataset.sectionTransition = morph
    ? to === "analysis"
      ? "shrink"
      : "grow"
    : "land";

  const transition = document.startViewTransition(() => {
    flushSync(commit);
    landStage(morph);
    if (morph) morphMap(to);
  });

  // Um clique no meio da troca pula a anterior; isso não é erro.
  transition.ready.catch(() => {});
  transition.finished.finally(() => {
    // A moldura ainda pode estar encolhendo depois que a foto saiu.
    window.setTimeout(() => {
      if (id === transitionId) delete root.dataset.sectionTransition;
    }, MORPH_MS);
  });
}
