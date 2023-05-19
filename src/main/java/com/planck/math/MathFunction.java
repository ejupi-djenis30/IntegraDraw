package com.planck.math;

import org.matheclipse.core.interfaces.IExpr;

import java.util.ArrayList;

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
            for(double i = lower; i < higher; i += step) {
                Double y = DefaultMathParser.getInstance().calculateFunction(function,i,variable);
                values.add(y);
            }
        return values;
    }

    public ArrayList<Rectangle> getRectangles(double lowerInterval, double higherInterval, int numberOfRectangles) {
        ArrayList<Rectangle> rectangles = new ArrayList<Rectangle>();
        double mediumWidth = (higherInterval - lowerInterval) / numberOfRectangles;
            for(int i = 0; i <= numberOfRectangles; i++) {
                double x = (i * mediumWidth) + lowerInterval;
                double y = DefaultMathParser.getInstance().calculateFunction(function,x, variable);
                rectangles.add(new Rectangle(x - (mediumWidth / 2), y,mediumWidth));
            }

        return rectangles;
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
        System.out.println(higherIntegralValue);
        System.out.println(lowIntervalValue);
        return higherIntegralValue - lowIntervalValue;

    }
}
