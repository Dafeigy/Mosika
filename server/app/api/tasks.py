import asyncio
import json

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from server.app.agents.mock import mock_runtime
from server.app.schemas.agent import TaskEvent, TaskEventType, TaskRecord, TaskRequest, TaskStatus
from server.app.services.event_bus import event_bus
from server.app.services.task_store import task_store


router = APIRouter(prefix="/tasks", tags=["tasks"])

TERMINAL_EVENTS = {
    TaskEventType.TASK_COMPLETED,
    TaskEventType.TASK_FAILED,
    TaskEventType.TASK_CANCELLED,
}


@router.post("", response_model=TaskRecord, status_code=201)
async def create_task(task_request: TaskRequest) -> TaskRecord:
    task = await task_store.create(TaskRecord(request=task_request))
    runner = asyncio.create_task(_run_task(task.id, task_request))
    await task_store.set_runner(task.id, runner)
    return task


@router.get("/{task_id}", response_model=TaskRecord)
async def get_task(task_id: str) -> TaskRecord:
    task = await task_store.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.post("/{task_id}/cancel", response_model=TaskRecord)
async def cancel_task(task_id: str) -> TaskRecord:
    cancelled = await task_store.cancel(task_id)
    if not cancelled:
        raise HTTPException(status_code=404, detail="Task not found")
    await event_bus.publish(
        await task_event(task_id, TaskEventType.TASK_CANCELLED, {"reason": "cancelled by user"})
    )
    task = await task_store.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("/{task_id}/events")
async def stream_task_events(task_id: str, request: Request) -> StreamingResponse:
    task = await task_store.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    async def event_generator():
        queue = await event_bus.subscribe(task_id)
        last_sequence = 0
        history = await event_bus.history(task_id)
        try:
            for event in history:
                last_sequence = max(last_sequence, event.sequence)
                yield sse(event.type, event.model_dump(mode="json"))
                if event.type in TERMINAL_EVENTS:
                    return

            while True:
                if await request.is_disconnected():
                    return
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                except TimeoutError:
                    yield ": keep-alive\n\n"
                    continue
                if event.sequence <= last_sequence:
                    continue
                last_sequence = event.sequence
                yield sse(event.type, event.model_dump(mode="json"))
                if event.type in TERMINAL_EVENTS:
                    return
        finally:
            await event_bus.unsubscribe(task_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def _run_task(task_id: str, task_request: TaskRequest) -> None:
    try:
        await mock_runtime.run(task_id, task_request, event_bus.publish)
    except asyncio.CancelledError:
        await task_store.update_status(task_id, TaskStatus.CANCELLED)
        await event_bus.publish(await task_event(task_id, TaskEventType.TASK_CANCELLED, {"reason": "cancelled"}))
    except Exception as exc:
        await task_store.update_status(task_id, TaskStatus.FAILED, error=str(exc))
        await event_bus.publish(await task_event(task_id, TaskEventType.TASK_FAILED, {"error": str(exc)}))


async def task_event(task_id: str, event_type: TaskEventType, data: dict) -> TaskEvent:
    return TaskEvent(task_id=task_id, sequence=await event_bus.next_sequence(task_id), type=event_type, data=data)


def sse(event_type: str, data: dict) -> str:
    return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
