package com.planck.ui;

import com.planck.data.ProgramData;
import com.planck.ui.widgets.GraphView;

import javax.swing.*;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;

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
        formulaTxtField.addKeyListener(new KeyAdapter() {
            @Override
            public void keyReleased(KeyEvent e) {
                ProgramData programData = ProgramData.getInstance();
                programData.setFormula(formulaTxtField.getText());

                graphView.repaint();
            }
        });
    }

    public void createUIComponents() {
        graphView = new GraphView();
    }
}
