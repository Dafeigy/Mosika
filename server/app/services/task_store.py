import asyncio
from datetime import datetime, timezone

from server.app.schemas.agent import Artifact, OutputContract, TaskRecord, TaskStatus, ToolCall


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class TaskStore:
    def __init__(self) -> None:
        self._tasks: dict[str, TaskRecord] = {}
        self._runners: dict[str, asyncio.Task[None]] = {}
        self._lock = asyncio.Lock()

    async def create(self, task: TaskRecord) -> TaskRecord:
        async with self._lock:
            self._tasks[task.id] = task
            return task

    async def get(self, task_id: str) -> TaskRecord | None:
        async with self._lock:
            return self._tasks.get(task_id)

    async def set_runner(self, task_id: str, runner: asyncio.Task[None]) -> None:
        async with self._lock:
            self._runners[task_id] = runner

    async def update_status(
        self,
        task_id: str,
        status: TaskStatus,
        *,
        error: str | None = None,
        result: OutputContract | None = None,
    ) -> TaskRecord | None:
        async with self._lock:
            task = self._tasks.get(task_id)
            if not task:
                return None
            task.status = status
            task.updated_at = utc_now()
            if status == TaskStatus.RUNNING and not task.started_at:
                task.started_at = task.updated_at
            if status in {TaskStatus.SUCCEEDED, TaskStatus.FAILED, TaskStatus.CANCELLED}:
                task.completed_at = task.updated_at
                self._runners.pop(task_id, None)
            if error is not None:
                task.error = error
            if result is not None:
                task.result = result
            return task

    async def add_tool_call(self, task_id: str, tool_call: ToolCall) -> ToolCall | None:
        async with self._lock:
            task = self._tasks.get(task_id)
            if not task:
                return None
            task.tool_calls.append(tool_call)
            task.updated_at = utc_now()
            return tool_call

    async def update_tool_call(self, task_id: str, tool_call: ToolCall) -> ToolCall | None:
        async with self._lock:
            task = self._tasks.get(task_id)
            if not task:
                return None
            for index, existing in enumerate(task.tool_calls):
                if existing.id == tool_call.id:
                    task.tool_calls[index] = tool_call
                    task.updated_at = utc_now()
                    return tool_call
            return None

    async def add_artifact(self, task_id: str, artifact: Artifact) -> Artifact | None:
        async with self._lock:
            task = self._tasks.get(task_id)
            if not task:
                return None
            task.artifacts.append(artifact)
            task.updated_at = utc_now()
            return artifact

    async def cancel(self, task_id: str) -> bool:
        async with self._lock:
            runner = self._runners.get(task_id)
            task = self._tasks.get(task_id)
            if not task:
                return False
            if task.status in {TaskStatus.SUCCEEDED, TaskStatus.FAILED, TaskStatus.CANCELLED}:
                return True
            task.status = TaskStatus.CANCELLED
            task.updated_at = utc_now()
            task.completed_at = task.updated_at
            if runner:
                runner.cancel()
            self._runners.pop(task_id, None)
            return True


task_store = TaskStore()

