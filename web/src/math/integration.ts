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
const MAX_REFERENCE_SEGMENTS = 100_000;

function finiteResult(value: number): number {
  if (!Number.isFinite(value)) {
    throw new NumericalRangeError("evaluation", "The integral exceeds the finite numerical range. Try a smaller interval or function scale.");
  }
  return value;
}

export function analyzeIntegral(
  expression: CompiledExpression,
  lower: number,
  upper: number,
  segments: number,
): IntegralResult {
  validateInputs(lower, upper, segments);
  const geometry = createApproximationGeometry(expression, lower, upper, segments);
  const midpoint = finiteResult(geometry.rectangles.reduce(
    (sum, rectangle) => sum + (rectangle.right - rectangle.left) * rectangle.height,
    0,
  ));
  const trapezoidal = finiteResult(geometry.trapezoids.reduce(
    (sum, trapezoid) =>
      sum + (trapezoid.leftHeight / 2 + trapezoid.rightHeight / 2) * (trapezoid.right - trapezoid.left),
    0,
  ));
  const reference = simpsonReference(expression, lower, upper, REFERENCE_SEGMENTS);
  return {
    midpoint,
    trapezoidal,
    reference,
    midpointError: finiteResult(Math.abs(midpoint - reference)),
    trapezoidalError: finiteResult(Math.abs(trapezoidal - reference)),
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
  if (!Number.isInteger(segments) || segments < 2 || segments > MAX_REFERENCE_SEGMENTS || segments % 2 !== 0) {
    throw new NumericalRangeError("segments", "Simpson’s rule needs an even segment count between 2 and 100,000.");
  }
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower >= upper) {
    throw new NumericalRangeError("bounds", "The lower bound must be smaller than the upper bound.");
  }

  const width = (upper - lower) / segments;
  if (!Number.isFinite(width) || width <= 0) {
    throw new NumericalRangeError("bounds", "The interval cannot be represented at this numerical resolution.");
  }
  // Apply quadrature weights before accumulation so finite large integrals do
  // not overflow merely because the unscaled Simpson sum is much larger.
  let sum = expression.evaluate(lower) * (width / 3) + expression.evaluate(upper) * (width / 3);
  for (let index = 1; index < segments; index += 1) {
    sum += expression.evaluate(lower + index * width) * (width * (index % 2 === 0 ? 2 / 3 : 4 / 3));
  }
  return finiteResult(sum);
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
