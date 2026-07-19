package com.planck.math;

import org.matheclipse.core.interfaces.IExpr;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

public final class MathFunction {
    private static final Pattern SAFE_EXPRESSION = Pattern.compile("[A-Za-z0-9_+\\-*/^().,\\s]+");
    private static final int MAX_EXPRESSION_LENGTH = 160;
    private static final double MAX_INTERVAL_WIDTH = 10_000.0;

    private final String source;
    private final String variable;
    private final IExpr function;
    private final IExpr integral;
    private final IExpr derivative;

    public MathFunction(String source, String variable) {
        String cleanSource = source == null ? "" : source.trim();
        if (cleanSource.isEmpty()) {
            throw new IllegalArgumentException("Enter a function before calculating.");
        }
        if (cleanSource.length() > MAX_EXPRESSION_LENGTH || !SAFE_EXPRESSION.matcher(cleanSource).matches()) {
            throw new IllegalArgumentException("Use a short mathematical expression with numbers, x, operators and functions.");
        }
        if (variable == null || !variable.matches("[A-Za-z][A-Za-z0-9_]*")) {
            throw new IllegalArgumentException("The variable name is invalid.");
        }

        this.source = cleanSource;
        this.variable = variable;
        DefaultMathParser parser = DefaultMathParser.getInstance();
        try {
            this.function = parser.parseFunction(cleanSource);
            this.integral = parser.integralFunction(cleanSource, variable);
            this.derivative = parser.derivativeFunction(cleanSource, variable);
        } catch (RuntimeException exception) {
            throw new IllegalArgumentException("The formula could not be parsed. Try Sin(x), x^2 or Exp(-x^2).", exception);
        }
    }

    public double valueAt(double value) {
        return DefaultMathParser.getInstance().calculateFunction(function, value, variable);
    }

    public List<Double> getValuesGivenInterval(double lower, double higher, double step) {
        validateInterval(lower, higher);
        if (!Double.isFinite(step) || step <= 0) {
            throw new IllegalArgumentException("The sampling step must be positive.");
        }
        long sampleCount = (long) Math.ceil((higher - lower) / step);
        if (sampleCount > 100_000) {
            throw new IllegalArgumentException("The requested sample contains too many points.");
        }

        List<Double> values = new ArrayList<>((int) sampleCount);
        for (int index = 0; index < sampleCount; index++) {
            values.add(valueAt(lower + index * step));
        }
        return values;
    }

    public List<Rectangle> getRectangles(double lower, double higher, int numberOfRectangles) {
        validateApproximation(lower, higher, numberOfRectangles);
        double width = (higher - lower) / numberOfRectangles;
        List<Rectangle> rectangles = new ArrayList<>(numberOfRectangles);
        for (int index = 0; index < numberOfRectangles; index++) {
            double left = lower + index * width;
            double midpoint = left + width / 2.0;
            rectangles.add(new Rectangle(left, valueAt(midpoint), width));
        }
        return rectangles;
    }

    public double midpointIntegral(double lower, double higher, int segments) {
        return getRectangles(lower, higher, segments).stream()
                .mapToDouble(Rectangle::getArea)
                .sum();
    }

    public double trapezoidalIntegral(double lower, double higher, int segments) {
        validateApproximation(lower, higher, segments);
        double width = (higher - lower) / segments;
        double sum = 0.5 * (valueAt(lower) + valueAt(higher));
        for (int index = 1; index < segments; index++) {
            sum += valueAt(lower + index * width);
        }
        return sum * width;
    }

    public double referenceIntegral(double lower, double higher) {
        validateInterval(lower, higher);
        int slices = 1_024;
        double width = (higher - lower) / slices;
        double sum = valueAt(lower) + valueAt(higher);
        for (int index = 1; index < slices; index++) {
            sum += (index % 2 == 0 ? 2.0 : 4.0) * valueAt(lower + index * width);
        }
        return sum * width / 3.0;
    }

    /** @deprecated Use {@link #referenceIntegral(double, double)} with lower then higher bounds. */
    @Deprecated
    public double calculateNumericalIntegral(int higherInterval, int lowerInterval) {
        return referenceIntegral(lowerInterval, higherInterval);
    }

    public String getSource() {
        return source;
    }

    public IExpr getFunction() {
        return function;
    }

    public IExpr getIntegral() {
        return integral;
    }

    public IExpr getDerivative() {
        return derivative;
    }

    /** @deprecated Use {@link #getDerivative()}. */
    @Deprecated
    public IExpr getDerivate() {
        return derivative;
    }

    private static void validateApproximation(double lower, double higher, int segments) {
        validateInterval(lower, higher);
        if (segments < 1 || segments > 1_000) {
            throw new IllegalArgumentException("Choose between 1 and 1,000 segments.");
        }
    }

    private static void validateInterval(double lower, double higher) {
        if (!Double.isFinite(lower) || !Double.isFinite(higher)) {
            throw new IllegalArgumentException("Interval bounds must be finite.");
        }
        if (lower >= higher) {
            throw new IllegalArgumentException("The lower bound must be smaller than the upper bound.");
        }
        if (higher - lower > MAX_INTERVAL_WIDTH) {
            throw new IllegalArgumentException("Keep the interval width below 10,000.");
        }
    }
}
