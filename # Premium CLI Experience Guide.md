# Premium CLI Experience Guide

Use this as the source of truth for how our CLI tools should behave, communicate, and feel.

The goal is not to make the terminal flashy.

The goal is to make every command feel:

- Clear
- Calm
- Intentional
- Fast
- Predictable
- Easy to recover from
- Useful in both terminals and automation

---

# 1. Core Principle

A premium CLI communicates **state**, not noise.

Avoid narrating every internal action:

```text
Reading package.json...
Package found.
Parsing package.json...
Package parsed.
Loading configuration...
```

Prefer showing the meaningful operation:

```text
◐ Loading project configuration
```

Then preserve only the useful result:

```text
✓ Configuration loaded
```

The user should always understand:

1. What the CLI is doing
2. Whether it succeeded
3. What changed
4. What they should do next

---

# 2. Think in Operations, Tasks, and Results

Most commands can be represented using three concepts.

## Operation

The overall thing the user asked for.

```text
Create product

billing-dashboard
```

## Tasks

The major pieces of work.

```text
✓ Validate configuration
✓ Generate product files
◐ Install dependencies
○ Validate manifest
```

## Result

The lasting outcome.

```text
✓ Product created

  path   products/billing-dashboard
  route  /billing-dashboard
```

Do not treat every log line as an independent visual element.

Group related activity into meaningful tasks.

---

# 3. Use Three Rendering Modes

A CLI should not render the same way everywhere.

## Interactive mode

Use when output is connected to a real terminal.

Interactive mode may use:

- Spinners
- Live-updating lines
- Prompts
- Cursor movement
- Collapsing task details
- Keyboard navigation

Example:

```text
◐ Install dependencies
  @gct-nexus/router · 18 of 24 packages
```

## Plain mode

Use for:

- CI
- Redirected output
- Pipes
- Unsupported terminals
- `--no-interactive`

Plain output should only append complete lines.

```text
Installing dependencies
Installed 24 packages
```

It should never contain spinner frames or cursor-control characters.

## Structured mode

Use for automation and integrations.

```json
{
  "ok": true,
  "product": {
    "name": "billing-dashboard",
    "path": "products/billing-dashboard"
  }
}
```

The CLI should support JSON when its result is likely to be consumed by another program.

---

# 4. Build Around Semantic Events

Application code should describe what happened.

It should not decide how that event looks in the terminal.

```ts
type CliEvent =
  | {
      type: "operation:start";
      id: string;
      title: string;
    }
  | {
      type: "task:start";
      id: string;
      title: string;
    }
  | {
      type: "task:update";
      id: string;
      detail?: string;
      current?: number;
      total?: number;
    }
  | {
      type: "task:complete";
      id: string;
      status: "success" | "warning" | "failure" | "skipped";
      detail?: string;
    }
  | {
      type: "result";
      value: unknown;
    };
```

Then render those events differently depending on the environment.

```ts
interface CliRenderer {
  emit(event: CliEvent): void;
  flush(): Promise<void>;
  dispose(): Promise<void>;
}
```

Recommended renderers:

```ts
InteractiveRenderer;
PlainRenderer;
JsonRenderer;
TestRenderer;
```

The business logic should not know about:

- ANSI escape sequences
- Spinner frames
- Terminal width
- CI providers
- Colors
- Unicode support

---

# 5. Keep the Visual Language Small

A CLI does not need dozens of visual components.

A useful core system might contain:

- Operation header
- Task list
- Progress detail
- Notice
- Warning
- Error
- Key-value summary
- Change list
- Command preview
- Completion receipt

That is enough for most commands.

---

# 6. Use a Stable Status System

Use the same statuses everywhere.

```ts
type TaskStatus =
  | "pending"
  | "running"
  | "success"
  | "warning"
  | "failure"
  | "skipped"
  | "cancelled";
```

Recommended symbols:

```text
○ pending
◐ running
✓ success
! warning
× failure
– skipped
```

Provide ASCII fallbacks:

```text
[ ] pending
[..] running
[ok] success
[!] warning
[x] failure
[-] skipped
```

Do not use emoji as the structural foundation of the interface.

Emoji width and appearance vary too much between terminals.

---

# 7. Use Color Sparingly

Color should reinforce meaning, not create decoration.

A simple palette is enough:

- Accent
- Success
- Warning
- Failure
- Primary text
- Secondary text
- Muted text

Use bright text for:

- The active task
- A selected option
- The main result
- Important values

Use dim text for:

- Paths
- Timing
- Counts
- Supporting detail
- Inactive items

The interface must still make sense without color.

---

# 8. Use Consistent Spacing

