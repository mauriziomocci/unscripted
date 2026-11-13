# Unscripted

English | [Italiano](README.it.md)

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-pre--release-yellow.svg)]()

> A stage for free-willed AI characters. You write who they are, you pick the
> scene, you pull a few strings from the director's booth. Nobody writes their
> lines.

## The idea

Unscripted is a game about characters that nobody scripts.

Each character is a written profile: a name, an age, a story, convictions,
fears, a way of talking, a couple of secrets and hidden goals, and how they
feel about the others. A large language model plays every character, one
decision or one line at a time, using only what that character knows. What
happens next is not planned: alliances, grudges, jokes, quarrels, kindness
and cruelty all come out of the characters themselves.

The characters live in an archive and can be dropped into different
**environments**, the stages of the game. The same people behave differently
on a desert island and under the studio lights, and they can carry their
memories from one stage to the next.

You are not a player character. You are the director: you watch, and when you
want, you intervene.

## Environments

### The island

A group of castaways wakes up on a desert island. They must find water, food
and shelter, and live together. Each one decides on their own what to do, who
to trust and what to say. Weather, wildlife, fire, hunger and boredom are
simulated; storms, forest fires and passing ships can happen.

As the director you can add resources, change the weather, whisper a thought
into someone's head, gather everyone around the fire for a discussion, bring
in a new castaway, or let things run. Characters can die, and death is
permanent in that story.

### The talk show

A late-night TV talk show, with a host and up to eight guests taken from the
archive. Everyone listens to everyone: guests answer the host, jump into each
other's arguments, interrupt, take sides, mutter under their breath, stand up
and point fingers. The host moderates, and you sit in the control room.

From the booth you can talk into the host's earpiece, speak on air so that
everyone hears you, whisper thoughts to anyone, lead the audience's applause
and boos, call a face-off, a point-blank question or a televote, and throw in
twists: a live phone call, a heckler, an ex walking on stage, an anonymous
message, an embarrassing old video. During the commercial break the guests
think the microphones are off.

### More to come

Environments share the same characters, archive and reporting, so new stages
can be added without rewriting the rest.

## What you get out of it

- A live 3D stage with speech bubbles, camera direction and reactions.
- A chronicle or transcript of everything that was said and done.
- A report for every session: indicators for each character, the relationship
  graph, best moments, and a book-like PDF.
- A novel-style retelling of the story, faithful to names and events.
- A character archive you can edit, import from Markdown files, version, and
  reuse across stories. Characters who die stay in the archive as deceased.

## How it is built

Unscripted runs in two forms that always share the same game engine:

| Form | What it is | Language model |
|---|---|---|
| **Web app** (this repository) | React front end and a small Node back end, run with Docker Compose | Anthropic Claude API, or any local model served by [LM Studio](https://lmstudio.ai/) |
| **Claude artifact** | A single self-contained page that runs inside claude.ai | The Claude plan of whoever opens it |

The game logic lives in one shared package. Both forms are built from it, so
they cannot drift apart.

```
unscripted/
  packages/core/     game engine: characters, island, talk show, prompts, reports
  apps/web/          React front end (Vite, three.js)
  apps/server/       Node back end: LLM proxy, model list, saves and archive
  apps/artifact/     build of the single-page Claude artifact from the same core
  compose/           Dockerfiles and entrypoints
  docs/              design notes and specs
```

### Language models

- **Claude (API)**: set `ANTHROPIC_API_KEY` in the back end environment. The
  key never reaches the browser.
- **Local, with LM Studio**: start LM Studio's local server on the host
  machine. The back end reaches it at `http://host.docker.internal:1234/v1`
  (OpenAI-compatible API). The game lists the models that are loaded and lets
  you pick one, separately for the main characters and for the lighter
  background calls. Models that follow instructions well and produce reliable
  JSON give the best results.

## Status

Pre-release. The Claude artifact is playable today; the web app is being
built from the same engine. Setup instructions will be added here as soon as
the first Docker Compose release is in place.

## Contributing

Contributions are welcome. Read [`CLAUDE.md`](CLAUDE.md) for the project
conventions: workflow, branch naming, commit format, code review checklist and
documentation rules. Code, comments and documentation are in English; the
README is kept in English and Italian, in sync.

## License

[MIT](LICENSE)
