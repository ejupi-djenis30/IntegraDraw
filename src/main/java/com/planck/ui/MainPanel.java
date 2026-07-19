package com.planck.ui;

import com.planck.math.IntegralAnalysis;
import com.planck.math.MathFunction;
import com.planck.ui.widgets.GraphView;

import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JComboBox;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JSlider;
import javax.swing.JSpinner;
import javax.swing.JTextField;
import javax.swing.SpinnerNumberModel;
import javax.swing.SwingConstants;
import javax.swing.Timer;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.FlowLayout;
import java.awt.Font;
import java.awt.GridLayout;
import java.text.DecimalFormat;

public final class MainPanel extends JPanel {
    private static final Color INK = new Color(14, 17, 17);
    private static final Color BONE = new Color(244, 241, 234);
    private static final Color PAPER = new Color(252, 250, 245);
    private static final Color OXIDE = new Color(180, 74, 42);
    private static final Color MUTED = new Color(88, 94, 91);
    private static final Color LINE = new Color(14, 17, 17, 34);
    private static final DecimalFormat NUMBER_FORMAT = new DecimalFormat("0.000000");

    private final JTextField formulaField = new JTextField("Sin(x) + x/3", 24);
    private final JSpinner lowerSpinner = new JSpinner(new SpinnerNumberModel(-4.0, -1000.0, 999.5, 0.5));
    private final JSpinner higherSpinner = new JSpinner(new SpinnerNumberModel(4.0, -999.5, 1000.0, 0.5));
    private final JSlider segmentSlider = new JSlider(2, 160, 24);
    private final JLabel segmentValue = new JLabel("24", SwingConstants.RIGHT);
    private final JLabel midpointValue = resultValue();
    private final JLabel trapezoidalValue = resultValue();
    private final JLabel referenceValue = resultValue();
    private final JLabel errorValue = resultValue();
    private final JTextField integralField = readOnlyField();
    private final JTextField derivativeField = readOnlyField();
    private final JLabel statusLabel = new JLabel("Ready.");
    private final GraphView graphView = new GraphView();
    private final Timer inputTimer = new Timer(220, event -> refreshAnalysis());

    public MainPanel() {
        super(new BorderLayout(0, 0));
        setBackground(BONE);
        setPreferredSize(new Dimension(1220, 790));
        setBorder(BorderFactory.createEmptyBorder(0, 0, 0, 0));
        inputTimer.setRepeats(false);

        add(createHeader(), BorderLayout.NORTH);
        add(createWorkspace(), BorderLayout.CENTER);
        configureControls();
        refreshAnalysis();
    }

