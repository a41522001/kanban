---
name: figma-plugin-native-design
description: Build or update a Figma Development Plugin that converts visual references, screenshots, SVGs, product code, or written specifications into native editable Figma design systems and views. Use when the deliverable needs variables, styles, components, variants, Auto Layout, responsive frames, and safe regeneration. Do not use for simple SVG import or direct MCP canvas editing.
---

# Native Figma Design through a Development Plugin

Use this workflow when the deliverable is a reusable Figma Development Plugin, not an imported SVG and not a text-only design specification.

## Establish source truth

1. Inventory all relevant inputs before editing: visual references, screenshots, source code, tokens, domain models, written requirements, and existing plugin output.
2. Record source authority and status. Never silently mix obsolete references into current output.
3. Build an explicit source-to-output manifest for views, viewports, states, and destination Pages or Sections. Source file boundaries do not determine Figma Page organization.
4. Treat raster and SVG references as visual evidence. Reconstruct layout semantics rather than copying image pixels, SVG groups, or absolute coordinates.

For source normalization and plugin architecture, read [references/workflow.md](references/workflow.md).

## Build in dependency order

1. Foundations: primitive and semantic variables, spacing, radii, typography, and effects.
2. Components: atoms before composed components; create variant sets for repeated states.
3. Views: assemble component instances in native Auto Layout frames, sections, dialogs, drawers, or other composed surfaces.
4. Runtime states: empty, loading, error, confirmation, drag, collaboration, and responsive behavior when required by the product.

Bind repeated values to variables when supported by the target file and Figma plan. Use deterministic names and tag generated roots with pluginData so reruns replace only plugin-owned content.

## Preserve product semantics

- Infer Fixed, Hug, Fill, wrapping, clipping, scrolling, and overlay behavior from product requirements and references; do not force content to fit by distorting its intended geometry.
- Use real interaction targets and editable vectors for icons, not decorative text substitutes.
- Keep fields, allowed values, states, and relationships aligned with the application data model when code or schemas are available.
- Use component instances in composed views. Do not flatten or detach them.
- Load the product font before writing text and verify the actual family used.
- Keep domain-specific rules in the target repository's design manifest or documentation, not in this reusable skill.

## Figma Plugin API invariants

Read [references/plugin-api-gotchas.md](references/plugin-api-gotchas.md) before changing plugin generation code.

Critical invariants:

- With documentAccess set to dynamic-page, use async document APIs and switch page context explicitly.
- Append an overlay child to an Auto Layout parent before setting layoutPositioning to ABSOLUTE.
- Do not assign unsupported fields to Figma proxy objects; for example, TextStyle does not accept a fills property.
- When a component becomes a Component Set, update hydration and existence checks to use the component-set registry.
- Generate in the order Foundations -> Components -> Views. A partial view-generation action must hydrate or rebuild its dependencies safely.

## Keep the package portable

- Do not encode product names, routes, domain values, absolute repository paths, or one project's responsive rules in this skill.
- Discover build commands, source directories, tokens, and output organization from the target repository.
- Keep helper scripts read-only unless the user's task explicitly authorizes writes.
- Use relative resource links so the folder can be copied into another project or Agent Skills-compatible coding agent.

## Validate before handoff

Read [references/verification.md](references/verification.md). When SVGs are inputs, run:

    node <skill-dir>/scripts/audit-svg-pages.mjs <design-directory>

At minimum:

- Validate every active SVG source.
- Typecheck and bundle the plugin.
- Search every ABSOLUTE assignment and confirm append happens first.
- Confirm generated Page, Section, and view names match the source manifest.
- Run the plugin in Figma; compilation alone does not validate Plugin API runtime behavior.
- Surface the exact runtime error in the plugin UI and stop on failure.

Do not claim completion until the user can identify the expected plugin version and the generated canvas has been visually checked.