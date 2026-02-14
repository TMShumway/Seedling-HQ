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
	@echo "Waiting for LocalStack..."
	@for i in $$(seq 1 30); do curl -sf http://localhost:4566/_localstack/health > /dev/null 2>&1 && break; sleep 1; done
	bash scripts/localstack-deploy.sh
	pnpm --filter @seedling/api run db:push
	pnpm --filter @seedling/api run db:seed-demo
