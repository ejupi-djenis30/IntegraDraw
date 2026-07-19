import { describe, expect, it } from "vitest";

import { compileExpression } from "./expression";
import { analyzeIntegral, createApproximationGeometry, simpsonReference } from "./integration";

describe("numerical integration", () => {
  it("creates exactly N rectangles and trapezoids", () => {
    const geometry = createApproximationGeometry(compileExpression("x^2"), 0, 1, 12);

    expect(geometry.rectangles).toHaveLength(12);
    expect(geometry.trapezoids).toHaveLength(12);
    expect(geometry.rectangles.at(-1)?.right).toBe(1);
  });

  it("keeps signed area", () => {
    const result = analyzeIntegral(compileExpression("-x"), 0, 1, 20);

    expect(result.midpoint).toBeCloseTo(-0.5, 12);
    expect(result.trapezoidal).toBeCloseTo(-0.5, 12);
    expect(result.reference).toBeCloseTo(-0.5, 12);
  });

  it("converges for a quadratic", () => {
    const result = analyzeIntegral(compileExpression("x^2"), 0, 1, 100);

    expect(result.reference).toBeCloseTo(1 / 3, 10);
    expect(result.midpointError).toBeLessThan(0.00001);
    expect(result.trapezoidalError).toBeLessThan(0.00002);
  });

  it("integrates a bell curve over a wide interval", () => {
    const reference = simpsonReference(compileExpression("exp(-x^2)"), -6, 6, 4096);

    expect(reference).toBeCloseTo(Math.sqrt(Math.PI), 7);
  });

  it("rejects reversed intervals", () => {
    expect(() => analyzeIntegral(compileExpression("x"), 1, -1, 10)).toThrow(/lower bound/);
  });
});
