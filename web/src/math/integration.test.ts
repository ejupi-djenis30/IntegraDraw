import { describe, expect, it } from "vitest";

import { compileExpression, NumericalRangeError } from "./expression";
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

  it("keeps large representable integrals finite without overflowing weighted sums", () => {
    const result = analyzeIntegral(compileExpression("10^308"), 0, 0.5, 12);
    for (const value of [result.midpoint, result.trapezoidal, result.reference]) {
      expect(value / 5e307).toBeCloseTo(1, 10);
    }
    expect(Number.isFinite(result.midpointError)).toBe(true);
    expect(Number.isFinite(result.trapezoidalError)).toBe(true);
  });

  it("reports overflow as an evaluation error instead of returning Infinity or NaN", () => {
    expect(() => analyzeIntegral(compileExpression("10^308"), 0, 2, 12))
      .toThrowError(NumericalRangeError);
    expect(() => simpsonReference(compileExpression("10^308"), 0, 2))
      .toThrow(/finite numerical range/);
    try {
      analyzeIntegral(compileExpression("10^308"), 0, 2, 12);
    } catch (error) {
      expect((error as NumericalRangeError).category).toBe("evaluation");
    }
  });

  it("bounds direct reference work and rejects unrepresentable step widths", () => {
    expect(() => simpsonReference(compileExpression("x"), 0, 1, 1e12)).toThrow(/segment count/);
    expect(() => simpsonReference(compileExpression("1"), 0, Number.MIN_VALUE)).toThrow(/resolution/);
  });
});
