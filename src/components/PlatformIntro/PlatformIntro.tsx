"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTranslations } from "next-intl";
import { SedesLogo } from "@/components/Header/SedesLogo";
import {
  finishPlatformIntro,
  hasSeenPlatformIntro,
  startPlatformIntro,
} from "./platformIntroState";
import "./platformIntro.css";

/** Duração da animação em `platformIntro.css`, para navegadores sem `getAnimations`. */
const INTRO_DURATION_MS = 1800;

/**
 * Abertura curta da plataforma: o brasão do SEDES se monta sobre o verde-oliva
 * e a tela some, mostrando a plataforma que carregou por baixo. Toca uma vez
 * por sessão do navegador; clique, toque ou Esc pulam.
 *
 * O layout só a renderiza quando o cookie de "já viu" não veio na requisição.
 *
 * @example
 * {hasSeen ? null : <PlatformIntro />}
 */
export function PlatformIntro() {
  const t = useTranslations("PlatformIntro");
  const [done, setDone] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const claimed = useRef<boolean | null>(null);

  const finish = useCallback(() => {
    setDone(true);
    finishPlatformIntro();
  }, []);

  // Antes da pintura: numa volta à plataforma pelo próprio site, o roteador
  // pode reaproveitar um layout pedido antes de a abertura tocar.
  useLayoutEffect(() => {
    // O ref sobrevive à segunda execução do modo estrito, que já veria o cookie.
    claimed.current ??= !hasSeenPlatformIntro();
    if (!claimed.current) {
      setDone(true);
      return;
    }
    startPlatformIntro();
    return finishPlatformIntro;
  }, []);

  useEffect(() => {
    if (done) return;

    let cancelled = false;
    const end = () => {
      if (!cancelled) finish();
    };

    // Se a página demorou a ficar interativa, a animação pode já ter acabado:
    // `finished` de uma animação encerrada resolve na hora.
    const animations = rootRef.current?.getAnimations?.() ?? [];
    let timer: number | undefined;
    if (animations.length > 0) {
      Promise.all(animations.map((animation) => animation.finished)).then(
        end,
        end,
      );
    } else {
      timer = window.setTimeout(end, INTRO_DURATION_MS);
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") end();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [done, finish]);

  if (done) return null;

  return (
    // Decorativa: o leitor de tela segue direto para a plataforma.
    <div
      ref={rootRef}
      className="platform-intro"
      aria-hidden="true"
      onClick={finish}
    >
      <div className="platform-intro-center">
        <SedesLogo className="platform-intro-logo" />
        <p className="platform-intro-tagline">{t("tagline")}</p>
      </div>
    </div>
  );
}

export default PlatformIntro;
