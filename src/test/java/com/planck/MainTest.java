package com.planck;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class MainTest {
    @Test
    void reportsDevelopmentVersionOutsidePackagedJar() {
        assertEquals("IntegraDraw development", Main.versionText());
    }
}
