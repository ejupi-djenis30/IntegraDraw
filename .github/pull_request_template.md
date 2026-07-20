## Summary

<!-- Explain the user-visible or engineering outcome, not only the files changed. -->

## Why

<!-- Describe the problem, constraint, or decision that makes this change necessary. -->

## Validation

- [ ] `./mvnw --batch-mode --no-transfer-progress verify`
- [ ] `cd web && npm ci && npm run check && npm run build`
- [ ] Relevant manual behavior or visual states were checked
- [ ] Security and privacy impact was reviewed

Commands, test counts, screenshots, or recordings:

<!-- Add concise evidence. Use N/A only when a check genuinely does not apply. -->

## Release impact

- [ ] No release metadata changes
- [ ] `pom.xml`, `web/package.json`, `web/package-lock.json`, and `CHANGELOG.md` stay synchronized
- [ ] The release-readiness candidate, vulnerability gate, and reproducibility gate pass
- [ ] No tag or GitHub Release is created by this pull request

## Review notes

<!-- Call out risky code, follow-up work, compatibility constraints, or deliberate non-goals. -->
