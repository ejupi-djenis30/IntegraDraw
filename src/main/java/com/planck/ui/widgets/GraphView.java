package com.planck.ui.widgets;

import com.planck.data.ProgramData;
import com.planck.math.MathFunction;

import javax.swing.*;
import java.awt.*;
import java.util.ArrayList;

public class GraphView extends JPanel {
    private static final int LIMIT = 250;

    public GraphView() {
        super();

        setBackground(Color.WHITE);
    }

    @Override
    protected void paintComponent(Graphics g) {
        super.paintComponent(g);
        drawAxis(g);

        drawFormula(g);
    }

    private void drawAxis(Graphics g) {
        g.setColor(Color.BLACK);

        // Disegnare gli assi
        g.drawLine(0, 250, 500, 250);
        g.drawLine(250, 0, 250, 500);

        // Disegnare le frecce
        drawArrows(g);
    }

    private void drawArrows(Graphics g) {
        // Disegnare freccia X.
        g.drawLine(500, 250, 490, 240);
        g.drawLine(500, 250, 490, 260);

        // Disegnare freccia Y.
        g.drawLine(250, 0, 260, 10);
        g.drawLine(250, 0, 240, 10);
    }

    private void drawFormula(Graphics g) {

        String formula = ProgramData.getInstance().getFormula();
        if (formula.isEmpty())
            return;

        MathFunction function = new MathFunction(formula, "x");
        System.out.println(function.getValueAt(3));
        ArrayList<Double> values = function.getValuesGivenInterval(-LIMIT,LIMIT,1);
        for (int i = -LIMIT; i < LIMIT; i++) {
            int currentSegment = (values.get((i + LIMIT)).intValue() + LIMIT);
            int nextSegment = (values.get((i + LIMIT + 1) >= LIMIT ? (i + LIMIT) : (i + LIMIT + 1)).intValue() + LIMIT);
            System.out.println(i + " " + currentSegment + " " + nextSegment);
            if(i < 0) {
                g.setColor(Color.BLUE);
                g.drawLine(i + LIMIT, currentSegment, i - 1 + LIMIT, nextSegment);
            } else {
                g.setColor(Color.RED);
                g.drawLine(i + LIMIT, currentSegment, i + 1 + LIMIT, nextSegment);
            }
        }
        /*
        for (int i = 0; i <= LIMIT; i++) {
            int[] segment = getFormulaSegment(i, formula, 1);
            segment[0] += LIMIT;
            segment[1] += LIMIT;

            g.drawLine(i + LIMIT, segment[0], i + 1 + LIMIT, segment[1]);
        }

        g.setColor(Color.RED);
        for (int i = 0; i >= -LIMIT; i--) {
            int[] segment = getFormulaSegment(i, formula, -1);
            segment[0] += LIMIT;
            segment[1] += LIMIT;

            g.drawLine(i + LIMIT, segment[0], i - 1 + LIMIT, segment[1]);
        }


        for (int i = 250; i >= 0; i--) {
            g.setColor(Color.RED);
            drawFormulaSegment(i, formula, g, -1);
        }

        for (int i = 250; i <= LIMIT * 2; i++) {
            g.setColor(Color.BLUE);
            drawFormulaSegment(i, formula, g, 1);
        }*/
/*
        for (int i = -LIMIT; i <= LIMIT * 2; i++) {
            Expression expression = new ExpressionBuilder(formula)
                    .variables("x").build()
                    .setVariable("x", i);

            Expression expression_after = new ExpressionBuilder(formula)
                    .variables("x").build()
                    .setVariable("x", i + LIMIT + 1);

            int result = (int) expression.evaluate();
            int result_after = (int) expression_after.evaluate();

            g.drawLine(i, result, i + 1, result_after);
        }*/
    }

    /*
    private int[] getFormulaSegment(int i, String formula, int inc) {
        Expression expression = new ExpressionBuilder(formula)
                .variables("x").build()
                .setVariable("x", i);

        Expression expression_after = new ExpressionBuilder(formula)
                .variables("x").build()
                .setVariable("x", i + inc);

        int result = (int) expression.evaluate();
        int result_after = (int) expression_after.evaluate();

        return new int[]{result, result_after};
    }
    */
}
