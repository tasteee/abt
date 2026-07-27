# Premium CLI developer experience

What "premium" means for a terminal tool, and the decisions it forces on `abt`
as it grows workspace support.

A premium CLI is not a decorated CLI. Decoration is the cheapest and least
durable form of quality. Premium is the feeling that the tool already knew what
you wanted, got out of the way, and left the terminal exactly as it found it.

---

## 1. Speed is the whole product

`abt` sits between a developer and the thing they actually want to run. Every
millisecond and every keystroke it adds is a tax it must earn back.

- **Startup is budget, not overhead.** Target under ~100ms to first paint. That
  rules out heavy prompt frameworks, and it rules out doing filesystem work
  before it is needed.
- **Dependencies are startup cost.** Each one is module resolution, parse, and
  evaluate on every single invocation. Fewer, smaller, no transitive sprawl.
- **Lazy everything.** Do not read every package in a monorepo to draw the first
  menu. Read what the first menu shows.
- **Keystrokes to outcome is the real metric.** Not lines of output, not
  features. How many keys from `abt` to a running script.

## 2. Zero friction for the common case

The overwhelmingly common invocation is "run a script in the thing I am standing
in." That path must not regress by even one keypress in order to support the
rarer path.

- New capability is **additive and below the fold**. It never sits between the
  developer and the thing they do fifty times a day.
- **Context is an input.** Where the developer is standing is information. A tool
  run inside `packages/web` should open on `packages/web`.
- **The right default is pre-selected**, so `enter` is often the whole
  interaction.

## 3. Progressive disclosure

Show a short list. Let depth be requested, not imposed.

- A long flat list is not power, it is abdication. Scanning cost grows linearly
  with entries; the developer pays it every time.
- Depth should be **one level, and cheap to undo**. `esc` goes back.
- Secondary information (the command behind a script, the script count behind a
  package) is present but **dimmed** — available to the eye, absent from the
  scan.

## 4. Escape hatches for people who already know

Interactive menus are for discovery. Once a developer knows the answer, the menu
is in the way.

- `abt build` — skip the menu entirely.
- `abt web build` — skip both menus.
- `abt --list` — plain, greppable, pipeable.

A tool that only has a UI cannot be scripted. A tool that only has flags cannot
be discovered. Premium tools have both, and the flag path is always faster.

## 5. Respect the terminal as shared, hostile territory

The terminal is not yours. You are borrowing it.

- **stdout is data. stderr is narration.** Menus, spinners and status go to
  stderr so `abt --list > file` produces a clean file while the human still sees
  progress. This one rule is most of what separates scriptable tools from toys.
- **Hand the terminal over completely** when running a child process. Inherited
  stdio, no wrapping, no prefixing, no swallowing. The script must behave as if
  `abt` was never there — including its own colors, its own prompts, its own
  progress bars.
- **Leave no residue.** Restore cursor and raw mode on every exit path, including
  `ctrl+c` and thrown errors.
- **Propagate the child's exit code.** A wrapper that always exits `0` breaks CI
  and breaks `&&`.
- **Never assume width or color.** Truncate to the real width; check
  `isTTY` and `NO_COLOR`. Wrapped lines destroy an aligned list instantly.

## 6. Non-interactive is a first-class mode, not a failure mode

CI, pipes, and dumb terminals are not degraded environments to apologize to.

- Detect `!isTTY` and switch to plain output rather than hanging on a prompt that
  nobody can answer. **A CLI that blocks forever in CI is a broken CLI.**
- Every interactive answer should have a non-interactive equivalent, so any
  session a human can drive, a script can drive too.

## 7. Typography and alignment do the work that color usually gets credit for

The visual system is the same one used everywhere else: no ornament, hierarchy
from weight, spacing, alignment, and restraint.

- **Columns, not run-on lines.** Names left-aligned in one column, commands in a
  second, dimmed. The eye scans one column instead of parsing a paragraph.
- **One accent color, used for one thing** — the cursor. If everything is
  colored, nothing is.
- **Dim is the primary tool for hierarchy**, not bold and not color.
- **Symbols carry meaning, consistently.** `❯` is "you are here", `›` is "there
  is more inside". A symbol that means two things means nothing.
- Truncate with `…` rather than wrapping. A wrapped row breaks the column and
  the whole list stops being scannable.

## 8. Failure is a design surface

Most tools are designed for the success path and generate their failures.

- **Every error names the thing, the place, and the next move.** Not
  `ENOENT`, but "no package.json in this directory or any parent."
