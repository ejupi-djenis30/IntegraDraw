package com.planck.math;

import com.planck.data.GraphData;
import org.matheclipse.core.interfaces.IExpr;

import java.util.ArrayList;
import java.util.Stack;

public class MathFunction {
    private IExpr function;
    private IExpr integral;
    private IExpr derivate;
    private String variable;

    public MathFunction(String function, String variable) {
        this.variable = variable;
        this.function = DefaultMathParser.getInstance().parseFunction(function);
        this.integral = DefaultMathParser.getInstance().integralFunction(function,variable);
        this.derivate = DefaultMathParser.getInstance().derivateFunction(function, variable);
    }

    public ArrayList<Double> getValuesGivenInterval(double lower, double higher, double step) {
        ArrayList<Double> values = new ArrayList<Double>();
            for(double i = lower; i <= higher; i += step) {
                Double y = getValueAt(i);
                values.add(y);
            }
        return values;
    }

    public ArrayList<Rectangle> getRectangles(double lowerInterval, double higherInterval, int numberOfRectangles) {
        ArrayList<Rectangle> rectangles = new ArrayList<Rectangle>();
        double mediumWidth = (higherInterval - lowerInterval) / numberOfRectangles;
        double rectArea = 0;
        for (int i = 0; i <= numberOfRectangles; i++) {
            double x = (i * mediumWidth) + lowerInterval;
            double y = getValueAt(x);
            Rectangle rectangle = new Rectangle(x - (mediumWidth / 2), y, mediumWidth);
            rectangles.add(rectangle);
            rectArea += rectangle.getArea();
        }

        GraphData.getInstance().setRectanglesArea(rectArea);
        return rectangles;
    }

    public void getTrapezoids(double lowerInterval, double higherInterval, int numberOfTrapezoids) {
        ArrayList<Trapezoid> trapezoids = new ArrayList<Trapezoid>();
        double stepSize = (higherInterval - lowerInterval) / numberOfTrapezoids;
        double trapArea = 0;

        for (int i = 0; i <= numberOfTrapezoids; i++) {
            double x1 = lowerInterval + (i * stepSize);
            double x2 = lowerInterval + ((i + 1) * stepSize);
            double y1 = getValueAt(x1);
            double y2 = getValueAt(x2);

            Trapezoid trapezoid = new Trapezoid(x1, y1, x2, y2);
            trapezoids.add(trapezoid);
            trapArea += trapezoid.getArea();
        }

        GraphData.getInstance().setTrapArea(trapArea);
    }



    public double getValueAt(double value) {
        return DefaultMathParser.getInstance().calculateFunction(function,value,variable);
    }

    public IExpr getFunction() {
        return function;
    }

    public IExpr getIntegral() {
        return integral;
    }

    public IExpr getDerivate() {
        return derivate;
    }

    public double calculateNumericalIntegral(int higherInterval, int lowerInterval) {
        double higherIntegralValue = DefaultMathParser.getInstance().calculateFunction(integral,higherInterval,variable);
        double lowIntervalValue = DefaultMathParser.getInstance().calculateFunction(integral,lowerInterval,variable);
        return higherIntegralValue - lowIntervalValue;

    }
}
