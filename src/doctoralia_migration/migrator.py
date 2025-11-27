"""Migration orchestrator module."""

from dataclasses import dataclass, field
from datetime import datetime
import logging
from enum import Enum

from tqdm import tqdm

from .config import MigrationConfig
from .extractor import DataExtractor
from .transformer import DataTransformer
from .loader import DataLoader, LoadMode

logger = logging.getLogger(__name__)


class MigrationStatus(Enum):
    """Migration status values."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class TableMigrationResult:
    """Result of migrating a single table."""

    table_name: str
    status: MigrationStatus
    rows_extracted: int = 0
    rows_loaded: int = 0
    start_time: datetime | None = None
    end_time: datetime | None = None
    error: str | None = None

    @property
    def duration_seconds(self) -> float | None:
        """Calculate migration duration in seconds."""
        if self.start_time and self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return None


@dataclass
class MigrationResult:
    """Overall migration result."""

    status: MigrationStatus
    table_results: list[TableMigrationResult] = field(default_factory=list)
    start_time: datetime | None = None
    end_time: datetime | None = None

    @property
    def total_rows_extracted(self) -> int:
        """Total rows extracted across all tables."""
        return sum(r.rows_extracted for r in self.table_results)

    @property
    def total_rows_loaded(self) -> int:
        """Total rows loaded across all tables."""
        return sum(r.rows_loaded for r in self.table_results)

    @property
    def duration_seconds(self) -> float | None:
        """Total migration duration in seconds."""
        if self.start_time and self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return None

    @property
    def success_count(self) -> int:
        """Number of successfully migrated tables."""
        return sum(
            1 for r in self.table_results
            if r.status == MigrationStatus.COMPLETED
        )

    @property
    def failure_count(self) -> int:
        """Number of failed table migrations."""
        return sum(
            1 for r in self.table_results
            if r.status == MigrationStatus.FAILED
        )


class Migrator:
    """Orchestrate data migration from source to target database."""

    def __init__(
        self,
        config: MigrationConfig,
        transformer: DataTransformer | None = None
    ):
        """Initialize migrator with configuration.

        Args:
            config: Migration configuration
            transformer: Optional data transformer
        """
        self.config = config
        self.transformer = transformer or DataTransformer()
        self.extractor = DataExtractor(config.source, config.batch_size)
        self.loader = DataLoader(config.target)

    def migrate_table(
        self,
        table_name: str,
        mode: LoadMode = LoadMode.APPEND,
        primary_key: str | None = None,
        show_progress: bool = True
    ) -> TableMigrationResult:
        """Migrate a single table from source to target.

        Args:
            table_name: Name of the table to migrate
            mode: Loading mode
            primary_key: Primary key column for upsert
            show_progress: Whether to show progress bar

        Returns:
            Migration result for the table
        """
        result = TableMigrationResult(
            table_name=table_name,
            status=MigrationStatus.RUNNING,
            start_time=datetime.now()
        )

        try:
            logger.info(f"Starting migration of table: {table_name}")

            if self.config.dry_run:
                logger.info("[DRY RUN] Skipping actual data transfer")
                result.status = MigrationStatus.COMPLETED
                result.end_time = datetime.now()
                return result

            total_rows = self.extractor.get_row_count(table_name)
            result.rows_extracted = 0

            pbar = None
            try:
                if show_progress:
                    pbar = tqdm(
                        total=total_rows,
                        desc=f"Migrating {table_name}",
                        unit="rows"
                    )

                for batch in self.extractor.extract_table(table_name):
                    batch_size = len(batch)
                    result.rows_extracted += batch_size

                    # Transform data
                    transformed = self.transformer.transform(batch)

                    # Load data
                    loaded = self.loader.load(
                        transformed,
                        table_name,
                        mode=mode,
                        primary_key=primary_key
                    )
                    result.rows_loaded += loaded

                    if pbar:
                        pbar.update(batch_size)
            finally:
                if pbar:
                    pbar.close()

            result.status = MigrationStatus.COMPLETED
            logger.info(
                f"Completed migration of {table_name}: "
                f"{result.rows_extracted} extracted, {result.rows_loaded} loaded"
            )

        except Exception as e:
            logger.error(f"Migration failed for {table_name}: {e}")
            result.status = MigrationStatus.FAILED
            result.error = str(e)

        result.end_time = datetime.now()
        return result

    def migrate_all(
        self,
        mode: LoadMode = LoadMode.APPEND,
        show_progress: bool = True
    ) -> MigrationResult:
        """Migrate all configured tables.

        Args:
            mode: Loading mode
            show_progress: Whether to show progress bar

        Returns:
            Overall migration result
        """
        result = MigrationResult(
            status=MigrationStatus.RUNNING,
            start_time=datetime.now()
        )

        # Validate configuration
        errors = self.config.validate()
        if errors:
            logger.error(f"Configuration validation failed: {errors}")
            result.status = MigrationStatus.FAILED
            result.end_time = datetime.now()
            return result

        # Get tables to migrate
        tables = self.config.tables
        if not tables:
            tables = self.extractor.get_tables()
            logger.info(f"No tables specified, migrating all: {tables}")

        logger.info(f"Starting migration of {len(tables)} tables")

        for table_name in tables:
            table_result = self.migrate_table(
                table_name,
                mode=mode,
                show_progress=show_progress
            )
            result.table_results.append(table_result)

        result.end_time = datetime.now()

        if result.failure_count > 0:
            result.status = MigrationStatus.FAILED
        else:
            result.status = MigrationStatus.COMPLETED

        logger.info(
            f"Migration completed: {result.success_count} succeeded, "
            f"{result.failure_count} failed"
        )

        return result

    def close(self) -> None:
        """Close all database connections."""
        self.extractor.close()
        self.loader.close()
