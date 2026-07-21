# Shared numerical corpus

`numerical-corpus.json` is the cross-runtime contract for the Java desktop and TypeScript web
integration engines. JUnit and Vitest read the same file in CI.

Each integral records its formula, bounds, segment count and signed analytical area. Midpoint,
trapezoidal and Simpson values use explicit Java and TypeScript fields so small, legitimate
floating-point differences never have to be hidden behind a broad shared tolerance. The separate
Simpson references are intentional: the desktop uses 1,024 intervals while the web workbench uses
8,192. Validation cases also document the deliberate 1,000 versus 500 interactive segment limits.

All integer fields share the signed 32-bit domain used by the Java records. Equivalent JSON number
forms such as `1`, `1.0` and `1e0` are accepted only when their mathematical value is integral.

Update the corpus only when the numerical contract changes deliberately. Do not widen a tolerance
to hide a regression; record a justified runtime-specific expectation instead.
