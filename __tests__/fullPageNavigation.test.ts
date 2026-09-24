import { describe, expect, it } from "vitest";
import { navigateWithFullReload } from "@/utils/fullPageNavigation";

/** Registra os destinos em vez de navegar, como faria o `window.location`. */
class FakeBrowserLocation {
  assignedPaths: string[] = [];

  assign = (path: string) => {
    this.assignedPaths.push(path);
  };
}

describe("navigateWithFullReload", () => {
  it("reloads the whole document so the router cache is discarded", () => {
    const location = new FakeBrowserLocation();

    navigateWithFullReload("/login", location);

    expect(location.assignedPaths).toEqual(["/login"]);
  });
});
