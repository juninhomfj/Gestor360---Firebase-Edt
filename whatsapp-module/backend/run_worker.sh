#!/usr/bin/env bash
# Run Redis/BullMQ worker (fallback)
set -e
node dist/worker-redis.js
