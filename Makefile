.PHONY: help setup install dev dev-web dev-mobile dev-pb pb-download seed reset-db test typecheck lint lintfix clean fresh sync-docs

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m

# PocketBase binary location (downloaded separately, gitignored)
PB := pocketbase/pocketbase

help:
	@echo ""
	@echo "$(BLUE)PayDirt — make targets$(NC)"
	@echo ""
	@echo "$(GREEN)Setup:$(NC)"
	@echo "  make setup           Install all workspace dependencies (pnpm)"
	@echo "  make install         Alias for setup"
	@echo ""
	@echo "$(GREEN)Development:$(NC)"
	@echo "  make dev             Start web + mobile (PocketBase run separately)"
	@echo "  make dev-web         Start Next.js parent dashboard"
	@echo "  make dev-mobile      Start Expo React Native app"
	@echo "  make dev-pb          Start local PocketBase server (needs binary)"
	@echo "  make pb-download     Download the PocketBase binary (latest, or PB_VERSION=x.y.z)"
	@echo ""
	@echo "$(GREEN)Test data:$(NC)"
	@echo "  make seed            Seed test household/users/chores (server must be RUNNING)"
	@echo "  make reset-db        Wipe the PocketBase DB and rebuild empty (server must be STOPPED)"
	@echo ""
	@echo "$(GREEN)Quality:$(NC)"
	@echo "  make test            Run all workspace tests"
	@echo "  make typecheck       Type-check all workspaces (tsc --noEmit)"
	@echo "  make lint            Lint all workspaces"
	@echo "  make lintfix         Auto-fix lint issues"
	@echo ""
	@echo "$(GREEN)Maintenance:$(NC)"
	@echo "  make clean           Remove build artifacts, caches, node_modules"
	@echo "  make fresh           Full reset: clean + setup + test"
	@echo "  make sync-docs       Sync AGENTS.md <-> CLAUDE.md"
	@echo ""

setup:
	@echo "$(BLUE)Installing workspace dependencies...$(NC)"
	@pnpm install

install: setup

dev:
	@echo "$(YELLOW)Tip: run 'make dev-pb' in a separate terminal for the backend.$(NC)"
	@pnpm run dev:web & pnpm run dev:mobile

dev-web:
	@pnpm run dev:web

dev-mobile:
	@pnpm run dev:mobile

dev-pb:
	@if [ ! -f "$(PB)" ]; then \
		echo "$(YELLOW)PocketBase binary not found at $(PB)$(NC)"; \
		echo "Run 'make pb-download' first."; \
		exit 1; \
	fi
	@$(PB) serve --dir pocketbase/pb_data --hooksDir pocketbase/pb_hooks --migrationsDir pocketbase/pb_migrations

pb-download:
	@os=$$(uname -s | tr '[:upper:]' '[:lower:]'); \
	arch=$$(uname -m | sed 's/x86_64/amd64/; s/aarch64/arm64/'); \
	ver="$(PB_VERSION)"; \
	if [ -z "$$ver" ]; then \
		ver=$$(curl -sL https://api.github.com/repos/pocketbase/pocketbase/releases/latest | jq -r '.tag_name' | sed 's/^v//'); \
	fi; \
	if [ -z "$$ver" ] || [ "$$ver" = "null" ]; then \
		echo "$(YELLOW)Could not resolve PocketBase version. Set PB_VERSION=x.y.z manually.$(NC)"; exit 1; \
	fi; \
	url="https://github.com/pocketbase/pocketbase/releases/download/v$$ver/pocketbase_$${ver}_$${os}_$${arch}.zip"; \
	echo "$(BLUE)Downloading PocketBase $$ver ($$os/$$arch)...$(NC)"; \
	curl -sL "$$url" -o /tmp/pocketbase.zip && \
	unzip -o /tmp/pocketbase.zip pocketbase -d pocketbase/ && \
	chmod +x $(PB) && rm -f /tmp/pocketbase.zip && \
	echo "$(GREEN)Installed $$($(PB) --version)$(NC)"

seed:
	@echo "$(BLUE)Seeding test data (PocketBase must be running)...$(NC)"
	@node pocketbase/seed.mjs

reset-db:
	@if [ ! -f "$(PB)" ]; then echo "$(YELLOW)PocketBase binary not found — run 'make pb-download'.$(NC)"; exit 1; fi
	@if curl -sf -o /dev/null http://127.0.0.1:8090/api/health; then \
		echo "$(YELLOW)PocketBase is running. Stop 'make dev-pb' first, then re-run 'make reset-db'.$(NC)"; exit 1; \
	fi
	@echo "$(BLUE)Wiping PocketBase data and rebuilding empty DB...$(NC)"
	@rm -rf pocketbase/pb_data
	@$(PB) migrate up --dir pocketbase/pb_data --migrationsDir pocketbase/pb_migrations
	@$(PB) superuser upsert admin@paydirt.local password123 --dir pocketbase/pb_data
	@echo "$(GREEN)DB reset. Now: start 'make dev-pb', then run 'make seed'.$(NC)"

test:
	@pnpm -r test

typecheck:
	@echo "$(BLUE)Type-checking all workspaces...$(NC)"
	@pnpm -r typecheck

lint:
	@pnpm -r lint

lintfix:
	@pnpm -r lint:fix

clean:
	@echo "$(BLUE)Cleaning artifacts...$(NC)"
	@rm -rf node_modules apps/*/node_modules packages/*/node_modules
	@rm -rf apps/web/.next apps/web/out apps/*/dist packages/*/dist
	@rm -rf apps/mobile/.expo
	@find . -name "*.tsbuildinfo" -delete 2>/dev/null || true

fresh: clean setup test

sync-docs:
	@if [ -f AGENTS.md ] && [ -f CLAUDE.md ]; then \
		if [ AGENTS.md -nt CLAUDE.md ]; then \
			cp AGENTS.md CLAUDE.md; \
			echo "$(GREEN)Synced AGENTS.md -> CLAUDE.md$(NC)"; \
		elif [ CLAUDE.md -nt AGENTS.md ]; then \
			cp CLAUDE.md AGENTS.md; \
			echo "$(GREEN)Synced CLAUDE.md -> AGENTS.md$(NC)"; \
		else \
			echo "$(BLUE)Both docs in sync$(NC)"; \
		fi; \
	else \
		echo "$(YELLOW)AGENTS.md and/or CLAUDE.md missing — nothing to sync$(NC)"; \
	fi
