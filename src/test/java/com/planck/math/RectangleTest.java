package com.planck.math;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class RectangleTest {
    @Test
    void preservesSignedHeightAndArea() {
        Rectangle rectangle = new Rectangle(-1.0, -3.0, 0.5);

        assertEquals(-3.0, rectangle.getHeight());
        assertEquals(3.0, rectangle.getAbsoluteHeight());
        assertEquals(-1.5, rectangle.getArea());
        assertEquals(1.5, rectangle.getAbsoluteArea());
    }

    @Test
    void rejectsNonPositiveWidth() {
        assertThrows(IllegalArgumentException.class, () -> new Rectangle(0, 1, 0));
        assertThrows(IllegalArgumentException.class, () -> new Rectangle(0, 1, -1));
    }
}
