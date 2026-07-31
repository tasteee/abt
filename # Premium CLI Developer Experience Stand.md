# Premium CLI Developer Experience Standard

**Document ID:** CLI-DX
**Version:** 1.0.0
**Status:** Proposed Standard
**Applies to:** Interactive and non-interactive command-line tools
**Primary audience:** CLI authors, framework maintainers, product engineers, QA engineers, and technical writers

---

## 1. Purpose

This specification defines the minimum behavioral, visual, architectural, and operational requirements for a command-line interface to be considered a **premium developer experience**.

It is intended to serve as:

- A source of truth for CLI design decisions.
- A foundation for acceptance criteria.
- A review standard for pull requests.
- A test plan for interactive and automated environments.
- A constraint system for shared CLI components.
- A baseline for consistency across commands and products.

This specification does not prescribe a specific rendering library, prompt framework, color library, or application architecture.

---

## 2. Normative Language

The terms **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are normative.

- **MUST** indicates a mandatory requirement.
- **MUST NOT** indicates prohibited behavior.
- **SHOULD** indicates a strong recommendation that may be violated only with documented justification.
- **SHOULD NOT** indicates behavior that normally requires documented justification.
- **MAY** indicates an optional capability.

Any requirement exception MUST be documented in an ADR or equivalent architectural decision record.

---

## 3. Definition of Premium CLI Experience

A premium CLI is not defined by decoration.

A premium CLI:

1. Makes the current system state immediately understandable.
2. Minimizes the amount of information the user must remember.
3. Clearly distinguishes progress, results, warnings, and failures.
4. Produces concise and useful permanent scrollback.
5. Behaves correctly in terminals, CI systems, pipes, scripts, and redirected output.
6. Explains recovery when an operation fails.
7. Uses consistent interaction and visual patterns across commands.
8. Preserves user control.
9. Does not rely on animation, color, or Unicode for semantic meaning.
10. Provides machine-readable output when its results may be consumed programmatically.

A premium CLI SHOULD feel calm, predictable, fast, and deliberate.

---

# 4. Foundational Principles

## CLI-DX-P01: State Over Activity

The interface MUST communicate meaningful state rather than narrating every internal action.

Preferred:

```text
◐ Installing dependencies
  18 of 24 packages
```

Avoid:

```text
Reading package.json...
Package.json read.
Resolving package...
Resolved package.
Installing package...
```

Low-level activity MAY be exposed through verbose or debug modes.

---

## CLI-DX-P02: Progressive Disclosure

The default experience MUST show the information necessary to understand and complete the operation.

Additional implementation detail SHOULD be available through one or more of:

- `--verbose`
- `--debug`
- Log files
- Expandable interactive details
- Diagnostic reports

The default experience MUST NOT require users to parse debug-level output.

---

## CLI-DX-P03: Durable Results, Ephemeral Progress

Transient progress MAY update in place.

Final outcomes MUST remain available in terminal scrollback.

A completed live region MUST resolve into a concise permanent record.

Example:

```text
✓ Created billing-dashboard in 6.4s
```

A successful operation MUST NOT erase its only visible result.

---

## CLI-DX-P04: Semantic Independence

Meaning MUST NOT depend exclusively on:

- Color
- Animation
- Emoji
- Terminal hyperlinks
- Cursor positioning
- Font characteristics
- Audio or terminal notifications

Every status MUST remain understandable in plain text.

---

## CLI-DX-P05: Actionability

Every failure MUST provide a reasonable next action when a next action is known.

A premium CLI does not merely report that something failed. It identifies:

- What failed.
- Why it failed.
- Where the problem exists.
- How the user can resolve or investigate it.

---

## CLI-DX-P06: Composability

The CLI MUST remain usable in shell pipelines, scripts, task runners, CI systems, and redirected output.

Interactive rendering MUST NOT corrupt piped or redirected output.

---

## CLI-DX-P07: User Control

The user MUST be able to:

- Cancel interactive operations.
- Disable decorative output.
- Avoid prompts when automation requires deterministic execution.
- Inspect the command before destructive changes when practical.
- Obtain help without leaving the terminal.

---

# 5. Execution Environments

The CLI MUST distinguish between execution environments before selecting a renderer.

## 5.1 Required Environment Model

At minimum, the CLI MUST recognize:

```ts
type CliEnvironment = {
  interactive: boolean;
  stdinTTY: boolean;
  stdoutTTY: boolean;
  stderrTTY: boolean;
  color: boolean;
  unicode: boolean;
  columns: number | null;
  rows: number | null;
  ci: boolean;
  json: boolean;
  quiet: boolean;
  verbose: boolean;
  debug: boolean;
};
```

