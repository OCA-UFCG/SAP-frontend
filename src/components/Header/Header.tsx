import Link from 'next/link';
import { NavItems } from '../NavItems/NavItems';
import { MenuModal } from '../MenuModal/MenuModal';
import { ISection } from '@/utils/interfaces';
import { Icon } from '../Icon/Icon';
import Image from 'next/image';

export const Header = ({ content }: { content: ISection[] }) => {
  return (
    <nav className="sticky top-0 z-50 w-full h-16.5 bg-[#F6F3F0] border-b-2 border-[#777E32]">
      <div className="w-full max-w-360 mx-auto px-4 md:px-10 lg:px-19.5">
        <div className="relative h-16.5 flex items-center justify-end">
          <div className="absolute flex items-center justify-center top-0 left-0 z-11 h-20.5 bg-[#989F43] w-44">
            <Link href="/" className="relative z-10">
              <Image
                alt="SAP Logo"
                src="/logo-sap.png"
                width={128}
                height={72}
                className="h-12 w-auto"
              />
            </Link>
          </div>
        <Icon
          id="icon-triangle"
          className="absolute top-[66px] left-[163px] z-10 w-[26px] h-[19px] fill-[#21240F] rotate-180"
        />
          <div className="hidden xl:block">
            <NavItems
              className="flex gap-6"
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
