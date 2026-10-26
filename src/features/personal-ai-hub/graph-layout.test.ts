import { expect, it } from "vitest";
import { layoutGraph } from "./graph-layout.worker";

it("packs disconnected document pairs into the actual landscape viewport", () => {
  const elements = Array.from({ length: 21 }, (_, index) => [
    { data: { id: "source:" + index } },
    { data: { id: "summary:" + index } },
    {
      data: {
        id: "edge:" + index,
        source: "source:" + index,
        target: "summary:" + index,
      },
    },
  ]).flat();
  const points = Object.values(
    layoutGraph({ elements, viewport: { width: 1600, height: 720 } }),
  );
  const width =
    Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x));
  const height =
    Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y));
  expect(width / height).toBeGreaterThan(1);
  expect(points).toHaveLength(42);
});

it("restores the same graph layout across reading and returning to the canvas", () => {
  const elements = [
    { data: { id: "wiki:a" } },
    { data: { id: "wiki:b" } },
    { data: { id: "e", source: "wiki:a", target: "wiki:b" } },
  ];
  const viewport = { width: 1000, height: 700 };
  const first = layoutGraph({ elements, viewport });
  const second = layoutGraph({ elements, viewport, saved_positions: first });
  expect(first).toEqual(second);
  expect(Number.isFinite(first["wiki:a"].x)).toBe(true);
});
