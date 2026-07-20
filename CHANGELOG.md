# Changelog

Notable changes to IntegraDraw are recorded here.

## Unreleased

- No unreleased changes.

## 1.1.0 — 2026-07-19

- Added a license-gated release pipeline with independent security and reproducibility checks before publication.
- Added stable-only Java, web, lockfile, changelog and tag version validation.
- Made the executable JAR, static web archive and normalized CycloneDX SBOMs reproducible across clean builds.
- Added semantic artifact validation, exact SBOM-to-dependency reconciliation, source-commit records and consolidated checksums.
- Added attestations for every candidate asset and a recoverable, contract-bound publisher that verifies immutable release state.
- Upgraded the transitive Jackson stack to 2.21.5 to resolve CVE-2026-54512, CVE-2026-54513 and CVE-2026-54515.
- Rebuilt the browser workbench in strict TypeScript with a dependency-free expression parser.
- Corrected interval handling and aligned numerical limits across the Java and browser apps.
- Added visible midpoint, trapezoidal and Simpson-reference comparisons.
- Added automated Java and browser tests, reproducible Pages deployment and a portfolio demo.
- Added packaged desktop artifacts, checksums, a CycloneDX SBOM and dependency automation.

## 1.0.0 — 2023

- Created the original Java Swing numerical-integration prototype.
