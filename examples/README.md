# examples

Two repos to point `abt` at. Structure only — no build tooling, no lockfiles, no
config files. Every script is an `echo`, so everything runs with plain `npm` and
nothing has to be installed first.

```sh
cd examples/solo      && abt
cd examples/monorepo  && abt
```

## solo

A normal single-package repo. `abt` lists its scripts and runs one. No workspace
detection happens, no location in the header, and `tab` is bound to nothing —
there is nowhere else to go.

`npm run fail` exits `3`, so `abt fail` is a quick check that exit codes survive
the trip back out.

## monorepo

```
monorepo/
  package.json          workspaces: ["apps/*", "packages/*"]
  apps/
    web/                @example/web     4 scripts
    admin/              @example/admin   3 scripts
    api/                @example/api     5 scripts
  packages/
    ui/                 @example/ui      3 scripts
    utils/              @example/utils   2 scripts
    config/             config           1 script
    tokens/             @example/tokens  no scripts
```

Things worth poking at:

- **Run `abt` from `apps/web`** — you get web's four scripts and nothing else,
  plus a tip that `tab` browses the workspace.
- **Press `tab`** — the package list, each entry named the way you would type
  it, with its script count, its location, and a marker on the one you are
  standing in. Pick one to see its scripts.
- **Press `escape`** — back to the package list from a package's scripts, and
  back to your own scripts from the package list. The prior selection is
  restored each time.
- **Run `abt` from the root** — same menu, rooted at the workspace root.
- **`packages/tokens` never appears.** It has no scripts, so it is omitted from
  the package list rather than offering an empty submenu.
- **`config` is deliberately unscoped** while everything else is `@example/*`.
  Both forms resolve: `abt config check`, `abt ui storybook`, and
  `abt @example/ui storybook` all work.
- **The menu shows the name you would type.** `@example/utils` displays as
  `utils`, and members sort by that displayed name.
- **Long commands truncate** rather than wrapping — `root build` and `web build`
  are long on purpose. Resize the terminal and they re-fit.
- **`abt api migrate` from anywhere in the repo** runs in `apps/api` without you
  changing directory.
- **Typos suggest.** Try `abt biuld`, or `abt wbe test`.

### Trying the pnpm layout

The root declares its members through the `workspaces` field so the example runs
with npm and no install step. `abt` reads `pnpm-workspace.yaml` the same way — to
try that path, drop the `workspaces` field and add:

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

The package manager `abt` invokes comes from `packageManager` in the root
`package.json` when it is set, and otherwise from whichever lockfile sits beside
it.