    private JPanel createHeader() {
        JPanel header = new JPanel(new BorderLayout());
        header.setBackground(INK);
        header.setBorder(BorderFactory.createEmptyBorder(20, 28, 20, 28));

        JLabel brand = new JLabel("ID  /  INTEGRADRAW");
        brand.setForeground(PAPER);
        brand.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 17));
        brand.getAccessibleContext().setAccessibleName("IntegraDraw");

        JLabel subtitle = new JLabel("Visual calculus workbench");
        subtitle.setForeground(new Color(222, 219, 211));
        subtitle.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 13));

        header.add(brand, BorderLayout.WEST);
        header.add(subtitle, BorderLayout.EAST);
        return header;
    }

    private JPanel createWorkspace() {
        JPanel workspace = new JPanel(new BorderLayout(18, 18));
        workspace.setOpaque(false);
        workspace.setBorder(BorderFactory.createEmptyBorder(22, 22, 22, 22));
        workspace.add(createControlPanel(), BorderLayout.WEST);

        JPanel graphCard = new JPanel(new BorderLayout(0, 10));
        graphCard.setBackground(PAPER);
        graphCard.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(LINE),
                BorderFactory.createEmptyBorder(14, 14, 12, 14)
        ));
        graphCard.add(createGraphToolbar(), BorderLayout.NORTH);
        graphCard.add(graphView, BorderLayout.CENTER);
        statusLabel.setForeground(MUTED);
        statusLabel.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 12));
        statusLabel.getAccessibleContext().setAccessibleName("Calculation status");
        graphCard.add(statusLabel, BorderLayout.SOUTH);

        workspace.add(graphCard, BorderLayout.CENTER);
        return workspace;
    }

    private JPanel createControlPanel() {
        JPanel controls = new JPanel();
        controls.setLayout(new BoxLayout(controls, BoxLayout.Y_AXIS));
        controls.setBackground(PAPER);
        controls.setPreferredSize(new Dimension(350, 620));
        controls.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(LINE),
                BorderFactory.createEmptyBorder(22, 22, 22, 22)
        ));

        JLabel eyebrow = new JLabel("CALCULATION");
        eyebrow.setForeground(OXIDE);
        eyebrow.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 11));
        controls.add(eyebrow);
        controls.add(Box.createVerticalStrut(8));

        JLabel title = new JLabel("Shape the approximation.");
        title.setForeground(INK);
        title.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 24));
        controls.add(title);
        controls.add(Box.createVerticalStrut(20));

        JLabel formulaLabel = fieldLabel("Function f(x)", formulaField);
        controls.add(formulaLabel);
        controls.add(Box.createVerticalStrut(6));
        controls.add(formulaField);
        controls.add(Box.createVerticalStrut(14));

        JComboBox<Preset> presets = new JComboBox<>(Preset.values());
        presets.setMaximumSize(new Dimension(Integer.MAX_VALUE, 34));
        presets.setSelectedIndex(0);
        presets.getAccessibleContext().setAccessibleName("Function preset");
        presets.addActionListener(event -> applyPreset((Preset) presets.getSelectedItem()));
        controls.add(fieldLabel("Preset", presets));
        controls.add(Box.createVerticalStrut(6));
        controls.add(presets);
        controls.add(Box.createVerticalStrut(16));

        JPanel bounds = new JPanel(new GridLayout(1, 2, 10, 0));
        bounds.setOpaque(false);
        bounds.add(fieldStack("Lower bound", lowerSpinner));
        bounds.add(fieldStack("Upper bound", higherSpinner));
        controls.add(bounds);
        controls.add(Box.createVerticalStrut(16));

        JPanel segmentHeader = new JPanel(new BorderLayout());
        segmentHeader.setOpaque(false);
        segmentHeader.add(fieldLabel("Segments", segmentSlider), BorderLayout.WEST);
        segmentValue.setForeground(OXIDE);
        segmentValue.setFont(new Font(Font.MONOSPACED, Font.BOLD, 13));
        segmentHeader.add(segmentValue, BorderLayout.EAST);
        controls.add(segmentHeader);
        controls.add(Box.createVerticalStrut(5));
        controls.add(segmentSlider);
        controls.add(Box.createVerticalStrut(20));

        JPanel results = new JPanel(new GridLayout(2, 2, 8, 8));
        results.setOpaque(false);
        results.add(resultCard("MIDPOINT", midpointValue));
        results.add(resultCard("TRAPEZOIDAL", trapezoidalValue));
        results.add(resultCard("REFERENCE", referenceValue));
        results.add(resultCard("BEST ERROR", errorValue));
        controls.add(results);
        controls.add(Box.createVerticalStrut(18));

        controls.add(fieldLabel("Antiderivative", integralField));
        controls.add(Box.createVerticalStrut(5));
        controls.add(integralField);
        controls.add(Box.createVerticalStrut(10));
        controls.add(fieldLabel("Derivative", derivativeField));
        controls.add(Box.createVerticalStrut(5));
        controls.add(derivativeField);
        controls.add(Box.createVerticalGlue());
        return controls;
    }

    private JPanel createGraphToolbar() {
        JPanel toolbar = new JPanel(new BorderLayout());
        toolbar.setOpaque(false);
        JLabel label = new JLabel("FUNCTION / APPROXIMATION");
        label.setForeground(MUTED);
        label.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 11));
        toolbar.add(label, BorderLayout.WEST);

        JPanel buttons = new JPanel(new FlowLayout(FlowLayout.RIGHT, 6, 0));
        buttons.setOpaque(false);
        buttons.add(toolButton("−", "Zoom out", graphView::zoomOut));
        buttons.add(toolButton("Reset", "Reset graph zoom", graphView::resetZoom));
        buttons.add(toolButton("+", "Zoom in", graphView::zoomIn));
        toolbar.add(buttons, BorderLayout.EAST);
        return toolbar;
    }

    private void configureControls() {
        formulaField.setMaximumSize(new Dimension(Integer.MAX_VALUE, 38));
        formulaField.getAccessibleContext().setAccessibleName("Function formula");
        formulaField.getAccessibleContext().setAccessibleDescription(
                "Enter a function of x, for example Sin(x), x^2 or Exp(-x^2)."
        );

        DocumentListener formulaListener = new DocumentListener() {
            @Override
            public void insertUpdate(DocumentEvent event) {
                scheduleRefresh();
            }

            @Override
            public void removeUpdate(DocumentEvent event) {
                scheduleRefresh();
            }

            @Override
            public void changedUpdate(DocumentEvent event) {
                scheduleRefresh();
            }
        };
        formulaField.getDocument().addDocumentListener(formulaListener);
        formulaField.addActionListener(event -> refreshAnalysis());
        lowerSpinner.addChangeListener(event -> scheduleRefresh());
        higherSpinner.addChangeListener(event -> scheduleRefresh());
        segmentSlider.addChangeListener(event -> {
            segmentValue.setText(Integer.toString(segmentSlider.getValue()));
            scheduleRefresh();
        });

        lowerSpinner.getAccessibleContext().setAccessibleName("Lower interval bound");
        higherSpinner.getAccessibleContext().setAccessibleName("Upper interval bound");
        segmentSlider.getAccessibleContext().setAccessibleName("Approximation segment count");
        segmentSlider.setMajorTickSpacing(40);
        segmentSlider.setMinorTickSpacing(10);
        segmentSlider.setPaintTicks(true);
    }

    private void scheduleRefresh() {
        inputTimer.restart();
    }

    private void refreshAnalysis() {
        inputTimer.stop();
        try {
            double lower = ((Number) lowerSpinner.getValue()).doubleValue();
            double higher = ((Number) higherSpinner.getValue()).doubleValue();
            int segments = segmentSlider.getValue();
            if (lower >= higher) {
                throw new IllegalArgumentException("The lower bound must be smaller than the upper bound.");
            }

            MathFunction function = new MathFunction(formulaField.getText(), "x");
            IntegralAnalysis analysis = IntegralAnalysis.calculate(function, lower, higher, segments);
            midpointValue.setText(NUMBER_FORMAT.format(analysis.midpoint()));
            trapezoidalValue.setText(NUMBER_FORMAT.format(analysis.trapezoidal()));
            referenceValue.setText(NUMBER_FORMAT.format(analysis.reference()));
            errorValue.setText(NUMBER_FORMAT.format(Math.min(
                    analysis.midpointError(), analysis.trapezoidalError()
            )));
            integralField.setText(function.getIntegral().toString());
            derivativeField.setText(function.getDerivative().toString());
            statusLabel.setForeground(MUTED);
            statusLabel.setText("Calculated " + segments + " segments on [" + lower + ", " + higher + "]. Scroll the graph to zoom.");
            graphView.setModel(function, lower, higher, segments);
        } catch (RuntimeException exception) {
            midpointValue.setText("—");
            trapezoidalValue.setText("—");
            referenceValue.setText("—");
            errorValue.setText("—");
            integralField.setText("");
            derivativeField.setText("");
            statusLabel.setForeground(OXIDE);
            statusLabel.setText(exception.getMessage() == null ? "The calculation could not be completed." : exception.getMessage());
            graphView.showMessage("Fix the formula or interval to continue.");
        }
    }

    private void applyPreset(Preset preset) {
        if (preset == null) {
            return;
        }
        formulaField.setText(preset.formula);
        lowerSpinner.setValue(preset.lower);
        higherSpinner.setValue(preset.higher);
        segmentSlider.setValue(preset.segments);
        scheduleRefresh();
    }

    private static JPanel fieldStack(String text, javax.swing.JComponent component) {
        JPanel panel = new JPanel(new BorderLayout(0, 5));
        panel.setOpaque(false);
        panel.add(fieldLabel(text, component), BorderLayout.NORTH);
        panel.add(component, BorderLayout.CENTER);
        return panel;
    }

    private static JLabel fieldLabel(String text, javax.swing.JComponent component) {
        JLabel label = new JLabel(text);
        label.setForeground(MUTED);
        label.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 12));
        label.setLabelFor(component);
        return label;
    }

    private static JPanel resultCard(String labelText, JLabel value) {
        JPanel card = new JPanel(new BorderLayout(0, 4));
        card.setBackground(BONE);
        card.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));
        JLabel label = new JLabel(labelText);
        label.setForeground(MUTED);
        label.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 9));
        card.add(label, BorderLayout.NORTH);
        card.add(value, BorderLayout.CENTER);
        return card;
    }

    private static JLabel resultValue() {
        JLabel label = new JLabel("—");
        label.setForeground(INK);
        label.setFont(new Font(Font.MONOSPACED, Font.BOLD, 13));
        return label;
    }

    private static JTextField readOnlyField() {
        JTextField field = new JTextField();
        field.setEditable(false);
        field.setFocusable(true);
        field.setBackground(BONE);
        field.setForeground(INK);
        field.setMaximumSize(new Dimension(Integer.MAX_VALUE, 34));
        return field;
    }

    private static JButton toolButton(String text, String accessibleName, Runnable action) {
        JButton button = new JButton(text);
        button.setToolTipText(accessibleName);
        button.getAccessibleContext().setAccessibleName(accessibleName);
        button.addActionListener(event -> action.run());
        return button;
    }

    private enum Preset {
        CUSTOM("Custom / current", "Sin(x) + x/3", -4.0, 4.0, 24),
        QUADRATIC("Quadratic bowl", "x^2 - 2", -2.5, 2.5, 18),
        SINE("Sine wave", "Sin(x)", -6.0, 6.0, 28),
        BELL("Bell curve", "Exp(-x^2)", -3.0, 3.0, 32),
        DAMPED("Damped wave", "Sin(3*x)/(1+x^2)", -5.0, 5.0, 42);

        private final String label;
        private final String formula;
        private final double lower;
        private final double higher;
        private final int segments;

        Preset(String label, String formula, double lower, double higher, int segments) {
            this.label = label;
            this.formula = formula;
            this.lower = lower;
            this.higher = higher;
            this.segments = segments;
        }

        @Override
        public String toString() {
            return label;
        }
    }
}
