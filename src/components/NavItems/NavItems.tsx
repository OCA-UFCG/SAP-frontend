import { ISection } from '@/utils/interfaces';
import { NavLink } from '../Navlink/NavLink';

export const NavItems = ({
  className,
  content,
}: {
  className: string;
  content: ISection[];
}) => {
  return (
    <div className={className}>
      {content?.map((item) => (
        <NavLink
          key={item.id}
          href={item.path || '#'}
          label={item.name || ''}
          exact={true}
        ></NavLink>
      ))}
    </div>
  );
};
