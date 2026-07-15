import { ISection } from '@/utils/interfaces';
import { NavLink } from '../Navlink/NavLink';
import { NavDropdown } from '../NavDropdown/NavDropdown';

export const NavItems = ({
  className,
  content,
}: {
  className: string;
  content: ISection[];
}) => {
  return (
    <div className={className}>
      {content?.map((item) =>
        item.childrenCollection?.items.length ? (
          <NavDropdown key={item.id} item={item} />
        ) : (
          <NavLink
            key={item.id}
            href={item.path || '#'}
            label={item.name || ''}
            exact={true}
          ></NavLink>
        ),
      )}
    </div>
  );
};
