/**
 * Minimal stand-in for the parts of a pi session the extension touches, so the
 * editor render path can be exercised without a live TUI.
 *
 * The editor is the real `CustomEditor` from pi-tui: the behaviour this harness
 * guards against comes from how a host writes properties onto the instance the
 * extension hands back, so the real base class matters.
 *
 * Skips (returns null) when the peer dependencies are not installed, matching
 * the other end-to-end checks in this directory.
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadPiThemeModule } from "./pi-theme-module.mjs";

const BUNDLE = path.join("dist", "extensions", "pi-theme-collection.ts");

export async function loadBundle() {
  const bundlePath = process.env.BUNDLE_UNDER_TEST
    ? path.resolve(process.env.BUNDLE_UNDER_TEST)
    : path.resolve(fileURLToPath(new URL("../../", import.meta.url)), BUNDLE);
  try {
    const module = await import(pathToFileURL(bundlePath).href);
    return { module, bundlePath };
  } catch {
    return null;
  }
}

export async function createEditorHost(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const piTheme = await loadPiThemeModule();
  const loaded = await loadBundle();
  if (!piTheme || !loaded?.module?.default) return null;
  const mod = loaded.module;
  const { CustomEditor } = await import("@earendil-works/pi-coding-agent");
  const { getKeybindings } = await import("@earendil-works/pi-tui");
  if (!CustomEditor) return null;

  const registrations = [];
  const widgets = [];
  const notices = [];
  let editorFactory = null;
  let editorInstance = null;
  const gitRepo = {
    isRepo() { return true; },
    branch() { return "master"; },
    status(_paths, untracked) {
      return {
        branch: "master",
        ahead: 0,
        behind: 0,
        staged: [],
        unstaged: [],
        untracked: untracked === false ? [] : ["note.md"],
        conflicts: []
      };
    }
  };

  const editorTheme = {
    name: "test-dark",
    colors: {
      text: "#dddddd",
      accent: "#7aa2f7",
      border: "#3b3f55",
      borderMuted: "#2b2f44",
      thinking: "#888899",
      success: "#4caf7d",
      warning: "#d8a657",
      error: "#e06c75"
    },
    borderColor: (line) => line ?? "",
    getThinkingBorderColor: () => (line) => line ?? ""
  };

  const renderRequests = [];
  const ui = {
    tui: {
      terminal: { rows: 40, cols: 120 },
      isAltScreen: false,
      requestRender() { renderRequests.push("render"); },
      requestRenderAll() { renderRequests.push("renderAll"); },
      getTotalLines() { return 0; },
      getTerminalWidth() { return 120; },
      getTerminalHeight() { return 40; },
      clearHotspots() {},
      invalidate() {}
    },
    setWidget(name, value) { widgets.push({ name, value }); },
    setEditorComponent(factory) {
      editorFactory = factory ?? null;
      // pi instantiates the factory immediately and wires the TUI onto it.
      editorInstance = factory ? factory(ui, editorTheme, keybindings) : null;
      if (editorInstance) editorInstance.tui = ui.tui;
    },
    getEditorComponent() { return editorFactory; },
    setFooter() {},
    setStatusIndicator() {},
    setStatusLabel() {},
    setWorkingMessage() {},
    setWorkingIndicator() {},
    setHiddenFileInputs() {},
    paste() {},
    copyToClipboard() {},
    setTerminalTitle() {},
    setTerminalTitle() {},
    setTitle() {},
    notify(message, type) { notices.push({ message, type }); },
    theme: editorTheme
  };

  const flags = new Map([["no-status-line", false], ["no-editor", false]]);
  const host = {
    registerCommand(name, opts) { registrations.push({ type: "command", name, handler: opts?.handler }); },
    registerShortcut() {},
    registerFlag(name, opts) { flags.set(name, opts?.default ?? false); },
    getFlag(name) { return flags.get(name); },
    exec() { return Promise.resolve({ code: 0, stdout: "", stderr: "" }); },
    getActiveTools() { return ["read", "edit", "bash"]; },
    getAllTools() { return ["read", "edit", "bash"]; },
    setActiveTools() {},
    on(event, handler) { registrations.push({ type: "event", event, handler }); },
    ui
  };

  const sessions = [];
  const ctx = {
    ui,
    cwd,
    hasUI: true,
    mode: "tui",
    isProjectTrusted: () => true,
    getModel() { return { id: "test-model", name: "Test Model", provider: "test", reasoning: false }; },
    hasContext() { return true; },
    getContextUsage() { return { usedTokens: 4096, contextWindow: 200000 }; },
    getTools() { return ["read", "edit", "bash"]; },
    getToolNames() { return ["read", "edit", "bash"]; },
    hasTool() { return true; },
    activeToolNames: ["read", "edit", "bash"],
    isIdle() { return true; },
    getSessionName() { return "test session"; },
    getThinkingLevel() { return "high"; },
    shellRunner: { isRunning() { return false; } },
    settings: {
      async setEffectiveOverride() {},
      async setEffectiveValue() {},
      getRaw() { return {}; },
      async setRaw() {}
    },
    gitRunner: { isRepo() { return true; }, getGitDir() { return undefined; }, getRepo() { return gitRepo; } },
    projectGitRunner: { isRepo() { return true; }, getGitDir() { return undefined; }, getRepo() { return gitRepo; } },
    sessionManager: {
      getBranch() { return sessions; },
      getEntries() { return sessions; },
      getSessionId() { return "session-1"; },
      getSession() { return { file: undefined, path: undefined }; }
    }
  };

  const emit = async (event, payload) => {
    for (const registration of registrations) {
      if (registration.type === "event" && registration.event === event) {
        await registration.handler(payload, ctx);
      }
    }
  };

  const runCommand = async (name, args) => {
    const entry = registrations.find((r) => r.type === "command" && r.name === name);
    if (!entry) throw new Error(`command ${name} is not registered`);
    await entry.handler(args, ctx);
  };

  const keybindings = typeof getKeybindings === "function" ? getKeybindings() : undefined;
  await mod.default(host);
  return {
    mod,
    ctx,
    ui,
    emit,
    runCommand,
    widgets,
    notices,
    renderRequests,
    makeEditor: () => {
      if (!editorInstance) throw new Error("no editor instance was created");
      return editorInstance;
    },
    editorInstalled: () => editorFactory !== null
  };
}

/** Render the editor at each width, the way a render pass would. */
export function renderEditor(editor, text, widths) {
  const out = [];
  editor.setText(text);
  for (const width of widths) {
    out.push({ width, lines: editor.render(width) });
  }
  return out;
}
