package com.planck.ui;

import com.planck.data.ProgramData;
import com.planck.ui.widgets.GraphView;

import javax.swing.*;

public class MainPanel {
    public JPanel mainPanel;
    private GraphView graphView;
    private JSlider rectSlider;
    private JLabel rectNumLbl;
    private JTextField formulaTxtField;


    public MainPanel() {
        rectSlider.addChangeListener(e -> {
            ProgramData programData = ProgramData.getInstance();
            programData.setRects(rectSlider.getValue());

            rectNumLbl.setText(String.valueOf(programData.getRects()));
        });
    }

    public void createUIComponents() {
        graphView = new GraphView();
    }
}
