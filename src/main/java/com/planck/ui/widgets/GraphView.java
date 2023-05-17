package com.planck.ui.widgets;

import javax.swing.*;
import java.awt.*;

public class GraphView extends JPanel {
    public GraphView() {
        super();

        setBackground(Color.WHITE);
    }

    @Override
    protected void paintComponent(Graphics g) {
        super.paintComponent(g);
        drawAxis(g);
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
}
