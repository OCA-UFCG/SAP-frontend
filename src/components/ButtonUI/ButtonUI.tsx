import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  styles: string;
  onClick?: () => void;
}

export const ButtonUi = ({ label, styles, ...props }: ButtonProps) => {
  return (
    <button
      className={cn(
        'h-40px hover:bg-stone-200 hover:rounded focus:hover:rounded-none focus:text-[#777E32] focus:border-[#777E32] border-transparent border-b-3 text-neutral-800 font-medium py-2 px-4',
        styles,
      )}
      {...props}
    >
      {label}
    </button>
  );
};
