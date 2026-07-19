package com.planck.math;

import org.matheclipse.core.eval.ExprEvaluator;
import org.matheclipse.core.interfaces.IExpr;

/**
 * Small synchronized adapter around Symja's stateful evaluator.
 */
public final class DefaultMathParser {
    private static final DefaultMathParser INSTANCE = new DefaultMathParser();

    private final ExprEvaluator evaluator = new ExprEvaluator();

    private DefaultMathParser() {
    }

    public static DefaultMathParser getInstance() {
        return INSTANCE;
    }

    public synchronized IExpr parseFunction(String function) {
        return evaluator.parse(function);
    }

    public synchronized IExpr integralFunction(String function, String variable) {
        evaluator.clearVariables();
        return evaluator.eval("Integrate(" + function + "," + variable + ")");
    }

    public synchronized IExpr derivativeFunction(String function, String variable) {
        evaluator.clearVariables();
        return evaluator.eval("D(" + function + "," + variable + ")");
    }

    /** @deprecated Kept for source compatibility with the original prototype. */
    @Deprecated
    public IExpr derivateFunction(String function, String variable) {
        return derivativeFunction(function, variable);
    }

    public synchronized double calculateFunction(IExpr function, double variableValue, String variable) {
        try {
            evaluator.defineVariable(variable, variableValue);
            double result = evaluator.eval(function).evalf();
            if (!Double.isFinite(result)) {
                throw new ArithmeticException("The function is not finite at x = " + variableValue + ".");
            }
            return result;
        } catch (RuntimeException exception) {
            throw new IllegalArgumentException("The function cannot be evaluated at x = " + variableValue + ".", exception);
        } finally {
            evaluator.clearVariables();
        }
    }
}
