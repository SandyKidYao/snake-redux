# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Snake Redux - A fan-made 3D snake game built with Three.js + Vite + TypeScript. The game features dual-sided 3D maps where the snake can traverse both front (y > 0) and back (y < 0) sides of the playing field.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (port 3000, auto-opens browser)
npm run build        # Build to single HTML file in dist/
npm run preview      # Preview production build
```

## Architecture

### Initialization Flow

`main.ts` → `LevelLoader.loadLevels()` → `new Game(container)` → `new Menu(container)`

Levels are loaded asynchronously from JSON files before game initialization.

### Core Systems

**GameState** (`src/core/GameState.ts`): Singleton with event-driven state management. Emits events: `screenChange`, `levelSelect`, `scoreChange`, `livesChange`. Screens: MENU, PLAYING, PAUSED, GAME_OVER.

**LevelLoader** (`src/core/LevelLoader.ts`): Singleton that loads, validates, and normalizes level JSON files. Provides `parseObstacleType()`, `parsePickupType()`, `parseSeekerType()` for string→enum conversion.

**Game** (`src/game/Game.ts`): Main orchestrator - Three.js scene, camera, renderer, OrbitControls, lighting setup, game loop. Listens to GameState events and manages Level lifecycle.

### Grid System

Abstract `Grid` base class with two implementations:

- **SquareGrid**: Uses BoxGeometry for floor tiles, 90-degree movement
- **HexGrid**: Uses ExtrudeGeometry with custom hex shapes, 60-degree movement, odd-row X offset

Key methods: `gridToWorld(x, y)`, `worldToGrid(worldPos)`, `removeCellMesh(x, y)` for holes.

### Coordinate System

```text
Y axis (vertical)
^
|   Front elements (y > 0)
|   ════════════════  Floor (y = -0.04 to 0.04, thickness 0.08)
|   Back elements (y < 0)
+-------------------> X axis
```

- Floor surface: +0.04 (front), -0.04 (back)
- Walls sit on floor surface (y = 0.04 + height/2)
- Back-side elements use `scale.y = -1` to flip

### Level Generation

`Level` class creates grid and populates with:

- **Obstacles**: SOLID_WALL (cube/hex prism), BREAKABLE_WALL (pyramid), HOLE (removes floor tile)
- **Pickups**: FOOD, ENERGY, SHIELD, TELEPORT, EXTRA_LIFE, LETTER - all have floating/rotating animations
- **PowerPath**: Glowing cell overlays with pulsing wave effect
- **Seekers**: Enemy entities (PICKUP_STEALER, ENERGY_PROVIDER)

Position tracking via `occupiedFrontPositions`/`occupiedBackPositions` Sets prevents element overlap.

### Snake Rendering

Triangular cross-section body using three CatmullRomCurve3 splines (center, left, right). Supports front/back side transitions at map edges. Visual parameters:

- `triangleHalfWidth`: 0.2
- `triangleHeight`: 0.12
- `floorOffset`: 0.08

## TypeScript Configuration

- Strict mode enabled (`noUnusedLocals`, `noUnusedParameters`)
- Path alias: `@/*` maps to `src/*`
- Target: ES2020, Module: ESNext

## Build Output

Uses `vite-plugin-singlefile` to produce a single offline-capable HTML file with all assets inlined.

## Level JSON Format

Levels are stored in `public/levels/*.json`. Schema:

```json
{
  "id": "level-1-square",
  "name": "Square Grid",
  "gridType": "square" | "hexagonal",
  "gridSize": { "width": 15, "height": 15 },
  "timeLimit": 60,
  "snake": {
    "startPosition": { "x": 7, "y": 7 },
    "startDirection": "right" | "left" | "up" | "down" | "ne" | "nw" | "se" | "sw",
    "startOnBackSide": false,
    "initialLength": 6
  },
  "elements": {
    "front": { "obstacles": [], "pickups": [], "powerPaths": [], "seekers": [] },
    "back": { "obstacles": [], "pickups": [], "powerPaths": [], "seekers": [] }
  }
}
```

Element types (use lowercase strings in JSON):

- **obstacles**: `solid_wall`, `breakable_wall`, `hole`
- **pickups**: `food`, `energy`, `shield`, `teleport`, `extra_life`, `letter`
- **seekers**: `pickup_stealer`, `energy_provider`

## Pre-Commit Checklist

Before committing code changes, ensure the following steps are completed:

1. **Update documentation** - Review and update `README.md` and `CLAUDE.md` if the changes affect:
   - New features or commands
   - Architecture changes
   - New configuration options
   - API or interface changes

2. **Bump version** - Update the `version` field in `package.json` following semver:
   - **patch** (x.x.X): Bug fixes, minor changes
   - **minor** (x.X.0): New features, backward compatible
   - **major** (X.0.0): Breaking changes
