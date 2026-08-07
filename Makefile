.PHONY: bootstrap check test build dev

bootstrap:
	./scripts/bootstrap.sh

check:
	./scripts/check.sh

test:
	$(MAKE) check

build:
	python -m compileall -q api/app
	npm run build:frontend

dev:
	npm run dev
