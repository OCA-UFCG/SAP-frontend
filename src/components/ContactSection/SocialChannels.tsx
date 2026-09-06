import { SocialChannelsI } from "@/utils/interfaces";
import { Icon } from "../Icon/Icon";

const SocialChannels = ({
  channels,
  size,
  displayName = false,
}: SocialChannelsI) => {
  // Todas as redes estão comentadas em `@/utils/constants` hoje. Devolver o
  // contêiner vazio faria o `gap` do rodapé reservar espaço para nada, jogando
  // os logos para dentro da margem de 80px que o Figma pede.
  if (channels.length === 0) {
    return null;
  }

  return (
    <div
      className={`flex flex-wrap flex-row items-center ${
        displayName ? "gap-[44px]" : "gap-[16px]"
      }`}
    >
      {channels.map(({ href, icon, name }) => (
        <a
          key={`${icon}-${href}`}
          target="_blank"
          rel="noopener noreferrer"
          href={href}
          className="flex items-center gap-3"
        >
          <Icon id={icon} size={size} className="text-grey-900" />
          {displayName && (
            <p className="text-[16px] font-normal text-[#292829]">{name}</p>
          )}
        </a>
      ))}
    </div>
  );
};

export default SocialChannels;
