from fastapi.testclient import TestClient

from server.app.main import app


def test_mock_task_records_events_and_result() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/tasks",
            json={
                "user_instruction": "检查一份可研报告",
                "workflow_type": "mock_review",
                "runtime": "mock",
                "write_policy": "artifact_only",
            },
        )

        assert response.status_code == 201
        task = response.json()
        task_id = task["id"]

        seen_event_types: list[str] = []
        with client.stream("GET", f"/tasks/{task_id}/events") as stream:
            for line in stream.iter_lines():
                if line.startswith("event: "):
                    seen_event_types.append(line.removeprefix("event: "))
                if seen_event_types and seen_event_types[-1] == "task_completed":
                    break

        assert "task_started" in seen_event_types
        assert "tool_call_started" in seen_event_types
        assert "artifact_created" in seen_event_types
        assert seen_event_types[-1] == "task_completed"

        status_response = client.get(f"/tasks/{task_id}")
        assert status_response.status_code == 200
        completed = status_response.json()
        assert completed["status"] == "succeeded"
        assert completed["tool_calls"][0]["status"] == "succeeded"
        assert completed["artifacts"][0]["name"] == "mock-review-summary.md"
        assert completed["result"]["issues"]


def test_task_can_be_cancelled() -> None:
    with TestClient(app) as client:
        response = client.post("/tasks", json={"user_instruction": "取消这个任务"})
        task_id = response.json()["id"]

        cancel_response = client.post(f"/tasks/{task_id}/cancel")

        assert cancel_response.status_code == 200
        assert cancel_response.json()["status"] == "cancelled"
