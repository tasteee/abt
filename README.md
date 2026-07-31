# abt

CLI tool to list, select, and execute package scripts — across a workspace.
(Cross platform.)

```sh
npm i -g abt
```

## Usage

```sh
abt
```

`abt` shows the scripts of the package you are standing in. Pick one and it runs.

```
? abt · apps/web
❯ dev        vite
  build      tsc && vite build
  test       vitest run
  tab to browse packages
```

In a monorepo, `tab` opens the rest of the workspace. Pick a package to see its
scripts; `escape` walks back up either step.

```
? abt · packages
❯ root     6 scripts · workspace root
  admin    3 scripts · apps/admin
  api      5 scripts · apps/api
  ui       3 scripts · packages/ui
  web      4 scripts · apps/web · you are here
  escape to go back
```

Once you know the answer, skip the menu:

```sh
abt build              # run "build" in the package you are in
abt api build          # run "build" in the api package
abt api                # pick a script from the api package
abt test -- --watch    # forward arguments to the script
abt --list             # every script, one per line, pipeable
```

Workspaces are detected from `pnpm-workspace.yaml` or a `workspaces` field in
`package.json`. The package manager comes from `packageManager` in
`package.json`, falling back to whichever lockfile sits at the workspace root.

In a pipe or in CI, `abt` prints the script list instead of blocking on a menu
nobody can answer. It always exits with the script's own exit code.

## Dependencies

```sh
abt deps               # dependencies of the package you are in
abt deps web           # dependencies of a workspace package
```

`abt deps` presents `dependencies`, `peerDependencies`, and `devDependencies`
as a focused `package.json` fragment, with installed and latest versions in an
action rail beside each declaration:

```
"dependencies": {
  "execa": "^9.6.1"  │ [1] pin installed 9.6.1 - [2] pin latest 10.0.1 major
},
"devDependencies": {
  "typescript": "^6.0.3"  │ [1] pin installed 6.0.3 - [2] pin latest 7.0.2 major
}
```

The fragment deliberately omits the outermost `{` and `}`. It preserves the
section and dependency order from the real manifest, while navigation skips
the structural lines.

Move with the arrow keys. Press `1` to stage the exact version that is currently
installed, or `2` to stage the exact latest registry version. The JSON preview
updates immediately, but `package.json` is not written until `enter`; `escape`
discards the staged changes. A major upgrade requires a second `enter` before it
is applied.

Applying updates only the selected values in `package.json`; it does not install
packages or rewrite the lockfile. The final message reminds you to run your
package manager's install command.

Workspace, file, URL, Git, and npm-alias specs are still listed, but registry
updates are disabled for them. If the command is piped or run in CI, it prints a
tab-separated report and never attempts an edit.

## Design

[docs/premium-cli-dx.md](docs/premium-cli-dx.md) covers what a premium CLI
experience means here, and why workspace packages are listed beneath the current
package's scripts rather than chosen first.

## Changelog

### Next

Added `abt deps` with a native JSON-fragment editor; declared, installed, and
latest versions; staged pin/latest actions; major-upgrade confirmation;
viewport-aware navigation; workspace package targeting; and a plain
non-interactive report.

### 4.0.0

Workspace support. `abt` now finds sibling packages in a monorepo and runs their
scripts without you leaving the directory you are in — press `tab` to browse
them, or go straight there with `abt <package> <script>`.

Also new: direct invocation by script name, `--list` for non-interactive use,
argument forwarding after `--`, "did you mean" suggestions on typos, and a real
exit code when the package manager itself is missing.

Rebuilt on [pathenger](https://github.com/tasteee/pathenger). Dropped `inquirer`
and `find-pkg`.

### 3.0.0 (06/28/2026)

Redid the whole thing because turns out it didn't actually work
on Windows after all. But now it damn sure does.

### 2.0.0 (03/29/2025)

Updated so it should work on Windows, Mac, Linux, whatever.
Removed a ton of dependencies. Reduced codebase by like a billion times.
