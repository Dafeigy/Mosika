import asyncio
from datetime import datetime, timezone
from typing import Any

from server.app.agents.runtime import PublishEvent, RuntimeAdapter
from server.app.schemas.agent import (
    Artifact,
    ArtifactKind,
    OutputContract,
    TaskEvent,
    TaskEventType,
    TaskRequest,
    TaskStatus,
    ToolCall,
    ToolCallStatus,
)
from server.app.services.task_store import task_store


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class MockRuntime(RuntimeAdapter):
    async def run(self, task_id: str, request: TaskRequest, publish: PublishEvent) -> None:
        sequence = 1

        async def emit(event_type: TaskEventType, data: dict[str, Any] | None = None) -> None:
            nonlocal sequence
            await publish(
                TaskEvent(
                    task_id=task_id,
                    sequence=sequence,
                    type=event_type,
                    data=data or {},
                )
            )
            sequence += 1

        await task_store.update_status(task_id, TaskStatus.RUNNING)
        await emit(
            TaskEventType.TASK_STARTED,
            {
                "run_id": f"mock-{task_id}",
                "workflow_type": request.workflow_type,
                "write_policy": request.write_policy,
            },
        )

        steps = [
            ("Build AgentContext", "context", "读取项目、选中文件、写入策略和输出契约。"),
            ("Read project material", "filesystem", "模拟扫描选中文件并生成文本预览。"),
            ("Run mock domain tool", "tool", "调用 mock 审查工具并记录结构化结果。"),
            ("Create artifact", "artifact", "保存 Markdown/JSON 形式的任务结果。"),
        ]

        for title, tag, message in steps:
            if await self._is_cancelled(task_id):
                await emit(TaskEventType.TASK_CANCELLED, {"reason": "cancelled"})
                return
            await emit(TaskEventType.STEP_STARTED, {"title": title, "tag": tag})
            await asyncio.sleep(0.35)
            await emit(TaskEventType.ASSISTANT_MESSAGE_DELTA, {"text": message})

        tool_call = ToolCall(
            task_id=task_id,
            name="mock.review_engineering_package",
            title="模拟审查工程资料",
            input={
                "instruction": request.user_instruction,
                "selected_files": request.selected_files,
                "allowed_tools": request.allowed_tools,
            },
        )
        await task_store.add_tool_call(task_id, tool_call)
        await emit(TaskEventType.TOOL_CALL_STARTED, {"tool_call": tool_call.model_dump(mode="json")})
        await asyncio.sleep(0.45)
        await emit(TaskEventType.TOOL_CALL_PROGRESS, {"tool_call_id": tool_call.id, "message": "正在整理章节、表格和引用线索。"})
        await asyncio.sleep(0.45)

        issues = [
            {
                "id": "ISSUE-MOCK-001",
                "severity": "high",
                "category": "consistency",
                "location": "模拟文件 / 第 3 节",
                "description": "主设备容量在说明正文和参数表中不一致。",
                "evidence": "正文写作 2x180MVA，参数表写作 2x240MVA。",
                "suggestion": "请确认设计输入后统一容量表述，并在修订说明中记录依据。",
                "source_file": request.selected_files[0] if request.selected_files else "未选择文件",
                "confidence": 0.86,
                "citations": [],
            },
            {
                "id": "ISSUE-MOCK-002",
                "severity": "mid",
                "category": "terminology",
                "location": "全文",
                "description": "术语写法存在混用。",
                "evidence": "站用变、所用变在多个段落中交替出现。",
                "suggestion": "按项目术语库统一写法。",
                "source_file": request.selected_files[0] if request.selected_files else "未选择文件",
                "confidence": 0.72,
                "citations": [],
            },
        ]

        tool_call.status = ToolCallStatus.SUCCEEDED
        tool_call.output = {"issues": issues, "checked_at": iso_now()}
        tool_call.completed_at = datetime.now(timezone.utc)
        await task_store.update_tool_call(task_id, tool_call)
        await emit(TaskEventType.TOOL_CALL_COMPLETED, {"tool_call": tool_call.model_dump(mode="json")})

        artifact = Artifact(
            task_id=task_id,
            name="mock-review-summary.md",
            kind=ArtifactKind.MARKDOWN,
            content=self._markdown_result(request, issues),
            metadata={"workflow_type": request.workflow_type, "mock": True},
        )
        await task_store.add_artifact(task_id, artifact)
        await emit(TaskEventType.ARTIFACT_CREATED, {"artifact": artifact.model_dump(mode="json")})

        result = OutputContract(
            summary="Mock Runtime 已完成一次可观测的 Agent 任务演示，生成了结构化问题和 artifact。",
            issues=issues,
            artifacts=[artifact.model_dump(mode="json")],
            next_actions=["接入真实 Word/Excel 工具", "把 artifact 存储迁移到磁盘或 SQLite", "为写入型工具补充审批事件"],
        )
        await task_store.update_status(task_id, TaskStatus.SUCCEEDED, result=result)
        await emit(TaskEventType.TASK_COMPLETED, {"result": result.model_dump(mode="json")})

    async def _is_cancelled(self, task_id: str) -> bool:
        task = await task_store.get(task_id)
        return task is None or task.status == TaskStatus.CANCELLED

    def _markdown_result(self, request: TaskRequest, issues: list[dict[str, Any]]) -> str:
        issue_lines = "\n".join(
            f"- **{issue['severity']}** `{issue['id']}` {issue['description']} ({issue['location']})"
            for issue in issues
        )
        return (
            "# Mock Agent 审查结果\n\n"
            f"指令：{request.user_instruction}\n\n"
            "## 问题\n\n"
            f"{issue_lines}\n"
        )


mock_runtime = MockRuntime()
