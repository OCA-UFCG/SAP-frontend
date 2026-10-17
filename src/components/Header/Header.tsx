import { Link } from '@/translations/routing';
import { NavItems } from '../NavItems/NavItems';
import { MenuModal } from '../MenuModal/MenuModal';
import { ISection } from '@/utils/interfaces';
import { Icon } from '../Icon/Icon';
import { UserAuth } from '../UserAuth/UserAuth';
import { HeaderFrame } from './HeaderFrame';
import { SedesLogo } from './SedesLogo';

export const Header = ({ content }: { content: ISection[] }) => {
  return (
    <HeaderFrame>
      <div className="w-full max-w-360 mx-auto px-4 md:px-10 lg:px-19.5 group-data-[platform]/header:max-w-none">
        <div className="relative h-16.5 flex items-center justify-end">
          <div className="absolute flex items-center justify-center top-0 left-0 z-50 h-20.5 bg-[#989F43] w-44 transition-colors duration-300 has-[a:hover]:bg-[#777E32]">
            <Link
              href="/"
              className="group/logo relative z-10 transition-[scale] duration-300 ease-out motion-safe:hover:scale-105"
            >
              <SedesLogo className="h-12 w-auto overflow-visible" />
            </Link>
          </div>
        <Icon
          id="icon-triangle"
          className="absolute top-[66px] left-[163px] z-[45] w-[26px] h-[19px] fill-[#21240F] rotate-180 pointer-events-none"
        />
          <div className="hidden xl:flex items-center gap-6">
            <NavItems
              className="flex gap-6"
              content={content}
            ></NavItems>
            <span aria-hidden="true" className="h-8 w-px bg-[#C9C6C0]" />
            <UserAuth />
          </div>

          <div className="flex items-center gap-4 xl:hidden">
            <UserAuth />
            <MenuModal content={content}></MenuModal>
          </div>
        </div>
      </div>
    </HeaderFrame>
  );
};
