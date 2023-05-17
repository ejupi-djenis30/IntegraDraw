package com.planck.data;

public class ProgramData {
    private int rects;

    private static ProgramData currentInstance;

    private ProgramData() {
        rects = 0;
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
}
