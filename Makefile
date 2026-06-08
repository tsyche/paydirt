.PHONY: help setup install dev dev-web dev-mobile dev-pb test lint lintfix clean fresh sync-docs

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
	@echo ""
	@echo "$(GREEN)Quality:$(NC)"
	@echo "  make test            Run all workspace tests"
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
		echo "Download from https://github.com/pocketbase/pocketbase/releases and place it there."; \
		exit 1; \
	fi
	@$(PB) serve --dir pocketbase/pb_data --hooksDir pocketbase/pb_hooks --migrationsDir pocketbase/pb_migrations

test:
	@pnpm -r test

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
