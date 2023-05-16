package com.planck.ui;

import com.planck.ui.widgets.GraphView;

import javax.swing.*;

public class MainPanel {
    public JPanel mainPanel;
    private GraphView graphView;
    private JSlider rectSlider;
    private JLabel rectNumLbl;
    private JTextField formulaTxtField;


    public void createUIComponents() {
        graphView = new GraphView();
    }
}