Node exposes TTY detection through properties such as `process.stdout.isTTY`, along with terminal width, height, and resize events for TTY streams.

---

## CLI-DX-ENV-001: Interactive Detection

Interactive rendering MUST only be enabled when the relevant input and output streams support interaction.

### Acceptance criteria

**Given** standard output is attached to a terminal
**When** an interactive command runs
**Then** the CLI MAY use live regions, cursor movement, prompts, and animation.

**Given** standard output is piped or redirected
**When** the same command runs
**Then** the CLI MUST use stable, append-only output.

---

## CLI-DX-ENV-002: Explicit Overrides

The CLI SHOULD support explicit renderer controls:

```text
--interactive
--no-interactive
--color
--no-color
--unicode
--no-unicode
```

Explicit command-line options SHOULD take precedence over automatic detection, except where the requested behavior cannot operate safely.

---

## CLI-DX-ENV-003: Color Control

If color is enabled by default, the CLI MUST honor the `NO_COLOR` environment variable when it is present and non-empty, unless a more specific user configuration explicitly enables color.

This follows the established `NO_COLOR` convention.

---

## CLI-DX-ENV-004: Terminal Width

The renderer MUST account for terminal width.

The renderer MUST NOT assume an 80-column or 120-column viewport.

At narrow widths, the renderer MUST prefer:

1. Wrapping body content.
2. Truncating nonessential metadata.
3. Moving secondary values onto additional lines.
4. Removing decorative elements.

The renderer MUST NOT truncate the primary error cause or required recovery action.

---

## CLI-DX-ENV-005: Resize Behavior

Long-running interactive interfaces SHOULD respond to terminal resize events.

A resize MUST NOT:

- Crash the process.
- Leave duplicated frames.
- Corrupt permanent scrollback.
- Leave the cursor in an invalid position.

---

# 6. Output Channels

## CLI-DX-OUT-001: Standard Output

Standard output MUST contain the command's intended result.

Examples:

- Generated identifier
- Requested data
- File path
- JSON document
- Search result
- Validation result
- Transformation output

---

## CLI-DX-OUT-002: Standard Error

Standard error SHOULD contain:

- Progress indicators
- Warnings
- Diagnostics
- Human-readable errors
- Debug output

This separation MUST allow users to capture a successful command result without also capturing progress decoration.

Example:

```bash
project_id="$(nexus create product billing --output id)"
```

---

## CLI-DX-OUT-003: No Output Corruption

ANSI escape sequences, spinner frames, cursor control codes, and terminal hyperlinks MUST NOT appear in redirected plain-text output unless explicitly requested.

### Acceptance criteria

```bash
nexus build > output.txt
```

The resulting file MUST:

- Contain no cursor movement sequences.
- Contain no repeated spinner frames.
- Remain readable in a text editor.
- Contain complete lines.

---

## CLI-DX-OUT-004: Quiet Mode

Commands that produce a meaningful result SHOULD support `--quiet`.

Quiet mode MUST suppress:

- Decorative headings
- Progress animation
- Informational notices
- Completion celebrations

Quiet mode MUST NOT suppress:

- The requested result
- Fatal errors
- Required confirmation unless non-interactive behavior was explicitly selected

---

## CLI-DX-OUT-005: Verbose and Debug Modes

`--verbose` SHOULD expose operational detail useful to advanced users.

`--debug` SHOULD expose diagnostic detail useful to maintainers.

Debug output MAY include:

- Stack traces
- Internal command execution
- Resolved configuration
- Timing
- Environment detection
- Request identifiers

Secrets, credentials, tokens, and sensitive values MUST be redacted in every output mode.

---

# 7. Rendering Architecture

## CLI-DX-ARC-001: Semantic Events

Application logic MUST NOT directly construct terminal escape sequences or visual layouts.

Application logic SHOULD emit semantic events.

```ts
type CliEvent =
  | {
      type: "operation:start";
      id: string;
      title: string;
      startedAt: number;
    }
  | {
      type: "task:start";
      id: string;
      parentId?: string;
      title: string;
      startedAt: number;
    }
  | {
      type: "task:update";
      id: string;
      detail?: string;
      current?: number;
      total?: number;
      unit?: string;
    }
  | {
      type: "task:complete";
      id: string;
      status: "success" | "warning" | "failure" | "skipped";
      detail?: string;
      completedAt: number;
    }
  | {
      type: "notice";
      level: "info" | "warning" | "error";
      title: string;
      body?: string;
    }
  | {
      type: "result";
      value: unknown;
    };
```

---

## CLI-DX-ARC-002: Renderer Separation

