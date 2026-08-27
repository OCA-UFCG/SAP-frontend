import { describe, expect, test } from "vitest";
import { getErrorMessage } from "@/utils/getErrorMessage";

describe("getErrorMessage", () => {
  test("formats FastAPI validation errors", () => {
    expect(
      getErrorMessage([
        {
          type: "missing",
          loc: ["body", "analysisLevel"],
          msg: "Field required",
        },
      ]),
    ).toBe("Field required");
  });

  test("formats nested backend errors", () => {
    expect(getErrorMessage({ detail: "Invalid dataset" })).toBe(
      "Invalid dataset",
    );
  });
});
