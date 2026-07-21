export type Evaluate = (x: number) => number;

export interface CompiledExpression {
  readonly source: string;
  evaluate(x: number): number;
}

export type NumericalErrorCategory = "expression" | "bounds" | "segments" | "evaluation";

export class NumericalRangeError extends RangeError {
  readonly category: Exclude<NumericalErrorCategory, "expression">;
  readonly code: Exclude<NumericalErrorCategory, "expression">;

  constructor(category: Exclude<NumericalErrorCategory, "expression">, message: string) {
    super(message);
    this.name = "NumericalRangeError";
    this.category = category;
    this.code = category;
  }
}

type Token =
  | { type: "number"; value: number; position: number }
  | { type: "identifier"; value: string; position: number }
  | { type: "operator"; value: "+" | "-" | "*" | "/" | "^"; position: number }
  | { type: "left" | "right" | "comma" | "eof"; position: number };

const FUNCTIONS: Readonly<Record<string, (value: number) => number>> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log10,
  sqrt: Math.sqrt,
  abs: Math.abs,
};

const CONSTANTS: Readonly<Record<string, number>> = {
  e: Math.E,
  pi: Math.PI,
};

const MAX_SOURCE_LENGTH = 160;
const MAX_TOKENS = 256;

export class ExpressionError extends Error {
  readonly position: number;
  readonly category = "expression" as const;
  readonly code = "expression" as const;

  constructor(message: string, position: number) {
    super(`${message} at character ${position + 1}.`);
    this.name = "ExpressionError";
    this.position = position;
  }
}

export function compileExpression(source: string): CompiledExpression {
  const normalized = source.trim();
  if (normalized.length === 0) {
    throw new ExpressionError("Enter a function", 0);
  }
  if (normalized.length > MAX_SOURCE_LENGTH) {
    throw new ExpressionError(`Keep the function under ${MAX_SOURCE_LENGTH} characters`, MAX_SOURCE_LENGTH);
  }

  const parser = new Parser(tokenize(normalized));
  const evaluate = parser.parse();
  return {
    source: normalized,
    evaluate(x: number): number {
      const value = evaluate(x);
      if (!Number.isFinite(value)) {
        throw new NumericalRangeError("evaluation", `The function is not finite at x = ${formatPoint(x)}.`);
      }
      return value;
    },
  };
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let position = 0;

  while (position < source.length) {
    const character = source[position];
    if (character === undefined) break;

    if (/\s/.test(character)) {
      position += 1;
      continue;
    }

    if (/[0-9.]/.test(character)) {
      const start = position;
      let sawDot = false;
      while (position < source.length) {
        const part = source[position];
        if (part === ".") {
          if (sawDot) break;
          sawDot = true;
          position += 1;
        } else if (part !== undefined && /[0-9]/.test(part)) {
          position += 1;
        } else {
          break;
        }
      }
      if (position < source.length && /[eE]/.test(source[position] ?? "")) {
        const exponentStart = position;
        position += 1;
        if (/[+-]/.test(source[position] ?? "")) position += 1;
        const digitsStart = position;
        while (/[0-9]/.test(source[position] ?? "")) position += 1;
        if (digitsStart === position) position = exponentStart;
      }
      const raw = source.slice(start, position);
      const value = Number(raw);
      if (!Number.isFinite(value) || raw === ".") {
        throw new ExpressionError("Invalid number", start);
      }
      tokens.push({ type: "number", value, position: start });
    } else if (/[A-Za-z]/.test(character)) {
      const start = position;
      while (/[A-Za-z0-9_]/.test(source[position] ?? "")) position += 1;
      tokens.push({ type: "identifier", value: source.slice(start, position).toLowerCase(), position: start });
    } else if (character === "+" || character === "-" || character === "*" || character === "/" || character === "^") {
      tokens.push({ type: "operator", value: character, position });
      position += 1;
    } else if (character === "(") {
      tokens.push({ type: "left", position });
      position += 1;
    } else if (character === ")") {
      tokens.push({ type: "right", position });
      position += 1;
    } else if (character === ",") {
      tokens.push({ type: "comma", position });
      position += 1;
    } else {
      throw new ExpressionError(`Unsupported character “${character}”`, position);
    }

    if (tokens.length > MAX_TOKENS) {
      throw new ExpressionError("The function is too complex", position);
    }
  }

  tokens.push({ type: "eof", position: source.length });
  return tokens;
}

class Parser {
  private index = 0;

  constructor(private readonly tokens: readonly Token[]) {}

  parse(): Evaluate {
    const expression = this.parseAddition();
    const next = this.peek();
    if (next.type !== "eof") {
      throw new ExpressionError("Expected an operator", next.position);
    }
    return expression;
  }

  private parseAddition(): Evaluate {
    let left = this.parseMultiplication();
    while (this.matchesOperator("+") || this.matchesOperator("-")) {
      const operator = this.consume() as Extract<Token, { type: "operator" }>;
      const right = this.parseMultiplication();
      const previous = left;
      left = operator.value === "+" ? (x) => previous(x) + right(x) : (x) => previous(x) - right(x);
    }
    return left;
  }

  private parseMultiplication(): Evaluate {
    let left = this.parseUnary();
    while (this.matchesOperator("*") || this.matchesOperator("/")) {
      const operator = this.consume() as Extract<Token, { type: "operator" }>;
      const right = this.parseUnary();
      const previous = left;
      left = operator.value === "*" ? (x) => previous(x) * right(x) : (x) => previous(x) / right(x);
    }
    return left;
  }

  private parseUnary(): Evaluate {
    if (this.matchesOperator("+") || this.matchesOperator("-")) {
      const operator = this.consume() as Extract<Token, { type: "operator" }>;
      const operand = this.parseUnary();
      return operator.value === "+" ? operand : (x) => -operand(x);
    }
    return this.parsePower();
  }

  private parsePower(): Evaluate {
    const base = this.parsePrimary();
    if (!this.matchesOperator("^")) return base;
    this.consume();
    const exponent = this.parseUnary();
    return (x) => Math.pow(base(x), exponent(x));
  }

  private parsePrimary(): Evaluate {
    const token = this.consume();
    if (token.type === "number") {
      return () => token.value;
    }
    if (token.type === "identifier") {
      if (token.value === "x") return (x) => x;
      const constant = CONSTANTS[token.value];
      if (constant !== undefined) return () => constant;

      const fn = FUNCTIONS[token.value];
      if (fn === undefined) {
        throw new ExpressionError(`Unknown name “${token.value}”`, token.position);
      }
      this.expect("left", `Expected “(” after ${token.value}`);
      const argument = this.parseAddition();
      this.expect("right", "Expected “)”");
      return (x) => fn(argument(x));
    }
    if (token.type === "left") {
      const expression = this.parseAddition();
      this.expect("right", "Expected “)”");
      return expression;
    }
    throw new ExpressionError("Expected a number, x or a function", token.position);
  }

  private expect(type: Token["type"], message: string): void {
    const token = this.consume();
    if (token.type !== type) throw new ExpressionError(message, token.position);
  }

  private matchesOperator(operator: Extract<Token, { type: "operator" }>["value"]): boolean {
    const token = this.peek();
    return token.type === "operator" && token.value === operator;
  }

  private peek(): Token {
    return this.tokens[this.index] ?? { type: "eof", position: 0 };
  }

  private consume(): Token {
    const token = this.peek();
    this.index += 1;
    return token;
  }
}

function formatPoint(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toPrecision(5);
}