The system SHOULD provide separate renderers for:

```ts
interface CliRenderer {
  emit(event: CliEvent): void;
  flush(): Promise<void>;
  dispose(): Promise<void>;
}
```

Minimum recommended renderer set:

- `InteractiveRenderer`
- `PlainRenderer`
- `JsonRenderer`
- `SilentRenderer`
- `TestRenderer`

---

## CLI-DX-ARC-003: Renderer Selection

Renderer selection MUST happen at the application boundary.

Business logic MUST NOT branch on:

- ANSI support
- Terminal width
- Color capability
- CI provider
- Spinner availability
- Unicode availability

These concerns belong to environment detection and rendering.

---

## CLI-DX-ARC-004: Deterministic Rendering

Given the same semantic event sequence and environment configuration, a renderer SHOULD produce deterministic output.

Deterministic rendering enables:

- Snapshot testing
- Golden-file testing
- Replay debugging
- Cross-command consistency
- Reliable acceptance testing

---

## CLI-DX-ARC-005: Render Ownership

Only one component MUST own a given terminal region at a time.

Uncoordinated calls to `console.log`, `stdout.write`, or third-party renderers MUST NOT write through an active live region.

External process output MUST be:

- Captured and rendered through the active renderer, or
- Allowed to suspend and resume the live renderer safely.

---

# 8. Visual Language

## CLI-DX-VIS-001: Hierarchy

The visual system MUST define at least these hierarchy levels:

1. Command or operation title
2. Active task
3. Supporting detail
4. Metadata
5. Result or next action

Hierarchy SHOULD be communicated through spacing, indentation, weight, and concise wording before relying on color.

---

## CLI-DX-VIS-002: Status Vocabulary

The system MUST define a stable status vocabulary.

Recommended semantic states:

```ts
type Status =
  | "pending"
  | "running"
  | "success"
  | "warning"
  | "failure"
  | "skipped"
  | "cancelled";
```

A status MUST have the same meaning across all commands.

---

## CLI-DX-VIS-003: Glyph Vocabulary

The CLI SHOULD use a restrained glyph system.

Example:

```text
○ pending
◐ running
✓ success
! warning
× failure
– skipped
```

Fallback text MUST exist when Unicode is unavailable:

```text
[ ] pending
[..] running
[ok] success
[!] warning
[x] failure
[-] skipped
```

Emoji SHOULD NOT be used as foundational status glyphs because their presentation and width may vary across terminal environments.

---

## CLI-DX-VIS-004: Color Vocabulary

The interface SHOULD use a limited semantic palette:

- Accent
- Success
- Warning
- Failure
- Primary text
- Secondary text
- Muted text

Color MUST be semantic and consistent.

A command MUST NOT assign arbitrary colors solely to create visual variety.

---

## CLI-DX-VIS-005: Indentation

Indentation levels MUST be standardized.

Recommended model:

```text
Operation
  Task
    Detail
      Diagnostic
```

The same hierarchy MUST use the same indentation across commands.

---

## CLI-DX-VIS-006: Whitespace

Whitespace MUST communicate grouping.

The renderer SHOULD:

- Separate major operations with blank lines.
- Keep related task lines adjacent.
- Avoid blank lines between every low-level event.
- Avoid dense unbroken walls of text.
- Avoid leading and trailing vertical noise.

---

## CLI-DX-VIS-007: Borders and Boxes

Boxes MAY be used for exceptional callouts.

Boxes SHOULD NOT surround ordinary:

- Logs
- Tasks
- Prompts
- Success messages
- Key-value groups

Borders MUST NOT consume enough horizontal space to reduce readability at common terminal widths.

---

## CLI-DX-VIS-008: Text Style

CLI copy MUST be:

- Concise
- Specific
- Consistent
- Written in sentence case
- Free of unnecessary punctuation
- Free of novelty language during serious failures

Preferred:

```text
Installing dependencies
```

Avoid:

```text
We are now beginning the process of installing your dependencies...
```

---

# 9. Operations and Tasks

## CLI-DX-TASK-001: Operation Context

A multi-step command MUST identify the operation before or when work begins.

```text
Create product

billing-dashboard
```

The operation title MUST explain the user-level intent, not the internal function name.

---

## CLI-DX-TASK-002: Active Task Visibility

During a long-running operation, the interface MUST identify the currently active task.

A task lasting longer than approximately one second SHOULD produce visible feedback in interactive environments.

---

## CLI-DX-TASK-003: Task State Transitions

A task MUST transition through valid states.

```text
pending → running → success
pending → running → warning
pending → running → failure
pending → skipped
pending → cancelled
running → cancelled
```

