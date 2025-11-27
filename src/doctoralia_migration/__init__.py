"""Doctoralia Data Migration Application.

A modular data migration framework for transferring healthcare data
between different database systems.
"""

__version__ = "0.1.0"
__author__ = "Doctoralia Team"

from .config import MigrationConfig
from .extractor import DataExtractor
from .transformer import DataTransformer
from .loader import DataLoader
from .migrator import Migrator

__all__ = [
    "MigrationConfig",
    "DataExtractor",
    "DataTransformer",
    "DataLoader",
    "Migrator",
]
