// components/layout/Header.tsx
import Link from 'next/link';
import { Icon } from '../Icon/Icon';
import { NavItems } from '../NavItems/NavItems';
import { MenuModal } from '../MenuModal/MenuModal';
import { ISection } from '@/utils/interfaces';

export const Header = ({ content }: { content: ISection[] }) => {
  return (
    <nav className="fixed top-0 z-50 w-full h-[66px] bg-[#F6F3F0]  border-b-[2px] border-[#777E32]">
      <div className='relative mx-auto max-w-[1440px] h-full'>
        <div className="absolute flex items-center justify-center top-0 left-0 z-1001 h-[82px] bg-[#989F43] w-[176px]">
          <Link href="/" className="relative z-10">
            <Icon id="logo" width={128} height={72} />
          </Link>
        </div>

        <svg
          id="triangle"
          viewBox="0 0 100 100"
          className="absolute top-[66px] left-[163px] z-1000 w-[26px] h-[19px] fill-[#21240F] rotate-180"
        >
          <polygon points="50 15, 100 100, 0 100" />
        </svg>

        <div className="w-full flex h-full items-center justify-end pr-[80px]">
          <div className="hidden xl:block">
            <NavItems
              className="flex gap-x-[24px]"
              content={content}
            ></NavItems>
          </div>

          <div className="block xl:hidden">
            <MenuModal content={content}></MenuModal>
          </div>
        </div>
      </div>
    </nav>
  );
};
