package com.planck.math;

import org.matheclipse.core.interfaces.IExpr;

import java.util.ArrayList;

public class MathFunction {
    private IExpr function;
    private String variable;

    public MathFunction(String function, String variable) {
        this.variable = variable;
        this.function = DefaultMathParser.getInstance().parseFunction(function);
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
            for(double i = lowerInterval; i < higherInterval; i += mediumWidth) {
                double y = DefaultMathParser.getInstance().calculateFunction(function,i, variable);
                rectangles.add(new Rectangle(i, y,mediumWidth));
            }

        return rectangles;
    }

    public double getValueAt(double value) {
        return DefaultMathParser.getInstance().calculateFunction(function,value,variable);
    }

    public IExpr getFunction() {
        return function;
    }

    public void setFunction(String function) {
        this.function = DefaultMathParser.getInstance().parseFunction(function);
    }

    public void changeVariable(String variable) {
        this.variable = variable;
    }

    public IExpr getIntegral() {
        return DefaultMathParser.getInstance().integralFunction(this.function, variable);

    }

    public IExpr getDerivate() {
        return DefaultMathParser.getInstance().derivateFunction(this.function, variable);
    }


}
