import { SapChannelI } from "../../utils/interfaces"

const ContactSection = ({channels}: SapChannelI) => {
    return (
        <section className="w-full max-w-[1440px] min-h-[303px] bg-white">
            <div className="
              bg-[#E1E2B4]
              h-[117px]
              px-[10px] py-[10px]
              pl-[80px]
              rounded-b-[8px]
              flex items-center">
                <h1
                className="
                    font-['Open_Sans']
                    font-bold
                    text-[48px]
                    leading-[68px]
                    text-[#3F4324]
                "
                >
                    Contatos
                </h1>
            </div>

            <div className="         
                px-[80px]
                flex flex-col
                gap-[36px]
                pt-[36px]">
                    <p className="                
                    font-['Open_Sans']
                    text-[24px]
                    font-normal
                    text-[#292829]">
                        sap.ufcg@gmail.com
                    </p>
                    <div className="flex flex-col gap-[16px]">
                        <p className="
                            font-['Open_Sans']
                            text-[24px]
                            font-semibold
                            text-[#292829]">
                            Nos acompanhe nas redes sociais
                        </p>

                        <div className="flex flex-wrap items-center gap-[44px]">
                             {channels.map(({ href, icon, size }, index) => (
                                            <a target="_blank" href={href} key={index}>
                                              <Icon
                                                id={icon}
                                                size={size}
                                                key={index}
                                                className="text-grey-900"
                                              />
                                            </a>
                                          ))}
                        </div>

                        

                    </div>
            </div>
        </section>
    )
}

export default ContactSection