import "./styles.css";

import { compileExpression } from "./math/expression";
import { analyzeIntegral } from "./math/integration";
import { PlotView } from "./plot";
import { installRevealObserver } from "./reveal";

installRevealObserver();

interface Preset {
  readonly formula: string;
  readonly lower: number;
  readonly upper: number;
  readonly segments: number;
}

const PRESETS: Readonly<Record<string, Preset>> = {
  bell: { formula: "exp(-x^2)", lower: -3, upper: 3, segments: 24 },
  quadratic: { formula: "x^2 - 2", lower: -2.5, upper: 2.5, segments: 18 },
  sine: { formula: "sin(x)", lower: -6, upper: 6, segments: 28 },
  damped: { formula: "sin(3*x) / (1+x^2)", lower: -5, upper: 5, segments: 42 },
};

const formulaInput = element<HTMLInputElement>("formula");
const lowerInput = element<HTMLInputElement>("lower");
const upperInput = element<HTMLInputElement>("upper");
const segmentInput = element<HTMLInputElement>("segments");
const segmentOutput = element<HTMLOutputElement>("segment-output");
const status = element<HTMLElement>("status");
const equationDisplay = element<HTMLElement>("equation-display");
const midpointValue = element<HTMLElement>("midpoint-value");
const trapezoidalValue = element<HTMLElement>("trapezoidal-value");
const referenceValue = element<HTMLElement>("reference-value");
const midpointError = element<HTMLElement>("midpoint-error");
const trapezoidalError = element<HTMLElement>("trapezoidal-error");
const plot = new PlotView(element<HTMLCanvasElement>("plot"));

let updateTimer: number | undefined;

for (const input of [formulaInput, lowerInput, upperInput, segmentInput]) {
  input.addEventListener("input", scheduleUpdate);
  input.addEventListener("change", scheduleUpdate);
}

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-preset]")) {
  button.addEventListener("click", () => {
    const name = button.dataset.preset;
    if (name === undefined) return;
    const preset = PRESETS[name];
    if (preset === undefined) return;

    formulaInput.value = preset.formula;
    lowerInput.value = preset.lower.toString();
    upperInput.value = preset.upper.toString();
    segmentInput.value = preset.segments.toString();
    for (const candidate of document.querySelectorAll("[data-preset]")) candidate.classList.remove("is-active");
    button.classList.add("is-active");
    update();
  });
}

element<HTMLButtonElement>("zoom-in").addEventListener("click", () => plot.zoomIn());
element<HTMLButtonElement>("zoom-out").addEventListener("click", () => plot.zoomOut());
element<HTMLButtonElement>("zoom-reset").addEventListener("click", () => plot.resetZoom());

update();

function scheduleUpdate(): void {
  window.clearTimeout(updateTimer);
  updateTimer = window.setTimeout(update, 120);
  if (document.activeElement === formulaInput) {
    for (const candidate of document.querySelectorAll("[data-preset]")) candidate.classList.remove("is-active");
  }
}

function update(): void {
  segmentOutput.value = segmentInput.value;
  const lower = Number(lowerInput.value);
  const upper = Number(upperInput.value);
  const segments = Number(segmentInput.value);

  for (const input of [formulaInput, lowerInput, upperInput, segmentInput]) {
    input.removeAttribute("aria-invalid");
  }

  try {
    const expression = compileExpression(formulaInput.value);
    const result = analyzeIntegral(expression, lower, upper, segments);
    midpointValue.textContent = formatResult(result.midpoint);
    trapezoidalValue.textContent = formatResult(result.trapezoidal);
    referenceValue.textContent = formatResult(result.reference);
    midpointError.textContent = `Error ${formatError(result.midpointError)}`;
    trapezoidalError.textContent = `Error ${formatError(result.trapezoidalError)}`;
    equationDisplay.textContent = typographicFormula(expression.source);
    status.textContent = `${segments} segments on [${formatBound(lower)}, ${formatBound(upper)}]. Scroll the graph or use the controls to zoom.`;
    status.classList.remove("is-error");
    plot.setState({ expression, lower, upper, segments });
  } catch (error) {
    markInvalidInput(lower, upper, segments);
    for (const target of [midpointValue, trapezoidalValue, referenceValue]) target.textContent = "—";
    midpointError.textContent = "Error —";
    trapezoidalError.textContent = "Error —";
    status.textContent = error instanceof Error ? error.message : "The calculation could not be completed.";
    status.classList.add("is-error");
  }
}

function markInvalidInput(lower: number, upper: number, segments: number): void {
  try {
    compileExpression(formulaInput.value);
  } catch {
    formulaInput.setAttribute("aria-invalid", "true");
    return;
  }

  if (!Number.isFinite(lower) || lower >= upper || upper - lower > 10_000) {
    lowerInput.setAttribute("aria-invalid", "true");
  }
  if (!Number.isFinite(upper) || lower >= upper || upper - lower > 10_000) {
    upperInput.setAttribute("aria-invalid", "true");
  }
  if (!Number.isInteger(segments) || segments < 1 || segments > 500) {
    segmentInput.setAttribute("aria-invalid", "true");
  }
}

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`Missing required element #${id}.`);
  return found as T;
}

function formatResult(value: number): string {
  const absolute = Math.abs(value);
  if ((absolute > 0 && absolute < 0.00001) || absolute >= 1_000_000) return value.toExponential(5);
  return value.toFixed(6);
}

function formatError(value: number): string {
  if (value === 0) return "0";
  return value < 0.0001 ? value.toExponential(2) : value.toFixed(6);
}

function formatBound(value: number): string {
  return Number(value.toFixed(3)).toString();
}

function typographicFormula(source: string): string {
  return source.replaceAll("-", "−").replaceAll("^2", "²").replaceAll("*", "·");
}
