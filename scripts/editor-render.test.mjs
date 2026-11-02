/**
 * The editor frame is drawn inside pi's render loop, so a throw there takes the
 * whole TUI down. Preset switching rebuilds the editor, and pi writes its own
 * properties onto whatever instance the extension's factory returns, so two
 * things are guarded here:
 *
 * 1. every preset keeps producing a frame at every width, including the
 *    claude -> omp hop, where the rounded border starts carrying the status
 *    line (`borderStatus`) and the context gauge;
 * 2. a property written by the host must not hide a render helper. An own
 *    property named `borderStatus` or `borderColor` shadows the prototype
 *    method the render path dispatches through; if the value is not callable
 *    the render pass throws halfway through a frame.
 *
 * Run:  node scripts/editor-render.test.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createEditorHost, renderEditor } from "./lib/editor-host.mjs";

const WIDTHS = [20, 40, 60, 80, 120, 200];
const ROUNDED_TOP = "\u256D";

// Run against a scratch agent directory so a preset switch cannot rewrite the
// settings file of a real install.
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "pi-theme-collection-test-"));
process.env.PI_CODING_AGENT_DIR = sandbox;

const host = await createEditorHost({ cwd: sandbox });
if (!host) {
  console.log("SKIP pi peer dependencies are not installed");
  fs.rmSync(sandbox, { recursive: true, force: true });
  process.exit(0);
}
const { ctx, emit, runCommand, makeEditor, editorInstalled } = host;

await emit("session_start", { cwd: ctx.cwd, sessionManager: ctx.sessionManager }, ctx);
assert.ok(editorInstalled(), "extension should install a custom editor");

function plain(line) {
  return String(line)
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/\u001b\]8;;[^\u0007\u001b]*(?:\u0007|\u001b\\)/g, "")
    .replace(/[\u001b\u0007]/g, "");
}

/** pi re-creates the editor when a preset changes the composer shape. */
function currentEditor() {
  const editor = makeEditor();
  editor.setPaddingX(1);
  return editor;
}

function check(label, editor) {
  const frames = renderEditor(editor, "hello there", WIDTHS);
  for (const { width, lines } of frames) {
    assert.ok(Array.isArray(lines), `${label}: render(${width}) should return an array`);
    assert.ok(lines.length >= 2, `${label}: render(${width}) should draw a frame`);
    for (const line of lines) {
      assert.ok(!plain(line).includes("undefined"), `${label}: render(${width}) leaked "undefined" into ${plain(line)}`);
    }
  }
  // The completion dropdown walks a different branch of the same frame code.
  const dropdown = editor.autocompleteState;
  editor.autocompleteState = null;
  try {
    for (const { width, lines } of renderEditor(editor, "hello there", WIDTHS)) {
      assert.ok(lines.length >= 2, `${label}: bare render(${width}) should draw a frame`);
    }
  } finally {
    editor.autocompleteState = dropdown;
  }
  return frames;
}

/** Presets in the order a user is likely to cycle through them. */
let sawRounded = false;
for (const preset of ["claude", "claude-code", "omp", "codex", "default", "omp"]) {
  await runCommand("pi-theme-collection", `preset ${preset}`);
  const editor = currentEditor();
  check(`preset ${preset}`, editor);
  if (plain(editor.render(120)[0]).includes(ROUNDED_TOP)) sawRounded = true;
}
assert.ok(sawRounded, "a rounded preset should draw a rounded top border carrying the status line");

/** pi copies the previous editor's border colour onto the replacement. */
const inherited = currentEditor();
inherited.borderColor = (line) => `${line ?? ""}+`;
check("host border colour", inherited);
assert.ok(
  plain(inherited.render(120)[0]).length > 0,
  "a callable host border colour should still render"
);

/** A non-callable host property must not hide the render helpers. */
const editor = currentEditor();
for (const name of [
  "borderStatus",
  "borderColor",
  "borderFooter",
  "frame",
  "metadata",
  "styleFor",
  "frameKind",
  "paddingFor",
  "borderFor",
  "borderColorFor",
  "contextGauge",
  "statusTheme",
  "semantic"
]) {
  editor[name] = { hostOwned: true };
}
check("non-callable host properties", editor);

/** Switching presets while shadowed must not throw either. */
for (const preset of ["claude-code", "omp", "default"]) {
  await runCommand("pi-theme-collection", `preset ${preset}`);
  check(`preset ${preset} while shadowed`, currentEditor());
}

fs.rmSync(sandbox, { recursive: true, force: true });
console.log("editor render checks passed");
