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
Start typing to fuzzy-filter by script name or command. Backspace edits the
query; Escape clears it before leaving the menu.

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

### Script descriptions

Descriptions can live in an `abt` property in `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "test": "vitest run"
  },
  "abt": {
    "scripts": {
      "dev": "Start the local development server",
      "test": "Run the complete test suite"
    }
  }
}
```

They can also live in one `abt.json` anywhere inside that package boundary,
including beside `package.json`:

```json
{
  "scripts": {
    "dev": "Start the local development server",
    "test": "Run the complete test suite"
  }
}
```

File values override matching `package.json#abt.scripts` values. Entries that
do not name a real package script are ignored. Discovery does not descend into
nested packages, common generated directories, version-control data, or dependencies. More
than one applicable `abt.json` is reported as ambiguous instead of being
resolved by an invisible precedence rule.

The default menu is intentionally mixed: configured scripts show their
description and unconfigured scripts show their command. Press Right Arrow to
show every command, then Left Arrow to return to descriptions. Filtering always
matches the script name, description, and command regardless of the visible
view.

### Recent scripts

ABT remembers chosen scripts separately for each absolute `package.json` and
moves the most recently used valid scripts to the top of that package's menu.
Both menu selections and direct commands such as `abt test` update history. The
history stores only package paths and script names, retains at most 20 scripts
per package, and never prevents execution if the history location is read-only.

History is stored at `%LOCALAPPDATA%\abt\history.json` on Windows,
`~/Library/Application Support/abt/history.json` on macOS, and
`${XDG_STATE_HOME:-~/.local/state}/abt/history.json` elsewhere. Set
`ABT_HISTORY_PATH` to use a different file.

Workspaces are detected from `pnpm-workspace.yaml` or a `workspaces` field in
`package.json`. The package manager comes from `packageManager` in
`package.json`, falling back to whichever lockfile sits at the workspace root.

In a pipe or in CI, `abt` prints the script list instead of blocking on a menu
nobody can answer. It always exits with the script's own exit code.

Use `--json` with `--list` for structured script data. `--no-interactive`,
`--no-color`, and `--no-unicode` provide explicit overrides for automation and
constrained terminals. `--quiet`, `--verbose`, and `--debug` control diagnostic
detail without changing the command result written to standard output.

## Dependencies

```sh
abt deps               # dependencies of the package you are in
abt deps web           # dependencies of a workspace package
abt deps --update typescript=major --dry-run
abt deps --update typescript=major --update execa=latest
abt deps --json
```

`abt deps` presents `dependencies`, `peerDependencies`, and `devDependencies`
as a responsive JSON-table hybrid. The colon remains the hinge between the
manifest declaration and the installed, same-major, and latest registry values:

```
                         declared    installed    major       latest
"dependencies": {
❯  "execa":             "^9.6.1"    9.6.1        9.8.0       10.0.1
},
"devDependencies": {
   "typescript":        "^6.0.3"    6.0.3        6.4.2       7.0.2
}
```

The header and controls stay fixed while dependency rows move through a viewport.
Up/down changes the focused dependency, whose declared cell is highlighted.
Left/right moves that cell through the available declared, installed,
same-major, and latest columns. Every column is a separate stop, even when two
columns contain the same version.
Page up/down moves through the dependency list. The proposed value appears in
the declared column with `←`; pressing `enter` opens a before/after review
screen, where `enter` applies and `escape` returns to the table.

Typing fuzzy-filters dependency names and focuses the best match. Backspace
edits the filter; Escape clears an active filter before cancelling the command.

At compact widths the name column contracts. At narrow widths the rows return
to a compact JSON fragment and the selected dependency's four values appear on
one detail line.

Applying updates only the selected values in `package.json`; it does not install
packages or rewrite the lockfile. The final message reminds you to run your
package manager's install command.

For automation, repeat `--update <package>=installed|major|latest`. The choice is
explicit, so no confirmation prompt is opened. Add `--dry-run` to produce the
same change receipt without writing `package.json`.

Workspace, file, URL, Git, and npm-alias specs are still listed, but registry
updates are disabled for them. If the command is piped or run in CI, it prints a
tab-separated report and never attempts an edit.

### JSON contract

`abt --version --json`, `abt --list --json`, and `abt deps --json` write exactly
one JSON document to standard output and never include ANSI control sequences.
Successful documents have `ok: true` plus a stable `command` discriminator.
Script results use a `scripts` array; dependency reports use `package`,
`dependencies`, and `changes`; dependency updates additionally use `dryRun`.

Failures use this shape and a nonzero exit status:

```json
{
  "ok": false,
  "error": {
    "code": "ABT_USAGE",
    "category": "usage",
    "message": "unknown option \"--wat\".",
    "recovery": "Run \"abt --help\" for usage."
  }
}
```

Exit statuses are `0` for success, `1` for an internal runtime failure, `2` for
usage/environment errors, `127` when the package manager cannot start, and
`130` when an interactive operation is cancelled with Ctrl+C. Executed scripts
otherwise preserve their own exit status.

## Design

[docs/premium-cli-dx.md](docs/premium-cli-dx.md) covers what a premium CLI
experience means here, and why workspace packages are listed beneath the current
package's scripts rather than chosen first.

## Changelog

### Next

Added `abt deps` with a responsive JSON-table editor; declared, installed,
same-major, and latest versions; staged column actions; a before/after review
screen; fuzzy filtering; viewport-aware navigation; workspace package
targeting; and a plain non-interactive report. Script and package menus now
support the same type-to-filter interaction.

Added strict option validation, explicit terminal capability overrides,
ASCII-safe narrow rendering, resize and signal cleanup, non-interactive
dependency updates with dry-run, stable JSON results/errors, and separated
plain, interactive, JSON, silent, and test renderers.
Replaced the Pathenger menu dependency with the native fuzzy selector used by
both scripts and dependencies.
Added package-scoped script descriptions, command/description view switching,
and persistent per-package recent-script ordering.

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
