"""Data extraction module for reading from source database."""

from typing import Iterator
import logging

import pandas as pd
from sqlalchemy import create_engine, text, MetaData, Table
from sqlalchemy.engine import Engine

from .config import DatabaseConfig

logger = logging.getLogger(__name__)


class DataExtractor:
    """Extract data from source database."""

    def __init__(self, config: DatabaseConfig, batch_size: int = 1000):
        """Initialize extractor with database configuration.

        Args:
            config: Database connection configuration
            batch_size: Number of records to fetch per batch
        """
        self.config = config
        self.batch_size = batch_size
        self._engine: Engine | None = None

    @property
    def engine(self) -> Engine:
        """Get or create database engine."""
        if self._engine is None:
            self._engine = create_engine(
                self.config.get_connection_string(),
                pool_pre_ping=True,
                pool_recycle=3600,
            )
        return self._engine

    def get_tables(self) -> list[str]:
        """Get list of available tables in source database."""
        metadata = MetaData()
        metadata.reflect(bind=self.engine)
        return list(metadata.tables.keys())

    def get_table_schema(self, table_name: str) -> dict:
        """Get schema information for a table.

        Args:
            table_name: Name of the table

        Returns:
            Dictionary with column names and types
        """
        metadata = MetaData()
        table = Table(table_name, metadata, autoload_with=self.engine)
        return {
            col.name: str(col.type)
            for col in table.columns
        }

    def get_row_count(self, table_name: str) -> int:
        """Get total row count for a table.

        Args:
            table_name: Name of the table

        Returns:
            Total number of rows
        """
        with self.engine.connect() as conn:
            result = conn.execute(
                text(f"SELECT COUNT(*) FROM {table_name}")  # noqa: S608
            )
            return result.scalar() or 0

    def extract_table(self, table_name: str) -> Iterator[pd.DataFrame]:
        """Extract data from a table in batches.

        Args:
            table_name: Name of the table to extract

        Yields:
            DataFrame batches of extracted data
        """
        logger.info(f"Extracting data from table: {table_name}")
        offset = 0
        total_rows = self.get_row_count(table_name)
        logger.info(f"Total rows to extract: {total_rows}")

        while offset < total_rows:
            query = text(
                f"SELECT * FROM {table_name} LIMIT :limit OFFSET :offset"  # noqa: S608
            )
            df = pd.read_sql(
                query,
                self.engine,
                params={"limit": self.batch_size, "offset": offset}
            )

            if df.empty:
                break

            logger.debug(f"Extracted batch: offset={offset}, rows={len(df)}")
            yield df
            offset += self.batch_size

    def extract_query(self, query: str) -> Iterator[pd.DataFrame]:
        """Extract data using custom SQL query.

        Args:
            query: SQL query string

        Yields:
            DataFrame batches of query results
        """
        logger.info("Executing custom extraction query")
        for chunk in pd.read_sql(
            text(query),
            self.engine,
            chunksize=self.batch_size
        ):
            yield chunk

    def close(self) -> None:
        """Close database connection."""
        if self._engine:
            self._engine.dispose()
            self._engine = None
