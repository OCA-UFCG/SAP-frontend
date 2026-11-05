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

  if (locale && !request.cookies.has(SESSION_COOKIE_NAME)) {
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
