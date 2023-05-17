package com.planck.data;

public class GraphData {
    private double rectanglesArea;
    private double trapArea;
    private double integralArea;

    private static GraphData instance;

    private GraphData() {
        rectanglesArea = 0;
        trapArea = 0;
        integralArea = 0;
    }

    public static GraphData getInstance() {
        if(instance == null) {
            instance = new GraphData();
        }
        return instance;
    }

    public double getRectanglesArea() {
        return rectanglesArea;
    }

    public void setRectanglesArea(double rectanglesArea) {
        this.rectanglesArea = rectanglesArea;
    }

    public double getTrapArea() {
        return trapArea;
    }

    public void setTrapArea(double trapArea) {
        this.trapArea = trapArea;
    }

    public double getIntegralArea() {
        return integralArea;
    }

    public void setIntegralArea(double integralArea) {
        this.integralArea = integralArea;
    }

}
