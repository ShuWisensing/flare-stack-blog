// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, expect, it } from "vitest";
import { HubCitations } from "./components/hub-citations";

afterEach(cleanup);
it("shows evidence locations with reference numbers and line ranges", () => {
  render(
    createElement(HubCitations, {
      citations: [
        {
          path: "project/readme.md",
          start_line: 10,
          end_line: 18,
          url: "https://example.org/doc",
        },
      ],
    }),
  );
  expect(screen.getByText(/project\/readme.md/).textContent).toContain("10–18");
  expect(screen.getByRole("link").getAttribute("href")).toBe(
    "https://example.org/doc",
  );
});
it("never turns non-HTTP citations into executable links", () => {
  render(
    createElement(HubCitations, {
      citations: [{ url: "javascript:alert(1)" }],
    }),
  );
  expect(screen.queryByRole("link")).toBeNull();
});
