package com.planck.ui.widgets;

import com.planck.data.ProgramData;
import net.objecthunter.exp4j.Expression;
import net.objecthunter.exp4j.ExpressionBuilder;

import javax.swing.*;
import java.awt.*;
import java.util.Objects;

public class GraphView extends JPanel {
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
        g.setColor(Color.BLUE);

        String formula = ProgramData.getInstance().getFormula();
        if (formula.isEmpty())
            return;

        for (int i = 0; i < 500; i++) {
            Expression expression = new ExpressionBuilder(formula)
                    .variables("x").build()
                    .setVariable("x", i);
            int result = (int) expression.evaluate();

            g.drawLine(i, result, i, result);
        }
    }
}
