package com.planck.math;

import com.fasterxml.jackson.core.JsonFactory;
import com.fasterxml.jackson.core.StreamReadFeature;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SharedNumericalCorpusTest {
    private static final Path CORPUS_PATH = Path.of("shared", "numerical-corpus.json");
    private static final Pattern CASE_ID = Pattern.compile("[a-z0-9]+(?:-[a-z0-9]+)*");
    private static final Set<String> OUTCOMES = Set.of("valid", "error");
    private static final Set<String> CATEGORIES = Set.of("expression", "bounds", "segments", "evaluation");
    private static final ObjectMapper CORPUS_MAPPER = JsonMapper.builder(
                    JsonFactory.builder().enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION).build()
            )
            .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .enable(DeserializationFeature.FAIL_ON_MISSING_CREATOR_PROPERTIES)
            .enable(DeserializationFeature.FAIL_ON_NULL_CREATOR_PROPERTIES)
            .enable(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES)
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
            .enable(DeserializationFeature.ACCEPT_FLOAT_AS_INT)
            .enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS)
            .enable(DeserializationFeature.USE_BIG_INTEGER_FOR_INTS)
            .disable(MapperFeature.ALLOW_COERCION_OF_SCALARS)
            .build();
    private static final String CORPUS_SOURCE = readCorpusSource();
    private static final NumericalCorpus CORPUS = parseCorpus(CORPUS_SOURCE);

    @Test
    void recordsTheIntentionalRuntimeDifferences() {
        assertEquals(1, CORPUS.schemaVersion());
        assertEquals(MathFunction.REFERENCE_SEGMENTS, CORPUS.implementations().java().referenceSegments());
        assertEquals(8_192, CORPUS.implementations().typescript().referenceSegments());
        assertEquals(MathFunction.MAX_APPROXIMATION_SEGMENTS, CORPUS.implementations().java().maximumSegments());
        assertEquals(500, CORPUS.implementations().typescript().maximumSegments());
        assertEquals("composite Simpson", CORPUS.implementations().java().referenceRule());
        assertEquals("composite Simpson", CORPUS.implementations().typescript().referenceRule());
    }

    @Test
    void matchesEveryGoldenIntegral() {
        for (IntegralCase testCase : CORPUS.integrals()) {
            MathFunction function = new MathFunction(testCase.formula(), "x");
            IntegralAnalysis actual = IntegralAnalysis.calculate(
                    function,
                    testCase.lower(),
                    testCase.upper(),
                    testCase.segments()
            );

            assertEquals(
                    testCase.segments(),
                    function.getRectangles(testCase.lower(), testCase.upper(), testCase.segments()).size(),
                    testCase.id() + " rectangle count"
            );
            assertEquals(
                    testCase.expected().midpoint().java(),
                    actual.midpoint(),
                    testCase.tolerances().midpoint().java(),
                    testCase.id() + " midpoint"
            );
            assertEquals(
                    testCase.expected().trapezoidal().java(),
                    actual.trapezoidal(),
                    testCase.tolerances().trapezoidal().java(),
                    testCase.id() + " trapezoidal"
            );
            assertEquals(
                    testCase.expected().reference().java(),
                    actual.reference(),
                    testCase.tolerances().reference().java(),
                    testCase.id() + " Java reference"
            );
            assertEquals(
                    testCase.expected().signedArea(),
                    actual.reference(),
                    testCase.tolerances().signedArea().java(),
                    testCase.id() + " signed area"
            );
        }
    }

    @Test
    void rejectsEverySharedInvalidExpressionWithItsDeclaredCategory() {
        for (InvalidExpressionCase testCase : CORPUS.invalidExpressions()) {
            NumericalException failure = assertThrows(
                    NumericalException.class,
                    () -> new MathFunction(testCase.formula(), "x"),
                    testCase.id()
            );
            assertEquals(testCase.expectations().java().category(), failure.code(), testCase.id());
        }
    }

    @Test
    void appliesTheJavaValidationExpectationAndCategoryForEverySharedCase() {
        for (ValidationCase testCase : CORPUS.validationCases()) {
            Runnable calculation = () -> IntegralAnalysis.calculate(
                    new MathFunction(testCase.formula(), "x"),
                    testCase.lower(),
                    testCase.upper(),
                    testCase.segments()
            );
            RuntimeExpectation expectation = testCase.expectations().java();
            if ("valid".equals(expectation.outcome())) {
                assertDoesNotThrow(calculation::run, testCase.id());
            } else {
                NumericalException failure = assertThrows(NumericalException.class, calculation::run, testCase.id());
                assertEquals(expectation.category(), failure.code(), testCase.id());
            }
        }
    }

    @Test
    void rejectsDuplicateKeysMissingFieldsNullsAndInvalidRanges() {
        assertThrows(IllegalStateException.class, () -> parseCorpus("{\"schemaVersion\":1,\"schemaVersion\":1}"));
        assertThrows(IllegalStateException.class, () -> parseCorpus("{}"));
        assertThrows(
                IllegalStateException.class,
                () -> parseCorpus(replaceRequired(
                        CORPUS_SOURCE,
                        "\"formulaDialect\": \"Symja 3.2\"",
                        "\"formulaDialect\": null"
                ))
        );
        assertThrows(
                IllegalStateException.class,
                () -> parseCorpus(replaceRequired(
                        CORPUS_SOURCE,
                        "\"schemaVersion\": 1",
                        "\"schemaVersion\": 2147483648"
                ))
        );
    }

    @Test
    void usesTheSameSemantic32BitIntegerDomainAsTypeScript() {
        assertEquals(
                1,
                parseCorpus(replaceRequired(CORPUS_SOURCE, "\"schemaVersion\": 1", "\"schemaVersion\": 1.0"))
                        .schemaVersion()
        );
        assertEquals(
                1,
                parseCorpus(replaceRequired(CORPUS_SOURCE, "\"schemaVersion\": 1", "\"schemaVersion\": 1e0"))
                        .schemaVersion()
        );
        assertThrows(
                IllegalStateException.class,
                () -> parseCorpus(replaceRequired(
                        CORPUS_SOURCE,
                        "\"referenceSegments\": 1024",
                        "\"referenceSegments\": 3"
                ))
        );
    }

    @Test
    void rejectsVacuousCollectionsAndDuplicateCaseIds() {
        assertThrows(
                IllegalStateException.class,
                () -> validateCorpus(new NumericalCorpus(
                        CORPUS.schemaVersion(),
                        CORPUS.implementations(),
                        List.of(),
                        CORPUS.invalidExpressions(),
                        CORPUS.validationCases()
                ))
        );

        List<IntegralCase> duplicated = new ArrayList<>(CORPUS.integrals());
        duplicated.add(CORPUS.integrals().get(0));
        assertThrows(
                IllegalStateException.class,
                () -> validateCorpus(new NumericalCorpus(
                        CORPUS.schemaVersion(),
                        CORPUS.implementations(),
                        duplicated,
                        CORPUS.invalidExpressions(),
                        CORPUS.validationCases()
                ))
        );
    }

    private static String readCorpusSource() {
        try {
            return Files.readString(CORPUS_PATH);
        } catch (IOException exception) {
            throw new IllegalStateException("Cannot read shared numerical corpus at " + CORPUS_PATH, exception);
        }
    }

    private static NumericalCorpus parseCorpus(String source) {
        try {
            JsonNode tree = CORPUS_MAPPER.readTree(source);
            validateIntegerNodes(tree);
            return validateCorpus(CORPUS_MAPPER.treeToValue(tree, NumericalCorpus.class));
        } catch (IOException exception) {
            throw new IllegalStateException("Shared numerical corpus is not valid JSON", exception);
        }
    }

    private static void validateIntegerNodes(JsonNode root) {
        integer32(root.path("schemaVersion"), "$.schemaVersion");
        JsonNode implementations = root.path("implementations");
        for (String runtime : List.of("java", "typescript")) {
            JsonNode implementation = implementations.path(runtime);
            integer32(implementation.path("referenceSegments"), "$.implementations." + runtime + ".referenceSegments");
            integer32(implementation.path("maximumSegments"), "$.implementations." + runtime + ".maximumSegments");
        }
        validateCaseIntegers(root.path("integrals"), "$.integrals");
        validateCaseIntegers(root.path("validationCases"), "$.validationCases");
    }

    private static void validateCaseIntegers(JsonNode cases, String path) {
        if (!cases.isArray()) {
            return;
        }
        for (int index = 0; index < cases.size(); index++) {
            integer32(cases.path(index).path("segments"), path + "[" + index + "].segments");
        }
    }

    private static void integer32(JsonNode node, String path) {
        require(node.isNumber(), path, "must be a number");
        BigDecimal value = node.decimalValue().stripTrailingZeros();
        require(value.scale() <= 0, path, "must be an integer");
        require(
                value.compareTo(BigDecimal.valueOf(Integer.MIN_VALUE)) >= 0
                        && value.compareTo(BigDecimal.valueOf(Integer.MAX_VALUE)) <= 0,
                path,
                "must be a 32-bit integer"
        );
    }

    private static NumericalCorpus validateCorpus(NumericalCorpus corpus) {
        require(corpus != null, "$", "must be an object");
        require(corpus.schemaVersion() == 1, "$.schemaVersion", "must be exactly 1");

        Implementations implementations = required(corpus.implementations(), "$.implementations");
        RuntimeSpec java = validateRuntimeSpec(implementations.java(), "$.implementations.java");
        RuntimeSpec typescript = validateRuntimeSpec(implementations.typescript(), "$.implementations.typescript");
        int sharedMaximum = Math.min(java.maximumSegments(), typescript.maximumSegments());

        Set<String> ids = new HashSet<>();
        List<IntegralCase> integrals = nonEmpty(corpus.integrals(), "$.integrals");
        for (int index = 0; index < integrals.size(); index++) {
            String path = "$.integrals[" + index + "]";
            IntegralCase testCase = required(integrals.get(index), path);
            validateId(testCase.id(), path + ".id", ids);
            validateFormula(testCase.formula(), path + ".formula", false);
            finite(testCase.lower(), path + ".lower");
            finite(testCase.upper(), path + ".upper");
            require(testCase.lower() < testCase.upper(), path, "integral bounds must be increasing");
            require(testCase.upper() - testCase.lower() <= 10_000, path, "integral width must not exceed 10,000");
            require(
                    testCase.segments() >= 1 && testCase.segments() <= sharedMaximum,
                    path + ".segments",
                    "must be between 1 and " + sharedMaximum
            );

            ExpectedValues expected = required(testCase.expected(), path + ".expected");
            finite(expected.signedArea(), path + ".expected.signedArea");
            validateRuntimeValues(expected.midpoint(), path + ".expected.midpoint", false);
            validateRuntimeValues(expected.trapezoidal(), path + ".expected.trapezoidal", false);
            validateRuntimeValues(expected.reference(), path + ".expected.reference", false);

            Tolerances tolerances = required(testCase.tolerances(), path + ".tolerances");
            validateRuntimeValues(tolerances.midpoint(), path + ".tolerances.midpoint", true);
            validateRuntimeValues(tolerances.trapezoidal(), path + ".tolerances.trapezoidal", true);
            validateRuntimeValues(tolerances.reference(), path + ".tolerances.reference", true);
            validateRuntimeValues(tolerances.signedArea(), path + ".tolerances.signedArea", true);
        }

        List<InvalidExpressionCase> invalidExpressions = nonEmpty(
                corpus.invalidExpressions(),
                "$.invalidExpressions"
        );
        for (int index = 0; index < invalidExpressions.size(); index++) {
            String path = "$.invalidExpressions[" + index + "]";
            InvalidExpressionCase testCase = required(invalidExpressions.get(index), path);
            validateId(testCase.id(), path + ".id", ids);
            validateFormula(testCase.formula(), path + ".formula", true);
            RuntimeExpectations expectations = required(testCase.expectations(), path + ".expectations");
            validateInvalidExpressionExpectation(expectations.java(), path + ".expectations.java");
            validateInvalidExpressionExpectation(expectations.typescript(), path + ".expectations.typescript");
        }

        List<ValidationCase> validationCases = nonEmpty(corpus.validationCases(), "$.validationCases");
        for (int index = 0; index < validationCases.size(); index++) {
            String path = "$.validationCases[" + index + "]";
            ValidationCase testCase = required(validationCases.get(index), path);
            validateId(testCase.id(), path + ".id", ids);
            validateFormula(testCase.formula(), path + ".formula", false);
            finite(testCase.lower(), path + ".lower");
            finite(testCase.upper(), path + ".upper");
            RuntimeExpectations expectations = required(testCase.expectations(), path + ".expectations");
            validateValidationExpectation(expectations.java(), path + ".expectations.java");
            validateValidationExpectation(expectations.typescript(), path + ".expectations.typescript");
        }

        return corpus;
    }

    private static RuntimeSpec validateRuntimeSpec(RuntimeSpec spec, String path) {
        RuntimeSpec value = required(spec, path);
        nonBlank(value.formulaDialect(), path + ".formulaDialect");
        nonBlank(value.referenceRule(), path + ".referenceRule");
        require(
                value.referenceSegments() >= 2 && value.referenceSegments() % 2 == 0,
                path + ".referenceSegments",
                "must be a positive, even integer"
        );
        require(value.maximumSegments() >= 1, path + ".maximumSegments", "must be positive");
        return value;
    }

    private static void validateRuntimeValues(RuntimeValues values, String path, boolean isTolerance) {
        RuntimeValues value = required(values, path);
        if (isTolerance) {
            tolerance(value.java(), path + ".java");
            tolerance(value.typescript(), path + ".typescript");
        } else {
            finite(value.java(), path + ".java");
            finite(value.typescript(), path + ".typescript");
        }
    }

    private static void validateInvalidExpressionExpectation(RuntimeExpectation expectation, String path) {
        validateExpectation(expectation, path);
        require("error".equals(expectation.outcome()), path + ".outcome", "must be error");
        require("expression".equals(expectation.category()), path + ".category", "must be expression");
    }

    private static void validateValidationExpectation(RuntimeExpectation expectation, String path) {
        validateExpectation(expectation, path);
        require(!"expression".equals(expectation.category()), path + ".category", "cannot be expression");
    }

    private static void validateExpectation(RuntimeExpectation expectation, String path) {
        RuntimeExpectation value = required(expectation, path);
        require(OUTCOMES.contains(value.outcome()), path + ".outcome", "must be valid or error");
        require(CATEGORIES.contains(value.category()), path + ".category", "is not a known category");
    }

    private static void validateId(String id, String path, Set<String> ids) {
        nonBlank(id, path);
        require(CASE_ID.matcher(id).matches(), path, "must use lower-kebab-case");
        require(ids.add(id), path, "duplicates corpus id " + id);
    }

    private static void validateFormula(String formula, String path, boolean allowEmpty) {
        required(formula, path);
        require(allowEmpty || !formula.isBlank(), path, "must not be blank");
        require(formula.length() <= 160, path, "must not exceed 160 characters");
    }

    private static void nonBlank(String value, String path) {
        required(value, path);
        require(!value.isBlank(), path, "must be a non-blank string");
    }

    private static void finite(double value, String path) {
        require(Double.isFinite(value), path, "must be finite");
    }

    private static void tolerance(double value, String path) {
        finite(value, path);
        require(value >= 0, path, "must not be negative");
    }

    private static <T> List<T> nonEmpty(List<T> values, String path) {
        List<T> list = required(values, path);
        require(!list.isEmpty(), path, "must not be empty");
        return list;
    }

    private static <T> T required(T value, String path) {
        require(value != null, path, "is required");
        return value;
    }

    private static void require(boolean condition, String path, String message) {
        if (!condition) {
            throw new IllegalStateException(path + ": " + message);
        }
    }

    private static String replaceRequired(String source, String target, String replacement) {
        String result = source.replace(target, replacement);
        if (result.equals(source)) {
            throw new AssertionError("Corpus fixture does not contain expected text: " + target);
        }
        return result;
    }

    private record NumericalCorpus(
            int schemaVersion,
            Implementations implementations,
            List<IntegralCase> integrals,
            List<InvalidExpressionCase> invalidExpressions,
            List<ValidationCase> validationCases
    ) {
    }

    private record Implementations(RuntimeSpec java, RuntimeSpec typescript) {
    }

    private record RuntimeSpec(
            String formulaDialect,
            String referenceRule,
            int referenceSegments,
            int maximumSegments
    ) {
    }

    private record IntegralCase(
            String id,
            String formula,
            double lower,
            double upper,
            int segments,
            ExpectedValues expected,
            Tolerances tolerances
    ) {
    }

    private record ExpectedValues(
            double signedArea,
            RuntimeValues midpoint,
            RuntimeValues trapezoidal,
            RuntimeValues reference
    ) {
    }

    private record Tolerances(
            RuntimeValues midpoint,
            RuntimeValues trapezoidal,
            RuntimeValues reference,
            RuntimeValues signedArea
    ) {
    }

    private record RuntimeValues(double java, double typescript) {
    }

    private record InvalidExpressionCase(
            String id,
            String formula,
            RuntimeExpectations expectations
    ) {
    }

    private record ValidationCase(
            String id,
            String formula,
            double lower,
            double upper,
            int segments,
            RuntimeExpectations expectations
    ) {
    }

    private record RuntimeExpectations(RuntimeExpectation java, RuntimeExpectation typescript) {
    }

    private record RuntimeExpectation(String outcome, String category) {
    }
}
