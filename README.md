# Doctoralia Data Migration

A flexible ETL (Extract, Transform, Load) tool for migrating data between databases.

## Features

- **Batch Processing**: Efficiently processes large datasets in configurable batches
- **Multiple Database Support**: Works with PostgreSQL, MySQL, and other SQLAlchemy-compatible databases
- **Data Transformation**: Built-in transformers for column mapping, type conversion, and custom logic
- **Multiple Load Modes**: Supports append, replace, and upsert operations
- **Progress Tracking**: Real-time progress bars and detailed migration reports
- **Dry Run Mode**: Test migrations without actually loading data
- **CLI Interface**: Easy-to-use command-line interface
- **Environment Configuration**: Configure via environment variables or command-line options

## Installation

```bash
pip install -e .
```

Or install dependencies directly:

```bash
pip install -r requirements.txt
```

## Quick Start

### Using CLI

```bash
# Run migration with command-line options
doctoralia-migrate run \
    --source-host localhost \
    --source-db source_database \
    --source-user admin \
    --source-password secret \
    --target-host localhost \
    --target-db target_database \
    --target-user admin \
    --target-password secret \
    --tables users --tables orders \
    --batch-size 1000 \
    --mode append

# List tables in source database
doctoralia-migrate list-tables \
    --host localhost \
    --database source_database \
    --user admin
```

### Using Environment Variables

Create a `.env` file:

```env
SOURCE_DB_HOST=localhost
SOURCE_DB_PORT=5432
SOURCE_DB_NAME=source_database
SOURCE_DB_USER=admin
SOURCE_DB_PASSWORD=secret
SOURCE_DB_DRIVER=postgresql

TARGET_DB_HOST=localhost
TARGET_DB_PORT=5432
TARGET_DB_NAME=target_database
TARGET_DB_USER=admin
TARGET_DB_PASSWORD=secret
TARGET_DB_DRIVER=postgresql

MIGRATION_BATCH_SIZE=1000
MIGRATION_TABLES=users,orders,products
MIGRATION_DRY_RUN=false
```

Then run:

```bash
doctoralia-migrate from-env
```

### Programmatic Usage

```python
from doctoralia_migration import (
    MigrationConfig,
    DataExtractor,
    DataTransformer,
    DataLoader,
    Migrator
)
from doctoralia_migration.config import DatabaseConfig
from doctoralia_migration.loader import LoadMode

# Configure source and target databases
source = DatabaseConfig(
    host="localhost",
    port=5432,
    database="source_db",
    username="admin",
    password="secret",
    driver="postgresql"
)

target = DatabaseConfig(
    host="localhost",
    port=5432,
    database="target_db",
    username="admin",
    password="secret",
    driver="postgresql"
)

# Create migration config
config = MigrationConfig(
    source=source,
    target=target,
    batch_size=1000,
    tables=["users", "orders"],
    dry_run=False
)

# Create transformer with custom logic
transformer = DataTransformer()
transformer.map_columns({"old_column": "new_column"})
transformer.set_defaults({"status": "active"})
transformer.add_transform(DataTransformer.drop_columns(["temp_column"]))

# Run migration
migrator = Migrator(config, transformer)
result = migrator.migrate_all(mode=LoadMode.APPEND)

# Check results
print(f"Status: {result.status.value}")
print(f"Rows migrated: {result.total_rows_loaded}")
```

## Architecture

```
doctoralia-migration/
├── src/doctoralia_migration/
│   ├── __init__.py       # Package exports
│   ├── cli.py            # Command-line interface
│   ├── config.py         # Configuration management
│   ├── extractor.py      # Data extraction from source
│   ├── transformer.py    # Data transformation logic
│   ├── loader.py         # Data loading to target
│   └── migrator.py       # Migration orchestrator
└── tests/
    ├── test_config.py
    ├── test_transformer.py
    └── test_migrator.py
```

## Load Modes

| Mode | Description |
|------|-------------|
| `append` | Add new rows to existing table |
| `replace` | Replace entire table with new data |
| `upsert` | Insert new rows or update existing ones (requires primary key) |

## Development

### Running Tests

```bash
pytest tests/ -v
```

### Code Formatting

```bash
black src/ tests/
```

### Type Checking

```bash
mypy src/
```

## License

MIT License