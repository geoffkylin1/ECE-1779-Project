"""Sample tests to verify the test setup works."""

from src.main import main


def test_main_returns_greeting():
    assert main() == "Hello from ECE-1779-Project!"


def test_basic_arithmetic():
    assert 1 + 1 == 2
