package com.planck.data;

import com.planck.math.MathFunction;
import com.planck.math.Rectangle;

import java.util.ArrayList;

public class ProgramData {
    private int rects;
    private MathFunction formula;
    private int lowLimit;
    private int highLimit;

    private ArrayList<Double> intervalValues;

    private ArrayList<Rectangle> rectangles;

    private static ProgramData currentInstance;

    private ProgramData() {
        rects = 0;
        formula = null;
        lowLimit = 0;
        highLimit = 0;
        intervalValues = null;
        rectangles = null;
    }

    public static synchronized ProgramData getInstance() {
        if (currentInstance == null)
            currentInstance = new ProgramData();

        return currentInstance;
    }

    public int getRects() {
        return rects;
    }

    public void setRects(int rects) {
        this.rects = rects;
    }

    public MathFunction getFormula() {
        return formula;
    }

    public void setFormula(MathFunction formula) {
        this.formula = formula;
    }

    public int getLowLimit() {
        return lowLimit;
    }

    public void setLowLimit(int lowLimit) {
        this.lowLimit = lowLimit;
    }

    public int getHighLimit() {
        return highLimit;
    }

    public void setHighLimit(int highLimit) {
        this.highLimit = highLimit;
    }

    public ArrayList<Double> getIntervalValues() {
        return intervalValues;
    }

    public ArrayList<Rectangle> getRectangles() {
        return rectangles;
    }

    public void setIntervalValues(ArrayList<Double> intervalValues) {
        this.intervalValues = intervalValues;
    }

    public void setRectangles(ArrayList<Rectangle> rectangles) {
        this.rectangles = rectangles;
    }
}
