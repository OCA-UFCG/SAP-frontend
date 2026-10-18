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
          {/* No celular a aba encolhe para o idioma, o login e o menu caberem
              ao lado dela; antes o idioma ficava escondido atrás da logo.
              A aba é uma etiqueta que vem de trás da barra, e o triângulo
              escuro é a dobra dela. No hover a etiqueta desce como se fosse
              puxada e a dobra estica junto até a nova ponta. */}
          <div className="peer/tab absolute flex items-center justify-center top-0 left-0 z-50 h-20.5 bg-[#989F43] w-44 max-sm:w-36 transition-[height,background-color] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] has-[a:hover]:bg-[#777E32] motion-safe:has-[a:hover]:h-22">
            <Link
              href="/"
              className="relative z-10"
            >
              <SedesLogo className="h-12 max-sm:h-10 w-auto overflow-visible" />
            </Link>
          </div>
          <span className="absolute top-[66px] left-[163px] max-sm:left-[131px] z-[45] w-[26px] h-[19px] origin-top transition-[scale] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-safe:peer-has-[a:hover]/tab:scale-y-[1.37] pointer-events-none">
            <Icon
              id="icon-triangle"
              className="block w-full h-full fill-[#21240F] rotate-180"
            />
          </span>
          <div className="hidden xl:flex items-center gap-6">
            <NavItems
              className="flex gap-6"
              content={content}
            ></NavItems>
            <span aria-hidden="true" className="h-8 w-px bg-[#C9C6C0]" />
            <UserAuth />
          </div>

          <div className="flex items-center gap-4 max-sm:gap-2 xl:hidden">
            <UserAuth />
            <MenuModal content={content}></MenuModal>
          </div>
        </div>
      </div>
    </HeaderFrame>
  );
};
