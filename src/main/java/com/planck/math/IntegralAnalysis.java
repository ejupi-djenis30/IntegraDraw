package com.planck.math;

public record IntegralAnalysis(
        double midpoint,
        double trapezoidal,
        double reference,
        double midpointError,
        double trapezoidalError
) {
    public static IntegralAnalysis calculate(MathFunction function, double lower, double higher, int segments) {
        double midpoint = function.midpointIntegral(lower, higher, segments);
        double trapezoidal = function.trapezoidalIntegral(lower, higher, segments);
        double reference = function.referenceIntegral(lower, higher);
        return new IntegralAnalysis(
                midpoint,
                trapezoidal,
                reference,
                Math.abs(midpoint - reference),
                Math.abs(trapezoidal - reference)
        );
    }
}
