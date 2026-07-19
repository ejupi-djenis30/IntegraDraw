import type { CompiledExpression } from "./math/expression";
import { createApproximationGeometry } from "./math/integration";

interface PlotState {
  readonly expression: CompiledExpression;
  readonly lower: number;
  readonly upper: number;
  readonly segments: number;
}

interface Range {
  readonly minimum: number;
  readonly maximum: number;
}

const COLORS = {
  ink: "#0e1111",
  muted: "#686d69",
  grid: "rgba(14, 17, 17, 0.10)",
  axis: "rgba(14, 17, 17, 0.48)",
  paper: "#f8f5ee",
  oxide: "#b44a2a",
  oxideFill: "rgba(180, 74, 42, 0.15)",
  blue: "#225c7e",
  blueFill: "rgba(34, 92, 126, 0.12)",
} as const;

export class PlotView {
  private readonly context: CanvasRenderingContext2D;
  private state: PlotState | undefined;
  private zoom = 1;
  private resizeObserver: ResizeObserver | undefined;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("Canvas rendering is not available in this browser.");
    this.context = context;

    this.canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      this.setZoom(this.zoom * Math.exp(event.deltaY * 0.001));
    }, { passive: false });
    this.canvas.addEventListener("dblclick", () => this.resetZoom());

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.render());
      this.resizeObserver.observe(this.canvas);
    }
  }

  setState(state: PlotState): void {
    this.state = state;
    this.render();
  }

  zoomIn(): void {
    this.setZoom(this.zoom / 1.28);
  }

  zoomOut(): void {
    this.setZoom(this.zoom * 1.28);
  }

  resetZoom(): void {
    this.setZoom(1);
  }

  render(): void {
    this.resizeCanvas();
    const width = this.canvas.width / this.pixelRatio();
    const height = this.canvas.height / this.pixelRatio();
    const context = this.context;
    context.save();
    context.setTransform(this.pixelRatio(), 0, 0, this.pixelRatio(), 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = COLORS.paper;
    context.fillRect(0, 0, width, height);

    if (this.state === undefined) {
      context.fillStyle = COLORS.muted;
      context.font = "500 15px system-ui, sans-serif";
      context.fillText("Enter a valid function to draw it.", 28, height / 2);
      context.restore();
      return;
    }

    const padding = { left: width < 600 ? 48 : 64, right: 24, top: 30, bottom: 44 };
    const plotWidth = Math.max(1, width - padding.left - padding.right);
    const plotHeight = Math.max(1, height - padding.top - padding.bottom);
    const center = (this.state.lower + this.state.upper) / 2;
    const halfSpan = Math.max((this.state.upper - this.state.lower) * 0.6 * this.zoom, 0.2);
    const xRange = { minimum: center - halfSpan, maximum: center + halfSpan };
    const yRange = this.findYRange(xRange, Math.max(260, Math.floor(plotWidth)));

    this.drawGrid(padding.left, padding.top, plotWidth, plotHeight, xRange, yRange);
    this.drawTrapezoids(padding.left, padding.top, plotWidth, plotHeight, xRange, yRange);
    this.drawRectangles(padding.left, padding.top, plotWidth, plotHeight, xRange, yRange);
    this.drawCurve(padding.left, padding.top, plotWidth, plotHeight, xRange, yRange);
    context.restore();
  }

  private resizeCanvas(): void {
    const bounds = this.canvas.getBoundingClientRect();
    const cssWidth = Math.max(320, bounds.width || this.canvas.clientWidth || 960);
    const cssHeight = Math.max(300, bounds.height || this.canvas.clientHeight || 620);
    const ratio = this.pixelRatio();
    const pixelWidth = Math.round(cssWidth * ratio);
    const pixelHeight = Math.round(cssHeight * ratio);
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }
  }

  private findYRange(xRange: Range, samples: number): Range {
    const state = this.requireState();
    let minimum = 0;
    let maximum = 0;
    let found = false;
    for (let index = 0; index <= samples; index += 1) {
      const x = xRange.minimum + ((xRange.maximum - xRange.minimum) * index) / samples;
      try {
        const y = state.expression.evaluate(x);
        if (Math.abs(y) <= 1_000_000) {
          minimum = found ? Math.min(minimum, y) : Math.min(0, y);
          maximum = found ? Math.max(maximum, y) : Math.max(0, y);
          found = true;
        }
      } catch {
        // Discontinuities become gaps in the plot.
      }
    }
    if (!found) throw new RangeError("No finite values are visible in this range.");
    let span = maximum - minimum;
    if (span < 1e-9) span = Math.max(2, Math.abs(maximum) * 0.5);
    const margin = span * 0.14;
    return { minimum: minimum - margin, maximum: maximum + margin };
  }

  private drawGrid(left: number, top: number, width: number, height: number, xRange: Range, yRange: Range): void {
    const context = this.context;
    context.lineWidth = 1;
    context.font = "500 10px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "top";
    for (let index = 0; index <= 8; index += 1) {
      const x = left + (width * index) / 8;
      context.strokeStyle = COLORS.grid;
      context.beginPath();
      context.moveTo(x, top);
      context.lineTo(x, top + height);
      context.stroke();
      context.fillStyle = COLORS.muted;
      const value = xRange.minimum + ((xRange.maximum - xRange.minimum) * index) / 8;
      context.fillText(formatAxis(value), x, top + height + 14);
    }

    context.textAlign = "right";
    context.textBaseline = "middle";
    for (let index = 0; index <= 6; index += 1) {
      const y = top + (height * index) / 6;
      context.strokeStyle = COLORS.grid;
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(left + width, y);
      context.stroke();
      context.fillStyle = COLORS.muted;
      const value = yRange.maximum - ((yRange.maximum - yRange.minimum) * index) / 6;
      context.fillText(formatAxis(value), left - 9, y);
    }

    context.strokeStyle = COLORS.axis;
    context.lineWidth = 1.3;
    if (xRange.minimum <= 0 && xRange.maximum >= 0) {
      const x = mapX(0, left, width, xRange);
      context.beginPath();
      context.moveTo(x, top);
      context.lineTo(x, top + height);
      context.stroke();
    }
    if (yRange.minimum <= 0 && yRange.maximum >= 0) {
      const y = mapY(0, top, height, yRange);
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(left + width, y);
      context.stroke();
    }
  }

  private drawRectangles(
    left: number,
    top: number,
    width: number,
    height: number,
    xRange: Range,
    yRange: Range,
  ): void {
    const state = this.requireState();
    const geometry = createApproximationGeometry(state.expression, state.lower, state.upper, state.segments);
    const zeroY = mapY(0, top, height, yRange);
    this.context.lineWidth = 1;
    for (const rectangle of geometry.rectangles) {
      const x1 = mapX(rectangle.left, left, width, xRange);
      const x2 = mapX(rectangle.right, left, width, xRange);
      const valueY = mapY(rectangle.height, top, height, yRange);
      const y = Math.min(zeroY, valueY);
      const boxHeight = Math.max(0.5, Math.abs(valueY - zeroY));
      this.context.fillStyle = COLORS.blueFill;
      this.context.fillRect(x1, y, Math.max(0.5, x2 - x1), boxHeight);
      this.context.strokeStyle = COLORS.blue;
      this.context.strokeRect(x1, y, Math.max(0.5, x2 - x1), boxHeight);
    }
  }

  private drawTrapezoids(
    left: number,
    top: number,
    width: number,
    height: number,
    xRange: Range,
    yRange: Range,
  ): void {
    const state = this.requireState();
    const geometry = createApproximationGeometry(state.expression, state.lower, state.upper, state.segments);
    const zeroY = mapY(0, top, height, yRange);
    this.context.lineWidth = 1.1;
    for (const trapezoid of geometry.trapezoids) {
      const x1 = mapX(trapezoid.left, left, width, xRange);
      const x2 = mapX(trapezoid.right, left, width, xRange);
      const y1 = mapY(trapezoid.leftHeight, top, height, yRange);
      const y2 = mapY(trapezoid.rightHeight, top, height, yRange);
      this.context.beginPath();
      this.context.moveTo(x1, zeroY);
      this.context.lineTo(x1, y1);
      this.context.lineTo(x2, y2);
      this.context.lineTo(x2, zeroY);
      this.context.closePath();
      this.context.fillStyle = COLORS.oxideFill;
      this.context.fill();
      this.context.strokeStyle = COLORS.oxide;
      this.context.beginPath();
      this.context.moveTo(x1, y1);
      this.context.lineTo(x2, y2);
      this.context.stroke();
    }
  }

  private drawCurve(left: number, top: number, width: number, height: number, xRange: Range, yRange: Range): void {
    const state = this.requireState();
    this.context.strokeStyle = COLORS.ink;
    this.context.lineWidth = 2.6;
    this.context.lineJoin = "round";
    this.context.lineCap = "round";
    this.context.beginPath();
    let drawing = false;
    let previousY = 0;
    for (let pixel = 0; pixel <= width; pixel += 1) {
      const x = xRange.minimum + ((xRange.maximum - xRange.minimum) * pixel) / width;
      try {
        const y = mapY(state.expression.evaluate(x), top, height, yRange);
        if (!drawing || Math.abs(y - previousY) > height * 2) this.context.moveTo(left + pixel, y);
        else this.context.lineTo(left + pixel, y);
        drawing = true;
        previousY = y;
      } catch {
        drawing = false;
      }
    }
    this.context.stroke();
  }

  private setZoom(requested: number): void {
    this.zoom = Math.max(0.3, Math.min(6, requested));
    this.render();
  }

  private requireState(): PlotState {
    if (this.state === undefined) throw new Error("Plot state is unavailable.");
    return this.state;
  }

  private pixelRatio(): number {
    return Math.min(window.devicePixelRatio || 1, 2);
  }
}

function mapX(value: number, left: number, width: number, range: Range): number {
  return left + ((value - range.minimum) / (range.maximum - range.minimum)) * width;
}

function mapY(value: number, top: number, height: number, range: Range): number {
  return top + ((range.maximum - value) / (range.maximum - range.minimum)) * height;
}

function formatAxis(value: number): string {
  const absolute = Math.abs(value);
  if ((absolute > 0 && absolute < 0.001) || absolute >= 10_000) return value.toExponential(1);
  return Number(value.toFixed(2)).toString();
}
