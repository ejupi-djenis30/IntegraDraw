import { describe, expect, it } from "vitest";

import { compileExpression, ExpressionError } from "./expression";

describe("compileExpression", () => {
  it("respects precedence and right-associative powers", () => {
    expect(compileExpression("2 + 3 * x^2").evaluate(2)).toBe(14);
    expect(compileExpression("2^3^2").evaluate(0)).toBe(512);
  });

  it("applies unary minus after exponentiation", () => {
    expect(compileExpression("-x^2").evaluate(3)).toBe(-9);
    expect(compileExpression("2^-2").evaluate(0)).toBeCloseTo(0.25);
  });

  it("supports the documented functions and constants", () => {
    expect(compileExpression("sin(pi / 2) + ln(e)").evaluate(0)).toBeCloseTo(2);
    expect(compileExpression("exp(-x^2)").evaluate(2)).toBeCloseTo(Math.exp(-4));
  });

  it("rejects implicit multiplication and unknown names", () => {
    expect(() => compileExpression("2x")).toThrow(ExpressionError);
    expect(() => compileExpression("mystery(x)")).toThrow(/Unknown name/);
  });

  it("rejects non-finite evaluations", () => {
    expect(() => compileExpression("1 / x").evaluate(0)).toThrow(/not finite/);
  });
});
