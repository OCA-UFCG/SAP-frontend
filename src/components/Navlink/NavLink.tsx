'use client';

import { Link, usePathname } from '@/translations/routing';
import { ButtonUi } from '../ButtonUI/ButtonUI';
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
  const newClassName = cn(className, isActive && 'text-[#777E32]');

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
          <ButtonUi
            label={label}
            styles={cn(newClassName, 'focus:border-transparent')}
          ></ButtonUi>
          <NavUnderline active={isActive} />
        </>
      )}
    </Link>
  );
};
