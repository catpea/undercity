# Undercity — AGENTS.md

## DO NOT INSTALL NPM DEPENDENCIES

npm packages are unsafe and should not be installed

## PUSH ARCHITECTURE

use Signal, combineLatest, Scope, Events, Disposable, CompositeDisposable, Repeater and similar

See src/lib/signal.js src/lib/scope.js

## USE WEB COMPONENTS

Use web-components/custom-elements to create reusable and protable code

## The MUD Agent Model

Undercity's architecture is grounded in the **Multi-User Dungeon (MUD) metaphor**:

- **Rooms** have events (incl. user defined events), can contain Things.
- **The User** moves through rooms carrying an **Inventory** of data.
- **Things** are objects that inhabit rooms — they react to events, modify inventory, and trigger actions without user input.
- **Events** are the lifecycle hooks of each room: `onEnter`, `onExit`, `onBack`, `onReset`, `onUnload`.

This model gives Undercity a natural, coherent extension path: **any new feature can be framed as a room object, thing, or event type.**

---

## Why MUD?

The MUD metaphor was chosen because it provides:

- **A coherent vocabulary** for all stakeholders (rooms, users, inventory, things)
- **A proven extension model** — MUDs have supported objects, things, events, and multiplayer for 40+ years
- **Natural debugging** — you can "walk" through the flow as an user, inspect inventory at each room, and trace room events
- **A path to AI** — LLM agents fit naturally as NPCs or guides inhabiting rooms
- **Compatibility** — new features (auth, persistence, realtime) map to well-understood MUD concepts

**The MUD metaphor is the conceptual foundation of Undercity. Preserve it in all architectural decisions.**