A terminal state MUST NOT return to `running`.

A completed task MUST NOT continue animating.

---

## CLI-DX-TASK-004: Completed Task Compression

Completed tasks SHOULD collapse into concise summaries.

During execution:

```text
◐ Install dependencies
  Resolving @gct-nexus/router
  18 of 24 packages
```

After completion:

```text
✓ Install dependencies  24 packages · 2.8s
```

Historical progress frames MUST NOT remain in permanent scrollback.

---

## CLI-DX-TASK-005: Nested Tasks

Nested tasks MAY be used when they improve comprehension.
Task nesting SHOULD NOT exceed three visible levels.
Deep implementation detail SHOULD move to verbose or debug output.

## CLI-DX-TASK-006: Concurrency

Concurrent tasks MUST remain individually identifiable.

The renderer MUST NOT allow concurrent updates to:

- Overwrite unrelated tasks.
- Cause status lines to jump unpredictably.
- Reorder completed tasks without a defined ordering policy.

The system SHOULD define one ordering policy:

- Declaration order
- Start order
- Completion order
- Explicit priority

---

# 10. Progress

## CLI-DX-PRG-001: Determinate Progress

When the total quantity is known, the CLI SHOULD show determinate progress.

```text
18 of 24 packages
75%
37 of 120 files
```

The renderer MUST NOT fabricate precision.

---

## CLI-DX-PRG-002: Indeterminate Progress

When the total quantity is unknown, the CLI MAY show an indeterminate spinner or changing activity indicator.

The interface MUST also provide a meaningful task label.

Good:

```text
◐ Waiting for deployment
```

Insufficient:

```text
◐
```

---

## CLI-DX-PRG-003: Progress Stability

Progress MUST NOT move backward unless the underlying domain legitimately supports rollback or reprocessing.

If the operation restarts, the interface MUST communicate the restart.

---

## CLI-DX-PRG-004: Update Rate

Live progress SHOULD be rate-limited.

The renderer SHOULD avoid:

- Excessive CPU use
- Excessive output writes
- Flicker
- Updates faster than the terminal can meaningfully display

Application logic MAY emit frequent state updates, but the renderer SHOULD control frame frequency.

---

## CLI-DX-PRG-005: Long Silence

An active operation MUST NOT appear frozen.

If an operation has no measurable progress, it SHOULD periodically communicate a stable waiting state or elapsed time without flooding scrollback.

---

# 11. Prompts and Interaction

## CLI-DX-INT-001: Prompt Necessity

The CLI SHOULD prompt only when the answer cannot be safely inferred or supplied through arguments, configuration, or defaults.

Prompts MUST NOT replace a coherent command-line API.

---

## CLI-DX-INT-002: Prompt Context

Every prompt MUST explain the decision being requested.

Avoid:

```text
Continue? (y/N)
```

Preferred:

```text
Overwrite 14 existing files? (y/N)
```

---

## CLI-DX-INT-003: Defaults

Every prompt with a default MUST display the default.

Defaults MUST be safe and predictable.

Destructive actions SHOULD default to cancellation.

---

## CLI-DX-INT-004: Automation

Every interactive workflow intended for automation MUST provide a non-interactive equivalent.

Examples:

```text
--yes
--force
--name billing
--template react
--no-interactive
```

When required input is missing in non-interactive mode, the CLI MUST fail with a clear message rather than waiting for input.

---

## CLI-DX-INT-005: Cancellation

`Ctrl+C` MUST safely cancel interactive operations.

Cancellation handling MUST:

1. Stop active animation.
2. Restore cursor visibility.
3. Restore terminal input mode.
4. Stop or terminate managed child processes where appropriate.
5. Preserve a concise cancellation message.
6. Return a non-success exit status.

Installing custom signal handlers changes Node's default signal behavior, so handlers must explicitly perform required cleanup and termination.

---

## CLI-DX-INT-006: Keyboard Conventions

Interactive controls SHOULD follow established conventions:

- Arrow keys move selection.
- Enter confirms.
- Space toggles checkbox selections.
- Escape moves backward or cancels the current interaction.
- `Ctrl+C` cancels the command.
- Typing filters searchable lists where supported.

Custom key bindings MUST be visible in contextual help.

---

## CLI-DX-INT-007: Large Option Sets

Prompts with large option sets SHOULD support:

- Search
- Filtering
- Typeahead
- Pagination or viewport scrolling
- Clear empty-state messaging

The user MUST NOT be required to repeatedly press arrow keys through an unbounded list.

---

# 12. Results and Completion

## CLI-DX-RES-001: Explicit Completion

A successful multi-step operation MUST end with an explicit completion state.

