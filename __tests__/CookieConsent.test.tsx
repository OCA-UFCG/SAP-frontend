import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CookieConsent } from "@/components/CookieConsent/CookieConsent";
import {
  ANALYTICS_CONSENT_KEY,
  clearAnalyticsCookies,
  openCookiePreferences,
} from "@/lib/analytics-consent";

vi.mock("@next/third-parties/google", () => ({
  GoogleAnalytics: ({ gaId }: { gaId: string }) => (
    <div data-testid="google-analytics" data-ga-id={gaId} />
  ),
}));

const GA_ID = "G-TESTE";

const analyticsLoaded = () => screen.queryByTestId("google-analytics");
const notice = () => screen.queryByRole("region", { name: "Cookies" });

describe("CookieConsent", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("asks before loading Analytics and sends nothing until the visitor answers", () => {
    render(<CookieConsent gaId={GA_ID} />);

    expect(notice()).toBeInTheDocument();
    expect(analyticsLoaded()).not.toBeInTheDocument();
  });

  it("loads Analytics once the visitor accepts and remembers the choice", () => {
    render(<CookieConsent gaId={GA_ID} />);

    fireEvent.click(screen.getByRole("button", { name: "Aceitar" }));

    expect(analyticsLoaded()).toHaveAttribute("data-ga-id", GA_ID);
    expect(notice()).not.toBeInTheDocument();
    expect(window.localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe("granted");
  });

  it("never loads Analytics for a visitor who declined, not even on the next visit", () => {
    const { unmount } = render(<CookieConsent gaId={GA_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "Recusar" }));
    unmount();

    render(<CookieConsent gaId={GA_ID} />);

    expect(notice()).not.toBeInTheDocument();
    expect(analyticsLoaded()).not.toBeInTheDocument();
  });

  it("reopens from the footer link so the visitor can change their mind", () => {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, "denied");
    render(<CookieConsent gaId={GA_ID} />);

    act(() => openCookiePreferences());
    fireEvent.click(screen.getByRole("button", { name: "Aceitar" }));

    expect(analyticsLoaded()).toBeInTheDocument();
  });

  // O script do Google já carregado não sai da página: só recarregando.
  it("erases the Analytics cookies and reloads when consent is withdrawn", () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    document.cookie = "_ga=GA1.1.123";
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, "granted");
    render(<CookieConsent gaId={GA_ID} />);

    act(() => openCookiePreferences());
    fireEvent.click(screen.getByRole("button", { name: "Recusar" }));

    expect(document.cookie).not.toContain("_ga");
    expect(reload).toHaveBeenCalled();
    expect(window.localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe("denied");
  });

  it("keeps cookies that are not from Analytics", () => {
    document.cookie = "_ga_ABC=GS1.1";
    document.cookie = "NEXT_LOCALE=pt";

    clearAnalyticsCookies();

    expect(document.cookie).toBe("NEXT_LOCALE=pt");
  });
});
