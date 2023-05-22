package com.planck.ui.widgets;

import com.planck.data.GraphData;
import com.planck.data.ProgramData;
import com.planck.math.Rectangle;

import javax.swing.*;
import java.awt.*;
import java.util.ArrayList;

public class GraphView extends JPanel {
    final int jump = 20;
    public GraphView() {
        super();
        setBackground(Color.WHITE);
    }

    @Override
     public void paint(Graphics g) {
        super.paint(g);
        drawAxis(g);

        drawNumbersOnLine(g);

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
        ProgramData programData = ProgramData.getInstance();
        GraphData graphData = GraphData.getInstance();

        if(programData.getIntervalValues() != null) {
            int limitW = getWidth() / 2;
            int limitH = getHeight() / 2;
            ArrayList<Double> values = programData.getIntervalValues();
            int i = 0;
            for (Double value : values) {
                int currentSegment = (int) (value * jump);
                int nextSegment = (int) (values.get(i + 1 >= values.size() ? i : i + 1) * jump);
                int nextPoint = ((i + 1) * jump);
                g.drawLine((i * jump), (limitH - currentSegment), nextPoint, limitH - nextSegment);
                i += 1;
            }
            if(programData.getRectangles() != null && programData.getLowLimit() > -limitW && programData.getHighLimit() < limitH) {
                g.setColor(Color.RED);
                ArrayList<Rectangle> rectangles = programData.getRectangles();
                for(Rectangle rectangle: rectangles) {
                    double y = values.get((int) ((limitW/20) + rectangle.getX()));
                    g.drawRect((int) (rectangle.getX() * jump) + limitW, y < -Double.MIN_VALUE? (limitH) : (int) (limitH - (Math.abs(rectangle.getHeight()) * jump)), (int) (rectangle.getWidth() * jump), (int) (Math.abs(rectangle.getHeight()) * jump));
                }
            }

        }

    }

    private void drawNumbersOnLine(Graphics g) {
        final int X_middle = getWidth() / 2;
        final int Y_middle = getHeight() / 2;

        int counter = 1;

        Font numFont = new Font("Courier New", Font.PLAIN, 8);
        Font originalFont = g.getFont();

        g.setFont(numFont);

        counter = -1;
        for (int i = 20; i < X_middle; i += 20) {
            g.drawLine(i, Y_middle - 10, i, Y_middle + 10);
            drawNumber(counter, g, X_middle - i - 7, Y_middle - 20);
            counter--;
        }

        counter = 1;
        for (int i = X_middle + 20; i <= X_middle * 2; i += 20) {
            g.drawLine(i, Y_middle - 10, i, Y_middle + 10);
            drawNumber(counter, g, i - 3, Y_middle - 20);
            counter++;
        }

        counter = 1;
        for (int i = 20; i <= Y_middle; i += 20) {
            g.drawLine(X_middle - 10, i, X_middle + 10, i);

            if (counter > 1 && counter < 125)
                drawNumber(counter, g, X_middle + 23, Y_middle - i);
            counter++;
        }

        counter = - 1;
        for (int i = Y_middle + 20; i <= Y_middle * 2; i += 20) {
            g.drawLine(X_middle - 10, i, X_middle + 10, i);
            if (counter < 125)
                drawNumber(counter, g, X_middle + 23, i);
            counter--;
        }

        g.setFont(originalFont);
    }

    private void drawNumber(int number, Graphics g, int x, int y) {
        g.drawString(String.valueOf(number), x, y);
    }
}
