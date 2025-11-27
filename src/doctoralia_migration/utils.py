"""Utility functions for safe SQL operations."""

import re


def validate_identifier(name: str) -> str:
    """Validate and sanitize a SQL identifier (table or column name).

    This function validates that a string is a safe SQL identifier,
    preventing SQL injection attacks through table/column names.

    Args:
        name: The identifier to validate

    Returns:
        The validated identifier

    Raises:
        ValueError: If the identifier contains invalid characters
    """
    if not name:
        raise ValueError("Identifier cannot be empty")

    # Allow only alphanumeric characters, underscores, and dots (for schema.table)
    # This is a conservative approach that works across most databases
    if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$', name):
        raise ValueError(
            f"Invalid identifier '{name}': must contain only letters, "
            "numbers, underscores, and optionally a single dot for schema prefix"
        )

    # Check for common SQL keywords that shouldn't be used as identifiers
    sql_keywords = {
        'select', 'insert', 'update', 'delete', 'drop', 'create',
        'alter', 'truncate', 'grant', 'revoke', 'union', 'where',
        'from', 'join', 'and', 'or', 'not', 'null', 'true', 'false'
    }
    if name.lower() in sql_keywords:
        raise ValueError(f"Identifier '{name}' is a reserved SQL keyword")

    return name


def validate_identifiers(names: list[str]) -> list[str]:
    """Validate multiple SQL identifiers.

    Args:
        names: List of identifiers to validate

    Returns:
        List of validated identifiers

    Raises:
        ValueError: If any identifier is invalid
    """
    return [validate_identifier(name) for name in names]
