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
# Package versions read on 2026-11-26.
RUN npm install -g pnpm@12.20.0 \
    && apk add --no-cache python3=3.14.10-r2 git=2.54.1-r0 \
    && git config --system --add safe.directory /app

USER node
WORKDIR /app