Spacing should communicate hierarchy.

```text
Operation

  Task
    Supporting detail
```

Recommended structure:

```text
Create product

  ✓ Validate configuration
  ✓ Generate files
  ◐ Install dependencies
    18 of 24 packages
```

Avoid:

- A blank line after every event
- Deeply nested indentation
- Large banners
- Boxes around everything
- Excessive borders
- Dense walls of logs

Boxes should be reserved for exceptional callouts.

---

# 9. Design Task Lifecycles

Tasks should move through predictable states.

```text
pending → running → success
pending → running → failure
pending → skipped
running → cancelled
```

Once a task completes, it should stop animating.

While running:

```text
◐ Install dependencies
  Resolving @gct-nexus/router
  18 of 24 packages
```

After completion:

```text
✓ Install dependencies  24 packages · 2.8s
```

The live detail should collapse into a concise permanent record.

Do not leave every progress frame in terminal history.

---

# 10. Show Progress Honestly

Use determinate progress when the total is known.

```text
18 of 24 packages
75%
37 of 120 files
```

Use an indeterminate spinner when the total is unknown.

```text
◐ Waiting for deployment
```

Do not show a spinner without a meaningful label.

Bad:

```text
◐
```

Good:

```text
◐ Connecting to registry
```

Do not invent percentages.

Do not move progress backward unless work is genuinely being repeated.

---

# 11. Avoid Visual Noise for Fast Work

Do not show a spinner for work that finishes almost immediately.

A spinner that flashes for 100 milliseconds feels worse than no spinner.

For fast work, simply print the result:

```text
✓ Configuration valid
```

For slower work, introduce live progress after a small delay.

This prevents flicker while still giving feedback when necessary.

---

# 12. Make Prompts Specific

A prompt should explain the actual decision.

Bad:

```text
Continue? (y/N)
```

Better:

```text
Overwrite 14 existing files? (y/N)
```

Every prompt should have:

- A clear question
- A visible default
- A safe default
- A non-interactive equivalent

Example:

```text
Select a template

  React
› Solid
  Vanilla
```

For automation:

```bash
nexus create product billing --template solid --yes
```

Interactive workflows must not become the only way to use a command.

---

# 13. Support Non-Interactive Use

A command must not hang waiting for input when running in CI or through a pipe.

When required information is missing:

```text
Missing required option: --template

Provide it explicitly:
  nexus create product billing --template react
```

Useful automation flags include:

```text
--yes
--force
--no-interactive
--quiet
--json
--output
```

Use only the flags that make sense for the command.

---

# 14. Separate Results From Diagnostics

Use standard output for the requested result.

Use standard error for:

- Progress
- Warnings
- Diagnostics
- Human-readable errors
- Debug information

This allows users to safely capture the result:

```bash
path="$(nexus create product billing --output path)"
```

The captured value should not include:

- Spinner frames
- Headings
- Success icons
- Diagnostic text

---

# 15. End With a Completion Receipt

Do not end important commands with only:

```text
Done!
```

Show what happened.

```text
✓ Product created                                      6.4s

  path      products/billing-dashboard
  route     /billing-dashboard
  files     14
  packages  24

Next
  cd products/billing-dashboard
  nexus start
```

A useful completion receipt may contain:

- Resource name
- Path
- URL
- Route
- Counts
- Duration
- Next command
- Warnings

The user should not need to scroll upward to understand the result.

---

# 16. Make Important Values Easy to Copy

Prefer:

```text
path  products/billing-dashboard
```

Avoid embedding important values inside decorative sentences:

```text
✨ Your wonderful product has been created at
products/billing-dashboard! ✨
```

Useful focused output options:

```bash
nexus create product billing --output path
nexus create product billing --output id
nexus deploy --output url
```

---

# 17. Summarize File and Configuration Changes

Commands that modify files should show what changed.

```text
Changes

  + source/entry.tsx
  + .platform/manifest.json
  ~ package.json
  - legacy.config.js
```

Recommended vocabulary:

```text
+ created
~ modified
- removed
= unchanged
```

Use the same representation for dry runs and real execution.

---

# 18. Treat Errors as Recovery Interfaces

A premium error should answer four questions:

1. What failed?
2. Why did it fail?
3. Where is the problem?
4. What should the user do next?

Bad:

```text
Build failed
```

Better:

```text
Build failed

Manifest route "/billing" is already registered by
product "customer-billing".

File
  .platform/manifest.json

Change the route to a unique value, then run:
  nexus build
```

Expected user errors should not show raw stack traces.

Stack traces belong in `--debug`.

---

# 19. Group Validation Errors

When possible, show all related validation problems at once.

