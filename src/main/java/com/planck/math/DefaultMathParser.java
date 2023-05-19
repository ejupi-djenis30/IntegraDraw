package com.planck.math;

import org.matheclipse.core.eval.ExprEvaluator;
import org.matheclipse.core.expression.F;
import org.matheclipse.core.interfaces.IExpr;

public class DefaultMathParser {
    private ExprEvaluator util;
    private static DefaultMathParser instance;
    private DefaultMathParser() {
        util = new ExprEvaluator();
    }

    public static DefaultMathParser getInstance() {
        if(instance == null) {
            instance = new DefaultMathParser();
        }
        return instance;
    }

    public IExpr parseFunction(String function) {
        return util.parse(function);
    }


    public IExpr integralFunction(String function, String variable) {
        util.clearVariables();
        return util.eval("integrate(" + function + "," + variable + ")");
    }

    public IExpr derivateFunction(String function, String variable) {
        util.clearVariables();
        return util.eval("D(" + function + "," + variable + ")");
    }

    public double calculateFunction(IExpr function, double variableValue, String variable){
        util.defineVariable(variable, variableValue);
        double value = util.eval(function).evalDouble();
        util.clearVariables();
        return value;
    }


}
