import asyncio

from server.app.schemas.agent import TaskEvent


class TaskEventBus:
    def __init__(self) -> None:
        self._events: dict[str, list[TaskEvent]] = {}
        self._queues: dict[str, list[asyncio.Queue[TaskEvent]]] = {}
        self._lock = asyncio.Lock()

    async def publish(self, event: TaskEvent) -> None:
        async with self._lock:
            self._events.setdefault(event.task_id, []).append(event)
            queues = list(self._queues.get(event.task_id, []))

        for queue in queues:
            await queue.put(event)

    async def history(self, task_id: str) -> list[TaskEvent]:
        async with self._lock:
            return list(self._events.get(task_id, []))

    async def next_sequence(self, task_id: str) -> int:
        async with self._lock:
            return len(self._events.get(task_id, [])) + 1

    async def subscribe(self, task_id: str) -> asyncio.Queue[TaskEvent]:
        queue: asyncio.Queue[TaskEvent] = asyncio.Queue()
        async with self._lock:
            self._queues.setdefault(task_id, []).append(queue)
        return queue

    async def unsubscribe(self, task_id: str, queue: asyncio.Queue[TaskEvent]) -> None:
        async with self._lock:
            queues = self._queues.get(task_id)
            if not queues:
                return
            if queue in queues:
                queues.remove(queue)
            if not queues:
                self._queues.pop(task_id, None)


event_bus = TaskEventBus()
