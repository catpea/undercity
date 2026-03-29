# Undercity IDE

Visual flow IDE — MUD-style logic graph builder with Bootstrap code generation.

Design multi-screen applications as interconnected rooms on a map, wire up event-driven workflows with a point-and-click action editor, then generate a self-contained static Bootstrap app in one click.

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

## Usage

1. **Map** — Place rooms (screens), diamonds (logic branches), and terminals (end states) on the canvas. Connect them with edges.
2. **Savant** — Select a node and build its action sequence: display content, read/write inventory, navigate, call APIs, render forms, and more.
3. **Generate** — Click **Generate** (or **Preview**) to produce a self-contained Bootstrap app under `generated/<project-id>/`.

## Project structure

```
src/ide/            IDE client-side JavaScript and CSS
src/ide/css/        IDE stylesheet
src/ide/command-line/  Command palette parser and commands
src/lib/            Shared utilities (signal, scope, state-machine, icons)
src/generator/      Code generation engine
src/server/         HTTP server + API routes
src/server/routes/  API route handlers
actions/            Action plugins (one directory per category)
plugins/            Generator plugins (forms, wizard, multipage)
packages/           Local npm workspace packages (http-server, parser)
generator/base/     Bootstrap .min files + icon SVGs used during code generation
public/             HTML entry points (index.html, testbench.html) and static icons
public/icons/       Custom IDE toolbar icons
public/icons/bootstrap/  Bootstrap icon subset used by the IDE
templates/          Starter project templates
things/             Thing definitions (reusable room objects)
projects/           Saved user projects (created at runtime)
generated/          Generated app output (created at runtime)
```

`tmp/` and `generated/` are excluded from version control.

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Production server |
| `npm run dev` | Development server with `--watch` hot reload |

## Tech

- Node.js (ES Modules, no bundler)
- Bootstrap 5.3.8
- Bootstrap Icons 1.13.1
