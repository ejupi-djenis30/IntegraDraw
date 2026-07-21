const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const REVEAL_ENABLED_CLASS = "reveal-enabled";

interface RevealRuntime {
  readonly IntersectionObserver?: typeof IntersectionObserver;
  matchMedia(query: string): Pick<MediaQueryList, "matches">;
}

type RevealDocument = Pick<Document, "documentElement" | "querySelectorAll">;

export function installRevealObserver(
  root: RevealDocument = document,
  runtime: RevealRuntime = window,
): void {
  let observer: IntersectionObserver | undefined;

  try {
    const items = Array.from(root.querySelectorAll<HTMLElement>(".reveal"));
    const Observer = runtime.IntersectionObserver;

    if (items.length === 0 || runtime.matchMedia(REDUCED_MOTION_QUERY).matches || Observer === undefined) {
      return;
    }

    observer = new Observer(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer?.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12 },
    );

    for (const item of items) observer.observe(item);

    // CSS hides reveal items only after every observer registration succeeds.
    // If module startup fails before this point, the document remains readable.
    root.documentElement.classList.add(REVEAL_ENABLED_CLASS);
  } catch {
    try {
      observer?.disconnect();
    } catch {
      // A broken animation API must never block the calculator or page content.
    }
    root.documentElement.classList.remove(REVEAL_ENABLED_CLASS);
  }
}
