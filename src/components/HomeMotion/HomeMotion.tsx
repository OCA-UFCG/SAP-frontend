"use client";

import {
  CSSProperties,
  ElementType,
  PointerEvent,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** Avisa uma vez quando o elemento entra na tela e para de observar. */
const useOnScreen = <T extends Element>(threshold = 0.15) => {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        observer.disconnect();
      },
      { threshold, rootMargin: "0px 0px -60px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, shown] as const;
};

type RevealProps = {
  as?: ElementType;
  className?: string;
  children: ReactNode;
};

/**
 * Quando o bloco entra na tela, os filhos com `reveal-item` sobem e aparecem,
 * em cascata pela variável `--i` de cada um (globals.css). O próprio bloco não
 * muda de layout: ele só ganha `data-shown`.
 */
export const Reveal = ({
  as: Tag = "div",
  className,
  children,
}: RevealProps) => {
  const [ref, shown] = useOnScreen<HTMLElement>();
  return (
    <Tag ref={ref} className={className} data-shown={shown || undefined}>
      {children}
    </Tag>
  );
};

/** Atalho para o atraso da cascata do `reveal-item`. */
export const revealOrder = (index: number) =>
  ({ "--i": index }) as CSSProperties;

type CountUpProps = {
  /** Texto do número como vem da tradução, por exemplo "5.570" ou "+20". */
  value: string;
  durationMs?: number;
};

// Ano ("2015") não conta: subir de 0 até ele não diz nada.
const isYear = (digits: string) => /^(19|20)\d{2}$/.test(digits);

/**
 * Conta de 0 até o valor quando o número entra na tela, mantendo o que vem
 * antes e depois (o "+" de "+20") e o separador de milhar do idioma.
 */
export const CountUp = ({ value, durationMs = 1400 }: CountUpProps) => {
  const match = value.match(/^(\D*)([\d.,]+)(.*)$/);
  const digits = match?.[2].replace(/[.,]/g, "") ?? "";
  const target = Number(digits);
  const animated = !!match && digits.length > 0 && !isYear(match[2]);
  const separator = match?.[2].match(/\d([.,])\d{3}\b/)?.[1];

  const [ref, shown] = useOnScreen<HTMLSpanElement>(0.6);
  const [current, setCurrent] = useState<number | null>(null);

  useEffect(() => {
    if (!animated || !shown) return;
    if (window.matchMedia(REDUCED_MOTION).matches) return;
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      // Desacelera no fim, para o número "pousar" no valor.
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(step);
      else setCurrent(null);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [animated, shown, target, durationMs]);

  const format = (n: number) => {
    const text = String(n);
    return separator ? text.replace(/\B(?=(\d{3})+(?!\d))/g, separator) : text;
  };

  // Antes de entrar na tela fica em 0, para a contagem não "pular".
  const shownValue =
    animated && (current !== null || !shown)
      ? `${match[1]}${format(current ?? 0)}${match[3]}`
      : value;

  return (
    <span ref={ref} className="tabular-nums">
      <span className="sr-only">{value}</span>
      <span aria-hidden>{shownValue}</span>
    </span>
  );
};

type SpotlightProps = {
  className?: string;
  children: ReactNode;
};

/**
 * Passa a posição do mouse a cada `[data-spotlight]` de dentro, em coordenadas
 * do próprio card, para o brilho do `spotlight-card` (globals.css) seguir o
 * ponteiro — inclusive acendendo a borda dos cards vizinhos.
 */
export const Spotlight = ({ className, children }: SpotlightProps) => {
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    const cards =
      event.currentTarget.querySelectorAll<HTMLElement>("[data-spotlight]");
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      card.style.setProperty("--my", `${event.clientY - rect.top}px`);
    });
  };

  return (
    <div className={className} onPointerMove={onPointerMove}>
      {children}
    </div>
  );
};
