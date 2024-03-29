package com.planck.ui;

import com.planck.data.GraphData;
import com.planck.data.ProgramData;
import com.planck.math.DefaultMathParser;
import com.planck.ui.widgets.GraphView;

import javax.swing.*;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import java.awt.event.ComponentAdapter;
import java.awt.event.ComponentEvent;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;

public class MainPanel {
    public JPanel mainPanel;
    private GraphView graphView;
    private JSlider rectSlider;
    private JLabel rectNumLbl;
    private JTextField formulaTxtField;
    private JScrollPane scrollPane;
    private JSpinner lowSpin;
    private JSpinner highSpin;
    private JLabel integralLabl;
    private JLabel derivateLabl;
    private JLabel aRet;
    private JLabel aTrap;
    private JLabel aInt;


    public MainPanel() {

        lowSpin.addChangeListener( e -> {
            int lowVal = Integer.parseInt(String.valueOf(lowSpin.getValue()));
            ProgramData programData = ProgramData.getInstance();
            programData.setLowLimit(lowVal);
            graphView.repaint();

            GraphData graphData = GraphData.getInstance();
            aRet.setText("" + graphData.getRectanglesArea());
            aTrap.setText("" + graphData.getTrapArea());
            aInt.setText("" + graphData.getIntegralArea());
        });

        highSpin.addChangeListener(e -> {
            int highVal = Integer.parseInt(String.valueOf(highSpin.getValue()));
            ProgramData programData = ProgramData.getInstance();
            programData.setHighLimit(highVal);
            graphView.repaint();

            GraphData graphData = GraphData.getInstance();
            aRet.setText("" + graphData.getRectanglesArea());
            aTrap.setText("" + graphData.getTrapArea());
            aInt.setText("" + graphData.getIntegralArea());
        });

        rectSlider.addChangeListener(e -> {
            ProgramData programData = ProgramData.getInstance();
            programData.setRects(rectSlider.getValue());

            rectNumLbl.setText(String.valueOf(programData.getRects()));
            graphView.repaint();

            GraphData graphData = GraphData.getInstance();
            aRet.setText("" + graphData.getRectanglesArea());
            aTrap.setText("" + graphData.getTrapArea());
        });
        formulaTxtField.addKeyListener(new KeyAdapter() {
            @Override
            public void keyReleased(KeyEvent e) {
                ProgramData programData = ProgramData.getInstance();

                programData.setFormula(formulaTxtField.getText());
                integralLabl.setText(programData.getFormula().getIntegral().toString());
                derivateLabl.setText(programData.getFormula().getDerivate().toString());

                graphView.repaint();
            }
        });
        scrollPane.addComponentListener(new ComponentAdapter() {
                                           @Override
                                           public void componentResized(ComponentEvent e) {
                                               graphView.repaint();
                                           }
                                       }
        );
        scrollPane.createHorizontalScrollBar();
        scrollPane.createVerticalScrollBar();
        scrollPane.setWheelScrollingEnabled(true);
    }

    public void createUIComponents() {
        graphView = new GraphView();
        scrollPane = new JScrollPane(graphView);
    }
}
