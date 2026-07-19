package com.planck.ui;

import org.junit.jupiter.api.Test;

import javax.swing.SwingUtilities;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class MainPanelTest {
    @Test
    void constructsWithoutIntellijFormInstrumentation() {
        AtomicReference<MainPanel> panel = new AtomicReference<>();

        assertDoesNotThrow(() -> SwingUtilities.invokeAndWait(() -> panel.set(new MainPanel())));
        assertNotNull(panel.get());
        assertNotNull(panel.get().getAccessibleContext());
    }
}
