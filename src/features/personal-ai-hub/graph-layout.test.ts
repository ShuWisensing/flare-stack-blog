import { expect, it } from "vitest";
import { layoutGraph } from "./graph-layout.worker";

it("restores the same graph layout across reading and returning to the canvas", () => {
  const elements = [
    { data: { id: "wiki:a" } },
    { data: { id: "wiki:b" } },
    { data: { id: "e", source: "wiki:a", target: "wiki:b" } },
  ];
  const first = layoutGraph({ elements });
  const second = layoutGraph({ elements, saved_positions: first });
  expect(first).toEqual(second);
  expect(Number.isFinite(first["wiki:a"].x)).toBe(true);
});
