package com.planck.ui.widgets;

import com.planck.math.MathFunction;
import com.planck.math.Rectangle;

import javax.swing.JPanel;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.event.MouseWheelEvent;
import java.awt.geom.Path2D;
import java.text.DecimalFormat;
import java.util.List;

public final class GraphView extends JPanel {
    private static final Color INK = new Color(14, 17, 17);
    private static final Color MUTED = new Color(93, 99, 96);
    private static final Color GRID = new Color(14, 17, 17, 22);
    private static final Color OXIDE = new Color(180, 74, 42);
    private static final Color OXIDE_FILL = new Color(180, 74, 42, 42);
    private static final Color BLUE = new Color(34, 92, 126);
    private static final Color BLUE_FILL = new Color(34, 92, 126, 30);
    private static final Color BONE = new Color(250, 248, 242);
    private static final DecimalFormat AXIS_FORMAT = new DecimalFormat("0.##");

    private MathFunction function;
    private double lower;
    private double higher;
    private int segments;
    private double zoom = 1.0;
    private String emptyMessage = "Enter a valid formula to draw it.";

    public GraphView() {
        setOpaque(true);
        setBackground(BONE);
        setPreferredSize(new Dimension(720, 520));
        setMinimumSize(new Dimension(420, 320));
        setFocusable(true);
        setToolTipText("Use the mouse wheel to zoom. Double-click to reset the view.");
        getAccessibleContext().setAccessibleName("Function graph");
        getAccessibleContext().setAccessibleDescription(
                "Cartesian graph with midpoint rectangles and trapezoidal segments. Use the mouse wheel to zoom."
        );
        addMouseWheelListener(this::handleWheelZoom);
        addMouseListener(new java.awt.event.MouseAdapter() {
            @Override
            public void mouseClicked(java.awt.event.MouseEvent event) {
                if (event.getClickCount() == 2) {
                    resetZoom();
                }
            }
        });
    }

    public void setModel(MathFunction function, double lower, double higher, int segments) {
        this.function = function;
        this.lower = lower;
        this.higher = higher;
        this.segments = segments;
        this.emptyMessage = "";
        repaint();
    }

    public void showMessage(String message) {
        this.function = null;
        this.emptyMessage = message;
        repaint();
    }

    public void zoomIn() {
        setZoom(zoom / 1.25);
    }

    public void zoomOut() {
        setZoom(zoom * 1.25);
    }

    public void resetZoom() {
        setZoom(1.0);
    }

    @Override
    protected void paintComponent(Graphics graphics) {
        super.paintComponent(graphics);
        Graphics2D canvas = (Graphics2D) graphics.create();
        try {
            canvas.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            canvas.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            if (function == null) {
                drawEmptyState(canvas);
                return;
            }
            drawGraph(canvas);
        } catch (RuntimeException exception) {
            drawErrorState(canvas, "This view contains a discontinuity or a value outside the drawable range.");
        } finally {
            canvas.dispose();
        }
    }

    private void drawGraph(Graphics2D canvas) {
        int width = getWidth();
        int height = getHeight();
        int leftPadding = 64;
        int rightPadding = 28;
        int topPadding = 34;
        int bottomPadding = 48;
        int plotWidth = Math.max(1, width - leftPadding - rightPadding);
        int plotHeight = Math.max(1, height - topPadding - bottomPadding);

        double center = (lower + higher) / 2.0;
        double halfSpan = Math.max((higher - lower) * 0.58 * zoom, 0.25);
        double xMin = center - halfSpan;
        double xMax = center + halfSpan;

        SampleRange yRange = findYRange(xMin, xMax, Math.max(240, plotWidth));
        double yMin = yRange.minimum();
        double yMax = yRange.maximum();

        drawGrid(canvas, leftPadding, topPadding, plotWidth, plotHeight, xMin, xMax, yMin, yMax);
        drawTrapezoids(canvas, leftPadding, topPadding, plotWidth, plotHeight, xMin, xMax, yMin, yMax);
        drawRectangles(canvas, leftPadding, topPadding, plotWidth, plotHeight, xMin, xMax, yMin, yMax);
        drawCurve(canvas, leftPadding, topPadding, plotWidth, plotHeight, xMin, xMax, yMin, yMax);
        drawLegend(canvas, leftPadding + 12, topPadding + 12);
    }

