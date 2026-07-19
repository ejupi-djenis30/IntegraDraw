package com.planck;

import com.planck.ui.MainPanel;

import javax.swing.JFrame;
import javax.swing.SwingUtilities;
import javax.swing.UIManager;
import java.awt.Color;
import java.awt.Dimension;

public final class Main {
    private Main() {
    }

    public static void main(String[] args) {
        SwingUtilities.invokeLater(Main::showApplication);
    }

    private static void showApplication() {
        UIManager.put("Panel.background", new Color(244, 241, 234));
        UIManager.put("Label.foreground", new Color(14, 17, 17));
        UIManager.put("Button.focus", new Color(180, 74, 42, 80));

        JFrame window = new JFrame("IntegraDraw — Visual calculus workbench");
        window.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        window.setContentPane(new MainPanel());
        window.setMinimumSize(new Dimension(940, 680));
        window.pack();
        window.setLocationRelativeTo(null);
        window.setVisible(true);
    }
}
