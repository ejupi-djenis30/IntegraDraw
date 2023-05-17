package com.planck;


import com.planck.ui.MainPanel;


import javax.swing.*;
import java.awt.*;

public class Main {
    public static void main(String[] args){
        JFrame mainWindow = new JFrame();
        mainWindow.setContentPane(new MainPanel().mainPanel);
        mainWindow.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        mainWindow.setMinimumSize(new Dimension(800, 800));
        mainWindow.setTitle("IntegralDraw");
        mainWindow.setVisible(true);

    }
}