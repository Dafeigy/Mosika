from datetime import datetime, timezone
from enum import StrEnum
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class TaskStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class WritePolicy(StrEnum):
    READ_ONLY = "read_only"
    ARTIFACT_ONLY = "artifact_only"
    WITH_APPROVAL = "with_approval"


class ToolCallStatus(StrEnum):
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ArtifactKind(StrEnum):
    JSON = "json"
    MARKDOWN = "markdown"
    DOCX = "docx"
    XLSX = "xlsx"
    TEXT = "text"


class TaskEventType(StrEnum):
    TASK_STARTED = "task_started"
    STEP_STARTED = "step_started"
    ASSISTANT_MESSAGE_DELTA = "assistant_message_delta"
    TOOL_CALL_STARTED = "tool_call_started"
    TOOL_CALL_PROGRESS = "tool_call_progress"
    TOOL_CALL_COMPLETED = "tool_call_completed"
    TOOL_CALL_FAILED = "tool_call_failed"
    APPROVAL_REQUIRED = "approval_required"
    ARTIFACT_CREATED = "artifact_created"
    TASK_COMPLETED = "task_completed"
    TASK_FAILED = "task_failed"
    TASK_CANCELLED = "task_cancelled"


class OutputContract(BaseModel):
    summary: str | None = None
    issues: list[dict[str, Any]] = Field(default_factory=list)
    artifacts: list[dict[str, Any]] = Field(default_factory=list)
    citations: list[dict[str, Any]] = Field(default_factory=list)
    next_actions: list[str] = Field(default_factory=list)


class TaskRequest(BaseModel):
    conversation_id: str | None = None
    project_id: str | None = None
    project_root: str | None = None
    selected_files: list[str] = Field(default_factory=list)
    user_instruction: str
    workflow_type: str = "mock_review"
    runtime: Literal["mock", "native"] = "mock"
    allowed_tools: list[str] = Field(default_factory=lambda: ["filesystem.read_text_preview", "artifact.save_markdown"])
    write_policy: WritePolicy = WritePolicy.ARTIFACT_ONLY
    model_profile: str = "mock"
    output_contract: dict[str, Any] = Field(default_factory=dict)
    knowledge_scope: list[str] = Field(default_factory=list)


class ToolCall(BaseModel):
    id: str = Field(default_factory=lambda: f"tool_{uuid4().hex[:12]}")
    task_id: str
    name: str
    title: str | None = None
    status: ToolCallStatus = ToolCallStatus.RUNNING
    input: dict[str, Any] = Field(default_factory=dict)
    output: dict[str, Any] | None = None
    error: str | None = None
    started_at: datetime = Field(default_factory=utc_now)
    completed_at: datetime | None = None


class Artifact(BaseModel):
    id: str = Field(default_factory=lambda: f"artifact_{uuid4().hex[:12]}")
    task_id: str
    name: str
    kind: ArtifactKind
    path: str | None = None
    content: str | dict[str, Any] | list[Any] | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=utc_now)


class TaskEvent(BaseModel):
    id: str = Field(default_factory=lambda: f"event_{uuid4().hex[:12]}")
    task_id: str
    sequence: int
    type: TaskEventType
    created_at: datetime = Field(default_factory=utc_now)
    data: dict[str, Any] = Field(default_factory=dict)


class TaskRecord(BaseModel):
    id: str = Field(default_factory=lambda: f"task_{uuid4().hex[:12]}")
    run_id: str = Field(default_factory=lambda: f"run_{uuid4().hex[:12]}")
    request: TaskRequest
    status: TaskStatus = TaskStatus.QUEUED
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
    started_at: datetime | None = None
    completed_at: datetime | None = None
    error: str | None = None
    result: OutputContract | None = None
    tool_calls: list[ToolCall] = Field(default_factory=list)
    artifacts: list[Artifact] = Field(default_factory=list)

