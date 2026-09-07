import { expect, it } from "vitest";
import {
  GRAPH_MAX_ZOOM,
  graphOverview,
  wheelViewport,
} from "../../src/features/history/graph-navigation";

const initial = { x: -80, y: 25, zoom: 0.6 };
const pointer = { x: 250, y: 140 };
const zoom = (delta: number, mode = 0) =>
  wheelViewport(initial, pointer, delta, mode, 0.005, 2);

it("zooms promptly under the cursor without moving the graph point under it", () => {
  const next = zoom(-120);
  expect(next.zoom / initial.zoom).toBeCloseTo(2 ** 0.6);
  expect((pointer.x - next.x) / next.zoom).toBeCloseTo(
    (pointer.x - initial.x) / initial.zoom,
  );
  expect((pointer.y - next.y) / next.zoom).toBeCloseTo(
    (pointer.y - initial.y) / initial.zoom,
  );
  expect(initial).toEqual({ x: -80, y: 25, zoom: 0.6 });
});

it("reverses wheel direction and keeps fine trackpad movements proportional", () => {
  const next = zoom(-120);
  const back = wheelViewport(next, pointer, 120, 0, 0.005, 2);
  expect(back.zoom).toBeCloseTo(initial.zoom);
  expect(back.x).toBeCloseTo(initial.x);
  expect(back.y).toBeCloseTo(initial.y);
  expect(zoom(-1).zoom).toBeGreaterThan(initial.zoom);
  expect(zoom(-1).zoom / initial.zoom).toBeLessThan(1.01);
});

it("normalizes pixel, line and page wheel deltas", () => {
  expect(zoom(-25, 0)).toEqual(zoom(-1, 1));
  expect(zoom(-500, 0)).toEqual(zoom(-1, 2));
  expect(zoom(0)).toEqual(initial);
});

it("bounds coarse events and clamps scale without disabling either limit", () => {
  expect(zoom(-100000).zoom).toBe(initial.zoom * 2);
  expect(zoom(100000).zoom).toBe(initial.zoom / 2);
  expect(
    wheelViewport({ ...initial, zoom: 1.8 }, pointer, -120, 0, 0.005, 2).zoom,
  ).toBe(2);
  expect(wheelViewport(initial, pointer, 120, 0, 0.5, 2).zoom).toBe(0.5);
});

it("fits the whole graph and adjusts the floor to graph and canvas dimensions", () => {
  const bounds = { x: -100, y: 80, width: 1200, height: 3000 };
  const overview = graphOverview(bounds, 800, 580);
  expect(overview.zoom).toBeLessThan(0.5);
  expect(bounds.x * overview.zoom + overview.x).toBeGreaterThan(0);
  expect(bounds.y * overview.zoom + overview.y).toBeGreaterThan(0);
  expect((bounds.x + bounds.width) * overview.zoom + overview.x).toBeLessThan(
    800,
  );
  expect((bounds.y + bounds.height) * overview.zoom + overview.y).toBeLessThan(
    580,
  );
  expect(graphOverview(bounds, 250, 400).zoom).toBeLessThan(overview.zoom);
  expect(
    graphOverview({ ...bounds, height: 1500 }, 800, 580).zoom,
  ).toBeGreaterThan(overview.zoom);
  expect(
    graphOverview({ ...bounds, width: 200, height: 200 }, 800, 580).zoom,
  ).toBe(1.05);
});

it("stops repeated zoom-out at the fitted overview without shifting it", () => {
  const atMinimum = graphOverview(
    { x: 0, y: 0, width: 500, height: 4000 },
    800,
    580,
  );
  expect(
    wheelViewport(atMinimum, pointer, 10000, 0, atMinimum.zoom, GRAPH_MAX_ZOOM),
  ).toEqual(atMinimum);
});
