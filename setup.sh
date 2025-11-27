#!/bin/bash

# Doctoralia Migration - Setup Script
# This script helps set up the project for first-time use

set -e

echo "========================================="
echo "Doctoralia Migration - Setup"
echo "========================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "✅ .env file created. Please review and adjust the variables."
else
    echo "ℹ️  .env file already exists"
fi

# Build Docker images
echo "🔨 Building Docker images..."
docker-compose build

echo ""
echo "========================================="
echo "Setup completed! ✅"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Review and adjust .env file if needed"
echo "  2. Run: docker-compose up"
echo "  3. Watch the pipeline execute!"
echo ""
echo "For more information, see README_COMPLETE.md"
echo ""
