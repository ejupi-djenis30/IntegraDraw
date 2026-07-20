# Changelog

Notable changes to IntegraDraw are recorded here.

## Unreleased

- Added a tag-gated release pipeline that builds and verifies the desktop JAR and static web application before publication.
- Added synchronized Java/web/tag version checks, executable-JAR smoke testing and deterministic release-bundle validation.
- Added consolidated checksums, Java and web CycloneDX SBOMs, dependency evidence, source-commit records and tag-only GitHub attestations.
- Documented the immutable draft-to-public release process without creating a tag or changing the repository's licensing status.

## 1.1.0 — 2026-07-19

- Rebuilt the browser workbench in strict TypeScript with a dependency-free expression parser.
- Corrected interval handling and aligned numerical limits across the Java and browser apps.
- Added visible midpoint, trapezoidal and Simpson-reference comparisons.
- Added automated Java and browser tests, reproducible Pages deployment and a portfolio demo.
- Added packaged desktop artifacts, checksums, a CycloneDX SBOM and dependency automation.

## 1.0.0 — 2023

- Created the original Java Swing numerical-integration prototype.
