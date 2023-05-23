package com.planck.ui;

import com.planck.data.GraphData;
import com.planck.data.ProgramData;
import com.planck.math.MathFunction;
import com.planck.ui.widgets.GraphView;

import javax.swing.*;
import java.awt.event.*;

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
    private JButton drawBtn;
    private JSpinner rectSpin;


    public MainPanel() {

        scrollPane.createHorizontalScrollBar();
        scrollPane.createVerticalScrollBar();
        scrollPane.setWheelScrollingEnabled(true);

        drawBtn.addMouseListener(new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent e) {
                ProgramData programData = ProgramData.getInstance();
                GraphData graphData = GraphData.getInstance();
                String formula = formulaTxtField.getText();
                if(!formula.isEmpty() && !formula.isBlank()) {
                    double limitW = graphView.getWidth() / 40;
                    MathFunction function = new MathFunction(formula, "x");
                    programData.setFormula(function);
                    programData.setIntervalValues(function.getValuesGivenInterval(-limitW, limitW, 1.0));
                    integralLabl.setText(programData.getFormula().getIntegral().toString());
                    derivateLabl.setText(programData.getFormula().getDerivate().toString());
                    int lowVal = Integer.parseInt(String.valueOf(lowSpin.getValue()));
                    int highVal = Integer.parseInt(String.valueOf(highSpin.getValue()));
                    int rects = Integer.parseInt(rectSpin.getValue().toString()) - 1;
                    if(lowVal < highVal) {
                        programData.setRects(rects);
                        programData.setRectangles(function.getRectangles(lowVal,highVal, rects));
                        function.getTrapezoids(lowVal,highVal,rects * 10);
                        aRet.setText(String.valueOf(graphData.getRectanglesArea()));
                        aTrap.setText(String.valueOf(graphData.getTrapArea()));
                        aInt.setText(String.valueOf(function.calculateNumericalIntegral(highVal,lowVal)));
                    }
                }
                graphView.repaint();

            }
        });
    }

    public void createUIComponents() {
        graphView = new GraphView();
        scrollPane = new JScrollPane(graphView);
    }
}
