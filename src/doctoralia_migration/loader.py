"""Data loading module for writing to target database."""

import logging
from enum import Enum

import pandas as pd
from sqlalchemy import (
    create_engine, text, MetaData, Table, select, insert, update, delete,
    PrimaryKeyConstraint
)
from sqlalchemy.engine import Engine
from sqlalchemy.schema import AddConstraint

from .config import DatabaseConfig
from .utils import validate_identifier, validate_identifiers

logger = logging.getLogger(__name__)


class LoadMode(Enum):
    """Data loading mode."""

    APPEND = "append"
    REPLACE = "replace"
    UPSERT = "upsert"


class DataLoader:
    """Load data into target database."""

    def __init__(self, config: DatabaseConfig):
        """Initialize loader with database configuration.

        Args:
            config: Database connection configuration
        """
        self.config = config
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

    def table_exists(self, table_name: str) -> bool:
        """Check if a table exists in target database.

        Args:
            table_name: Name of the table

        Returns:
            True if table exists

        Raises:
            ValueError: If table_name contains invalid characters
        """
        validate_identifier(table_name)
        metadata = MetaData()
        metadata.reflect(bind=self.engine)
        return table_name in metadata.tables

    def create_table_from_df(
        self,
        table_name: str,
        df: pd.DataFrame,
        primary_key: str | None = None
    ) -> None:
        """Create table based on DataFrame schema.

        Args:
            table_name: Name of the table to create
            df: DataFrame to infer schema from
            primary_key: Optional primary key column

        Raises:
            ValueError: If table_name or primary_key contains invalid characters
        """
        validate_identifier(table_name)
        if primary_key:
            validate_identifier(primary_key)

        logger.info(f"Creating table: {table_name}")
        df.head(0).to_sql(
            table_name,
            self.engine,
            if_exists="replace",
            index=False
        )

        if primary_key and primary_key in df.columns:
            # Use SQLAlchemy DDL for adding primary key safely
            metadata = MetaData()
            metadata.reflect(bind=self.engine)
            table = metadata.tables[table_name]
            pk_column = table.c[primary_key]

            # Create primary key constraint using SQLAlchemy DDL
            pk_constraint = PrimaryKeyConstraint(pk_column, name=f"pk_{table_name}")
            with self.engine.connect() as conn:
                conn.execute(AddConstraint(pk_constraint))
                conn.commit()

    def load(
        self,
        df: pd.DataFrame,
        table_name: str,
        mode: LoadMode = LoadMode.APPEND,
        primary_key: str | None = None
    ) -> int:
        """Load data into target table.

        Args:
            df: DataFrame to load
            table_name: Target table name
            mode: Loading mode (append, replace, upsert)
            primary_key: Primary key column for upsert mode

        Returns:
            Number of rows loaded

        Raises:
            ValueError: If table_name or primary_key contains invalid characters
        """
        validate_identifier(table_name)
        if primary_key:
            validate_identifier(primary_key)

        if df.empty:
            logger.warning("Empty DataFrame, skipping load")
            return 0

        logger.info(f"Loading {len(df)} rows to {table_name} (mode={mode.value})")

        if mode == LoadMode.UPSERT and primary_key:
            return self._upsert(df, table_name, primary_key)
        else:
            if_exists = "replace" if mode == LoadMode.REPLACE else "append"
            df.to_sql(
                table_name,
                self.engine,
                if_exists=if_exists,
                index=False,
                method="multi"
            )
            return len(df)

    def _upsert(
        self,
        df: pd.DataFrame,
        table_name: str,
        primary_key: str
    ) -> int:
        """Perform upsert (insert or update) operation.

        Args:
            df: DataFrame to upsert
            table_name: Target table name
            primary_key: Primary key column

        Returns:
            Number of rows affected
        """
        # Identifiers already validated in load() method
        if not self.table_exists(table_name):
            self.create_table_from_df(table_name, df, primary_key)
            df.to_sql(table_name, self.engine, if_exists="append", index=False)
            return len(df)

        metadata = MetaData()
        table = Table(table_name, metadata, autoload_with=self.engine)
        columns = [c.name for c in table.columns]

        # Validate column names from the database schema
        validate_identifiers(columns)

        rows_affected = 0
        with self.engine.connect() as conn:
            for _, row in df.iterrows():
                pk_value = row[primary_key]

                # Check if row exists using SQLAlchemy select
                pk_column = table.c[primary_key]
                check_query = select(table).where(pk_column == pk_value).limit(1)
                result = conn.execute(check_query)

                if result.fetchone():
                    # Update existing row using SQLAlchemy update
                    update_values = {
                        col: row[col]
                        for col in columns
                        if col != primary_key and col in row.index
                    }
                    update_stmt = (
                        update(table)
                        .where(pk_column == pk_value)
                        .values(**update_values)
                    )
                    conn.execute(update_stmt)
                else:
                    # Insert new row using SQLAlchemy insert
                    insert_values = {
                        col: row[col]
                        for col in columns
                        if col in row.index
                    }
                    insert_stmt = insert(table).values(**insert_values)
                    conn.execute(insert_stmt)

                rows_affected += 1

            conn.commit()

        return rows_affected

    def truncate_table(self, table_name: str) -> None:
        """Truncate a table.

        Args:
            table_name: Name of the table to truncate

        Raises:
            ValueError: If table_name contains invalid characters
        """
        validate_identifier(table_name)
        logger.info(f"Truncating table: {table_name}")

        # Use SQLAlchemy's delete for safer truncation
        metadata = MetaData()
        table = Table(table_name, metadata, autoload_with=self.engine)
        with self.engine.connect() as conn:
            conn.execute(delete(table))
            conn.commit()

    def close(self) -> None:
        """Close database connection."""
        if self._engine:
            self._engine.dispose()
            self._engine = None