```text
✓ Product created
```

Silence MUST only represent success for commands whose established contract is intentionally silent.

---

## CLI-DX-RES-002: Completion Receipt

Commands that create or materially change resources SHOULD produce a completion receipt.

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

The receipt SHOULD contain:

- Outcome
- Primary resource identifier
- Important paths or URLs
- Relevant counts
- Duration when meaningful
- Next action

---

## CLI-DX-RES-003: Copyable Values

Important values MUST be easy to copy.

Values SHOULD NOT be interrupted by:

- Inline decorative glyphs
- Excessive punctuation
- Embedded animation
- Unnecessary wrapping

The CLI MAY offer focused output controls:

```text
--output path
--output id
--output url
--json
```

---

## CLI-DX-RES-004: Change Summary

Commands that modify files or configuration SHOULD summarize changes.

Recommended vocabulary:

```text
+ created
~ modified
- removed
= unchanged
```

A dry-run mode SHOULD use the same change representation as actual execution.

---

# 13. Errors

## CLI-DX-ERR-001: Error Structure

A user-facing error SHOULD contain:

```text
Failure title

Cause

Location or affected resource

Recovery action

Optional diagnostic reference
```

Example:

```text
Build failed

Manifest route "/billing" is already registered by
product "customer-billing".

File
  .platform/manifest.json

Change the route to a unique value, then run:
  nexus build
```

---

## CLI-DX-ERR-002: Error Classification

The error system SHOULD distinguish:

```ts
type ErrorCategory =
  | "usage"
  | "validation"
  | "configuration"
  | "authentication"
  | "authorization"
  | "network"
  | "filesystem"
  | "conflict"
  | "dependency"
  | "internal"
  | "cancelled";
```

Error category MUST NOT be inferred from display text.

---

## CLI-DX-ERR-003: Error Codes

Stable error codes SHOULD be provided for errors that may require:

- Documentation lookup
- Support escalation
- Programmatic handling
- Telemetry correlation

Example:

```text
Error: NX-MANIFEST-004
```

Error codes MUST remain stable after public release.

---

## CLI-DX-ERR-004: Stack Traces

Stack traces MUST NOT appear in default user-facing output for expected failures.

Stack traces SHOULD be available through `--debug`.

Unexpected internal failures SHOULD provide:

- A concise human-readable summary.
- A stable error code or diagnostic identifier.
- A debug path.
- A nonzero exit status.

---

## CLI-DX-ERR-005: Partial Failure

When an operation partially succeeds, the CLI MUST state:

- What completed.
- What failed.
- What was rolled back.
- What remains changed.
- Whether retrying is safe.

The interface MUST NOT report an unqualified success when required work failed.

---

## CLI-DX-ERR-006: Validation Errors

Validation errors SHOULD be grouped when the user can reasonably fix them together.

```text
Manifest validation failed

  route
    Must begin with "/"

  navigation.label
    Must not be empty

  schemaVersion
    Unsupported version "3"
```

The CLI SHOULD avoid forcing one validation-run cycle per field.

---

# 14. Warnings

## CLI-DX-WARN-001: Warning Semantics

Warnings MUST represent conditions that:

- Do not prevent completion.
- May create risk, degradation, or future failure.
- Deserve user awareness.

Warnings MUST NOT be used for ordinary informational messages.

---

## CLI-DX-WARN-002: Warning Persistence

Warnings emitted during live rendering MUST remain represented in final scrollback.

---

## CLI-DX-WARN-003: Warning Resolution

A warning SHOULD state how it may be resolved or suppressed.

---

# 15. Help and Discoverability

## CLI-DX-HELP-001: Local Help

Every command MUST support terminal-accessible help.

```text
nexus --help
nexus create --help
nexus create product --help
```

Terminal-local documentation is useful because it corresponds to the installed version and remains available offline.

---

## CLI-DX-HELP-002: Help Structure

Command help SHOULD include:

1. One-sentence purpose
2. Usage
3. Arguments
4. Options
5. Examples
6. Relevant environment variables
7. Exit behavior when non-obvious
8. Related commands

---

## CLI-DX-HELP-003: Examples

Every nontrivial command SHOULD include at least one realistic example.

Examples MUST be executable or clearly marked as illustrative.

---

## CLI-DX-HELP-004: Invalid Usage

Invalid command usage MUST produce:

- A concise explanation.
- The relevant usage pattern.
- The nearest valid command or option when confidently known.
- A nonzero exit status.

The CLI SHOULD suggest corrections for likely typographical errors.

```text
Unknown command "buid".

Did you mean:
  nexus build
```

---

# 16. Machine-Readable Output

