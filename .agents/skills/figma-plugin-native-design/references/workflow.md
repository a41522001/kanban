# Workflow

## 1. Inventory the sources

List current visual references, screenshots, SVGs, frontend code, tokens, domain types, written requirements, and existing plugin output.

Classify each input as:

- authoritative: defines a required value or behavior;
- supplementary: helps infer appearance or structure;
- obsolete: retained only for comparison.

Ask only when conflicting authoritative inputs would materially change the output.

Build a manifest with fields appropriate to the task, such as:

- view or surface name;
- viewport or size;
- interaction or runtime state;
- source references;
- destination Figma Page and Section;
- component dependencies;
- completion status.

Source file boundaries do not determine Figma Page organization. Split compound source files only when it improves traceability or maintenance.

## 2. Normalize the design model

Extract repeated values and patterns before writing Plugin API code:

1. Primitive tokens: raw colors, spacing, radii, font sizes, and shadows.
2. Semantic tokens: canvas, surface, text, border, action, status, and domain roles.
3. Components: repeated controls, content patterns, navigation, feedback, overlays, and domain-specific composites.
4. View structure: fixed, fill, hug, wrap, clip, scroll, overlay, and responsive behavior.
5. Runtime states: default, hover, focus, disabled, loading, empty, error, confirmation, drag, and any product-specific states.

Raster pixels, SVG layers, and source coordinates are evidence of appearance, not the target Figma layer tree. Replace coordinate-heavy structures with native Frames and Auto Layout where the behavior supports it.

## 3. Inspect or scaffold the Development Plugin

Prefer the repository's existing plugin structure and build system. For a new plugin, use a normal Figma manifest, TypeScript source, and a repeatable build.

Keep UI status or version text visible so the user can confirm which bundle Figma loaded. Organize code by responsibility when the implementation is large enough to benefit:

    figma-plugin/
    - manifest.json
    - src/
      - code.ts
      - ui.html
      - foundations/
      - components/
      - views/
    - dist/

The exact structure is adaptable. The dependency direction is not: Foundations, then Components, then Views.

## 4. Make generation idempotent

- Add pluginData ownership markers to generated Pages, Sections, or root Frames.
- On rerun, replace only nodes carrying the plugin's ownership marker.
- Preserve user-created nodes and Pages.
- Migrate old plugin-owned organization only when it is safe; remove old Pages only when they are empty of user work.
- Hydrate variables, styles, Components, and Component Sets before partial generation actions.

## 5. Assemble native views

- Bind repeated values to variables and styles where supported.
- Use Component Instances instead of cloned detached frames.
- Use Auto Layout for structures whose behavior is flow-based.
- Use absolute positioning only for genuinely layered elements such as overlays, popovers, drawers, and floating controls.
- Model resizing, wrapping, clipping, scrolling, and overflow from product behavior rather than from a universal breakpoint formula.
- Name layers for product meaning and future Inspect usage.

## 6. Keep project rules local

The reusable skill defines the generation method, not the product design.

Store project-specific decisions next to the project, for example in its design README or a source manifest:

- approved routes and view inventory;
- color restrictions and domain enums;
- current versus archived references;
- responsive behavior;
- required interaction states;
- Page and Section organization.

## 7. Hand off

Report:

- plugin version or visible cache marker;
- inputs and manifest coverage;
- generated Pages, Sections, Views, and Frames;
- component sets and important variants;
- variables and styles created;
- build commands and results;
- exact manual Figma runtime checks still required.

Never describe an SVG import as a native Figma reconstruction.