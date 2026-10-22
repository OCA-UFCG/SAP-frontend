'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from '@/translations/routing';
import { SKIP_TARGETS } from '../SkipLinks/skipTargets';

/**
 * A barra do cabeçalho. Na plataforma ela marca `data-platform`, e o
 * `Header` usa isso para soltar o conteúdo da largura máxima e encolher a aba
 * da logo para a altura da barra.
 *
 * A plataforma ocupa a janela inteira, presa à esquerda. Centralizada em
 * 1440px, a logo andava para a direita a cada zoom out e parava em cima da
 * lista de produtos; e a aba, mais alta que a barra, cobria a lista ao rolar.
 */
export const HeaderFrame = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const isPlatform = pathname.startsWith('/platform');
  const t = useTranslations('Navigation');

  // `id` e `tabIndex` são o alvo do "Ir para o menu" da barra de atalhos.
  return (
    <nav
      id={SKIP_TARGETS.menu.id}
      tabIndex={-1}
      aria-label={t('mainMenu')}
      data-platform={isPlatform || undefined}
      className="group/header focus:outline-none sticky top-0 z-50 w-full h-16.5 bg-[#F6F3F0] border-b-2 border-[#5B612A]"
    >
      {children}
    </nav>
  );
};