## CLI-DX-DATA-001: JSON Mode

Commands returning structured information SHOULD support JSON output.

JSON output MUST:

- Be valid JSON.
- Contain no ANSI sequences.
- Contain no spinner output.
- Contain no human-oriented headings.
- Use stable field names.
- Be written as a complete document unless a streaming format is explicitly documented.

---

## CLI-DX-DATA-002: Schema Stability

Machine-readable output SHOULD have a documented schema.

Breaking schema changes MUST follow the project's versioning policy.

Human-readable formatting MAY change without being considered an API break, unless otherwise documented.

---

## CLI-DX-DATA-003: JSON Errors

When JSON mode is active, failures SHOULD also use structured output.

```json
{
  "ok": false,
  "error": {
    "code": "NX-MANIFEST-004",
    "category": "validation",
    "message": "Manifest route is already registered",
    "details": {
      "route": "/billing",
      "product": "customer-billing"
    }
  }
}
```

---

## CLI-DX-DATA-004: Streaming Data

Commands producing unbounded event streams SHOULD use an explicitly documented streaming format such as newline-delimited JSON.

Streaming output MUST NOT masquerade as a single JSON document.

---

# 17. Exit Behavior

## CLI-DX-EXIT-001: Success

Successful completion MUST return exit status `0`.

---

## CLI-DX-EXIT-002: Failure

Failed completion MUST return a nonzero exit status.

Commands SHOULD define stable exit-code categories when scripts are expected to distinguish failure types.

Example:

```text
0   success
1   general failure
2   usage error
3   validation failure
4   authentication failure
5   authorization failure
6   conflict
7   network failure
130 cancelled by Ctrl+C
```

---

## CLI-DX-EXIT-003: Graceful Output Completion

The CLI SHOULD prefer setting `process.exitCode` and allowing output to flush rather than immediately invoking `process.exit()` after writing output.

Node documents that immediate `process.exit()` can terminate before asynchronous standard-output writes complete.

---

## CLI-DX-EXIT-004: Cleanup

Before normal or handled abnormal termination, the CLI MUST restore:

- Cursor visibility
- Raw input mode
- Alternate-screen state
- Temporary terminal settings
- Managed child-process state where applicable

Cleanup MUST be idempotent.

---

# 18. Accessibility and Resilience

## CLI-DX-A11Y-001: Color Independence

Every colored status MUST include text, position, or a glyph conveying the same meaning.

---

## CLI-DX-A11Y-002: Animation Control

The CLI SHOULD support disabling animation.

Animation MUST be disabled when:

- Output is not interactive.
- The terminal is unsupported.
- A reduced-motion configuration is explicitly provided.
- Testing requires deterministic output.

---

## CLI-DX-A11Y-003: Unicode Fallback

The CLI MUST remain understandable with ASCII-only output.

---

## CLI-DX-A11Y-004: Screen Reader Compatibility

Interactive interfaces SHOULD avoid unnecessarily redrawing large terminal regions.

Commands that require substantial cursor-based interaction SHOULD provide a plain or non-interactive equivalent.

---

## CLI-DX-A11Y-005: Language Clarity

Error and instructional text SHOULD avoid:

- Idioms
- Sarcasm
- Blame
- Ambiguous abbreviations
- Culture-specific jokes
- Excessively casual language

---

## CLI-DX-A11Y-006: Narrow and Basic Terminals

The CLI MUST remain operational in constrained terminals.

Decorative degradation is acceptable.

Functional degradation is not.

---

# 19. Performance

## CLI-DX-PERF-001: Startup Feedback

Commands SHOULD avoid showing a spinner for work that completes nearly immediately.

A spinner that appears and disappears too quickly creates visual noise.

---

## CLI-DX-PERF-002: Startup Latency

Help, version, and usage-error paths SHOULD avoid loading the full application when unnecessary.

```text
tool --help
tool --version
```

These commands SHOULD feel immediate.

---

## CLI-DX-PERF-003: Rendering Overhead

Rendering MUST NOT become a material contributor to command execution time.

The interactive renderer SHOULD batch and rate-limit updates.

---

## CLI-DX-PERF-004: Perceived Performance

Independent work SHOULD run concurrently when safe.

The interface MUST accurately represent concurrency and MUST NOT imply work is complete before it is complete.

---

# 20. Safety and Destructive Operations

## CLI-DX-SAFE-001: Destructive Clarity

Destructive operations MUST explicitly identify what will be changed or removed.

Avoid:

```text
Continue?
```

Preferred:

```text
Delete product "billing" and 14 generated files?
```

---

## CLI-DX-SAFE-002: Confirmation Bypass

