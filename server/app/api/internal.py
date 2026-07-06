import ipaddress
import os
from collections.abc import Callable
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request, status


router = APIRouter(prefix="/internal")


def is_loopback_host(host: str | None) -> bool:
    if not host:
        return False

    if host == "localhost":
        return True

    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def shutdown_handler(app_state: Any) -> Callable[[], None] | None:
    handler = getattr(app_state, "shutdown_server", None)
    return handler if callable(handler) else None


@router.post("/shutdown")
def shutdown(
    request: Request,
    background_tasks: BackgroundTasks,
    x_mousika_shutdown_token: str | None = Header(default=None),
) -> dict[str, str]:
    if not is_loopback_host(request.client.host if request.client else None):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="loopback client required")

    shutdown_token = os.environ.get("MOUSIKA_SHUTDOWN_TOKEN")
    if not shutdown_token or x_mousika_shutdown_token != shutdown_token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="invalid shutdown token")

    handler = shutdown_handler(request.app.state)
    if handler is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="shutdown unavailable")

    background_tasks.add_task(handler)
    return {"status": "shutting_down"}
