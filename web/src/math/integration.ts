import { NumericalRangeError, type CompiledExpression } from "./expression";

export interface IntegralResult {
  readonly midpoint: number;
  readonly trapezoidal: number;
  readonly reference: number;
  readonly midpointError: number;
  readonly trapezoidalError: number;
}

export interface RectangleSlice {
  readonly left: number;
  readonly right: number;
  readonly height: number;
}

export interface TrapezoidSlice {
  readonly left: number;
  readonly right: number;
  readonly leftHeight: number;
  readonly rightHeight: number;
}

export interface ApproximationGeometry {
  readonly rectangles: readonly RectangleSlice[];
  readonly trapezoids: readonly TrapezoidSlice[];
}

export const REFERENCE_SEGMENTS = 8_192;
export const MAX_APPROXIMATION_SEGMENTS = 500;

export function analyzeIntegral(
  expression: CompiledExpression,
  lower: number,
  upper: number,
  segments: number,
): IntegralResult {
  validateInputs(lower, upper, segments);
  const geometry = createApproximationGeometry(expression, lower, upper, segments);
  const midpoint = geometry.rectangles.reduce(
    (sum, rectangle) => sum + (rectangle.right - rectangle.left) * rectangle.height,
    0,
  );
  const trapezoidal = geometry.trapezoids.reduce(
    (sum, trapezoid) =>
      sum + ((trapezoid.leftHeight + trapezoid.rightHeight) / 2) * (trapezoid.right - trapezoid.left),
    0,
  );
  const reference = simpsonReference(expression, lower, upper, REFERENCE_SEGMENTS);
  return {
    midpoint,
    trapezoidal,
    reference,
    midpointError: Math.abs(midpoint - reference),
    trapezoidalError: Math.abs(trapezoidal - reference),
  };
}

export function createApproximationGeometry(
  expression: CompiledExpression,
  lower: number,
  upper: number,
  segments: number,
): ApproximationGeometry {
  validateInputs(lower, upper, segments);
  const width = (upper - lower) / segments;
  const rectangles: RectangleSlice[] = [];
  const trapezoids: TrapezoidSlice[] = [];

  let leftHeight = expression.evaluate(lower);
  for (let index = 0; index < segments; index += 1) {
    const left = lower + index * width;
    const right = index === segments - 1 ? upper : left + width;
    const rightHeight = expression.evaluate(right);
    rectangles.push({ left, right, height: expression.evaluate((left + right) / 2) });
    trapezoids.push({ left, right, leftHeight, rightHeight });
    leftHeight = rightHeight;
  }

  return { rectangles, trapezoids };
}

export function simpsonReference(
  expression: CompiledExpression,
  lower: number,
  upper: number,
  segments = REFERENCE_SEGMENTS,
): number {
  if (!Number.isInteger(segments) || segments < 2 || segments % 2 !== 0) {
    throw new NumericalRangeError("segments", "Simpson’s rule needs a positive, even segment count.");
  }
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower >= upper) {
    throw new NumericalRangeError("bounds", "The lower bound must be smaller than the upper bound.");
  }

  const width = (upper - lower) / segments;
  let sum = expression.evaluate(lower) + expression.evaluate(upper);
  for (let index = 1; index < segments; index += 1) {
    sum += (index % 2 === 0 ? 2 : 4) * expression.evaluate(lower + index * width);
  }
  return (sum * width) / 3;
}

export function validateInputs(lower: number, upper: number, segments: number): void {
  if (!Number.isFinite(lower) || !Number.isFinite(upper)) {
    throw new NumericalRangeError("bounds", "Interval bounds must be finite numbers.");
  }
  if (lower >= upper) {
    throw new NumericalRangeError("bounds", "The lower bound must be smaller than the upper bound.");
  }
  if (upper - lower > 10_000) {
    throw new NumericalRangeError("bounds", "Keep the interval width below 10,000.");
  }
  if (!Number.isInteger(segments) || segments < 1 || segments > MAX_APPROXIMATION_SEGMENTS) {
    throw new NumericalRangeError("segments", "Choose between 1 and 500 segments.");
  }
}