```text
Manifest validation failed

  route
    Must begin with "/"

  navigation.label
    Must not be empty

  schemaVersion
    Unsupported version "3"
```

Do not force the user to fix and rerun once for every field.

---

# 20. Handle Partial Failure Clearly

When part of an operation succeeds, explain exactly what remains.

```text
Product creation was incomplete

Completed
  ✓ Generated 14 files
  ✓ Updated package.json

Failed
  × Install dependencies

Current state
  Files remain in products/billing-dashboard

Retry with:
  cd products/billing-dashboard
  npm install
```

Never report success when required work failed.

If rollback occurred, say so.

If rollback did not occur, say what remains changed.

---

# 21. Warnings Should Be Useful

Warnings are for conditions that do not block the command but deserve attention.

```text
! Node.js 20 is supported but will be removed in the next major release.

  Upgrade to Node.js 22 when possible.
```

Do not use warning styling for ordinary information.

Warnings shown during live rendering must remain visible in the final output.

---

# 22. Support Cancellation Correctly

`Ctrl+C` should leave the terminal clean.

Cancellation should:

- Stop active animation
- Restore the cursor
- Restore terminal input mode
- Stop managed child processes
- Preserve a concise message
- Return a nonzero exit status

Example:

```text
– Product creation cancelled
```

Cleanup code should be safe to call more than once.

---

# 23. Never Leak Secrets

Never print:

- Access tokens
- API keys
- Passwords
- Authentication headers
- Private keys
- Complete connection strings

This rule applies to:

- Normal output
- Verbose output
- Debug output
- Stack traces
- Child-process commands
- Diagnostic reports

Redact sensitive values before they enter the rendering system.

---

# 24. Keep Help Useful

Every command should support:

```bash
nexus --help
nexus create --help
nexus create product --help
```

Useful help includes:

1. A one-sentence description
2. Usage
3. Arguments
4. Options
5. Realistic examples
6. Relevant environment variables
7. Related commands

Example:

```text
Create a new product from a platform template.

Usage
  nexus create product <name> [options]

Options
  --template <name>   Product template
  --route <path>      Product route
  --yes               Accept defaults
  --dry-run           Preview changes

Examples
  nexus create product billing
  nexus create product billing --template react
```

---

# 25. Suggest Corrections

When the user makes a likely typo, provide the nearest valid option.

```text
Unknown command "buid".

Did you mean:
  nexus build
```

Do not dump the entire help page for every small mistake.

Show the relevant correction first.

---

# 26. Provide Quiet, Verbose, and Debug Modes

## Default

Show only what a normal user needs.

## Quiet

Show:

- Requested result
- Fatal errors

Suppress:

- Progress
- Headings
- Informational messages
- Completion decoration

## Verbose

Show more operational detail.

```text
Resolved configuration from nexus.config.ts
Using registry environment "development"
Generated 14 files
```

## Debug

Show maintainer-focused diagnostics.

```text
Configuration search paths
Executed child commands
Timing information
Stack traces
Environment detection
```

All modes must redact secrets.

---

# 27. Make JSON a Real Interface

JSON mode should be valid and stable.

Good:

```json
{
  "ok": true,
  "product": {
    "name": "billing-dashboard",
    "path": "products/billing-dashboard",
    "route": "/billing-dashboard"
  },
  "changes": {
    "filesCreated": 14,
    "packagesInstalled": 24
  }
}
```

JSON output must contain:

- No ANSI codes
- No spinners
- No headings
- No human commentary
- No trailing logs

Errors should also be structured:

```json
{
  "ok": false,
  "error": {
    "code": "NX-MANIFEST-004",
    "category": "validation",
    "message": "Manifest route is already registered"
  }
}
```

---

# 28. Preserve Exit-Code Meaning

At minimum:

```text
0  success
1  failure
```

More detailed codes may be useful:

```text
2    invalid usage
3    validation failure
4    authentication failure
5    authorization failure
6    conflict
7    network failure
130  cancelled
```

Do not return `0` when required work failed.

Avoid terminating the process before output has finished writing.

Prefer setting the exit code and allowing cleanup and output flushing to complete.

---

# 29. Design for Narrow Terminals

Do not assume the terminal is wide.

At narrow widths:

1. Wrap important content
2. Move metadata to additional lines
3. Truncate nonessential values
4. Remove decorative elements
5. Preserve errors and recovery instructions

Do not truncate the reason an operation failed.

Do not truncate the command needed to recover.

---

# 30. Test the Actual Terminal Behavior

Do not only unit-test application logic.

Test the CLI as users will run it.

## Plain output