    private SampleRange findYRange(double xMin, double xMax, int samples) {
        double minimum = 0;
        double maximum = 0;
        boolean found = false;
        for (int index = 0; index <= samples; index++) {
            double x = xMin + (xMax - xMin) * index / samples;
            try {
                double y = function.valueAt(x);
                if (Double.isFinite(y) && Math.abs(y) < 1_000_000) {
                    minimum = found ? Math.min(minimum, y) : Math.min(0, y);
                    maximum = found ? Math.max(maximum, y) : Math.max(0, y);
                    found = true;
                }
            } catch (IllegalArgumentException ignored) {
                // A discontinuity creates a break in the curve instead of failing the whole view.
            }
        }
        if (!found) {
            throw new IllegalArgumentException("No finite values in range.");
        }
        double span = maximum - minimum;
        if (span < 1e-9) {
            span = Math.max(2.0, Math.abs(maximum) * 0.5);
        }
        double padding = span * 0.14;
        return new SampleRange(minimum - padding, maximum + padding);
    }

    private void drawGrid(Graphics2D canvas, int left, int top, int width, int height,
                          double xMin, double xMax, double yMin, double yMax) {
        canvas.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 11));
        canvas.setStroke(new BasicStroke(1f));

        for (int index = 0; index <= 8; index++) {
            int x = left + width * index / 8;
            double value = xMin + (xMax - xMin) * index / 8.0;
            canvas.setColor(GRID);
            canvas.drawLine(x, top, x, top + height);
            canvas.setColor(MUTED);
            canvas.drawString(AXIS_FORMAT.format(value), x - 10, top + height + 20);
        }
        for (int index = 0; index <= 6; index++) {
            int y = top + height * index / 6;
            double value = yMax - (yMax - yMin) * index / 6.0;
            canvas.setColor(GRID);
            canvas.drawLine(left, y, left + width, y);
            canvas.setColor(MUTED);
            canvas.drawString(AXIS_FORMAT.format(value), 8, y + 4);
        }

        canvas.setColor(new Color(14, 17, 17, 105));
        canvas.setStroke(new BasicStroke(1.4f));
        if (xMin <= 0 && xMax >= 0) {
            int zeroX = mapX(0, left, width, xMin, xMax);
            canvas.drawLine(zeroX, top, zeroX, top + height);
        }
        if (yMin <= 0 && yMax >= 0) {
            int zeroY = mapY(0, top, height, yMin, yMax);
            canvas.drawLine(left, zeroY, left + width, zeroY);
        }
    }

    private void drawRectangles(Graphics2D canvas, int left, int top, int width, int height,
                                double xMin, double xMax, double yMin, double yMax) {
        List<Rectangle> rectangles = function.getRectangles(lower, higher, segments);
        int zeroY = mapY(0, top, height, yMin, yMax);
        canvas.setStroke(new BasicStroke(1.15f));
        for (Rectangle rectangle : rectangles) {
            int x1 = mapX(rectangle.getX(), left, width, xMin, xMax);
            int x2 = mapX(rectangle.getX() + rectangle.getWidth(), left, width, xMin, xMax);
            int valueY = mapY(rectangle.getHeight(), top, height, yMin, yMax);
            int boxY = Math.min(valueY, zeroY);
            int boxHeight = Math.max(1, Math.abs(valueY - zeroY));
            canvas.setColor(BLUE_FILL);
            canvas.fillRect(x1, boxY, Math.max(1, x2 - x1), boxHeight);
            canvas.setColor(BLUE);
            canvas.drawRect(x1, boxY, Math.max(1, x2 - x1), boxHeight);
        }
    }

    private void drawTrapezoids(Graphics2D canvas, int left, int top, int width, int height,
                                double xMin, double xMax, double yMin, double yMax) {
        double step = (higher - lower) / segments;
        int zeroY = mapY(0, top, height, yMin, yMax);
        canvas.setStroke(new BasicStroke(1.25f));
        for (int index = 0; index < segments; index++) {
            double x1Value = lower + index * step;
            double x2Value = x1Value + step;
            double y1Value = function.valueAt(x1Value);
            double y2Value = function.valueAt(x2Value);
            int x1 = mapX(x1Value, left, width, xMin, xMax);
            int x2 = mapX(x2Value, left, width, xMin, xMax);
            int y1 = mapY(y1Value, top, height, yMin, yMax);
            int y2 = mapY(y2Value, top, height, yMin, yMax);

            Path2D polygon = new Path2D.Double();
            polygon.moveTo(x1, zeroY);
            polygon.lineTo(x1, y1);
            polygon.lineTo(x2, y2);
            polygon.lineTo(x2, zeroY);
            polygon.closePath();
            canvas.setColor(OXIDE_FILL);
            canvas.fill(polygon);
            canvas.setColor(new Color(180, 74, 42, 165));
            canvas.drawLine(x1, y1, x2, y2);
        }
    }

    private void drawCurve(Graphics2D canvas, int left, int top, int width, int height,
                           double xMin, double xMax, double yMin, double yMax) {
        canvas.setColor(INK);
        canvas.setStroke(new BasicStroke(2.6f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
        Path2D curve = new Path2D.Double();
        boolean active = false;
        int previousY = 0;
        for (int pixel = 0; pixel <= width; pixel++) {
            double x = xMin + (xMax - xMin) * pixel / width;
            try {
                double value = function.valueAt(x);
                int y = mapY(value, top, height, yMin, yMax);
                if (!active || Math.abs(y - previousY) > height * 2) {
                    curve.moveTo(left + pixel, y);
                } else {
                    curve.lineTo(left + pixel, y);
                }
                active = true;
                previousY = y;
            } catch (IllegalArgumentException exception) {
                active = false;
            }
        }
        canvas.draw(curve);
    }

    private void drawLegend(Graphics2D canvas, int x, int y) {
        canvas.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 11));
        canvas.setColor(BLUE);
        canvas.fillRect(x, y, 16, 8);
        canvas.setColor(INK);
        canvas.drawString("Midpoint", x + 23, y + 9);
        canvas.setColor(OXIDE);
        canvas.fillRect(x + 92, y, 16, 8);
        canvas.setColor(INK);
        canvas.drawString("Trapezoidal", x + 115, y + 9);
    }

    private void drawEmptyState(Graphics2D canvas) {
        canvas.setColor(MUTED);
        canvas.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 16));
        int textWidth = canvas.getFontMetrics().stringWidth(emptyMessage);
        canvas.drawString(emptyMessage, Math.max(24, (getWidth() - textWidth) / 2), getHeight() / 2);
    }

    private void drawErrorState(Graphics2D canvas, String message) {
        canvas.setColor(BONE);
        canvas.fillRect(0, 0, getWidth(), getHeight());
        canvas.setColor(OXIDE);
        canvas.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 15));
        canvas.drawString(message, 28, getHeight() / 2);
    }

    private void handleWheelZoom(MouseWheelEvent event) {
        setZoom(zoom * Math.pow(1.12, event.getPreciseWheelRotation()));
    }

    private void setZoom(double requestedZoom) {
        zoom = Math.max(0.3, Math.min(5.0, requestedZoom));
        repaint();
    }

    private static int mapX(double value, int left, int width, double minimum, double maximum) {
        return left + (int) Math.round((value - minimum) / (maximum - minimum) * width);
    }

    private static int mapY(double value, int top, int height, double minimum, double maximum) {
        return top + (int) Math.round((maximum - value) / (maximum - minimum) * height);
    }

    private record SampleRange(double minimum, double maximum) {
    }
}
