package com.planck.data;

public class ProgramData {
    private int rects;
    private String formula;

    private static ProgramData currentInstance;

    private ProgramData() {
        rects = 0;
        formula = "";
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
}