```bash
nexus build | cat
nexus build > output.txt
nexus build 2> errors.txt
```

Verify:

- No spinner frames
- No cursor escapes
- Complete lines
- Correct stdout and stderr separation

## Interactive output

Verify:

- Live updates replace previous frames
- Completed tasks remain visible
- Cursor visibility is restored
- Concurrent tasks do not overwrite one another

## Cancellation

Verify:

- `Ctrl+C` stops the operation
- Child processes stop
- Terminal state is restored
- Exit code is correct

## JSON

Parse the result during tests.

Do not rely only on string snapshots.

---

# 31. Recommended Component API

A simple framework-level API might look like this:

```ts
const operation = cli.ui.operation("Create product", {
  subject: "billing-dashboard",
});

const validation = operation.task("Validate configuration");

validation.succeed({
  detail: "nexus.config.ts",
});

const files = operation.task("Generate product files");

files.update({
  detail: "Writing source/entry.tsx",
});

files.succeed({
  detail: "14 files",
});

const dependencies = operation.task("Install dependencies");

dependencies.update({
  detail: "@gct-nexus/router",
  progress: {
    current: 18,
    total: 24,
    unit: "packages",
  },
});

dependencies.succeed({
  detail: "24 packages",
});

operation.succeed({
  title: "Product created",
  summary: {
    path: "products/billing-dashboard",
    route: "/billing-dashboard",
  },
  next: ["cd products/billing-dashboard", "nexus start"],
});
```

The API should encourage good output by default.

Authors should not need to manually coordinate:

- Spinner cleanup
- Cursor movement
- Indentation
- Status icons
- Terminal width
- Plain fallback
- JSON output

---

# 32. Recommended Rendering Architecture

```text
Command logic
     │
     ▼
Semantic CLI events
     │
     ├── Interactive renderer
     ├── Plain renderer
     ├── JSON renderer
     └── Test renderer
```

Recommended low-level responsibilities:

```text
Interactive renderer
  live-region updates
  task collapsing
  spinners
  prompt rendering
  width-aware layout

Plain renderer
  append-only output
  no ANSI cursor movement
  CI-safe formatting

JSON renderer
  structured results
  structured errors
  no human decoration
```

---

# 33. Things We Should Not Do

Avoid these patterns:

- Showing a spinner with no label
- Logging every internal implementation step
- Ending important commands with only “Done”
- Using color as the only status indicator
- Using emoji as the only status indicator
- Showing raw stack traces for expected errors
- Asking vague questions like “Continue?”
- Prompting in CI
- Writing spinner frames into redirected output
- Running multiple live renderers at once
- Printing secrets in debug mode
- Reporting success before asynchronous work completes
- Hiding partial failure
- Using a full-screen TUI for a simple one-shot command
- Putting boxes around every section
- Adding decorative banners before useful information
- Inventing progress percentages
- Leaving the cursor hidden after cancellation
- Making the user scroll upward to find the result

---

# 34. Pull Request Checklist

Use this checklist when reviewing a command.

## General

- [ ] The command clearly identifies what it is doing
- [ ] The current task is visible during long work
- [ ] The final result remains in scrollback
- [ ] The user knows what changed
- [ ] The user knows what to do next
- [ ] Output works without color
- [ ] Output works without Unicode
- [ ] Important values are easy to copy

## Automation

- [ ] The command works without prompts
- [ ] Redirected output contains no animation
- [ ] Standard output contains the intended result
- [ ] Diagnostics are sent separately
- [ ] JSON output is valid when supported
- [ ] Exit codes represent success and failure correctly

## Errors

- [ ] Errors explain what failed
- [ ] Errors explain why
- [ ] Errors identify the affected resource or file
- [ ] Errors provide a recovery action when possible
- [ ] Expected errors do not show raw stack traces
- [ ] Partial failure is described accurately

## Terminal behavior

- [ ] `Ctrl+C` restores terminal state
- [ ] The cursor is not left hidden
- [ ] Narrow terminals remain usable
- [ ] Concurrent progress does not overlap
- [ ] Completed spinners stop animating
- [ ] CI logs remain readable

---

# 35. Definition of Done

A CLI command is complete when:

- Its operation and task states are understandable
- Interactive and plain output both work
- Automation does not depend on prompts
- Errors provide useful recovery information
- Cancellation leaves the terminal clean
- The final result is concise and actionable
- Output behaves correctly in pipes and CI
- Structured output is available when appropriate
- The command follows the shared visual vocabulary

The final test is simple:

After the command finishes, can the user immediately answer:

1. What happened?
2. Did it work?
3. What changed?
4. What should I do next?

When those answers are clear, the CLI experience is doing its job.
