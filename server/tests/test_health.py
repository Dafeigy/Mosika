from fastapi.testclient import TestClient

from server.app.main import app


def test_health() -> None:
    client = TestClient(app)
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["service"] == "mousika-local-server"


def test_cors_allows_dynamic_localhost_ports() -> None:
    client = TestClient(app)
    response = client.options(
        "/health",
        headers={
            "Origin": "http://127.0.0.1:49876",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:49876"


def test_internal_shutdown_requires_token() -> None:
    client = TestClient(app)
    response = client.post("/internal/shutdown")

    assert response.status_code == 403
