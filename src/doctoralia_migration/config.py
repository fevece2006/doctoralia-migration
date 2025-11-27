"""Configuration management for data migration."""

from dataclasses import dataclass, field
from typing import Any
import os

from dotenv import load_dotenv


@dataclass
class DatabaseConfig:
    """Database connection configuration."""

    host: str
    port: int
    database: str
    username: str
    password: str
    driver: str = "postgresql"

    def get_connection_string(self) -> str:
        """Generate SQLAlchemy connection string."""
        return f"{self.driver}://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}"


@dataclass
class MigrationConfig:
    """Main configuration for data migration."""

    source: DatabaseConfig
    target: DatabaseConfig
    batch_size: int = 1000
    tables: list[str] = field(default_factory=list)
    dry_run: bool = False

    @classmethod
    def from_env(cls) -> "MigrationConfig":
        """Create configuration from environment variables."""
        load_dotenv()

        source = DatabaseConfig(
            host=os.getenv("SOURCE_DB_HOST", "localhost"),
            port=int(os.getenv("SOURCE_DB_PORT", "5432")),
            database=os.getenv("SOURCE_DB_NAME", "source_db"),
            username=os.getenv("SOURCE_DB_USER", "user"),
            password=os.getenv("SOURCE_DB_PASSWORD", ""),
            driver=os.getenv("SOURCE_DB_DRIVER", "postgresql"),
        )

        target = DatabaseConfig(
            host=os.getenv("TARGET_DB_HOST", "localhost"),
            port=int(os.getenv("TARGET_DB_PORT", "5432")),
            database=os.getenv("TARGET_DB_NAME", "target_db"),
            username=os.getenv("TARGET_DB_USER", "user"),
            password=os.getenv("TARGET_DB_PASSWORD", ""),
            driver=os.getenv("TARGET_DB_DRIVER", "postgresql"),
        )

        tables_str = os.getenv("MIGRATION_TABLES", "")
        tables = [t.strip() for t in tables_str.split(",") if t.strip()]

        return cls(
            source=source,
            target=target,
            batch_size=int(os.getenv("MIGRATION_BATCH_SIZE", "1000")),
            tables=tables,
            dry_run=os.getenv("MIGRATION_DRY_RUN", "false").lower() == "true",
        )

    def validate(self) -> list[str]:
        """Validate configuration and return list of errors."""
        errors = []

        if not self.source.host:
            errors.append("Source database host is required")
        if not self.source.database:
            errors.append("Source database name is required")
        if not self.target.host:
            errors.append("Target database host is required")
        if not self.target.database:
            errors.append("Target database name is required")
        if self.batch_size <= 0:
            errors.append("Batch size must be positive")

        return errors
