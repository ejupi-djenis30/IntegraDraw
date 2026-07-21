import { beforeEach, describe, expect, it, vi } from "vitest";

import { installRevealObserver } from "./reveal";

class RecordingObserver implements IntersectionObserver {
  static instances: RecordingObserver[] = [];

  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0.12];
  readonly observed: Element[] = [];
  readonly unobserved: Element[] = [];
  disconnected = false;

  constructor(
    readonly callback: IntersectionObserverCallback,
    _options?: IntersectionObserverInit,
  ) {
    RecordingObserver.instances.push(this);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  observe(target: Element): void {
    this.observed.push(target);
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  unobserve(target: Element): void {
    this.unobserved.push(target);
  }
}

interface RevealFixture {
  readonly document: Document;
  readonly items: HTMLElement[];
  readonly rootClasses: Set<string>;
}

function createElement(): HTMLElement {
  const classes = new Set<string>();
  return {
    classList: {
      add: (...tokens: string[]) => tokens.forEach((token) => classes.add(token)),
      contains: (token: string) => classes.has(token),
      remove: (...tokens: string[]) => tokens.forEach((token) => classes.delete(token)),
    },
  } as unknown as HTMLElement;
}

function createFixture(itemCount = 2): RevealFixture {
  const items = Array.from({ length: itemCount }, createElement);
  const rootClasses = new Set<string>();
  const documentFixture = {
    documentElement: {
      classList: {
        add: (...tokens: string[]) => tokens.forEach((token) => rootClasses.add(token)),
        remove: (...tokens: string[]) => tokens.forEach((token) => rootClasses.delete(token)),
      },
    },
    querySelectorAll: vi.fn(() => items),
  } as unknown as Document;

  return { document: documentFixture, items, rootClasses };
}

function createRuntime(
  matches: boolean,
  Observer: typeof IntersectionObserver | undefined,
): Window {
  return {
    IntersectionObserver: Observer,
    matchMedia: vi.fn(() => ({ matches })),
  } as unknown as Window;
}

beforeEach(() => {
  RecordingObserver.instances = [];
});

describe("reveal observer", () => {
  it("enables motion only after every reveal item is observed", () => {
    const fixture = createFixture();

    installRevealObserver(fixture.document, createRuntime(false, RecordingObserver));

    const observer = RecordingObserver.instances[0];
    expect(observer?.observed).toEqual(fixture.items);
    expect(fixture.rootClasses).toContain("reveal-enabled");
  });

  it("reveals intersecting items and stops observing them", () => {
    const fixture = createFixture();
    installRevealObserver(fixture.document, createRuntime(false, RecordingObserver));
    const observer = RecordingObserver.instances[0];
    const target = fixture.items[0];
    if (observer === undefined || target === undefined) throw new Error("Reveal fixture was not installed.");

    observer.callback(
      [{ isIntersecting: true, target } as unknown as IntersectionObserverEntry],
      observer,
    );

    expect(target.classList.contains("is-visible")).toBe(true);
    expect(observer.unobserved).toEqual([target]);
  });

  it("keeps content fail-open when observer registration throws", () => {
    class FailingObserver extends RecordingObserver {
      override observe(target: Element): void {
        super.observe(target);
        throw new Error("Observer registration failed");
      }
    }

    const fixture = createFixture();
    installRevealObserver(
      fixture.document,
      createRuntime(false, FailingObserver as unknown as typeof IntersectionObserver),
    );

    expect(fixture.rootClasses).not.toContain("reveal-enabled");
    expect(RecordingObserver.instances[0]?.disconnected).toBe(true);
  });

  it("does not let animation feature detection block module startup", () => {
    const fixture = createFixture();
    const runtime = {
      IntersectionObserver: RecordingObserver,
      matchMedia: vi.fn(() => {
        throw new Error("Media queries are unavailable");
      }),
    } as unknown as Window;

    expect(() => installRevealObserver(fixture.document, runtime)).not.toThrow();
    expect(fixture.rootClasses).not.toContain("reveal-enabled");
    expect(RecordingObserver.instances).toHaveLength(0);
  });

  it("leaves content visible for reduced motion and unsupported browsers", () => {
    const reducedMotionFixture = createFixture();
    installRevealObserver(reducedMotionFixture.document, createRuntime(true, RecordingObserver));

    const unsupportedFixture = createFixture();
    installRevealObserver(unsupportedFixture.document, createRuntime(false, undefined));

    expect(RecordingObserver.instances).toHaveLength(0);
    expect(reducedMotionFixture.rootClasses).not.toContain("reveal-enabled");
    expect(unsupportedFixture.rootClasses).not.toContain("reveal-enabled");
  });
});
