package com.planck.math;

/**
 * An input or evaluation failure with a stable machine-readable category.
 *
 * <p>The class remains an {@link IllegalArgumentException} so existing callers can keep handling
 * the public API exactly as before, while tests and other clients can distinguish the failure
 * stage without parsing the user-facing message.</p>
 */
public final class NumericalException extends IllegalArgumentException {
    public enum Category {
        EXPRESSION("expression"),
        BOUNDS("bounds"),
        SEGMENTS("segments"),
        EVALUATION("evaluation");

        private final String code;

        Category(String code) {
            this.code = code;
        }

        public String code() {
            return code;
        }
    }

    private final Category category;

    public NumericalException(Category category, String message) {
        super(message);
        this.category = category;
    }

    public NumericalException(Category category, String message, Throwable cause) {
        super(message, cause);
        this.category = category;
    }

    public Category category() {
        return category;
    }

    public String code() {
        return category.code();
    }
}
