# Contributing to IntegraDraw

Thanks for helping make numerical integration easier to inspect. Focused changes with a clear
mathematical or usability benefit are the easiest to review.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Set up the project

The desktop app requires Java 17 and Maven 3.9 or newer:

```sh
mvn clean verify
```

The browser workbench requires Node.js 22:

```sh
cd web
npm ci
npm run check
```

## Before opening a pull request

1. Start from the latest `master` and keep the branch focused on one change.
2. Add a regression test for parser, validation or numerical changes.
3. Run both verification commands when shared behavior changes.
4. Keep generated `target`, `dist` and `node_modules` files out of Git.
5. Update the README or demo notes when the public behavior changes.

## Project guardrails

- Keep interval and rendering limits aligned between Java and TypeScript.
- Do not replace the expression parser with `eval` or another code-execution shortcut.
- Preserve signed areas and make approximation error visible.
- Use reproducible examples in screenshots and demo recordings.
- Keep the original contributors and project history credited accurately.

## Security reports

Do not open a public issue for a suspected vulnerability. Follow [SECURITY.md](SECURITY.md) so the
report can be handled privately.
