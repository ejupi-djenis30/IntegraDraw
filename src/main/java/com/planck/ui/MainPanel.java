package com.planck.ui;

import com.planck.ui.widgets.GraphView;

import javax.swing.*;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import java.beans.PropertyChangeListener;

public class MainPanel {
    public JPanel mainPanel;
    private GraphView graphView;
    private JSlider rectSlider;
    private JLabel rectNumLbl;
    private JTextField formulaTxtField;


    public MainPanel() {
        rectSlider.addChangeListener(e -> {
            rectNumLbl.setText(String.valueOf(rectSlider.getValue()));
        });
    }

    public void createUIComponents() {
        graphView = new GraphView();
    }
}
