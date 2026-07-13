'use client';

import { Link } from '@/translations/routing';
import { ISection } from '@/utils/interfaces';
import { cn } from '@/lib/utils';

export const NavDropdown = ({ item }: { item: ISection }) => {
  const children = item.childrenCollection?.items ?? [];

  return (
    <div className="group relative flex flex-col items-center">
      <button
        type="button"
        aria-haspopup="true"
        className="h-40px flex cursor-default items-center gap-1.5 border-b-3 border-transparent px-4 py-2 font-medium text-neutral-800 transition duration-300 group-hover:bg-stone-200 group-hover:text-[#777E32] group-focus-within:border-[#777E32] group-focus-within:text-[#777E32]"
      >
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
      </button>

      {/*
        Static, untransformed hit-area: always full size and flush against the
        button (no gap), so the mouse path from the button into the menu never
        crosses a dead zone. It only accepts pointer events once the group is
        already hovered/focused - otherwise it's inert and can't intercept
        hover/clicks meant for whatever page content sits underneath it.
      */}
      <div className="pointer-events-none absolute top-full left-1/2 z-50 -translate-x-1/2 pt-1 group-hover:pointer-events-auto group-focus-within:pointer-events-auto">
        <div
          className={cn(
            'flex w-max min-w-55 flex-col overflow-hidden rounded-md border border-[#E4E5E2] bg-[#F6F3F0] shadow-lg',
            'origin-top -translate-y-1 scale-95 opacity-0 transition-[opacity,transform] duration-200 ease-out',
            'group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100',
            'group-focus-within:translate-y-0 group-focus-within:scale-100 group-focus-within:opacity-100',
          )}
        >
          {children.map((child) => (
            <Link
              key={child.id}
              href={child.path || '#'}
              onClick={(event) => event.currentTarget.blur()}
              className="px-4 py-2.5 text-sm font-medium text-neutral-800 transition hover:bg-stone-200 hover:text-[#777E32]"
            >
              {child.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};
