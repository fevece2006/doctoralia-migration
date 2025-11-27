"""Tests for transformer module."""

import pandas as pd
import pytest

from doctoralia_migration.transformer import DataTransformer


class TestDataTransformer:
    """Tests for DataTransformer class."""

    def test_transform_empty_df(self):
        """Test transforming empty DataFrame."""
        transformer = DataTransformer()
        df = pd.DataFrame()
        result = transformer.transform(df)
        assert result.empty

    def test_map_columns(self):
        """Test column mapping."""
        transformer = DataTransformer()
        transformer.map_columns({"old_name": "new_name", "old_id": "new_id"})

        df = pd.DataFrame({
            "old_name": ["Alice", "Bob"],
            "old_id": [1, 2],
            "unchanged": ["a", "b"]
        })

        result = transformer.transform(df)

        assert "new_name" in result.columns
        assert "new_id" in result.columns
        assert "unchanged" in result.columns
        assert "old_name" not in result.columns
        assert "old_id" not in result.columns

    def test_set_defaults(self):
        """Test setting default values for missing columns."""
        transformer = DataTransformer()
        transformer.set_defaults({"new_column": "default_value", "another": 0})

        df = pd.DataFrame({"existing": [1, 2, 3]})
        result = transformer.transform(df)

        assert "new_column" in result.columns
        assert "another" in result.columns
        assert list(result["new_column"]) == ["default_value"] * 3
        assert list(result["another"]) == [0, 0, 0]

    def test_add_transform(self):
        """Test adding custom transform function."""
        transformer = DataTransformer()

        def uppercase_names(df):
            df = df.copy()
            df["name"] = df["name"].str.upper()
            return df

        transformer.add_transform(uppercase_names)

        df = pd.DataFrame({"name": ["alice", "bob"]})
        result = transformer.transform(df)

        assert list(result["name"]) == ["ALICE", "BOB"]

    def test_drop_columns(self):
        """Test drop columns transform."""
        transformer = DataTransformer()
        transformer.add_transform(
            DataTransformer.drop_columns(["drop_me", "and_me"])
        )

        df = pd.DataFrame({
            "keep": [1, 2],
            "drop_me": [3, 4],
            "and_me": [5, 6]
        })

        result = transformer.transform(df)

        assert "keep" in result.columns
        assert "drop_me" not in result.columns
        assert "and_me" not in result.columns

    def test_select_columns(self):
        """Test select columns transform."""
        transformer = DataTransformer()
        transformer.add_transform(
            DataTransformer.select_columns(["col1", "col2"])
        )

        df = pd.DataFrame({
            "col1": [1, 2],
            "col2": [3, 4],
            "col3": [5, 6]
        })

        result = transformer.transform(df)

        assert list(result.columns) == ["col1", "col2"]

    def test_fill_na(self):
        """Test fill NA values transform."""
        transformer = DataTransformer()
        transformer.add_transform(
            DataTransformer.fill_na({"col1": 0, "col2": "unknown"})
        )

        df = pd.DataFrame({
            "col1": [1, None, 3],
            "col2": ["a", None, "c"]
        })

        result = transformer.transform(df)

        assert list(result["col1"]) == [1.0, 0.0, 3.0]
        assert list(result["col2"]) == ["a", "unknown", "c"]

    def test_convert_types(self):
        """Test type conversion transform."""
        transformer = DataTransformer()
        transformer.add_transform(
            DataTransformer.convert_types({"id": "str", "value": "float"})
        )

        df = pd.DataFrame({
            "id": [1, 2, 3],
            "value": [10, 20, 30]
        })

        result = transformer.transform(df)

        assert result["id"].dtype == "object"  # str
        assert result["value"].dtype == "float64"

    def test_chained_operations(self):
        """Test chaining multiple operations."""
        transformer = DataTransformer()
        transformer.map_columns({"old_name": "name"})
        transformer.set_defaults({"status": "active"})
        transformer.add_transform(DataTransformer.drop_columns(["temp"]))

        df = pd.DataFrame({
            "old_name": ["Alice", "Bob"],
            "temp": [1, 2],
            "id": [100, 200]
        })

        result = transformer.transform(df)

        assert list(result.columns) == ["name", "id", "status"]
        assert list(result["name"]) == ["Alice", "Bob"]
        assert list(result["status"]) == ["active", "active"]
