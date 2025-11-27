"""Tests for migrator module."""

from datetime import datetime, timedelta

import pytest

from doctoralia_migration.migrator import (
    MigrationStatus,
    TableMigrationResult,
    MigrationResult,
)


class TestTableMigrationResult:
    """Tests for TableMigrationResult class."""

    def test_duration_seconds(self):
        """Test duration calculation."""
        start = datetime(2023, 1, 1, 12, 0, 0)
        end = datetime(2023, 1, 1, 12, 0, 30)

        result = TableMigrationResult(
            table_name="test",
            status=MigrationStatus.COMPLETED,
            start_time=start,
            end_time=end
        )

        assert result.duration_seconds == 30.0

    def test_duration_seconds_none(self):
        """Test duration is None when times not set."""
        result = TableMigrationResult(
            table_name="test",
            status=MigrationStatus.PENDING
        )

        assert result.duration_seconds is None


class TestMigrationResult:
    """Tests for MigrationResult class."""

    def test_total_rows_extracted(self):
        """Test total rows extracted calculation."""
        result = MigrationResult(
            status=MigrationStatus.COMPLETED,
            table_results=[
                TableMigrationResult("t1", MigrationStatus.COMPLETED, rows_extracted=100),
                TableMigrationResult("t2", MigrationStatus.COMPLETED, rows_extracted=200),
                TableMigrationResult("t3", MigrationStatus.FAILED, rows_extracted=50),
            ]
        )

        assert result.total_rows_extracted == 350

    def test_total_rows_loaded(self):
        """Test total rows loaded calculation."""
        result = MigrationResult(
            status=MigrationStatus.COMPLETED,
            table_results=[
                TableMigrationResult("t1", MigrationStatus.COMPLETED, rows_loaded=100),
                TableMigrationResult("t2", MigrationStatus.COMPLETED, rows_loaded=200),
            ]
        )

        assert result.total_rows_loaded == 300

    def test_success_count(self):
        """Test success count calculation."""
        result = MigrationResult(
            status=MigrationStatus.COMPLETED,
            table_results=[
                TableMigrationResult("t1", MigrationStatus.COMPLETED),
                TableMigrationResult("t2", MigrationStatus.COMPLETED),
                TableMigrationResult("t3", MigrationStatus.FAILED),
            ]
        )

        assert result.success_count == 2

    def test_failure_count(self):
        """Test failure count calculation."""
        result = MigrationResult(
            status=MigrationStatus.FAILED,
            table_results=[
                TableMigrationResult("t1", MigrationStatus.COMPLETED),
                TableMigrationResult("t2", MigrationStatus.FAILED),
                TableMigrationResult("t3", MigrationStatus.FAILED),
            ]
        )

        assert result.failure_count == 2

    def test_duration_seconds(self):
        """Test duration calculation."""
        start = datetime(2023, 1, 1, 12, 0, 0)
        end = datetime(2023, 1, 1, 12, 5, 0)

        result = MigrationResult(
            status=MigrationStatus.COMPLETED,
            start_time=start,
            end_time=end
        )

        assert result.duration_seconds == 300.0


class TestMigrationStatus:
    """Tests for MigrationStatus enum."""

    def test_status_values(self):
        """Test status enum values."""
        assert MigrationStatus.PENDING.value == "pending"
        assert MigrationStatus.RUNNING.value == "running"
        assert MigrationStatus.COMPLETED.value == "completed"
        assert MigrationStatus.FAILED.value == "failed"
        assert MigrationStatus.CANCELLED.value == "cancelled"
