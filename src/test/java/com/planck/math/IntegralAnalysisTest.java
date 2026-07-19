package com.planck.math;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class IntegralAnalysisTest {
    @Test
    void reportsErrorsAgainstTheReferenceValue() {
        IntegralAnalysis analysis = IntegralAnalysis.calculate(new MathFunction("x^2", "x"), 0, 1, 12);

        assertEquals(Math.abs(analysis.midpoint() - analysis.reference()), analysis.midpointError(), 1e-12);
        assertEquals(Math.abs(analysis.trapezoidal() - analysis.reference()), analysis.trapezoidalError(), 1e-12);
        assertTrue(analysis.midpointError() < 0.001);
        assertTrue(analysis.trapezoidalError() < 0.002);
    }
}
