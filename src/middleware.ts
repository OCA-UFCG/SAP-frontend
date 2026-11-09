import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./translations/routing-config";
import {
  APPROVALS_PATH,
  LOGIN_PATH,
  PLATFORM_PATH,
  SESSION_COOKIE_NAME,
  VISITOR_COOKIE_NAME,
} from "./config/accessRoutes";
import { isPlatformOpen } from "./lib/access-flag";

const handleI18nRouting = createMiddleware(routing);
const VISITOR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function platformLocale(pathname: string) {
  return routing.locales.find(
    (locale) =>
      pathname === `/${locale}${PLATFORM_PATH}` ||
      pathname.startsWith(`/${locale}${PLATFORM_PATH}/`),
  );
}

/** Telas só da equipe, que pedem login mesmo com a plataforma aberta. */
function isTeamScreen(platformPath: string, view: string | null) {
  return (
    platformPath.startsWith(APPROVALS_PATH) ||
    view === "logs" ||
    view === "catalog"
  );
}

export default function middleware(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;
  const locale = platformLocale(pathname);
  const platformOpen = isPlatformOpen();
  const needsLogin =
    locale &&
    (!platformOpen ||
      isTeamScreen(
        pathname.slice(locale.length + 1),
        searchParams.get("view"),
      ));

  // Plataforma aberta: só as telas da equipe vão para o login. O navegador
  // ganha um cookie próprio, que só separa os limites de uso de cada pessoa
  // (`getPlatformRequesterKey`).
  if (platformOpen && !needsLogin) {
    const response = handleI18nRouting(request);

    if (locale && !request.cookies.has(VISITOR_COOKIE_NAME)) {
      response.cookies.set(VISITOR_COOKIE_NAME, crypto.randomUUID(), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: VISITOR_COOKIE_MAX_AGE_SECONDS,
      });
    }

    return response;
  }

  // Só quem abre a página vai direto para o login. O prefetch e a navegação do
  // roteador do Next seguem para o layout, como antes: o prefetch feito antes
  // de entrar fica guardado, e um 307 aqui fazia o login voltar para o próprio
  // login depois da senha certa. `Sec-Fetch-Mode` vem do navegador; os
  // cabeçalhos do roteador (`RSC`) o Next tira antes de chamar o middleware.
  if (
    locale &&
    needsLogin &&
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
