// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

describe("robots.txt", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps crawlers out of the API and points to the official sitemap", () => {
    vi.stubEnv("EMAIL_LINKS_BASE_URL", "https://sedes.oca.ufcg.edu.br/");

    expect(robots()).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: "/api/" },
      sitemap: "https://sedes.oca.ufcg.edu.br/sitemap.xml",
    });
  });

  it("has no sitemap without an official address", () => {
    vi.stubEnv("EMAIL_LINKS_BASE_URL", "");
    vi.stubEnv("PUBLIC_LINKS_BASE_URL", "");

    expect(robots().sitemap).toBeUndefined();
  });
});

describe("sitemap.xml", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lists the public pages on the official address, in the three languages", () => {
    vi.stubEnv("EMAIL_LINKS_BASE_URL", "https://sedes.oca.ufcg.edu.br");
    vi.stubEnv("PLATFORM_ACCESS_GUARD_ENABLED", "true");

    const entries = sitemap();

    expect(entries.map((entry) => entry.url)).toEqual([
      "https://sedes.oca.ufcg.edu.br/pt",
      "https://sedes.oca.ufcg.edu.br/pt/sobre-o-sedes",
      "https://sedes.oca.ufcg.edu.br/pt/glossary",
      "https://sedes.oca.ufcg.edu.br/pt/acessibilidade",
    ]);
    expect(entries[1].alternates?.languages).toEqual({
      pt: "https://sedes.oca.ufcg.edu.br/pt/sobre-o-sedes",
      en: "https://sedes.oca.ufcg.edu.br/en/sobre-o-sedes",
      es: "https://sedes.oca.ufcg.edu.br/es/sobre-o-sedes",
    });
  });

  it("adds the platform only while it is open", () => {
    vi.stubEnv("EMAIL_LINKS_BASE_URL", "https://sedes.oca.ufcg.edu.br");
    vi.stubEnv("PLATFORM_ACCESS_GUARD_ENABLED", "false");

    expect(sitemap().at(-1)?.url).toBe(
      "https://sedes.oca.ufcg.edu.br/pt/platform",
    );
  });

  it("is empty without an official address", () => {
    vi.stubEnv("EMAIL_LINKS_BASE_URL", "");
    vi.stubEnv("PUBLIC_LINKS_BASE_URL", "");

    expect(sitemap()).toEqual([]);
  });
});
