"""Command-line interface for Doctoralia Data Migration."""

import logging
import sys

import click

from .config import MigrationConfig, DatabaseConfig
from .migrator import Migrator, MigrationStatus
from .loader import LoadMode

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@click.group()
@click.version_option()
def main():
    """Doctoralia Data Migration Tool.

    A flexible ETL tool for migrating data between databases.
    """
    pass


@main.command()
@click.option(
    "--source-host", envvar="SOURCE_DB_HOST", default="localhost",
    help="Source database host"
)
@click.option(
    "--source-port", envvar="SOURCE_DB_PORT", default=5432, type=int,
    help="Source database port"
)
@click.option(
    "--source-db", envvar="SOURCE_DB_NAME", required=True,
    help="Source database name"
)
@click.option(
    "--source-user", envvar="SOURCE_DB_USER", required=True,
    help="Source database user"
)
@click.option(
    "--source-password", envvar="SOURCE_DB_PASSWORD", default="",
    help="Source database password"
)
@click.option(
    "--source-driver", envvar="SOURCE_DB_DRIVER", default="postgresql",
    help="Source database driver"
)
@click.option(
    "--target-host", envvar="TARGET_DB_HOST", default="localhost",
    help="Target database host"
)
@click.option(
    "--target-port", envvar="TARGET_DB_PORT", default=5432, type=int,
    help="Target database port"
)
@click.option(
    "--target-db", envvar="TARGET_DB_NAME", required=True,
    help="Target database name"
)
@click.option(
    "--target-user", envvar="TARGET_DB_USER", required=True,
    help="Target database user"
)
@click.option(
    "--target-password", envvar="TARGET_DB_PASSWORD", default="",
    help="Target database password"
)
@click.option(
    "--target-driver", envvar="TARGET_DB_DRIVER", default="postgresql",
    help="Target database driver"
)
@click.option(
    "--tables", "-t", multiple=True,
    help="Tables to migrate (can be specified multiple times)"
)
@click.option(
    "--batch-size", "-b", default=1000, type=int,
    help="Batch size for data extraction"
)
@click.option(
    "--mode", "-m", type=click.Choice(["append", "replace", "upsert"]),
    default="append", help="Data loading mode"
)
@click.option(
    "--dry-run", is_flag=True,
    help="Run without actually loading data"
)
@click.option(
    "--verbose", "-v", is_flag=True,
    help="Enable verbose logging"
)
def run(
    source_host, source_port, source_db, source_user, source_password, source_driver,
    target_host, target_port, target_db, target_user, target_password, target_driver,
    tables, batch_size, mode, dry_run, verbose
):
    """Run the data migration."""
    if verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    logger.info("Starting Doctoralia Data Migration")

    source_config = DatabaseConfig(
        host=source_host,
        port=source_port,
        database=source_db,
        username=source_user,
        password=source_password,
        driver=source_driver,
    )

    target_config = DatabaseConfig(
        host=target_host,
        port=target_port,
        database=target_db,
        username=target_user,
        password=target_password,
        driver=target_driver,
    )

    config = MigrationConfig(
        source=source_config,
        target=target_config,
        batch_size=batch_size,
        tables=list(tables),
        dry_run=dry_run,
    )

    # Validate configuration
    errors = config.validate()
    if errors:
        for error in errors:
            logger.error(f"Configuration error: {error}")
        sys.exit(1)

    load_mode = LoadMode(mode)

    migrator = Migrator(config)
    try:
        result = migrator.migrate_all(mode=load_mode)

        # Print summary
        click.echo("\n" + "=" * 60)
        click.echo("MIGRATION SUMMARY")
        click.echo("=" * 60)
        click.echo(f"Status: {result.status.value}")
        click.echo(f"Tables migrated: {result.success_count}/{len(result.table_results)}")
        click.echo(f"Total rows extracted: {result.total_rows_extracted}")
        click.echo(f"Total rows loaded: {result.total_rows_loaded}")
        if result.duration_seconds:
            click.echo(f"Duration: {result.duration_seconds:.2f} seconds")

        if result.failure_count > 0:
            click.echo("\nFailed tables:")
            for tr in result.table_results:
                if tr.status == MigrationStatus.FAILED:
                    click.echo(f"  - {tr.table_name}: {tr.error}")

        sys.exit(0 if result.status == MigrationStatus.COMPLETED else 1)

    finally:
        migrator.close()


@main.command()
@click.option(
    "--host", envvar="SOURCE_DB_HOST", default="localhost",
    help="Database host"
)
@click.option(
    "--port", envvar="SOURCE_DB_PORT", default=5432, type=int,
    help="Database port"
)
@click.option(
    "--database", envvar="SOURCE_DB_NAME", required=True,
    help="Database name"
)
@click.option(
    "--user", envvar="SOURCE_DB_USER", required=True,
    help="Database user"
)
@click.option(
    "--password", envvar="SOURCE_DB_PASSWORD", default="",
    help="Database password"
)
@click.option(
    "--driver", envvar="SOURCE_DB_DRIVER", default="postgresql",
    help="Database driver"
)
def list_tables(host, port, database, user, password, driver):
    """List available tables in a database."""
    from .extractor import DataExtractor

    config = DatabaseConfig(
        host=host,
        port=port,
        database=database,
        username=user,
        password=password,
        driver=driver,
    )

    extractor = DataExtractor(config)
    try:
        tables = extractor.get_tables()
        if tables:
            click.echo("Available tables:")
            for table in tables:
                click.echo(f"  - {table}")
        else:
            click.echo("No tables found in the database.")
    finally:
        extractor.close()


@main.command()
def from_env():
    """Run migration using environment variables for configuration."""
    config = MigrationConfig.from_env()

    errors = config.validate()
    if errors:
        for error in errors:
            logger.error(f"Configuration error: {error}")
        sys.exit(1)

    migrator = Migrator(config)
    try:
        result = migrator.migrate_all()
        sys.exit(0 if result.status == MigrationStatus.COMPLETED else 1)
    finally:
        migrator.close()


if __name__ == "__main__":
    main()
