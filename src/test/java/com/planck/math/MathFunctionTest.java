package com.planck.math;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;

class MathFunctionTest {
    @Test
    void createsExactlyTheRequestedNumberOfRectangles() {
        MathFunction function = new MathFunction("x^2", "x");

        List<Rectangle> rectangles = function.getRectangles(0, 1, 8);

        assertEquals(8, rectangles.size());
        assertEquals(0.125, rectangles.get(0).getWidth(), 1e-12);
        assertEquals(0.0, rectangles.get(0).getX(), 1e-12);
        assertEquals(0.875, rectangles.get(7).getX(), 1e-12);
    }

    @Test
    void midpointAndTrapezoidalRulesConvergeOnQuadraticIntegral() {
        MathFunction function = new MathFunction("x^2", "x");

        double midpoint = function.midpointIntegral(0, 1, 200);
        double trapezoidal = function.trapezoidalIntegral(0, 1, 200);
        double expected = 1.0 / 3.0;

        assertEquals(expected, midpoint, 1e-5);
        assertEquals(expected, trapezoidal, 1e-5);
    }

    @Test
    void referenceIntegralHandlesSmoothFunctions() {
        MathFunction function = new MathFunction("Sin(x)", "x");

        assertEquals(2.0, function.referenceIntegral(0, Math.PI), 1e-8);
    }

    @Test
    void acceptsFunctionsWhoseDomainDoesNotContainZero() {
        MathFunction function = new MathFunction("Log(x)", "x");

        assertEquals(2.0 * Math.log(2.0) - 1.0, function.referenceIntegral(1, 2), 1e-8);
    }

    @Test
    void negativeFunctionsProduceSignedAreas() {
        MathFunction function = new MathFunction("-x", "x");

        assertEquals(-0.5, function.midpointIntegral(0, 1, 20), 1e-12);
        assertTrue(function.getRectangles(0, 1, 2).get(0).getHeight() < 0);
    }

    @Test
    void rejectsInvalidIntervalsAndSegmentCounts() {
        MathFunction function = new MathFunction("x", "x");

        assertThrows(IllegalArgumentException.class, () -> function.getRectangles(1, 1, 10));
        assertThrows(IllegalArgumentException.class, () -> function.getRectangles(1, -1, 10));
        assertThrows(IllegalArgumentException.class, () -> function.getRectangles(0, 1, 0));
    }

    @Test
    void rejectsNonMathematicalInput() {
        assertThrows(IllegalArgumentException.class, () -> new MathFunction("x; quit", "x"));
        assertThrows(IllegalArgumentException.class, () -> new MathFunction("", "x"));
    }
}