- **Near-miss suggestions.** `abt buld` should say `did you mean "build"?`.
- **`ctrl+c` is a normal outcome, not a crash.** Exit quietly, exit `0`, print no
  stack.
- **Never a stack trace for a user error.** A stack trace is a message to the
  author, shown to the wrong person.

## 9. The tool should be knowable in one screen

`--help` that fits without scrolling, shows real invocations rather than a
grammar, and is honest about what exists.

`--version` prints the version and nothing else, so it can be parsed.

---

## Decision: how workspace packages enter the menu

**The default menu is the current package's scripts and nothing else. `tab`
opens the package list. Selecting a package shows its scripts. `escape` walks
back up either step.**

Not "choose a package first," and not "packages appended below the scripts."

### Why

1. **It protects the common case absolutely.** The overwhelming majority of runs
   are a script in the package you are already standing in. Asking "which
   package?" first taxes every invocation to serve the minority. Even listing
   packages *below* the scripts taxes it — every run pays the scanning cost of
   rows it will never choose. Behind a key, they cost nothing until wanted.

2. **It is honest about context.** Run at the root, you get root scripts. Run
   inside `apps/web`, you get web's. The tool opens where you are standing
   rather than making you re-declare it.

3. **A flat all-scripts list does not survive scale.** Twenty packages at ten
   scripts each is two hundred rows. Without fuzzy filtering that is unusable,
   and pathenger's select prompt renders every option in one block with no
   paging — so a flat list is not merely unpleasant, it exceeds the viewport and
   breaks the redraw. Short lists are a correctness requirement, not a taste.

4. **Depth is free to leave.** `escape` returns to the previous menu with the
   prior selection restored, at both levels. The cost of guessing wrong is one
   keypress.

5. **Discovery survives.** Hiding a capability behind a key only works if the
   key announces itself, so the tip is part of the feature, not decoration. It
   appears only when there is somewhere to go.

### Shape

```
? abt · apps/web
❯ dev        vite
  build      tsc && vite build
  test       vitest run
  tab to browse packages
```

```
? abt · packages
❯ root     6 scripts · workspace root
  admin    3 scripts · apps/admin
  api      5 scripts · apps/api
  web      4 scripts · apps/web · you are here
  escape to go back
```

The package list names each package the way you would type it, says how much is
inside, and marks where you already are. Everything secondary is dimmed and
column-aligned, truncated to terminal width.

Anyone who already knows the answer never sees either screen:

```
abt build          run "build" here
abt api build      run "build" in the api package
abt api            open api's scripts
```

---

## Follow-ups for pathenger

Building `abt` against the API drove one feature and one bug fix into pathenger
itself, and left four things open.

### Done

- **Key bindings on input steps** (pathenger 1.1.0). An input step can now bind
  keys to other steps with `keys: { tab: BrowsePackages }`. Pressing one
  abandons the prompt — no answer, no `post`, no `next` — and the flow continues
  from the bound step, which can `escape` straight back. This is what makes the
  tab menu above possible; without it a select prompt only answered to arrows,
  enter, and the back key.

- **`backKey: 'escape'` could never match** (fixed in 1.0.2). Node's readline
  reports a lone escape as `meta: true`, while the matcher required
  `meta: false` — and `'escape'` is the default `backKey`, so back navigation
  was unreachable out of the box. `readKeypress` now strips that phantom flag.

### Open

1. **Keypresses arriving in one chunk are dropped.** `readKeypress` subscribes
   with `process.stdin.once('keypress')` and only re-subscribes after the caller
   has awaited it. Additional keypress events emitted synchronously from the same
   stdin chunk land with no listener attached and are lost — four arrow sequences
   written at once move the cursor one row, not four. Shows up in practice as
   dropped input under key-repeat. A small queue buffering keypresses between
   reads would fix it.

2. **Paged select.** `renderLiveBlock` redraws by moving the cursor up N lines,
   so an option list taller than the viewport corrupts the display. A `pageSize`
   with a scrolling window is the highest-value remaining addition, and it is
   what keeps `abt` from ever offering one flat all-scripts list.

3. **Type-to-filter select.** Fuzzy narrowing would make long lists pleasant
   instead of merely short.

4. **Non-selectable separators.** No way to draw a divider between groups of
   options, so grouping has to be carried by ordering alone.

A smaller one: on submit, the committed line echoes the full option `label`,
including any interior padding used for column alignment. An optional
`committedLabel` (or echoing `value`) would keep aligned lists from leaving a
wide gap in the transcript.
