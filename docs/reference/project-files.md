# Project Files Reference

Facts about the files, commands, and settings in this repository. For **why** they exist and how they fit together, see [`docs/explanation/node-toolchain.md`](../explanation/node-toolchain.md).

---

## Files

| File | Committed | Purpose | Supports comments |
|---|---|---|---|
| `.nvmrc` | Yes | Exact Node.js version for this project | No (version only) |
| `.npmrc` | Yes | npm settings for this project: `save-exact=true` | Yes (`#`) |
| `package.json` | Yes | Project manifest: name, scripts, dependencies | No (strict JSON) |
| `package-lock.json` | Yes | Exact version and integrity hash of every installed package. Never edit by hand. | No |
| `tsconfig.json` | Yes | TypeScript compiler settings | Yes (`//`) |
| `src/` | Yes | TypeScript source code (`server.ts`) | Yes (`//`) |
| `node_modules/` | No | Installed packages; recreated by `npm ci` | — |
| `dist/` | No | Compiled JavaScript; recreated by `tsc` | — |

**Rule:** commit what a person decides (versions, settings, source code). Do not commit what a tool regenerates.

---

## package.json fields

| Field | Value | Meaning |
|---|---|---|
| `name` | `devops-lab` | Project identifier |
| `version` | `1.0.0` | Project version |
| `private` | `true` | npm refuses to publish this project to the public registry |
| `license` | `UNLICENSED` | No license is granted (the repository contains no license file) |
| `type` | `module` | `.js` files are ES Modules (`import`/`export`) |
| `scripts` | — | Named commands, run with `npm run <name>` |
| `devDependencies` | `typescript`, `@types/node` | Packages needed only to build or develop |

`main` is intentionally absent: it tells *other* code which file to load when importing a library. This project is an application, not a library.

### npm scripts

| Script | Runs | Effect |
|---|---|---|
| `build` | `tsc` | Compiles `src/` to `dist/` |
| `start` | `node dist/server.js` | Runs the compiled server on port 3000. Run `build` first. |
| `test` | placeholder | Always fails; tests are not set up yet |

Inside scripts, npm finds tools in `node_modules/.bin/`, so `tsc` is the project's pinned version without `npx`. `npm start` and `npm test` work without `run`; other scripts need `npm run <name>`.

---

## .npmrc

```ini
save-exact=true
```

npm writes exact versions (`"7.0.2"`) instead of ranges (`"^7.0.2"`) when installing.

This file is committed. **Never put registry tokens or other credentials in it.** Credentials belong in the user-level `~/.npmrc` (outside the repository) or in CI secrets.

---

## tsconfig.json options

| Option | Value | Meaning |
|---|---|---|
| `include` | `["src"]` | Only files under `src/` are compiled (the default would be every `.ts` file in the project) |
| `rootDir` | `src` | TypeScript source location |
| `outDir` | `dist` | Compiled output location |
| `target` | `es2024` | JavaScript version to emit; supported natively by Node.js 24 |
| `module` | `nodenext` | Follow Node.js module rules; with `"type": "module"` this means ES Modules |
| `strict` | `true` | Enable all strict type checks |
| `types` | `["node"]` | Load type definitions from `@types/node` |
| `sourceMap` | `true` | Emit `.map` files so stack traces point to `.ts` source lines |

---

## ES Modules and CommonJS

| | CommonJS | ES Modules |
|---|---|---|
| Load | `const x = require("x")` | `import x from "x"` |
| Export | `module.exports = ...` | `export ...` |
| Origin | Node.js's original system | The JavaScript language standard |
| Selected by | `"type": "commonjs"` | `"type": "module"` |

This project uses **ES Modules**. Imports of the project's own files must use the `.js` extension, even in `.ts` source (`import { x } from "./config.js"`), because `tsc` does not rewrite import paths.

---

## npm commands

| Command | Effect |
|---|---|
| `npm install <pkg>@<version>` | Add a package; update `package.json` and `package-lock.json` |
| `npm install --save-dev <pkg>@<version>` | Same, as a devDependency |
| `npm ci` | Install exactly what the lockfile specifies; fail on any mismatch. Used in CI. |
| `npm run <script>` | Run a script from `package.json` |
| `npm ls --all` | Show the full dependency tree, including transitive dependencies |
| `npm audit` | Check installed versions against known security advisories |
| `npm view <pkg> dist-tags` | Show a package's tags (`latest`, `next`, ...). Tags are mutable labels. |
| `npm view <pkg> time --json` | Show publish dates of all versions |
| `npx <tool>` | Run a tool from the project's `node_modules/` |

### Platform-specific optional dependencies

Some tools ship as compiled binaries, one package per operating system and CPU (for example `@typescript/typescript-linux-x64`). They are declared as optional dependencies, and npm installs only the one matching the current machine. `npm ls --all` lists the others as `UNMET OPTIONAL DEPENDENCY`, which is expected. The lockfile records all of them with their hashes, so installs on other platforms are verified too.

---

## nvm commands

| Command | Effect |
|---|---|
| `nvm install <version>` | Download a Node.js version; verify it against official checksums |
| `nvm use` | Switch to the version in `.nvmrc` |
| `nvm ls` | List installed versions |

---

## Dependency rules

| Rule | Enforced by |
|---|---|
| Exact versions only, never ranges | `.npmrc` (`save-exact=true`) |
| Lockfile committed; CI installs with `npm ci` | Repository and CI configuration |
| Mutable references pinned by hash: GitHub Actions by full commit SHA, container images by `sha256` digest | Review |
| Immutable releases (npm versions, Node.js releases) pinned by exact version and verified by checksum | npm and nvm |
| No release younger than ~14 days is adopted (cooldown) | Review: `npm view <pkg> time --json` |
| Every install is checked with `npm ls --all`, including for lookalike package names (typosquatting) | Review |
| Updates arrive only through Dependabot pull requests and review | Dependabot configuration and review |
