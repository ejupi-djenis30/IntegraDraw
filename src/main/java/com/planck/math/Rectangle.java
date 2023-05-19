package com.planck.math;

public class Rectangle {
    private double x;
    private double height;
    private double width;
    private double area;

    public Rectangle(double x,double height, double width) {
        this.x = x;
        this.height = Math.abs(height);
        this.width = width;
        this.area = this.width * height;
    }

    public double getX() {
        return x;
    }

    public double getHeight() {
        return height;
    }

    public double getWidth() {
        return width;
    }

    public double getArea() {
        return area;
    }
}