Automation MAY bypass confirmation through an explicit option such as:

```text
--yes
--force
```

The option's behavior MUST be documented.

---

## CLI-DX-SAFE-003: Dry Run

Commands with significant side effects SHOULD provide `--dry-run`.

Dry-run output MUST represent the same planned changes that real execution would attempt.

---

## CLI-DX-SAFE-004: Secret Protection

The CLI MUST NOT print secrets.

Secret values MUST be redacted from:

- Default output
- Verbose output
- Debug output
- Errors
- Child-process commands
- Generated diagnostic reports

---

# 21. Testing Requirements

## CLI-DX-TEST-001: Renderer Unit Tests

Each renderer MUST have tests for:

- All semantic event types
- All status states
- Color-disabled output
- Unicode-disabled output
- Narrow terminal widths
- Missing terminal dimensions
- Long paths and labels
- Multiline details
- Cancellation
- Partial failure
- Nested tasks

---

## CLI-DX-TEST-002: Golden Output Tests

Plain output SHOULD be verified through golden files or snapshots.

Golden tests MUST normalize only genuinely unstable values such as:

- Durations
- Temporary directories
- Process identifiers
- Random request identifiers

Tests MUST NOT normalize structural output differences.

---

## CLI-DX-TEST-003: ANSI Tests

Interactive output MUST be tested to ensure:

- Frames clear correctly.
- Cursor visibility is restored.
- Completed output persists.
- Escape sequences do not leak into plain output.
- Concurrent updates do not overlap.

---

## CLI-DX-TEST-004: Pipe Tests

Every command class MUST be tested with:

```bash
tool command | cat
tool command > output.txt
tool command 2> error.txt
tool command | another-command
```

---

## CLI-DX-TEST-005: CI Tests

Commands MUST be tested in a non-interactive CI environment.

CI tests MUST verify that:

- No prompt blocks indefinitely.
- No spinner frames flood logs.
- No cursor escapes appear.
- Errors are readable.
- Exit statuses are correct.

---

## CLI-DX-TEST-006: Signal Tests

Long-running commands MUST be tested for interruption.

Tests SHOULD verify that cancellation:

- Terminates correctly.
- Cleans up terminal state.
- Stops child processes.
- Leaves readable output.
- Returns the documented exit status.

---

## CLI-DX-TEST-007: JSON Contract Tests

JSON output MUST be parsed during tests.

String snapshots alone are insufficient.

Tests MUST verify:

- Valid JSON
- Required fields
- Stable field names
- Error shape
- Absence of ANSI sequences
- Separation from diagnostic output

---

# 22. Command Acceptance Criteria

A command is not ready for release until all applicable criteria pass.

## 22.1 Universal Command Gate

- [ ] `--help` is available.
- [ ] Successful execution returns status `0`.
- [ ] Failed execution returns a nonzero status.
- [ ] Output is readable without color.
- [ ] Output is readable without Unicode.
- [ ] Redirected output contains no interactive escape sequences.
- [ ] Errors identify the cause.
- [ ] Recoverable errors provide a next action.
- [ ] Debug output does not expose secrets.
- [ ] `Ctrl+C` does not leave the terminal corrupted.
- [ ] The command behaves deterministically in non-interactive environments.
- [ ] Primary results are distinguishable from diagnostics.
- [ ] Copyable values are not obscured by decoration.

---

## 22.2 Long-Running Command Gate

- [ ] The current operation is visible.
- [ ] The active task is visible.
- [ ] The interface does not appear frozen.
- [ ] Determinate progress is used when totals are known.
- [ ] Completed progress collapses into durable summaries.
- [ ] Permanent scrollback does not contain animation frames.
- [ ] Concurrent tasks remain identifiable.
- [ ] Cancellation stops active work safely.
- [ ] Partial completion is accurately reported.

---

## 22.3 Interactive Command Gate

- [ ] Every prompt identifies the requested decision.
- [ ] Defaults are visible.
- [ ] Destructive defaults are safe.
- [ ] Keyboard behavior follows terminal conventions.
- [ ] The workflow has a non-interactive equivalent when automation is expected.
- [ ] Missing non-interactive inputs fail rather than block.
- [ ] Large option sets support efficient navigation or filtering.
- [ ] Cancellation restores terminal state.

---

## 22.4 Resource-Creation Command Gate

- [ ] The resource being created is identified before execution.
- [ ] Conflicts are detected before destructive writes when practical.
- [ ] Created and modified files are summarized.
- [ ] The final resource identifier or path is shown.
- [ ] The completion receipt includes the next useful action.
- [ ] The command supports dry-run when side effects are substantial.
- [ ] Partial creation is rolled back or explicitly documented.

