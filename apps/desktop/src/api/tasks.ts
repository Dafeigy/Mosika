import { getApiBaseUrl } from "./config";

export type TaskStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type TaskRequest = {
  conversation_id?: string | null;
  project_id?: string | null;
  project_root?: string | null;
  selected_files?: string[];
  user_instruction: string;
  workflow_type?: string;
  runtime?: "mock" | "native";
  allowed_tools?: string[];
  write_policy?: "read_only" | "artifact_only" | "with_approval";
  model_profile?: string;
  output_contract?: Record<string, unknown>;
  knowledge_scope?: string[];
};

export type TaskRecord = {
  id: string;
  run_id: string;
  status: TaskStatus;
  request: TaskRequest;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  result: AgentResult | null;
  tool_calls: AgentToolCall[];
  artifacts: AgentArtifact[];
};

export type AgentIssue = {
  id: string;
  severity: "high" | "mid" | "low" | string;
  category?: string;
  location?: string;
  description: string;
  evidence?: string;
  suggestion?: string;
  source_file?: string;
  confidence?: number;
  citations?: unknown[];
};

export type AgentArtifact = {
  id: string;
  task_id: string;
  name: string;
  kind: string;
  path?: string | null;
  content?: unknown;
  metadata?: Record<string, unknown>;
  created_at: string;
};

export type AgentToolCall = {
  id: string;
  task_id: string;
  name: string;
  title?: string | null;
  status: "running" | "succeeded" | "failed" | "cancelled";
  input: Record<string, unknown>;
  output?: Record<string, unknown> | null;
  error?: string | null;
  started_at: string;
  completed_at?: string | null;
};

export type AgentResult = {
  summary?: string | null;
  issues?: AgentIssue[];
  artifacts?: AgentArtifact[];
  citations?: unknown[];
  next_actions?: string[];
};

export type TaskEvent = {
  id: string;
  task_id: string;
  sequence: number;
  type:
    | "task_started"
    | "step_started"
    | "assistant_message_delta"
    | "tool_call_started"
    | "tool_call_progress"
    | "tool_call_completed"
    | "tool_call_failed"
    | "approval_required"
    | "artifact_created"
    | "task_completed"
    | "task_failed"
    | "task_cancelled";
  created_at: string;
  data: Record<string, unknown>;
};

export async function createTask(request: TaskRequest): Promise<{ apiBaseUrl: string; task: TaskRecord }> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Create task failed: HTTP ${response.status}`);
  }

  return {
    apiBaseUrl,
    task: await response.json(),
  };
}

export async function cancelTask(taskId: string): Promise<TaskRecord> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/tasks/${taskId}/cancel`, { method: "POST" });

  if (!response.ok) {
    throw new Error(`Cancel task failed: HTTP ${response.status}`);
  }

  return response.json();
}

export async function fetchTask(taskId: string): Promise<TaskRecord> {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/tasks/${taskId}`);

  if (!response.ok) {
    throw new Error(`Fetch task failed: HTTP ${response.status}`);
  }

  return response.json();
}

export type TaskEventStream = {
  close: () => void;
};

export function streamTaskEvents(
  apiBaseUrl: string,
  taskId: string,
  onEvent: (event: TaskEvent) => void,
  onError?: (error: unknown) => void,
): TaskEventStream {
  const controller = new AbortController();
  const decoder = new TextDecoder();
  let buffer = "";

  function parseChunk(chunk: string) {
    buffer += chunk;
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const event = parseSseFrame(frame);
      if (event) {
        onEvent(event);
      }
    }
  }

  void (async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/tasks/${taskId}/events`, {
        headers: { Accept: "text/event-stream" },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Task event stream failed: HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error("Task event stream is not readable in this runtime");
      }

      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parseChunk(decoder.decode(value, { stream: true }));
      }

      parseChunk(decoder.decode());
    } catch (error) {
      if (!controller.signal.aborted) {
        onError?.(error);
      }
    }
  })();

  return {
    close: () => controller.abort(),
  };
}

function parseSseFrame(frame: string): TaskEvent | null {
  let data = "";

  for (const line of frame.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("data:")) {
      data += line.slice(5).trimStart();
    }
  }

  if (!data) return null;
  return JSON.parse(data) as TaskEvent;
}
