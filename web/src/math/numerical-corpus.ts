export type RuntimeName = "java" | "typescript";
export type CorpusErrorCategory = "expression" | "bounds" | "segments" | "evaluation";
export type CorpusOutcome = "valid" | "error";

export interface RuntimeSpec {
  readonly formulaDialect: string;
  readonly referenceRule: string;
  readonly referenceSegments: number;
  readonly maximumSegments: number;
}

export interface RuntimeValues {
  readonly java: number;
  readonly typescript: number;
}

export interface RuntimeExpectation {
  readonly outcome: CorpusOutcome;
  readonly category: CorpusErrorCategory;
}

export interface RuntimeExpectations {
  readonly java: RuntimeExpectation;
  readonly typescript: RuntimeExpectation;
}

export interface IntegralCase {
  readonly id: string;
  readonly formula: string;
  readonly lower: number;
  readonly upper: number;
  readonly segments: number;
  readonly expected: {
    readonly signedArea: number;
    readonly midpoint: RuntimeValues;
    readonly trapezoidal: RuntimeValues;
    readonly reference: RuntimeValues;
  };
  readonly tolerances: {
    readonly midpoint: RuntimeValues;
    readonly trapezoidal: RuntimeValues;
    readonly reference: RuntimeValues;
    readonly signedArea: RuntimeValues;
  };
}

export interface InvalidExpressionCase {
  readonly id: string;
  readonly formula: string;
  readonly expectations: RuntimeExpectations;
}

export interface ValidationCase {
  readonly id: string;
  readonly formula: string;
  readonly lower: number;
  readonly upper: number;
  readonly segments: number;
  readonly expectations: RuntimeExpectations;
}

export interface NumericalCorpus {
  readonly schemaVersion: 1;
  readonly implementations: Readonly<Record<RuntimeName, RuntimeSpec>>;
  readonly integrals: readonly IntegralCase[];
  readonly invalidExpressions: readonly InvalidExpressionCase[];
  readonly validationCases: readonly ValidationCase[];
}

export class CorpusValidationError extends Error {
  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "CorpusValidationError";
  }
}

export function parseNumericalCorpus(source: string): NumericalCorpus {
  const parsed = parseStrictJson(source);
  const root = readObject(parsed, "$", [
    "schemaVersion",
    "implementations",
    "integrals",
    "invalidExpressions",
    "validationCases",
  ]);
  const schemaVersion = readInteger(root.schemaVersion, "$.schemaVersion");
  if (schemaVersion !== 1) fail("$.schemaVersion", "must be exactly 1");

  const implementationsSource = readObject(root.implementations, "$.implementations", ["java", "typescript"]);
  const implementations = {
    java: readRuntimeSpec(implementationsSource.java, "$.implementations.java"),
    typescript: readRuntimeSpec(implementationsSource.typescript, "$.implementations.typescript"),
  } satisfies Readonly<Record<RuntimeName, RuntimeSpec>>;

  const seenIds = new Set<string>();
  const integrals = readNonEmptyArray(root.integrals, "$.integrals").map((value, index) => {
    const path = `$.integrals[${index}]`;
    const item = readObject(value, path, ["id", "formula", "lower", "upper", "segments", "expected", "tolerances"]);
    const id = readUniqueId(item.id, `${path}.id`, seenIds);
    const formula = readFormula(item.formula, `${path}.formula`, false);
    const lower = readFiniteNumber(item.lower, `${path}.lower`);
    const upper = readFiniteNumber(item.upper, `${path}.upper`);
    if (lower >= upper) fail(path, "integral bounds must be increasing");
    if (upper - lower > 10_000) fail(path, "integral width must not exceed 10,000");
    const segments = readInteger(item.segments, `${path}.segments`);
    const sharedMaximum = Math.min(implementations.java.maximumSegments, implementations.typescript.maximumSegments);
    if (segments < 1 || segments > sharedMaximum) {
      fail(`${path}.segments`, `must be between 1 and ${sharedMaximum}`);
    }

    const expectedSource = readObject(item.expected, `${path}.expected`, [
      "signedArea",
      "midpoint",
      "trapezoidal",
      "reference",
    ]);
    const expected = {
      signedArea: readFiniteNumber(expectedSource.signedArea, `${path}.expected.signedArea`),
      midpoint: readRuntimeValues(expectedSource.midpoint, `${path}.expected.midpoint`, false),
      trapezoidal: readRuntimeValues(expectedSource.trapezoidal, `${path}.expected.trapezoidal`, false),
      reference: readRuntimeValues(expectedSource.reference, `${path}.expected.reference`, false),
    };

    const tolerancesSource = readObject(item.tolerances, `${path}.tolerances`, [
      "midpoint",
      "trapezoidal",
      "reference",
      "signedArea",
    ]);
    const tolerances = {
      midpoint: readRuntimeValues(tolerancesSource.midpoint, `${path}.tolerances.midpoint`, true),
      trapezoidal: readRuntimeValues(tolerancesSource.trapezoidal, `${path}.tolerances.trapezoidal`, true),
      reference: readRuntimeValues(tolerancesSource.reference, `${path}.tolerances.reference`, true),
      signedArea: readRuntimeValues(tolerancesSource.signedArea, `${path}.tolerances.signedArea`, true),
    };

    return { id, formula, lower, upper, segments, expected, tolerances };
  });

  const invalidExpressions = readNonEmptyArray(root.invalidExpressions, "$.invalidExpressions").map((value, index) => {
    const path = `$.invalidExpressions[${index}]`;
    const item = readObject(value, path, ["id", "formula", "expectations"]);
    const expectations = readRuntimeExpectations(item.expectations, `${path}.expectations`);
    for (const runtime of ["java", "typescript"] as const) {
      if (expectations[runtime].outcome !== "error" || expectations[runtime].category !== "expression") {
        fail(`${path}.expectations.${runtime}`, "invalid expressions must expect an expression error");
      }
    }
    return {
      id: readUniqueId(item.id, `${path}.id`, seenIds),
      formula: readFormula(item.formula, `${path}.formula`, true),
      expectations,
    };
  });

  const validationCases = readNonEmptyArray(root.validationCases, "$.validationCases").map((value, index) => {
    const path = `$.validationCases[${index}]`;
    const item = readObject(value, path, ["id", "formula", "lower", "upper", "segments", "expectations"]);
    const expectations = readRuntimeExpectations(item.expectations, `${path}.expectations`);
    for (const runtime of ["java", "typescript"] as const) {
      if (expectations[runtime].category === "expression") {
        fail(`${path}.expectations.${runtime}.category`, "validation cases cannot use the expression category");
      }
    }
    return {
      id: readUniqueId(item.id, `${path}.id`, seenIds),
      formula: readFormula(item.formula, `${path}.formula`, false),
      lower: readFiniteNumber(item.lower, `${path}.lower`),
      upper: readFiniteNumber(item.upper, `${path}.upper`),
      segments: readInteger(item.segments, `${path}.segments`),
      expectations,
    };
  });

  return { schemaVersion: 1, implementations, integrals, invalidExpressions, validationCases };
}

