package com.planck.ui.widgets;

import com.planck.data.GraphData;
import com.planck.data.ProgramData;
import com.planck.math.DefaultMathParser;
import com.planck.math.MathFunction;
import com.planck.math.Rectangle;

import javax.swing.*;
import java.awt.*;
import java.util.ArrayList;

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
        g.drawLine(0, getHeight() / 2, getWidth(), getHeight() / 2);
        g.drawLine(getWidth() / 2, 0, getWidth() / 2, getHeight());

        // Disegnare le frecce
        drawArrows(g);
    }

    private void drawArrows(Graphics g) {
        // Disegnare freccia X.
        g.drawLine(getWidth(), getHeight() / 2, getWidth() - 10, (getHeight() / 2) - 10);
        g.drawLine(getWidth(), getHeight() / 2, getWidth() - 10, (getHeight() / 2) + 10);

        // Disegnare freccia Y.
        g.drawLine(getWidth() / 2, 0, (getWidth() / 2) + 10, 10);
        g.drawLine(getWidth() / 2, 0, (getWidth() / 2) - 10, 10);
    }

    private void drawFormula(Graphics g) {
        g.setColor(Color.BLUE);
        MathFunction function = ProgramData.getInstance().getFormula();
        if (function == null)
            return;

        int limitW = getWidth() / 2;
        int limitH = getHeight() / 2;
        ArrayList<Double> values = function.getValuesGivenInterval(-limitW, limitW, 1);
        int i = 0;
        for (Double value : values) {
            int currentSegment = value.intValue();
            g.drawLine(i, (limitH - currentSegment), i + 1, ((i + 1 >= values.size()) ? limitH - currentSegment : limitH - values.get(i + 1).intValue()) );
            i += 1;
        }

        ProgramData programData = ProgramData.getInstance();
        if(programData.getLowLimit() < programData.getHighLimit()) {
            g.setColor(Color.RED);
            GraphData graphData = GraphData.getInstance();
            if(programData.getRects() != 0) {
                ArrayList<Rectangle> rectangles = function.getRectangles(programData.getLowLimit(), programData.getHighLimit(), programData.getRects());
                double areaTotale = 0;
                for(Rectangle rectangle: rectangles) {
                    int y = values.get((int) (limitW + rectangle.getX())).intValue();
                    g.drawRect((int) rectangle.getX() + limitW, y < -0.1 ? (limitH) : (int) (limitH - rectangle.getHeight()), (int) rectangle.getWidth(), (int) rectangle.getHeight());
                    areaTotale += rectangle.getArea();
                }
                graphData.setRectanglesArea(areaTotale);
            }

            graphData.setIntegralArea(function.calculateNumericalIntegral( programData.getHighLimit(), programData.getLowLimit()));
        }



    }
}
