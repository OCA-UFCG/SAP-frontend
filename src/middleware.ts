import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./translations/routing-config";
import {
  LOGIN_PATH,
  PLATFORM_PATH,
  SESSION_COOKIE_NAME,
} from "./config/accessRoutes";

const handleI18nRouting = createMiddleware(routing);

function platformLocale(pathname: string) {
  return routing.locales.find(
    (locale) =>
      pathname === `/${locale}${PLATFORM_PATH}` ||
      pathname.startsWith(`/${locale}${PLATFORM_PATH}/`),
  );
}

export default function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const locale = platformLocale(pathname);

  // Só quem abre a página vai direto para o login. O prefetch e a navegação do
  // roteador do Next seguem para o layout, como antes: o prefetch feito antes
  // de entrar fica guardado, e um 307 aqui fazia o login voltar para o próprio
  // login depois da senha certa. `Sec-Fetch-Mode` vem do navegador; os
  // cabeçalhos do roteador (`RSC`) o Next tira antes de chamar o middleware.
  if (
    locale &&
    request.headers.get("sec-fetch-mode") === "navigate" &&
    !request.cookies.has(SESSION_COOKIE_NAME)
  ) {
    const loginUrl = new URL(`/${locale}${LOGIN_PATH}`, request.url);
    loginUrl.searchParams.set(
      "redirect",
      `${pathname.slice(locale.length + 1)}${search}`,
    );
    return NextResponse.redirect(loginUrl);
  }

  return handleI18nRouting(request);
}

export const config = {
  matcher: [
    "/((?!api|_next|_vercel|.*\\..*).*)",
    "/",
    "/(pt|en|es)/:path*",
  ],
};
