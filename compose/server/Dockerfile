# Dev image of the server and of every pnpm command (FR-002, research R-01).
# The base is pinned by digest, read on 2026-11-26 with
# `docker buildx imagetools inspect node:22.23.5-alpine`; the tag names the
# patch, the digest makes the build reproducible.
FROM node:22.23.5-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS dev

# pnpm is installed with npm because the host has no corepack. Python 3 is
# here only so the build.py comparison (FR-082) runs where every command runs;
# the production stage does not have it. Git is here because the repository
# guards (.gitignore test, taste-gate scripts) ask git, from the same container;
# /app is a bind mount owned by the host user, so it is declared safe.
# Package versions are minor pins (`~`, read on 2026-11-26: python3 3.14, git 2.54):
# the base digest does not freeze the apk index, and Alpine drops superseded
# revisions, so an exact `-rN` pin would break the build on the next rebuild.
RUN npm install -g pnpm@12.20.0 \
    && apk add --no-cache python3~3.14 git~2.54 \
    && git config --system --add safe.directory /app

# ESLint 10 loads eslint.config.ts through Node's native TypeScript support only
# with this flag; setting it here keeps it in one place for every eslint call.
ENV ESLINT_FLAGS=unstable_native_nodejs_ts_config

USER node
WORKDIR /app