function readRuntimeSpec(value: unknown, path: string): RuntimeSpec {
  const item = readObject(value, path, ["formulaDialect", "referenceRule", "referenceSegments", "maximumSegments"]);
  const referenceSegments = readInteger(item.referenceSegments, `${path}.referenceSegments`);
  if (referenceSegments < 2 || referenceSegments % 2 !== 0) {
    fail(`${path}.referenceSegments`, "must be a positive, even integer");
  }
  const maximumSegments = readInteger(item.maximumSegments, `${path}.maximumSegments`);
  if (maximumSegments < 1) fail(`${path}.maximumSegments`, "must be positive");
  return {
    formulaDialect: readNonBlankString(item.formulaDialect, `${path}.formulaDialect`),
    referenceRule: readNonBlankString(item.referenceRule, `${path}.referenceRule`),
    referenceSegments,
    maximumSegments,
  };
}

function readRuntimeValues(value: unknown, path: string, tolerance: boolean): RuntimeValues {
  const item = readObject(value, path, ["java", "typescript"]);
  return {
    java: tolerance ? readTolerance(item.java, `${path}.java`) : readFiniteNumber(item.java, `${path}.java`),
    typescript: tolerance
      ? readTolerance(item.typescript, `${path}.typescript`)
      : readFiniteNumber(item.typescript, `${path}.typescript`),
  };
}

function readRuntimeExpectations(value: unknown, path: string): RuntimeExpectations {
  const item = readObject(value, path, ["java", "typescript"]);
  return {
    java: readRuntimeExpectation(item.java, `${path}.java`),
    typescript: readRuntimeExpectation(item.typescript, `${path}.typescript`),
  };
}

function readRuntimeExpectation(value: unknown, path: string): RuntimeExpectation {
  const item = readObject(value, path, ["outcome", "category"]);
  return {
    outcome: readEnum(item.outcome, `${path}.outcome`, ["valid", "error"]),
    category: readEnum(item.category, `${path}.category`, ["expression", "bounds", "segments", "evaluation"]),
  };
}

function readObject(value: unknown, path: string, keys: readonly string[]): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(path, "must be an object");
  const item = value as Record<string, unknown>;
  for (const key of keys) {
    if (!Object.hasOwn(item, key)) fail(`${path}.${key}`, "is required");
  }
  for (const key of Object.keys(item)) {
    if (!keys.includes(key)) fail(`${path}.${key}`, "is not allowed");
  }
  return item;
}

function readNonEmptyArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) fail(path, "must be an array");
  if (value.length === 0) fail(path, "must not be empty");
  return value;
}

function readUniqueId(value: unknown, path: string, seen: Set<string>): string {
  const id = readNonBlankString(value, path);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) fail(path, "must use lower-kebab-case");
  if (seen.has(id)) fail(path, `duplicates corpus id “${id}”`);
  seen.add(id);
  return id;
}

function readFormula(value: unknown, path: string, allowEmpty: boolean): string {
  if (typeof value !== "string") fail(path, "must be a string");
  if (!allowEmpty && value.trim().length === 0) fail(path, "must not be blank");
  if (value.length > 160) fail(path, "must not exceed 160 characters");
  return value;
}

function readNonBlankString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) fail(path, "must be a non-blank string");
  return value;
}

function readFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(path, "must be a finite number");
  return value;
}

function readInteger(value: unknown, path: string): number {
  const number = readFiniteNumber(value, path);
  if (!Number.isInteger(number) || number < -2_147_483_648 || number > 2_147_483_647) {
    fail(path, "must be a 32-bit integer");
  }
  return number;
}

function readTolerance(value: unknown, path: string): number {
  const number = readFiniteNumber(value, path);
  if (number < 0) fail(path, "must not be negative");
  return number;
}

function readEnum<const T extends string>(value: unknown, path: string, options: readonly T[]): T {
  if (typeof value !== "string" || !options.includes(value as T)) {
    fail(path, `must be one of ${options.join(", ")}`);
  }
  return value as T;
}

function parseStrictJson(source: string): unknown {
  let cursor = 0;

  function skipWhitespace(): void {
    while (/\s/.test(source[cursor] ?? "")) cursor += 1;
  }

  function readString(): string {
    const start = cursor;
    cursor += 1;
    while (cursor < source.length) {
      const character = source[cursor];
      if (character === "\\") {
        cursor += 2;
      } else if (character === '"') {
        cursor += 1;
        try {
          return JSON.parse(source.slice(start, cursor)) as string;
        } catch {
          fail("$", `contains an invalid JSON string near character ${start + 1}`);
        }
      } else {
        cursor += 1;
      }
    }
    fail("$", `contains an unterminated JSON string near character ${start + 1}`);
  }

  function readPrimitive(): void {
    const start = cursor;
    while (cursor < source.length && !/[\s,\]}]/.test(source[cursor] ?? "")) cursor += 1;
    const token = source.slice(start, cursor);
    try {
      JSON.parse(token);
    } catch {
      fail("$", `contains invalid JSON near character ${start + 1}`);
    }
  }

  function readArray(): void {
    cursor += 1;
    skipWhitespace();
    if (source[cursor] === "]") {
      cursor += 1;
      return;
    }
    while (cursor < source.length) {
      readValue();
      skipWhitespace();
      if (source[cursor] === "]") {
        cursor += 1;
        return;
      }
      if (source[cursor] !== ",") fail("$", `expected “,” or “]” near character ${cursor + 1}`);
      cursor += 1;
      skipWhitespace();
    }
    fail("$", "contains an unterminated array");
  }

  function readMap(): void {
    cursor += 1;
    skipWhitespace();
    const keys = new Set<string>();
    if (source[cursor] === "}") {
      cursor += 1;
      return;
    }
    while (cursor < source.length) {
      if (source[cursor] !== '"') fail("$", `expected an object key near character ${cursor + 1}`);
      const key = readString();
      if (keys.has(key)) fail("$", `contains duplicate object key “${key}”`);
      keys.add(key);
      skipWhitespace();
      if (source[cursor] !== ":") fail("$", `expected “:” near character ${cursor + 1}`);
      cursor += 1;
      readValue();
      skipWhitespace();
      if (source[cursor] === "}") {
        cursor += 1;
        return;
      }
      if (source[cursor] !== ",") fail("$", `expected “,” or “}” near character ${cursor + 1}`);
      cursor += 1;
      skipWhitespace();
    }
    fail("$", "contains an unterminated object");
  }

  function readValue(): void {
    skipWhitespace();
    const character = source[cursor];
    if (character === "{") readMap();
    else if (character === "[") readArray();
    else if (character === '"') readString();
    else if (character === undefined) fail("$", "contains an incomplete value");
    else readPrimitive();
  }

  readValue();
  skipWhitespace();
  if (cursor !== source.length) fail("$", `contains trailing content near character ${cursor + 1}`);
  try {
    return JSON.parse(source) as unknown;
  } catch {
    fail("$", "is not valid JSON");
  }
}

function fail(path: string, message: string): never {
  throw new CorpusValidationError(path, message);
}
