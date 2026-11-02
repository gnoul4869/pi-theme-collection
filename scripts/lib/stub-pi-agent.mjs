// Stub of the parts of @earendil-works/pi-coding-agent the bundle imports.
export const CONFIG_DIR_NAME = ".pi";
export const VERSION = "0.0.0-test-stub";

// Points at a throwaway directory so tests never read or write real settings.
export function getAgentDir() {
  return process.env.PI_THEME_COLLECTION_TEST_AGENT_DIR ?? "/tmp/pi-theme-collection-test-agent";
}

export function getLanguageFromPath() {
  return void 0;
}

export function highlightCode() {
  return [];
}

// Plain functions double as constructors and callables, so `extends X`, `new X()`
// and `X()` all survive without a real editor or interactive mode.
export function CustomEditor() {}
export function InteractiveMode() {}
export function AssistantMessageComponent() {}
export function BashExecutionComponent() {}
export function BranchSummaryMessageComponent() {}
export function CompactionSummaryMessageComponent() {}
export function CustomMessageComponent() {}
export function SkillInvocationMessageComponent() {}
export function ToolExecutionComponent() {}
export function UserMessageComponent() {}