---

## 22.5 Destructive Command Gate

- [ ] The affected resource is explicitly named.
- [ ] The scope of deletion or mutation is stated.
- [ ] Confirmation is required by default when interactive.
- [ ] Automation requires an explicit bypass option.
- [ ] Dry-run is available where practical.
- [ ] Cancellation before commitment causes no side effects.
- [ ] Partial destructive failure reports remaining state.

---

## 22.6 Data-Producing Command Gate

- [ ] Human-readable output is concise and scannable.
- [ ] Structured output is available when programmatic consumption is expected.
- [ ] Structured output has a documented schema.
- [ ] Diagnostics do not contaminate standard output.
- [ ] Empty results are represented intentionally.
- [ ] Pagination or streaming behavior is documented.
- [ ] Machine-readable errors have stable fields.

---

# 23. Premium Quality Rubric

Each command may be scored from zero to two in each category.

| Category      | 0                           | 1                                  | 2                                            |
| ------------- | --------------------------- | ---------------------------------- | -------------------------------------------- |
| Clarity       | State is unclear            | State is eventually understandable | State is immediately understandable          |
| Hierarchy     | Flat output                 | Partial grouping                   | Deliberate and consistent hierarchy          |
| Progress      | Silent or noisy             | Basic progress                     | Stable live state with durable summaries     |
| Errors        | Failure only                | Cause provided                     | Cause, location, recovery, and diagnostics   |
| Completion    | Ends abruptly               | Success message                    | Actionable completion receipt                |
| Automation    | Interactive only            | Partial flags                      | Fully deterministic non-interactive contract |
| Composability | Breaks pipes                | Basic redirection                  | Clean stdout/stderr and structured output    |
| Accessibility | Depends on color or Unicode | Partial fallback                   | Complete semantic fallback                   |
| Consistency   | Command-specific patterns   | Mostly shared                      | Unified visual and behavioral system         |
| Resilience    | Terminal can corrupt        | Basic cleanup                      | Tested cleanup across failure and signals    |

### Score interpretation

- **0–8:** Not acceptable
- **9–13:** Functional
- **14–17:** Production-ready
- **18–20:** Premium

No command may be rated production-ready if it fails a mandatory requirement, regardless of its numeric score.

---

# 24. Prohibited Patterns

The following patterns MUST NOT appear in production commands unless explicitly justified:

- Spinner-only state with no task label.
- Success reported before asynchronous work completes.
- Errors that contain only “Something went wrong.”
- Prompting when standard input is not interactive.
- ANSI cursor control in redirected output.
- Direct application-level ANSI formatting.
- Multiple independent live renderers writing concurrently.
- Color as the only indicator of success or failure.
- Emoji as the only indicator of state.
- Raw stack traces for expected user errors.
- Destructive confirmation that does not name the affected resource.
- Silent partial failure.
- Automatic retries without communicating that a retry occurred.
- Debug output containing credentials or tokens.
- Immediate process termination that can truncate output.
- Long-running commands with no visible indication of state.
- Completion messages that do not identify what completed.
- Decorative banners that push relevant information out of view.
- Different status vocabulary for different commands.
- Full-screen interfaces for simple one-shot operations.

---

# 25. Reference Interaction

```text
Create product

  name   billing-dashboard
  route  /billing-dashboard

✓ Validate configuration
✓ Generate product files                         14 files
◐ Install dependencies
  @gct-nexus/router · 18 of 24 packages
○ Validate manifest
```

After completion:

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

Plain non-interactive equivalent:

```text
Creating product billing-dashboard
Validated configuration
Generated 14 product files
Installed 24 packages
Validated manifest
Created product at products/billing-dashboard
```

JSON equivalent:

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
  },
  "durationMs": 6400,
  "next": ["cd products/billing-dashboard", "nexus start"]
}
```

---

# 26. Definition of Done

A CLI feature is complete only when:

1. Its semantic events are defined.
2. Interactive and plain rendering are implemented.
3. Failure and cancellation states are implemented.
4. Exit status behavior is defined.
5. Help and examples are written.
6. Automation behavior is defined.
7. Required acceptance criteria pass.
8. Renderer tests pass.
9. Pipe and CI tests pass.
10. The final output leaves the user knowing:

- What happened.
- Whether it succeeded.
- What changed.
- What to do next.

---

# 27. Governing Rule

When design goals conflict, prioritize them in this order:

1. Correctness
2. Safety
3. Composability
4. Clarity
5. Accessibility
6. Consistency
7. Performance
8. Visual refinement
9. Delight

Visual refinement MUST never compromise correctness, safety, accessibility, or automation.
