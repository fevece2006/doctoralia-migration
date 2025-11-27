"""Data transformation module for processing and converting data."""

from typing import Callable
import logging

import pandas as pd

logger = logging.getLogger(__name__)

TransformFunc = Callable[[pd.DataFrame], pd.DataFrame]


class DataTransformer:
    """Transform data between source and target formats."""

    def __init__(self):
        """Initialize transformer with empty transform chain."""
        self._transforms: list[TransformFunc] = []
        self._column_mappings: dict[str, str] = {}
        self._column_defaults: dict[str, object] = {}

    def add_transform(self, func: TransformFunc) -> "DataTransformer":
        """Add a transformation function to the chain.

        Args:
            func: Function that takes and returns a DataFrame

        Returns:
            Self for method chaining
        """
        self._transforms.append(func)
        return self

    def map_columns(self, mappings: dict[str, str]) -> "DataTransformer":
        """Set column name mappings from source to target.

        Args:
            mappings: Dictionary of source_column -> target_column

        Returns:
            Self for method chaining
        """
        self._column_mappings.update(mappings)
        return self

    def set_defaults(self, defaults: dict[str, object]) -> "DataTransformer":
        """Set default values for new columns.

        Args:
            defaults: Dictionary of column_name -> default_value

        Returns:
            Self for method chaining
        """
        self._column_defaults.update(defaults)
        return self

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """Apply all transformations to data.

        Args:
            df: Input DataFrame

        Returns:
            Transformed DataFrame
        """
        result = df.copy()
        logger.debug(f"Transforming batch with {len(result)} rows")

        # Apply column mappings
        if self._column_mappings:
            result = result.rename(columns=self._column_mappings)
            logger.debug(f"Applied column mappings: {self._column_mappings}")

        # Apply default values for missing columns
        for col, default in self._column_defaults.items():
            if col not in result.columns:
                result[col] = default
                logger.debug(f"Added default column: {col}={default}")

        # Apply custom transforms
        for func in self._transforms:
            result = func(result)

        return result

    @staticmethod
    def drop_columns(columns: list[str]) -> TransformFunc:
        """Create a transform function to drop specific columns.

        Args:
            columns: List of column names to drop

        Returns:
            Transform function
        """
        def _drop(df: pd.DataFrame) -> pd.DataFrame:
            return df.drop(columns=[c for c in columns if c in df.columns])
        return _drop

    @staticmethod
    def select_columns(columns: list[str]) -> TransformFunc:
        """Create a transform function to select specific columns.

        Args:
            columns: List of column names to keep

        Returns:
            Transform function
        """
        def _select(df: pd.DataFrame) -> pd.DataFrame:
            existing = [c for c in columns if c in df.columns]
            return df[existing]
        return _select

    @staticmethod
    def fill_na(values: dict[str, object]) -> TransformFunc:
        """Create a transform function to fill NA values.

        Args:
            values: Dictionary of column -> fill_value

        Returns:
            Transform function
        """
        def _fill(df: pd.DataFrame) -> pd.DataFrame:
            return df.fillna(values)
        return _fill

    @staticmethod
    def convert_types(type_map: dict[str, str]) -> TransformFunc:
        """Create a transform function to convert column types.

        Args:
            type_map: Dictionary of column -> target_type

        Returns:
            Transform function
        """
        def _convert(df: pd.DataFrame) -> pd.DataFrame:
            result = df.copy()
            for col, dtype in type_map.items():
                if col in result.columns:
                    result[col] = result[col].astype(dtype)
            return result
        return _convert
