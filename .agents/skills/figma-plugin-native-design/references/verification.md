# Verification

Use all four levels. A successful bundle is not proof that the plugin runs in Figma.

## 1. Source audit

When SVGs participate in generation, run:

    node <skill-dir>/scripts/audit-svg-pages.mjs <design-directory>

Confirm each active SVG:

- has one complete svg root;
- has valid tag nesting;
- declares a valid viewBox or numeric width and height;
- has unique id values where IDs are used;
- has a documented role in the source-to-output manifest.

For screenshots, inspect dimensions and visual completeness. For code-backed designs, identify the relevant tokens, states, assets, and data constraints. Review the manifest against required views, viewports, overlays, and runtime states.

## 2. Static plugin checks

- Run the repository's TypeScript typecheck.
- Bundle the production plugin.
- Search every layoutPositioning assignment of ABSOLUTE and inspect the parent and append order.
- Search for unsupported mutations on Figma style or node proxies.
- Confirm partial generation actions hydrate dependencies.
- Confirm generated roots have stable pluginData ownership markers.
- Confirm project-specific names and values come from project inputs rather than this reusable skill.

## 3. Figma runtime checks

Reload the Development Plugin and confirm its visible version marker. If the plugin exposes partial actions, test them before the complete action:

1. Foundations creates expected Variables and Styles without placeholder output.
2. Components creates main Components and Component Sets with variants.
3. Views creates expected Sections and Frames using Instances.
4. Complete generation succeeds in a clean file.
5. Complete generation succeeds on rerun without duplicating plugin-owned output.

For dialogs, drawers, menus, and overlays, verify the parent layout mode and absolute-layer stacking order.

## 4. Inspect and visual checks

Inspect representative layers and confirm:

- padding, gap, alignment, radius, border, and shadow are visible;
- width and height behavior is intentional: fixed, Hug contents, or Fill container;
- wrapping, clipping, scrolling, and overflow reflect product behavior;
- typography uses the intended family, weight, line height, and style;
- repeated values are variable-bound where supported;
- composed views use Component Instances rather than detached copies;
- declared viewport frames match the manifest;
- required loading, empty, error, confirmation, and interaction states exist.

Capture the exact first failing action and runtime error if any check fails. Fix the generator rather than manually repairing generated canvas nodes.