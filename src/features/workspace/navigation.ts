import {
  Database,
  FileCheck2,
  Files,
  Fingerprint,
  GitBranch,
  History,
  Layers,
  Network,
  Search,
  ShieldCheck,
} from "lucide-react";

/** Presentation only: operations and their state remain in the workspace panels. */
export const workspaceGroups = [
  {
    key: "verify",
    label: "Verify",
    description: "Find records & check files",
    icon: ShieldCheck,
    tools: [
      { key: "records", label: "Inspect", icon: Search },
      { key: "proof-check", label: "Proof check", icon: FileCheck2 },
    ],
  },
  {
    key: "create",
    label: "Create",
    description: "Timestamps, versions & groups",
    icon: Fingerprint,
    tools: [
      { key: "register", label: "Timestamp", icon: Fingerprint },
      { key: "branch", label: "Branch", icon: GitBranch },
      { key: "aggregate", label: "Batch / Pack", icon: Layers },
      { key: "account", label: "Account", icon: Database },
    ],
  },
  {
    key: "history",
    label: "History",
    description: "Proof files & record recovery",
    icon: History,
    tools: [
      { key: "proofs", label: "Manage proofs", icon: Files },
      { key: "proof-inspector", label: "Proof inspector", icon: Network },
      { key: "restore", label: "Restore", icon: History },
    ],
  },
] as const;

export type WorkspaceTool =
  (typeof workspaceGroups)[number]["tools"][number]["key"];

export function groupForTool(tool: WorkspaceTool) {
  // The type is derived from these groups, so every tool has exactly one home.
  return workspaceGroups.find((group) =>
    group.tools.some((entry) => entry.key === tool),
  )!;
}
