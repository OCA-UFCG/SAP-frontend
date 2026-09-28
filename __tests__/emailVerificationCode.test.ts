import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyVerificationCode,
  extractVerificationCode,
} from "@/lib/email-verification-code";

describe("extractVerificationCode", () => {
  it("takes the one-time code out of the Firebase link", () => {
    expect(
      extractVerificationCode(
        "https://sap-project-123.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=ABC123&apiKey=chave&lang=en",
      ),
    ).toBe("ABC123");
  });

  it("returns null for a link without a code", () => {
    expect(extractVerificationCode("https://sap.example/")).toBeNull();
    expect(extractVerificationCode("não é um link")).toBeNull();
  });
});

describe("applyVerificationCode", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "chave-publica");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("hands the code to Firebase and returns the confirmed address", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ email: "Fulano@UFCG.edu.br", emailVerified: true }),
    );

    await expect(applyVerificationCode("ABC123")).resolves.toBe(
      "fulano@ufcg.edu.br",
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://identitytoolkit.googleapis.com/v1/accounts:update?key=chave-publica",
    );
    expect(JSON.parse(init.body as string)).toEqual({ oobCode: "ABC123" });
  });

  it("returns null when Firebase refuses the code", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { error: { message: "INVALID_OOB_CODE" } },
        { status: 400 },
      ),
    );

    await expect(applyVerificationCode("JA-USADO")).resolves.toBeNull();
  });

  it("never lets the code reach the log when Firebase is unreachable", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fetchMock.mockRejectedValue(new Error("falha de rede com oobCode=SEGREDO"));

    await expect(applyVerificationCode("SEGREDO")).resolves.toBeNull();
    expect(error.mock.calls.flat().join(" ")).not.toContain("SEGREDO");
  });
});
