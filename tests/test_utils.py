"""Tests for utility functions."""

import pytest

from doctoralia_migration.utils import validate_identifier, validate_identifiers


class TestValidateIdentifier:
    """Tests for validate_identifier function."""

    def test_valid_simple_name(self):
        """Test valid simple identifier."""
        assert validate_identifier("users") == "users"

    def test_valid_with_underscore(self):
        """Test valid identifier with underscores."""
        assert validate_identifier("user_accounts") == "user_accounts"

    def test_valid_with_numbers(self):
        """Test valid identifier with numbers."""
        assert validate_identifier("table123") == "table123"

    def test_valid_with_schema(self):
        """Test valid schema.table identifier."""
        assert validate_identifier("public.users") == "public.users"

    def test_invalid_empty(self):
        """Test empty identifier raises error."""
        with pytest.raises(ValueError, match="cannot be empty"):
            validate_identifier("")

    def test_invalid_starts_with_number(self):
        """Test identifier starting with number raises error."""
        with pytest.raises(ValueError, match="Invalid identifier"):
            validate_identifier("123table")

    def test_invalid_special_characters(self):
        """Test identifier with special characters raises error."""
        with pytest.raises(ValueError, match="Invalid identifier"):
            validate_identifier("users; DROP TABLE --")

    def test_invalid_sql_injection(self):
        """Test SQL injection attempt raises error."""
        with pytest.raises(ValueError, match="Invalid identifier"):
            validate_identifier("users' OR '1'='1")

    def test_invalid_reserved_keyword(self):
        """Test reserved SQL keyword raises error."""
        with pytest.raises(ValueError, match="reserved SQL keyword"):
            validate_identifier("select")

    def test_invalid_reserved_keyword_uppercase(self):
        """Test reserved SQL keyword uppercase raises error."""
        with pytest.raises(ValueError, match="reserved SQL keyword"):
            validate_identifier("SELECT")

    def test_invalid_spaces(self):
        """Test identifier with spaces raises error."""
        with pytest.raises(ValueError, match="Invalid identifier"):
            validate_identifier("user accounts")

    def test_invalid_dash(self):
        """Test identifier with dash raises error."""
        with pytest.raises(ValueError, match="Invalid identifier"):
            validate_identifier("user-accounts")


class TestValidateIdentifiers:
    """Tests for validate_identifiers function."""

    def test_valid_list(self):
        """Test validating a list of identifiers."""
        result = validate_identifiers(["users", "orders", "products"])
        assert result == ["users", "orders", "products"]

    def test_empty_list(self):
        """Test validating an empty list."""
        result = validate_identifiers([])
        assert result == []

    def test_invalid_in_list(self):
        """Test that invalid identifier in list raises error."""
        with pytest.raises(ValueError):
            validate_identifiers(["users", "DROP TABLE", "products"])
