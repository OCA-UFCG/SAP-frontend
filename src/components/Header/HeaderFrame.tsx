'use client';

import type { ReactNode } from 'react';
import { usePathname } from '@/translations/routing';

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

  return (
    <nav
      data-platform={isPlatform || undefined}
      className="group/header sticky top-0 z-50 w-full h-16.5 bg-[#F6F3F0] border-b-2 border-[#777E32]"
    >
      {children}
    </nav>
  );
};
