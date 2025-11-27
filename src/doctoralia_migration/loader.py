"""Data loading module for writing to target database."""

import logging
from enum import Enum

import pandas as pd
from sqlalchemy import create_engine, text, MetaData, Table
from sqlalchemy.engine import Engine

from .config import DatabaseConfig

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
        """
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
        """
        logger.info(f"Creating table: {table_name}")
        df.head(0).to_sql(
            table_name,
            self.engine,
            if_exists="replace",
            index=False
        )

        if primary_key and primary_key in df.columns:
            with self.engine.connect() as conn:
                conn.execute(text(
                    f"ALTER TABLE {table_name} ADD PRIMARY KEY ({primary_key})"  # noqa: S608
                ))
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
        """
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
        if not self.table_exists(table_name):
            self.create_table_from_df(table_name, df, primary_key)
            df.to_sql(table_name, self.engine, if_exists="append", index=False)
            return len(df)

        metadata = MetaData()
        table = Table(table_name, metadata, autoload_with=self.engine)
        columns = [c.name for c in table.columns]

        rows_affected = 0
        with self.engine.connect() as conn:
            for _, row in df.iterrows():
                pk_value = row[primary_key]

                # Check if row exists
                check_query = text(
                    f"SELECT 1 FROM {table_name} WHERE {primary_key} = :pk_value"  # noqa: S608
                )
                result = conn.execute(check_query, {"pk_value": pk_value})

                if result.fetchone():
                    # Update existing row
                    set_clause = ", ".join([
                        f"{col} = :{col}"
                        for col in columns if col != primary_key
                    ])
                    update_query = text(
                        f"UPDATE {table_name} SET {set_clause} WHERE {primary_key} = :pk_value"  # noqa: S608
                    )
                    params = {col: row[col] for col in columns if col in row.index}
                    params["pk_value"] = pk_value
                    conn.execute(update_query, params)
                else:
                    # Insert new row
                    cols = ", ".join(columns)
                    vals = ", ".join([f":{col}" for col in columns])
                    insert_query = text(
                        f"INSERT INTO {table_name} ({cols}) VALUES ({vals})"  # noqa: S608
                    )
                    params = {col: row[col] for col in columns if col in row.index}
                    conn.execute(insert_query, params)

                rows_affected += 1

            conn.commit()

        return rows_affected

    def truncate_table(self, table_name: str) -> None:
        """Truncate a table.

        Args:
            table_name: Name of the table to truncate
        """
        logger.info(f"Truncating table: {table_name}")
        with self.engine.connect() as conn:
            conn.execute(text(f"TRUNCATE TABLE {table_name}"))  # noqa: S608
            conn.commit()

    def close(self) -> None:
        """Close database connection."""
        if self._engine:
            self._engine.dispose()
            self._engine = None
