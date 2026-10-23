"use client";

import {
  ElementType,
  ReactNode,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

const noSubscription = () => () => {};

/** Avisa uma vez quando o elemento entra na tela e para de observar. */
const useOnScreen = <T extends Element>(threshold = 0.15) => {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);
  // Sem o observador (navegador antigo, ambiente de teste), mostra já.
  const noObserver = useSyncExternalStore(
    noSubscription,
    () => typeof IntersectionObserver === "undefined",
    () => false,
  );

  useEffect(() => {
    const element = ref.current;
    if (!element || noObserver) return;
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
  }, [threshold, noObserver]);

  return [ref, shown || noObserver] as const;
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

type CountUpProps = {
  /** Texto do número como vem da tradução, por exemplo "5.570" ou "+20". */
  value: string;
  durationMs?: number;
};

// Ano ("2015") não conta: subir de 0 até ele não diz nada.
const isYear = (digits: string) => /^(19|20)\d{2}$/.test(digits);

/**
 * Se a página só fica interativa depois disto (celular lento, rede fraca), o
 * número já apareceu sozinho pelo `.count-up-pending` do globals.css, e
 * voltar a 0 para contar pareceria um erro.
 */
const LATE_HYDRATION_MS = 1000;

/**
 * Conta de 0 até o valor quando o número entra na tela, mantendo o que vem
 * antes e depois (o "+" de "+20") e o separador de milhar do idioma.
 *
 * O HTML do servidor já traz o valor final, escondido até o JavaScript
 * decidir: se ele chega rápido, conta; se demora, o valor aparece sozinho
 * depois de 1 s. Antes o card mostrava "0" até a página ficar interativa.
 */
export const CountUp = ({ value, durationMs = 1400 }: CountUpProps) => {
  const match = value.match(/^(\D*)([\d.,]+)(.*)$/);
  const digits = match?.[2].replace(/[.,]/g, "") ?? "";
  const target = Number(digits);
  const hydrating = useSyncExternalStore(
    noSubscription,
    () => false,
    () => true,
  );
  // Só na hidratação da página: vindo de outra página do site, sempre conta.
  const [late] = useState(
    () =>
      typeof window !== "undefined" &&
      hydrating &&
      performance.now() > LATE_HYDRATION_MS,
  );
  const animated =
    !!match && digits.length > 0 && !isYear(match[2]) && !hydrating && !late;
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
      <span aria-hidden className={hydrating ? "count-up-pending" : undefined}>
        {shownValue}
      </span>
    </span>
  );
};
