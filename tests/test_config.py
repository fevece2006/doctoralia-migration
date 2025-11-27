"""Tests for configuration module."""

import os
import pytest

from doctoralia_migration.config import DatabaseConfig, MigrationConfig


class TestDatabaseConfig:
    """Tests for DatabaseConfig class."""

    def test_get_connection_string(self):
        """Test connection string generation."""
        config = DatabaseConfig(
            host="localhost",
            port=5432,
            database="testdb",
            username="testuser",
            password="testpass",
            driver="postgresql"
        )
        expected = "postgresql://testuser:testpass@localhost:5432/testdb"
        assert config.get_connection_string() == expected

    def test_get_connection_string_mysql(self):
        """Test MySQL connection string generation."""
        config = DatabaseConfig(
            host="localhost",
            port=3306,
            database="testdb",
            username="testuser",
            password="testpass",
            driver="mysql+pymysql"
        )
        expected = "mysql+pymysql://testuser:testpass@localhost:3306/testdb"
        assert config.get_connection_string() == expected


class TestMigrationConfig:
    """Tests for MigrationConfig class."""

    def test_validate_empty_source_host(self):
        """Test validation fails with empty source host."""
        config = MigrationConfig(
            source=DatabaseConfig(
                host="",
                port=5432,
                database="testdb",
                username="user",
                password="pass"
            ),
            target=DatabaseConfig(
                host="localhost",
                port=5432,
                database="targetdb",
                username="user",
                password="pass"
            )
        )
        errors = config.validate()
        assert "Source database host is required" in errors

    def test_validate_empty_target_database(self):
        """Test validation fails with empty target database."""
        config = MigrationConfig(
            source=DatabaseConfig(
                host="localhost",
                port=5432,
                database="sourcedb",
                username="user",
                password="pass"
            ),
            target=DatabaseConfig(
                host="localhost",
                port=5432,
                database="",
                username="user",
                password="pass"
            )
        )
        errors = config.validate()
        assert "Target database name is required" in errors

    def test_validate_invalid_batch_size(self):
        """Test validation fails with invalid batch size."""
        config = MigrationConfig(
            source=DatabaseConfig(
                host="localhost",
                port=5432,
                database="sourcedb",
                username="user",
                password="pass"
            ),
            target=DatabaseConfig(
                host="localhost",
                port=5432,
                database="targetdb",
                username="user",
                password="pass"
            ),
            batch_size=0
        )
        errors = config.validate()
        assert "Batch size must be positive" in errors

    def test_validate_success(self):
        """Test validation passes with valid config."""
        config = MigrationConfig(
            source=DatabaseConfig(
                host="localhost",
                port=5432,
                database="sourcedb",
                username="user",
                password="pass"
            ),
            target=DatabaseConfig(
                host="localhost",
                port=5432,
                database="targetdb",
                username="user",
                password="pass"
            )
        )
        errors = config.validate()
        assert len(errors) == 0

    def test_from_env(self, monkeypatch):
        """Test creating config from environment variables."""
        monkeypatch.setenv("SOURCE_DB_HOST", "source.example.com")
        monkeypatch.setenv("SOURCE_DB_PORT", "5433")
        monkeypatch.setenv("SOURCE_DB_NAME", "source_db")
        monkeypatch.setenv("SOURCE_DB_USER", "source_user")
        monkeypatch.setenv("SOURCE_DB_PASSWORD", "source_pass")
        monkeypatch.setenv("TARGET_DB_HOST", "target.example.com")
        monkeypatch.setenv("TARGET_DB_PORT", "5434")
        monkeypatch.setenv("TARGET_DB_NAME", "target_db")
        monkeypatch.setenv("TARGET_DB_USER", "target_user")
        monkeypatch.setenv("TARGET_DB_PASSWORD", "target_pass")
        monkeypatch.setenv("MIGRATION_BATCH_SIZE", "500")
        monkeypatch.setenv("MIGRATION_TABLES", "users, orders, products")
        monkeypatch.setenv("MIGRATION_DRY_RUN", "true")

        config = MigrationConfig.from_env()

        assert config.source.host == "source.example.com"
        assert config.source.port == 5433
        assert config.source.database == "source_db"
        assert config.target.host == "target.example.com"
        assert config.target.port == 5434
        assert config.batch_size == 500
        assert config.tables == ["users", "orders", "products"]
        assert config.dry_run is True
