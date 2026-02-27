// components/layout/Header.tsx
import Link from 'next/link';
import { NavItems } from '../NavItems/NavItems';
import { MenuModal } from '../MenuModal/MenuModal';
import { ISection } from '@/utils/interfaces';
import { Icon } from '../Icon/Icon';
import Image from 'next/image';

export const Header = ({ content }: { content: ISection[] }) => {
  return (
    <nav className="sticky top-0 z-50 w-full h-16.5 bg-[#F6F3F0]  border-b-2 border-[#777E32]">
      <div className='relative mx-auto max-w-360 h-full'>
        <div className="absolute flex items-center justify-center top-0 left-0 z-1001 h-20.5 bg-[#989F43] w-44">
          <Link href="/" className="relative z-10">
            <Image alt="" src="/logo-sap.png" width={128} height={72} className='h-12 w-auto'/>
          </Link>
        </div>

        <Icon
          id="icon-triangle"
          className="absolute top-[66px] left-[163px] z-1000 w-[26px] h-[19px] fill-[#21240F] rotate-180"
        />
        <div className="w-full flex h-full items-center justify-end pr-4 xl:pr-20">
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
