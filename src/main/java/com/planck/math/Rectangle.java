package com.planck.math;

/**
 * A midpoint rectangle. Height and area keep their mathematical sign; the
 * absolute accessors are available when a drawing operation needs a magnitude.
 */
public final class Rectangle {
    private final double x;
    private final double height;
    private final double width;

    public Rectangle(double x, double height, double width) {
        if (!Double.isFinite(x) || !Double.isFinite(height) || !Double.isFinite(width)) {
            throw new IllegalArgumentException("Rectangle values must be finite.");
        }
        if (width <= 0) {
            throw new IllegalArgumentException("Rectangle width must be positive.");
        }
        this.x = x;
        this.height = height;
        this.width = width;
    }

    public double getX() {
        return x;
    }

    public double getHeight() {
        return height;
    }

    public double getAbsoluteHeight() {
        return Math.abs(height);
    }

    public double getWidth() {
        return width;
    }

    public double getArea() {
        return width * height;
    }

    public double getAbsoluteArea() {
        return Math.abs(getArea());
    }
}
