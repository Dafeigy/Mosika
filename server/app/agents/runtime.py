from abc import ABC, abstractmethod
from collections.abc import Awaitable, Callable

from server.app.schemas.agent import TaskEvent, TaskRequest

PublishEvent = Callable[[TaskEvent], Awaitable[None]]


class RuntimeAdapter(ABC):
    @abstractmethod
    async def run(self, task_id: str, request: TaskRequest, publish: PublishEvent) -> None:
        """Run a task and publish progress events."""

