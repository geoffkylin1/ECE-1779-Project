"""Sample tests to verify the test setup works."""

from src.main import health, main


def test_main_returns_greeting():
    assert main() == "Hello from SplitMate!"


def test_basic_arithmetic():
    assert 1 + 1 == 2


def test_health_reports_replica():
    response = health()

    assert response["status"] == "ok"
    assert response["replica"]
