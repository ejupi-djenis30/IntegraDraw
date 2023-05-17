package com.planck.math;

import org.matheclipse.core.eval.ExprEvaluator;
import org.matheclipse.core.expression.F;
import org.matheclipse.core.interfaces.IExpr;

public class DefaultMathParser {
    private ExprEvaluator util;
    private static DefaultMathParser instance;
    private DefaultMathParser() {
        util = new ExprEvaluator(false, (short) 1);
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


    public IExpr integralFunction(IExpr function, String variable) {
        return util.eval("integrate(" + function.toString() + "," + variable + ")");
    }

    public IExpr derivateFunction(IExpr function, String variable) {
        return util.eval("D(" + function.toString() + "," + variable + ")");
    }

    public double calculateNumericalIntegral(IExpr function,double higherInterval, double lowerInterval, String forVariable) {
        return util.eval("NIntegrate(" + function.toString() + ", {"+ forVariable +", "+ lowerInterval +", "+ higherInterval+"})").evalDouble();
    }

    public double calculateFunction(IExpr function, double variableValue, String variable){
        util.defineVariable(variable, variableValue);
        return util.eval(function).evalDouble();
    }


}
