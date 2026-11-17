"""Tests for SplitMate equal splitting."""

import pytest

from src.split import amount_to_cents, equal_split


def test_equal_split_100():
    result = equal_split("100.00", [3, 1, 2])
    assert result == {
        1: "33.34",
        2: "33.33",
        3: "33.33",
    }


def test_equal_split_one_cent():
    result = equal_split("0.01", [3, 1, 2])
    assert result == {
        1: "0.01",
        2: "0.00",
        3: "0.00",
    }


def test_single_participant():
    assert equal_split("12.30", [2]) == {2: "12.30"}


def test_duplicate_participants():
    with pytest.raises(ValueError):
        equal_split("10.00", [1, 1])


def test_empty_participants():
    with pytest.raises(ValueError):
        equal_split("10.00", [])


def test_invalid_amount():
    with pytest.raises(ValueError):
        amount_to_cents("12.345")


def test_zero_amount():
    with pytest.raises(ValueError):
        equal_split("0.00", [1, 2])


def test_amount_too_large():
    with pytest.raises(ValueError):
        equal_split("100000000.00", [1, 2])


def test_total_is_preserved():
    result = equal_split("100.01", [4, 2, 3, 1])
    assert sum(amount_to_cents(value) for value in result.values()) == 10001
