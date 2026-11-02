# Changelog

All notable changes to `pi-theme-collection` are documented here. `0.1.0` is the
initial release of this package; it is maintained standalone and does not track any
other repository.

## [0.1.0] — 2026-11-02

Initial release: a collection of appearance presets for Pi. A preset composes the surfaces
around the editor — composer, status line, startup view, messages, tool rendering — and the
palette comes from whatever theme you choose in `/settings → Theme`, so the two combine.

It builds on `pi-omp-theme` (Nguyen Quang Thai, MIT), which provides the foundation: the
`omp` and `claude` presets, the Titanium themes, and the surfaces that first shipped with
them. From here the package is maintained standalone.

### Surfaces

- **Preset collection** — `claude`, `claude-code`, `omp`, `default`, `minimal`, `compact`,
  `full`, `ascii`, `native`: each a whole appearance, coordinating status placement, editor
  shape, separator and segment layout, startup view, and message and tool rendering.
- **Themes as the palette** — the bundled `titanium` and `titanium-light` themes are
  registered with Pi's theme picker, and so is any JSON theme in `themes/`; every colour a
  preset draws is read from the live theme, so presets and themes combine freely.
- **Glyph and colour handling** — Nerd Font / Unicode / ASCII glyph modes, shimmer,
  syntax-highlight caching and per-session accent colours, applied to whichever theme is
  active.
- **Status line** — model, effort, path, Git state, context usage, cost, timing and
  session state, laid out per preset, drawn above, below or inside the editor border.
- **Editor** — `compact`, `boxed`, `dock` and `native` styles with `auto`, `halfblock`,
  `line`, `solid`, `outline`, `rounded`, `claude` and `native` frames.
- **Claude Code transcript** (`claude-code`) — `● Name(args)` tool calls with a `⎿` result
  gutter, marked answers, one-line thinking summaries, edit sentences, an interrupt prompt
  and a working row with run time and tokens.
- **Tool rendering** — boxed or inline chrome, quiet-call batching, adaptive diffs,
  elapsed time and completed-turn summaries.
- **Startup** — compact header or an optional welcome card with resources, tool
  providers and recent sessions.

### Behaviour

- The status bar gives way on the project path first. As the terminal narrows, leading
  folders drop one at a time
  (`📁 D:\Google Drive\Projects\Python\proj` → `📁 …\Python\proj` → `📁 proj`);
  only once the path is down to the project folder name do other segments compact or
  move to the second row.
- Nothing is forced at session start: `theme.autoApply` defaults to `"off"`, so the
  theme stored in Pi's settings stays yours.
- Configuration precedence
  `defaults < global settings < trusted project settings < environment < session override`,
  with invalid values falling back safely and reported by `/pi-theme-collection doctor`.

### Fixed

- **`/settings → Theme` is respected.** A forced `setTheme("titanium")` at session
  start used to persist into Pi's settings and overwrite the theme you picked; the
  theme is now only applied when `theme.autoApply` (or `PI_THEME_COLLECTION_THEME`)
  names one.
- **Theme changes repaint immediately.** Pi hands extensions a stable theme proxy whose
  identity never changes, so caches keyed on that identity replayed the previous
  theme's colours. Theme caches are keyed on the live theme's name and colours, and the
  status widgets resolve the theme at render time.
- **Theme-provided extras follow the active theme** — glyphs, bash prompt colour and
  shimmer are re-applied when the live theme changes instead of once at session start.
- **Preset switching no longer crashes the render pass.** pi builds the editor from the
  extension's factory and then writes properties onto the instance; a value that is not
  callable hid the render helpers behind it and `this.borderStatus(...)` threw inside
  pi's layout pass, leaving a half-painted frame. The render path now resolves its
  helpers through a pinned table and the editor instance pins those names to callables,
  so host-written properties cannot break a frame.
- **Settings written under the previous `piOmpTheme` namespace** are read as a fallback
  and folded into `piThemeCollection` on the next write.

### Checks

- `npm run verify` — asserts the recorded fixes are present and the bundle parses.
- `npm run test` — theme switching against Pi's real theme module.
- `npm run testWidgets` — the real status-line widgets repaint on a theme change.
- `npm run testShrink` — the status row while the terminal narrows; the path must
  collapse level by level and never overflow.
- `npm run testEditor` — the editor frame across presets, widths and the completion
  dropdown, including host properties written onto the editor instance.
- CI runs all five on every push (`scripts/verify.yml`).
