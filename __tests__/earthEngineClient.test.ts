import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  parseGeeCredentials,
  resolveGeeProjectId,
} from "@/infrastructure/earth-engine/client";

const originalProjectId = process.env.GEE_PROJECT_ID;

afterEach(() => {
  if (originalProjectId === undefined) {
    delete process.env.GEE_PROJECT_ID;
  } else {
    process.env.GEE_PROJECT_ID = originalProjectId;
  }
});

describe("Earth Engine client configuration", () => {
  it("accepts the service-account JSON stored in GEE_PRIVATE_KEY", () => {
    const credentials = parseGeeCredentials(
      JSON.stringify({
        client_email: "gee-reader@example.iam.gserviceaccount.com",
        private_key:
          "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n",
        project_id: "service-account-project",
      }),
    );

    expect(credentials.client_email).toBe(
      "gee-reader@example.iam.gserviceaccount.com",
    );
    expect(resolveGeeProjectId(credentials)).toBe("service-account-project");
  });

  it("uses GEE_PROJECT_ID as the explicit consumer-project override", () => {
    process.env.GEE_PROJECT_ID = "runtime-project";

    expect(
      resolveGeeProjectId({
        client_email: "gee-reader@example.iam.gserviceaccount.com",
        private_key:
          "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n",
        project_id: "service-account-project",
      }),
    ).toBe("runtime-project");
  });

  it("rejects incomplete credentials before making a network request", () => {
    expect(() =>
      parseGeeCredentials(
        JSON.stringify({ client_email: "gee-reader@example.com" }),
      ),
    ).toThrow(/client_email and private_key/u);
  });
});
