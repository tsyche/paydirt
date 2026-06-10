.PHONY: help setup install dev dev-all stop cache-clean dev-web dev-mobile dev-pb pb-download seed reset-db test test-integration test-e2e typecheck lint lintfix clean fresh sync-docs

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
	@echo "  make dev-all         Clear caches + start everything (PB + web + mobile); requires emulator"
	@echo "  RESET=1 make dev-all Same, but wipe DB and reseed first (make stop first if running)"
	@echo "  make stop            Kill all PayDirt dev services"
	@echo "  make cache-clean     Clear Next.js/.expo/Metro caches (runs automatically in dev-all)"
	@echo "  make dev-web         Start Next.js parent dashboard only"
	@echo "  make dev-mobile      Start Expo React Native app only"
	@echo "  make dev-pb          Start PocketBase only"
	@echo "  make pb-download     Download the PocketBase binary (latest, or PB_VERSION=x.y.z)"
	@echo ""
	@echo "$(GREEN)Test data:$(NC)"
	@echo "  make seed            Seed test household/users/chores (server must be RUNNING)"
	@echo "  make reset-db        Wipe the PocketBase DB and rebuild empty (server must be STOPPED)"
	@echo ""
	@echo "$(GREEN)Quality:$(NC)"
	@echo "  make test            Run all workspace tests"
	@echo "  make test-integration Run live API/hook tests (needs running, seeded PocketBase)"
	@echo "  make test-e2e        Run Playwright dashboard tests (needs running, seeded PocketBase)"
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

cache-clean:
	@echo "$(BLUE)Clearing build/bundler caches...$(NC)"
	@rm -rf apps/web/.next
	@rm -rf apps/mobile/.expo
	@rm -rf /tmp/metro-* /tmp/haste-* 2>/dev/null || true
	@rm -rf /tmp/paydirt-logs
	@echo "$(GREEN)Caches cleared.$(NC)"

dev-all: cache-clean
	@if [ "$(RESET)" = "1" ]; then \
		echo "$(BLUE)Resetting database...$(NC)"; \
		if curl -sf -o /dev/null http://127.0.0.1:8090/api/health; then \
			echo "$(YELLOW)PocketBase is running — stop it before resetting. Run 'make stop' first.$(NC)"; exit 1; \
		fi; \
		make reset-db; \
	fi
	@if ! adb devices 2>/dev/null | grep -q "emulator.*device"; then \
		echo "$(YELLOW)No Android emulator detected. Start one first (AVD Manager or 'emulator -avd Pixel_7_API_33 &').$(NC)"; \
		exit 1; \
	fi
	@if [ ! -f "$(PB)" ]; then echo "$(YELLOW)PocketBase binary not found — run 'make pb-download'.$(NC)"; exit 1; fi
	@mkdir -p /tmp/paydirt-logs
	@echo "$(BLUE)Starting PocketBase...$(NC)"
	@$(PB) serve --dir pocketbase/pb_data --hooksDir pocketbase/pb_hooks --migrationsDir pocketbase/pb_migrations \
		> /tmp/paydirt-logs/pb.log 2>&1 & echo $$! > /tmp/paydirt-pb.pid
	@echo "  Waiting for PocketBase to be ready..."
	@for i in $$(seq 1 20); do \
		if curl -sf -o /dev/null http://127.0.0.1:8090/api/health; then break; fi; \
		if [ "$$i" = "20" ]; then echo "$(YELLOW)PocketBase didn't start in time — check /tmp/paydirt-logs/pb.log$(NC)"; exit 1; fi; \
		sleep 1; \
	done
	@if [ "$(RESET)" = "1" ]; then \
		echo "$(BLUE)Seeding test data...$(NC)"; \
		node pocketbase/seed.mjs; \
	fi
	@echo "$(BLUE)Starting Next.js dashboard...$(NC)"
	@pnpm run dev:web > /tmp/paydirt-logs/web.log 2>&1 & echo $$! > /tmp/paydirt-web.pid
	@sleep 3
	@echo "$(BLUE)Starting Expo (mobile) → pushing to Android emulator...$(NC)"
	@pnpm --filter mobile start -- --android > /tmp/paydirt-logs/mobile.log 2>&1 & echo $$! > /tmp/paydirt-mobile.pid
	@echo ""
	@echo "$(GREEN)All services running. Logs:$(NC)"
	@echo "  PocketBase:  /tmp/paydirt-logs/pb.log"
	@echo "  Dashboard:   /tmp/paydirt-logs/web.log  (http://localhost:3000)"
	@echo "  Mobile/Expo: /tmp/paydirt-logs/mobile.log"
	@echo "  PocketBase admin: http://localhost:8090/_/"
	@echo ""
	@echo "Press Ctrl+C to stop all services (or run 'make stop' from another terminal)."
	@trap 'make stop' INT; wait

stop:
	@echo "$(BLUE)Stopping PayDirt services...$(NC)"
	@for pid_file in /tmp/paydirt-pb.pid /tmp/paydirt-web.pid /tmp/paydirt-mobile.pid; do \
		if [ -f "$$pid_file" ]; then \
			pid=$$(cat "$$pid_file"); \
			if kill -0 "$$pid" 2>/dev/null; then kill "$$pid"; fi; \
			rm -f "$$pid_file"; \
		fi; \
	done
	@pkill -f "pocketbase serve" 2>/dev/null || true
	@pkill -f "next dev" 2>/dev/null || true
	@pkill -f "expo start" 2>/dev/null || true
	@if adb devices 2>/dev/null | grep -q "emulator.*device"; then \
		adb shell am force-stop host.exp.exponent 2>/dev/null || true; \
	fi
	@echo "$(GREEN)Done.$(NC)"

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

# Live tests need a running, seeded PocketBase: make dev-pb (in another
# terminal), then make seed. Start PB with NTFY_DISABLED=1 to keep test runs
# from blasting the real ntfy topics.
test-integration:
	@if ! curl -sf -o /dev/null http://127.0.0.1:8090/api/health; then \
		echo "$(YELLOW)PocketBase is not running. Start it ('make dev-pb', ideally with NTFY_DISABLED=1) and 'make seed' first.$(NC)"; exit 1; \
	fi
	@pnpm --filter @paydirt/shared test:integration

test-e2e:
	@if ! curl -sf -o /dev/null http://127.0.0.1:8090/api/health; then \
		echo "$(YELLOW)PocketBase is not running. Start it ('make dev-pb', ideally with NTFY_DISABLED=1) and 'make seed' first.$(NC)"; exit 1; \
	fi
	@pnpm --filter web test:e2e

typecheck:
	@echo "$(BLUE)Type-checking all workspaces...$(NC)"
	@pnpm -r typecheck

lint:
	@pnpm -r lint

lintfix:
	@pnpm -r lint:fix

clean: cache-clean
	@echo "$(BLUE)Removing node_modules and build outputs...$(NC)"
	@rm -rf node_modules apps/*/node_modules packages/*/node_modules
	@rm -rf apps/web/out apps/*/dist packages/*/dist
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
