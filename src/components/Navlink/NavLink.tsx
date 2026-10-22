'use client';

import { Link, usePathname } from '@/translations/routing';
import { NavUnderline } from '../NavItems/NavUnderline';
import { cn } from '@/lib/utils';

export const NavLink = ({
  href,
  exact = false,
  label = '',
  children,
  className,
  ...props
}: {
  href: string;
  exact?: boolean;
  prefetch?: boolean;
  children?: React.ReactNode;
  className?: string;
  label?: string;
}) => {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);
  // #5B612A e não #777E32: sobre o bege da barra o verde mais claro dava
  // contraste 3,9 e reprovava no mínimo de 4,5 para texto deste tamanho.
  const newClassName = cn(className, isActive && 'text-[#5B612A]');

  // A página atual é marcada pelo NavUnderline, e não pela borda do botão:
  // com as duas, o item atual mostrava dois traços no hover (e o foco do
  // clique deixava a borda acesa num item que não era o atual).
  return (
    <Link
      href={href}
      className={cn('group relative inline-flex', newClassName)}
      {...props}
    >
      {children ? (
        children
      ) : (
        <>
          {/* Um <span>, e não o ButtonUi: botão dentro de link fazia o Tab
              parar duas vezes em cada item e o leitor de tela ler os dois. */}
          <span
            className={cn(
              'h-40px border-b-3 border-transparent px-4 py-2 font-medium text-neutral-800 transition duration-300 hover:bg-stone-200 group-focus-visible:text-[#5B612A]',
              newClassName,
            )}
          >
            {label}
          </span>
          <NavUnderline active={isActive} />
        </>
      )}
    </Link>
  );
};
