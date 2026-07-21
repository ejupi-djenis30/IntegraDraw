import { describe, expect, it } from "vitest";

import corpusSource from "../../../shared/numerical-corpus.json?raw";
import { compileExpression } from "./expression";
import {
  analyzeIntegral,
  createApproximationGeometry,
  MAX_APPROXIMATION_SEGMENTS,
  REFERENCE_SEGMENTS,
} from "./integration";
import {
  CorpusValidationError,
  parseNumericalCorpus,
  type RuntimeExpectation,
} from "./numerical-corpus";

const corpus = parseNumericalCorpus(corpusSource);

function expectWithin(actual: number, expected: number, tolerance: number, label: string): void {
  expect(Math.abs(actual - expected), label).toBeLessThanOrEqual(tolerance);
}

function expectFailureCategory(action: () => void, expectation: RuntimeExpectation, label: string): void {
  let failure: unknown;
  try {
    action();
  } catch (error) {
    failure = error;
  }
  expect(failure, `${label} error type`).toBeInstanceOf(Error);
  expect((failure as { readonly category?: unknown }).category, `${label} category`).toBe(expectation.category);
  expect((failure as { readonly code?: unknown }).code, `${label} code`).toBe(expectation.category);
}

describe("shared numerical corpus", () => {
  it("records the intentional runtime differences", () => {
    expect(corpus.schemaVersion).toBe(1);
    expect(corpus.implementations.java.referenceSegments).toBe(1_024);
    expect(corpus.implementations.typescript.referenceSegments).toBe(REFERENCE_SEGMENTS);
    expect(corpus.implementations.java.maximumSegments).toBe(1_000);
    expect(corpus.implementations.typescript.maximumSegments).toBe(MAX_APPROXIMATION_SEGMENTS);
    expect(corpus.implementations.java.referenceRule).toBe("composite Simpson");
    expect(corpus.implementations.typescript.referenceRule).toBe("composite Simpson");
  });

  it("matches every golden integral", () => {
    for (const testCase of corpus.integrals) {
      const expression = compileExpression(testCase.formula);
      const geometry = createApproximationGeometry(
        expression,
        testCase.lower,
        testCase.upper,
        testCase.segments,
      );
      const actual = analyzeIntegral(expression, testCase.lower, testCase.upper, testCase.segments);

      expect(geometry.rectangles, `${testCase.id} rectangle count`).toHaveLength(testCase.segments);
      expect(geometry.trapezoids, `${testCase.id} trapezoid count`).toHaveLength(testCase.segments);
      expectWithin(
        actual.midpoint,
        testCase.expected.midpoint.typescript,
        testCase.tolerances.midpoint.typescript,
        `${testCase.id} midpoint`,
      );
      expectWithin(
        actual.trapezoidal,
        testCase.expected.trapezoidal.typescript,
        testCase.tolerances.trapezoidal.typescript,
        `${testCase.id} trapezoidal`,
      );
      expectWithin(
        actual.reference,
        testCase.expected.reference.typescript,
        testCase.tolerances.reference.typescript,
        `${testCase.id} TypeScript reference`,
      );
      expectWithin(
        actual.reference,
        testCase.expected.signedArea,
        testCase.tolerances.signedArea.typescript,
        `${testCase.id} signed area`,
      );
    }
  });

  it("rejects every shared invalid expression", () => {
    for (const testCase of corpus.invalidExpressions) {
      expectFailureCategory(
        () => compileExpression(testCase.formula),
        testCase.expectations.typescript,
        testCase.id,
      );
    }
  });

  it("applies the TypeScript validation expectation for every shared case", () => {
    for (const testCase of corpus.validationCases) {
      const calculation = (): void => {
        analyzeIntegral(
          compileExpression(testCase.formula),
          testCase.lower,
          testCase.upper,
          testCase.segments,
        );
      };
      const expectation = testCase.expectations.typescript;
      expect(["bounds", "segments", "evaluation"], `${testCase.id} category`).toContain(expectation.category);
      if (expectation.outcome === "valid") {
        expect(calculation, testCase.id).not.toThrow();
      } else {
        expectFailureCategory(calculation, expectation, testCase.id);
      }
    }
  });

  it("rejects duplicate keys, missing fields, nulls and invalid ranges", () => {
    expect(() => parseNumericalCorpus('{"schemaVersion":1,"schemaVersion":1}')).toThrow(CorpusValidationError);
    expect(() => parseNumericalCorpus("{}")).toThrow(CorpusValidationError);
    expect(() =>
      parseNumericalCorpus(corpusSource.replace('"formulaDialect": "Symja 3.2"', '"formulaDialect": null')),
    ).toThrow(CorpusValidationError);
    expect(() =>
      parseNumericalCorpus(corpusSource.replace('"referenceSegments": 1024', '"referenceSegments": 3')),
    ).toThrow(CorpusValidationError);
    expect(() =>
      parseNumericalCorpus(corpusSource.replace('"schemaVersion": 1', '"schemaVersion": 2147483648')),
    ).toThrow(CorpusValidationError);
  });

  it("uses the same semantic 32-bit integer domain as Java", () => {
    expect(parseNumericalCorpus(corpusSource.replace('"schemaVersion": 1', '"schemaVersion": 1.0')).schemaVersion).toBe(1);
    expect(parseNumericalCorpus(corpusSource.replace('"schemaVersion": 1', '"schemaVersion": 1e0')).schemaVersion).toBe(1);
  });

  it("rejects vacuous collections and duplicate case ids", () => {
    const parsed = JSON.parse(corpusSource) as Record<string, unknown>;
    expect(() => parseNumericalCorpus(JSON.stringify({ ...parsed, integrals: [] }))).toThrow(CorpusValidationError);
    expect(() =>
      parseNumericalCorpus(
        corpusSource.replace('"id": "empty-expression"', '"id": "constant-across-offset-bounds"'),
      ),
    ).toThrow(CorpusValidationError);
  });
});
