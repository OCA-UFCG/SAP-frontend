import { NavItems } from '../NavItems/NavItems';
import { ISection } from '@/utils/interfaces';
import { cn } from '@/lib/utils';
export const Sidebar = ({
  styles,
  content,
}: {
  styles?: string;
  content: ISection[];
}) => {
  return (
    <div className={cn('h-full w-full flex self-center justify-center', styles)}>
      <NavItems
        className="flex flex-col items-center justify-center gap-y-[24px]"
        content={content}
      ></NavItems>
    </div>
  );
};
