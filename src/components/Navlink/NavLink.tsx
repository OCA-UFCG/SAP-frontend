'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ButtonUi } from '../ButtonUI/ButtonUI';

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
  children?: React.ReactNode;
  className?: string;
  label?: string;
}) => {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);
  const newClassName = `${className} ${
    isActive
      ? 'text-[#777E32] border-[#777E32] rounded-none hover:border-transparent'
      : ''
  }`;

  return (
    <Link href={href} className={newClassName} {...props}>
      {children ? (
        children
      ) : (
        <ButtonUi label={label} styles={newClassName}></ButtonUi>
      )}
    </Link>
  );
};
