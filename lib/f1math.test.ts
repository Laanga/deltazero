import { describe, expect, it } from "vitest";

import {
  formatRaceDuration,
  integrateDistance,
  interp,
  lapEndTimes,
  lowerBound,
  parseRaceControl,
  raceProgress,
  toLocalStr,
  toUtcStr,
} from "./f1math";

describe("lowerBound", () => {
  it("devuelve el primer índice >= valor", () => {
    expect(lowerBound([0, 1, 2, 3], 2)).toBe(2);
    expect(lowerBound([0, 1, 2, 3], 1.5)).toBe(2);
    expect(lowerBound([0, 1, 2, 3], -1)).toBe(0);
    expect(lowerBound([0, 1, 2, 3], 99)).toBe(3);
    expect(lowerBound([], 1)).toBe(0);
  });
});

describe("interp", () => {
  it("interpola linealmente y satura en los extremos (como np.interp)", () => {
    expect(interp([-1, 0, 0.5, 1, 2], [0, 1], [10, 20])).toEqual([10, 10, 15, 20, 20]);
  });
  it("no divide por cero con x repetidos", () => {
    expect(interp([1], [0, 1, 1, 2], [0, 5, 7, 9]).every(Number.isFinite)).toBe(true);
  });
});

describe("integrateDistance", () => {
  it("integra 36 km/h constantes durante 10 s → 100 m", () => {
    const t = [0, 5, 10];
    expect(integrateDistance(t, [36, 36, 36]).at(-1)).toBeCloseTo(100);
  });
});

describe("fechas", () => {
  it("toUtcStr", () => {
    expect(toUtcStr("2025-05-25T13:00:00+00:00")).toBe("2025-05-25 13:00:00");
  });
  it("toLocalStr aplica el offset positivo y negativo", () => {
    expect(toLocalStr("2025-05-25T13:00:00+00:00", "02:00:00")).toBe("2025-05-25 15:00:00+02:00");
    expect(toLocalStr("2025-05-25T13:00:00+00:00", "-04:00:00")).toBe("2025-05-25 09:00:00-04:00");
  });
  it("formatRaceDuration", () => {
    expect(formatRaceDuration(5525.123)).toBe("1:32:05.123");
    expect(formatRaceDuration(3481.004)).toBe("58:01.004");
  });
});

const lap = (driver: number, n: number, startSec: number | null, dur: number | null) => ({
  driver_number: driver,
  lap_number: n,
  date_start:
    startSec == null ? null : new Date(Date.UTC(2025, 0, 1, 12) + startSec * 1000).toISOString(),
  lap_duration: dur,
});

describe("lapEndTimes", () => {
  it("usa el inicio de la vuelta siguiente y, en la última, inicio + duración", () => {
    const ends = lapEndTimes([lap(1, 2, 100, 90), lap(1, 1, 0, null)]);
    const base = Date.UTC(2025, 0, 1, 12, 0, 0);
    expect(ends.get(1)!.get(1)).toBe(base + 100_000);
    expect(ends.get(1)!.get(2)).toBe(base + 190_000);
  });
});

describe("raceProgress", () => {
  it("calcula posiciones y gaps por orden de paso por meta", () => {
    const laps = [lap(1, 1, 0, 90), lap(1, 2, 90, 90), lap(44, 1, 0, 91.5), lap(44, 2, 91.5, 90)];
    const acr: Record<number, string> = { 1: "VER", 44: "HAM" };
    const { positions, gaps } = raceProgress(laps, (n) => acr[n]);
    expect(positions).toEqual([
      { lap: 1, positions: { VER: 1, HAM: 2 } },
      { lap: 2, positions: { VER: 1, HAM: 2 } },
    ]);
    expect(gaps[0].gaps).toEqual({ VER: 0, HAM: 1.5 });
    expect(gaps[1].gaps.HAM).toBeCloseTo(1.5);
  });
  it("ignora pilotos sin acrónimo", () => {
    const { positions } = raceProgress([lap(99, 1, 0, 90)], () => undefined);
    expect(positions).toEqual([]);
  });
});

describe("parseRaceControl", () => {
  const msg = (
    lapN: number | null,
    message: string,
    flag: string | null = null,
    sec = lapN ?? 0,
  ) => ({
    date: new Date(Date.UTC(2025, 0, 1, 12, 0, sec)).toISOString(),
    lap_number: lapN,
    flag,
    message,
  });

  it("marca rangos de SC y VSC sin confundirlos", () => {
    const ev = parseRaceControl([
      msg(5, "SAFETY CAR DEPLOYED"),
      msg(7, "SAFETY CAR IN THIS LAP"),
      msg(20, "VIRTUAL SAFETY CAR DEPLOYED"),
      msg(21, "VIRTUAL SAFETY CAR ENDING"),
    ]);
    expect(ev).toEqual([
      { lap: 5, events: ["SC"] },
      { lap: 6, events: ["SC"] },
      { lap: 7, events: ["SC"] },
      { lap: 20, events: ["VSC"] },
      { lap: 21, events: ["VSC"] },
    ]);
  });

  it("bandera roja y periodos sin cierre", () => {
    const ev = parseRaceControl([msg(3, "RED FLAG", "RED"), msg(10, "SAFETY CAR DEPLOYED")]);
    expect(ev).toEqual([
      { lap: 3, events: ["RED"] },
      { lap: 10, events: ["SC"] },
    ]);
  });

  it("ordena por fecha aunque lleguen desordenados", () => {
    const ev = parseRaceControl([msg(7, "SAFETY CAR IN THIS LAP"), msg(5, "SAFETY CAR DEPLOYED")]);
    expect(ev.map((e) => e.lap)).toEqual([5, 6, 7]);
  });
});
