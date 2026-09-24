import { ISection } from '@/utils/interfaces';
import { NavLink } from '../Navlink/NavLink';
import { NavDropdown } from '../NavDropdown/NavDropdown';

/**
 * O prefetch padrão do Next só traz a rota até a tela de carregamento: o código
 * do mapa e as camadas da plataforma (~520 KB de JS e ~80 KB de dados) só
 * começavam a baixar depois do clique — cerca de 1 s num 4G. O prefetch
 * completo baixa tudo enquanto a pessoa ainda está no site institucional.
 * O servidor aguenta porque sessão e `getPanelLayers` já ficam em memória.
 *
 * <NavLink href={path} prefetch={shouldPrefetchFullRoute(path)} />
 */
export function shouldPrefetchFullRoute(path?: string) {
  return path === '/platform' ? true : undefined;
}

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
            prefetch={shouldPrefetchFullRoute(item.path)}
          ></NavLink>
        ),
      )}
    </div>
  );
};
