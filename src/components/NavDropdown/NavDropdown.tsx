'use client';

import { Link } from '@/translations/routing';
import { ISection } from '@/utils/interfaces';
import { cn } from '@/lib/utils';
import { ArrowForwardIcon } from '@/components/HomeIcons/HomeIcons';
import { NavUnderline } from '../NavItems/NavUnderline';

export const NavDropdown = ({ item }: { item: ISection }) => {
  const children = item.childrenCollection?.items ?? [];
  // Items like Home point at a real route, so the trigger has to stay
  // navigable. Purely decorative parents ('#') remain plain buttons.
  const href = item.path && item.path !== '#' ? item.path : null;

  const triggerClassName =
    'h-40px flex items-center gap-1.5 border-b-3 border-transparent px-4 py-2 font-medium text-neutral-800 transition duration-300 group-hover:bg-stone-200 group-hover:text-[#5B612A] group-focus-within:text-[#5B612A]';

  const triggerContent = (
    <>
      {item.name}
      <svg
        width="10"
        height="6"
        viewBox="0 0 10 6"
        fill="none"
        className="transition-transform duration-200 group-hover:rotate-180 group-focus-within:rotate-180"
      >
        <path
          d="M1 1L5 5L9 1"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </>
  );

  return (
    <div className="group relative flex flex-col items-center">
      {href ? (
        <Link
          href={href}
          aria-haspopup="true"
          onClick={(event) => event.currentTarget.blur()}
          className={triggerClassName}
        >
          {triggerContent}
        </Link>
      ) : (
        <button
          type="button"
          aria-haspopup="true"
          className={cn(triggerClassName, 'cursor-default')}
        >
          {triggerContent}
        </button>
      )}
      {/* O traço fica aceso enquanto o menu está aberto pelo teclado. */}
      <NavUnderline className="group-focus-within:scale-x-100" />

      {/*
        Static, untransformed hit-area: always full size and flush against the
        button (no gap), so the mouse path from the button into the menu never
        crosses a dead zone. It only accepts pointer events once the group is
        already hovered/focused - otherwise it's inert and can't intercept
        hover/clicks meant for whatever page content sits underneath it.

        O menu sai alinhado à esquerda do botão e pendurado logo abaixo da
        linha verde da barra (o pt-3 cobre a distância do botão até ela).
        Centralizado, ele era mais largo que o botão e vazava para a esquerda.
      */}
      <div className="pointer-events-none absolute top-full left-0 z-50 pt-3 group-hover:pointer-events-auto group-focus-within:pointer-events-auto">
        <div
          className={cn(
            'flex w-max min-w-60 flex-col overflow-hidden rounded-b-lg border border-t-0 border-[#E4E5E2] bg-white py-1.5 shadow-[0_16px_32px_rgba(33,36,15,0.14)]',
            'origin-top -translate-y-1 scale-y-95 opacity-0 transition-[opacity,translate,scale] duration-200 ease-out',
            'group-hover:translate-y-0 group-hover:scale-y-100 group-hover:opacity-100',
            'group-focus-within:translate-y-0 group-focus-within:scale-y-100 group-focus-within:opacity-100',
          )}
        >
          {children.map((child, index) => (
            // Os itens entram em cascata ao abrir; no hover ganham a barra
            // verde à esquerda e a seta, como as linhas de "Novidades".
            <Link
              key={child.id}
              href={child.path || '#'}
              onClick={(event) => event.currentTarget.blur()}
              style={{ transitionDelay: `${60 + index * 40}ms` }}
              className="group/item relative flex items-center justify-between gap-6 px-4 py-2.5 text-sm font-medium text-neutral-800 opacity-0 transition-[opacity,translate,background-color,color] duration-300 hover:bg-[#F6F7F6] hover:text-[#4F5424] hover:delay-0! group-hover:opacity-100 group-focus-within:opacity-100 motion-safe:-translate-x-2 motion-safe:group-hover:translate-x-0 motion-safe:group-focus-within:translate-x-0"
            >
              <span
                aria-hidden
                className="absolute inset-y-1 left-0 w-[3px] origin-center scale-y-0 rounded-r-full bg-[#5B612A] transition-[scale] duration-200 group-hover/item:scale-y-100"
              />
              <span className="transition-[translate] duration-200 motion-safe:group-hover/item:translate-x-1">
                {child.name}
              </span>
              <ArrowForwardIcon
                size={14}
                className="text-[#646B2D] opacity-0 transition-[opacity,translate] duration-200 group-hover/item:opacity-100 motion-safe:-translate-x-1 motion-safe:group-hover/item:translate-x-0"
              />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};
