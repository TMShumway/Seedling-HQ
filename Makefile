.PHONY: deps deps-up deps-down deps-reset

deps-up:
	docker compose up -d
	@echo "Waiting for Postgres..."
	@until docker compose exec -T postgres pg_isready -U fsa > /dev/null 2>&1; do sleep 1; done
	@echo "Postgres is ready."

deps-down:
	docker compose down

deps-reset:
	docker compose down -v
	$(MAKE) deps

deps: deps-up
	pnpm --filter @seedling/api run db:push
	pnpm --filter @seedling/api run db:seed
