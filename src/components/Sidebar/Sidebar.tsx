import { NavItems } from '../NavItems/NavItems';
import { ISection } from '@/utils/interfaces';
export const Sidebar = ({
  styles,
  content,
}: {
  styles: string;
  content: ISection[];
}) => {
  return (
    <div className={styles}>
      <NavItems
        className="flex flex-col items-center justify-center gap-y-[24px]"
        content={content}
      ></NavItems>
    </div>
  );
};
