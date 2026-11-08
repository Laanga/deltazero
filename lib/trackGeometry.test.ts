import { describe, expect, it } from "vitest";

import type { TelemetryData } from "./types";
import { decimate, dominance, makeFrame, nearestIndex, smoothPath } from "./trackGeometry";

const tele = (driver: string, time: number[]): TelemetryData => ({
  driver,
  lap_number: 1,
  lap_time: time.at(-1)!,
  compound: null,
  sectors: null,
  channels: {
    distance: time.map((_, i) => i * 5),
    speed: time.map(() => 200),
    rpm: [],
    throttle: [],
    brake: [],
    gear: [],
    drs: [],
    time,
  },
  track: null,
});

describe("makeFrame", () => {
  it("encaja la nube en el lienzo respetando el margen e invierte Y", () => {
    const f = makeFrame([{ x: [0, 100], y: [0, 50] }], 0, 200, 200, 10);
    const a = f.project(0, 0);
    const b = f.project(100, 50);
    expect(a.x).toBeCloseTo(10);
    expect(b.x).toBeCloseTo(190);
    expect(a.y).toBeGreaterThan(b.y); // Y hacia arriba en pista → hacia abajo en SVG
  });
  it("aplica la rotación oficial (90° convierte un trazado horizontal en vertical)", () => {
    const f = makeFrame([{ x: [0, 100], y: [0, 0] }], 90, 200, 200, 10);
    const a = f.project(0, 0);
    const b = f.project(100, 0);
    expect(Math.abs(a.x - b.x)).toBeLessThan(1e-6);
    expect(Math.abs(a.y - b.y)).toBeCloseTo(180);
  });
});

describe("utilidades de trazado", () => {
  it("decimate elimina puntos casi coincidentes", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 0.1, y: 0 },
      { x: 5, y: 0 },
    ];
    expect(decimate(pts, 1)).toHaveLength(2);
  });
  it("nearestIndex", () => {
    expect(
      nearestIndex(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 20, y: 0 },
        ],
        12,
        1,
      ),
    ).toBe(1);
  });
  it("smoothPath produce un path cerrado con curvas", () => {
    const d = smoothPath([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);
    expect(d.startsWith("M0.0,0.0")).toBe(true);
    expect(d).toContain("C");
    expect(d.endsWith("Z")).toBe(true);
  });
});

describe("dominance", () => {
  it("asigna cada minisector al piloto más rápido en él", () => {
    // A es más rápido en la primera mitad, B en la segunda
    const a = tele("AAA", [0, 1, 2, 4, 6]);
    const b = tele("BBB", [0, 2, 4, 5, 6]);
    const dom = dominance([a, b], 2);
    expect(dom.map((d) => d.driver)).toEqual(["AAA", "BBB"]);
  });
  it("vacío con un solo piloto", () => {
    expect(dominance([tele("AAA", [0, 1])])).toEqual([]);
  });
});
