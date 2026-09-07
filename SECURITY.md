# Security policy

## Supported version

Security fixes target the latest commit on the default branch. Earlier commits and local modifications are not supported separately.

## Report a vulnerability

Please use GitHub’s private vulnerability reporting from the repository’s **Security** tab. If that option is unavailable, email `info@ejupilabs.com` with the subject `IntegraDraw security report`.

Include the affected component, reproduction steps, expected impact and any suggested mitigation. Do not open a public issue or attach personal, confidential or production data.

I will acknowledge a complete report within five business days and keep you updated while I verify and address it.

## Scope

The policy covers the Java desktop application, the browser workbench, the build pipeline and the published GitHub Pages site. Numerical accuracy questions without a security impact belong in a regular issue.

## Java dependency alignment — 2026-09-07

The Maven build imports the Log4j 2.26.1 BOM to align the API used by Symja with the
runtime logging implementation. This prevents Maven from selecting Symja's older
Log4j API 2.25.4 and addresses
[CVE-2026-49844](https://logging.apache.org/security.html#CVE-2026-49844).
The release gate scans both the source dependency graph and the generated Java SBOM.

## Development dependency audit — 2026-09-07

The browser build lockfile uses PostCSS 8.5.25, addressing
[GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp), and nanoid 3.3.18,
addressing [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8).
An npm audit against `https://registry.npmjs.org/` reports no known vulnerabilities in
the current browser lockfile.

The compatible nanoid patch follows `vite → postcss@8.5.25 → nanoid@3.3.18` in the web
build toolchain. Its metadata and integrity hash were verified against the official registry
using a fresh npm cache; stale cached metadata had previously returned E404 for this version.
The existing audit gate remains enabled. Re-run the audit before release, because a clean
result describes the advisories known at the time of the check.
