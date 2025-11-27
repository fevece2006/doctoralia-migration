@echo off
REM Doctoralia Migration - Setup Script for Windows
REM This script helps set up the project for first-time use

echo =========================================
echo Doctoralia Migration - Setup
echo =========================================

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Docker is not installed. Please install Docker first.
    exit /b 1
)

docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Docker Compose is not installed. Please install Docker Compose first.
    exit /b 1
)

echo Docker and Docker Compose are installed

REM Create .env file if it doesn't exist
if not exist .env (
    echo Creating .env file from .env.example...
    copy .env.example .env
    echo .env file created. Please review and adjust the variables.
) else (
    echo .env file already exists
)

REM Build Docker images
echo Building Docker images...
docker-compose build

echo.
echo =========================================
echo Setup completed!
echo =========================================
echo.
echo Next steps:
echo   1. Review and adjust .env file if needed
echo   2. Run: docker-compose up
echo   3. Watch the pipeline execute!
echo.
echo For more information, see README_COMPLETE.md
echo.
