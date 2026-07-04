import type { Component } from "vue";

export type SessionState = "running" | "approval" | "done" | "failed" | "idle";
export type InspectorTab = "result" | "source" | "context";
export type ComposerMode = "agent" | "chat";
export type ActiveView = "home" | "workbench" | "documents" | "knowledge" | "history" | "settings";
export type PlanStepState = "done" | "current" | "pending";
export type RiskLevel = "high" | "mid" | "low";

export type MessageContent = {
  type: "text" | "html";
  text: string;
};

export type ConversationItem =
  | {
      type: "message";
      id: string;
      role: "user" | "assistant" | "system";
      content: MessageContent[];
      createdAt: string;
      status?: "streaming" | "done" | "error";
    }
  | {
      type: "tool_call";
      id: string;
      toolName: string;
      title?: string;
      status: "pending" | "running" | "approval_required" | "done" | "error";
      args?: unknown;
      result?: unknown;
      renderHint?: string;
      createdAt: string;
      updatedAt: string;
    };

export type ProjectMock = {
  id: string;
  name: string;
  meta: string;
  folderPath: string;
};

export type ConversationMock = {
  id: string;
  projectId: string | null;
  title: string;
  updatedAt: string;
  taskId: string;
  state: SessionState;
  statusLabel: string;
  user: string;
  prompt: string;
  metrics: Array<{ label: string; value: string; tone?: "danger" | "warn" | "success" }>;
  plan: Array<{ title: string; tag: string; state: PlanStepState }>;
  agentMessage: string;
  toolName: string;
  toolArgs: string;
  reviewRows: Array<{ level: RiskLevel; label: string; text: string; ref: string }>;
  approval?: {
    title: string;
    body: string;
  };
  contextChips: string[];
  items: ConversationItem[];
};

export type NavItem = {
  id: ActiveView | "home";
  label: string;
  icon: Component;
  description: string;
};
