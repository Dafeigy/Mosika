import logging
import sys
from argparse import ArgumentParser
from pathlib import Path

import uvicorn

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

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


def parse_args() -> tuple[str, int]:
    parser = ArgumentParser(description="Run the Mousika local server.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8765, type=int)
    args = parser.parse_args()
    return args.host, args.port


def main() -> None:
    configure_packaged_logging()
    host, port = parse_args()
    config = uvicorn.Config(
        app=app,
        host=host,
        port=port,
        log_level="info",
        log_config=None,
    )
    server = uvicorn.Server(config)

    def request_shutdown() -> None:
        logging.info("Graceful shutdown requested")
        server.should_exit = True

    app.state.shutdown_server = request_shutdown
    server.run()


if __name__ == "__main__":
    try:
        main()
    except Exception:
        logging.exception("Mousika server failed to start")
        raise
