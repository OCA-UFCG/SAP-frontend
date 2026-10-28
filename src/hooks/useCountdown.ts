"use client";

import { useEffect, useState } from "react";

/**
 * Segundos que faltam de uma espera, descendo de um em um.
 *
 * Com a aba em segundo plano o navegador atrasa o relógio, e a contagem anda
 * mais devagar que o tempo real. Para uma espera que tem de terminar depois da
 * do servidor, atrasar é o lado seguro.
 *
 * const [secondsLeft, startWait] = useCountdown();
 * startWait(90);
 */
export function useCountdown() {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;

    const timer = setTimeout(() => setSecondsLeft((left) => left - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  return [secondsLeft, setSecondsLeft] as const;
}

/** `90` vira `1:30`. */
export function formatCountdown(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
