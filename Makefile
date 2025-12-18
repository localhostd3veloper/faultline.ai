.PHONY: install dev build docker-up docker-down docker-build clean setup

# Full setup for development
setup: install

# Install all dependencies
install:
	@echo "Installing client dependencies..."
	cd client && bun install
	@echo "Installing server dependencies..."
	cd server && uv sync

# Run development environment (local)
dev:
	@echo "Starting development environment (Client: 3000, Server: 8080)..."
	@make -j 2 dev-client dev-server

dev-client:
	cd client && bun run dev

dev-server:
	cd server && uv run fastapi dev app/main.py --port 8080

# Docker operations
docker-up:
	docker compose up --build -d

docker-down:
	docker compose down

docker-build:
	docker compose build

# Production build (local)
build:
	@echo "Building client..."
	cd client && bun run build
	@echo "Syncing server dependencies..."
	cd server && uv sync

# Cleanup
clean:
	@echo "Cleaning up..."
	rm -rf client/.next
	rm -rf client/node_modules
	rm -rf server/.venv
	find . -type d -name "__pycache__" -exec rm -rf {} +

