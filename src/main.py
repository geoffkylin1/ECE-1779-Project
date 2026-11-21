"""SplitMate API application skeleton."""

import socket

from fastapi import FastAPI


app = FastAPI(title="SplitMate API", version="0.1.0")


@app.get("/api/health", tags=["system"])
def health() -> dict[str, str]:
    """Report liveness and the replica that served the request."""
    return {"status": "ok", "replica": socket.gethostname()}


def main() -> str:
    """Retain a small CLI entry point for local smoke checks."""
    message = "Hello from SplitMate!"
    print(message)
    return message


if __name__ == "__main__":
    main()
