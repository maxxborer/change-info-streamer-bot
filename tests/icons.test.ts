import { describe, expect, it } from "vitest";
import { brandIcon, uiIcon } from "../src/icons";

describe("bundled SVG icons", () => {
  it("keeps the original coordinate system while adding UI classes", () => {
    const copy = uiIcon("copy");
    const youtube = brandIcon("youtube");

    expect(copy).toContain('viewBox="0 0 24 24"');
    expect(youtube).toContain('viewBox="0 0 24 24"');
    expect(copy).toContain('class="icon icon-ui icon-copy"');
    expect(youtube).toContain('class="icon icon-brand icon-youtube"');
  });
});
