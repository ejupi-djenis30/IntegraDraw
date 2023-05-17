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
        drawPlane(g);
    }

    private void drawPlane(Graphics g) {
        g.setColor(Color.BLACK);

        g.drawLine(0, 250, 500, 250);
        g.drawLine(250, 0, 250, 500);
    }
}
