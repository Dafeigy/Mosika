import logging
import sys
from pathlib import Path

import uvicorn

from server.app.main import app


def configure_packaged_logging() -> None:
    if not getattr(sys, "frozen", False):
        return

    exe_path = Path(sys.executable)
    log_dir = exe_path.parent / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)

    logging.basicConfig(
        filename=log_dir / "server.log",
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )


def main() -> None:
    configure_packaged_logging()
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8765,
        log_level="info",
        log_config=None,
    )


if __name__ == "__main__":
    try:
        main()
    except Exception:
        logging.exception("Mousika server failed to start")
        raise
