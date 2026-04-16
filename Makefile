ifneq (,$(wildcard .env))
    include .env
endif

PWD=$(shell pwd)
NODE_IMAGE=node:20.12.2
IMAGE_NAME=sap-frontend
CONTAINER_PORT=3000
NODE_MODULES_VOLUME=$(IMAGE_NAME)-node_modules
NEXT_CACHE_VOLUME=$(IMAGE_NAME)-next_cache

# PROD Env
HOST_PORT_PROD=3000
CONTAINER_NAME_PROD=sap-frontend-app

#BETA Env
HOST_PORT_BETA=3000
CONTAINER_NAME_BETA=sap-frontend-app-beta

run-dev:
	npm run dev

run-prod:
	npm run build
	npm run start

docker-build-dev:
	docker build -t $(IMAGE_NAME) .

docker-run-dev:
	# Ensure the node_modules volume exists and is writable by the host user
	docker volume create $(NODE_MODULES_VOLUME) >/dev/null
	docker run --rm -v $(NODE_MODULES_VOLUME):/app/node_modules $(NODE_IMAGE) sh -lc "chown -R $(shell id -u):$(shell id -g) /app/node_modules || true"
	# Ensure the .next cache volume exists and is writable (Turbopack lockfile lives here)
	docker volume create $(NEXT_CACHE_VOLUME) >/dev/null
	docker run --rm -v $(NEXT_CACHE_VOLUME):/app/.next $(NODE_IMAGE) sh -lc "chown -R $(shell id -u):$(shell id -g) /app/.next || true"
	# Recreate container if it already exists
	docker rm -f $(IMAGE_NAME) >/dev/null 2>&1 || true
	docker run -p 3000:$(CONTAINER_PORT) --name $(IMAGE_NAME) \
		-v $(NODE_MODULES_VOLUME):/app/node_modules \
		-v $(NEXT_CACHE_VOLUME):/app/.next \
		-v $(PWD):/app \
		-w /app \
		--user $(shell id -u):$(shell id -g) \
		$(IMAGE_NAME)

docker-build-prod:
	docker build -t $(IMAGE_NAME) -f Dockerfile.production .

docker-run-prod:
	docker run --name $(CONTAINER_NAME_PROD) -p $(HOST_PORT_PROD):$(CONTAINER_PORT) -d --restart always $(IMAGE_NAME)

docker-run-beta:
	docker run --name $(CONTAINER_NAME_BETA) -p $(HOST_PORT_BETA):$(CONTAINER_PORT) -d --restart always $(IMAGE_NAME)
