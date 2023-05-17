package com.planck.data;

public class ProgramData {
    private int rects;
    private String formula;
    private int lowLimit;
    private int highLimit;

    private static ProgramData currentInstance;

    private ProgramData() {
        rects = 0;
        formula = "";
        lowLimit = 0;
        highLimit = 0;
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

    public String getFormula() {
        return formula;
    }

    public void setFormula(String formula) {
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
}
