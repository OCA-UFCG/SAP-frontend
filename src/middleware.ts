import createMiddleware from "next-intl/middleware";
import { routing } from "./translations/routing-config";

export default createMiddleware(routing);

export const config = {
  matcher: [
    "/((?!api|_next|_vercel|.*\\..*).*)",
    "/",
    "/(pt|en|es)/:path*",
  ],
};
