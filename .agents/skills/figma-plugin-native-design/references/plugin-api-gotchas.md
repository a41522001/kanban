# Figma Plugin API Gotchas

## Dynamic page access

When the manifest uses documentAccess: "dynamic-page", use async APIs such as figma.getLocalVariablesAsync() and explicitly set or load the target Page before traversing its nodes. Do not rely on APIs that require full-document synchronous access.

## Fonts are a runtime dependency

Call figma.loadFontAsync(fontName) for every font and weight before changing a Text node's characters or font properties. Provide a deliberate fallback and keep typography variables/styles aligned with the loaded family.

## Proxy objects are not plain extensible objects

Figma nodes, styles, and variables are proxy objects. Do not spread them, mutate unsupported fields, or attach arbitrary properties. Store application metadata with setPluginData or in your own plain-object registry.

For example, TextStyle does not support a fills property. Apply text color to Text nodes or via supported variable bindings.

## Absolute children of Auto Layout

Figma only allows layoutPositioning = "ABSOLUTE" when the node already belongs to an Auto Layout parent.

Wrong:

    overlay.layoutPositioning = "ABSOLUTE";
    screen.appendChild(overlay);

Correct:

    screen.appendChild(overlay);
    overlay.layoutPositioning = "ABSOLUTE";

Apply this ordering to overlay backgrounds, dialogs, drawers, menus, sheets, and floating controls. Ensure screen.layoutMode is not "NONE" first.

## Components and Component Sets use different registries

After combining Components as variants, the reusable public node is a Component Set. Hydration and existence checks must look up the Component Set by name, while screen assembly obtains one of its Component children and creates an Instance from it.

Do not check only a components map for a pattern that has become a Component Set; this commonly causes partial generation actions to recreate or miss dependencies.

## Partial generation needs dependency hydration

Buttons such as Foundations, Components, and Screens are separate entry points, but their dependencies are not independent:

- Components must hydrate or generate Foundations.
- Screens must hydrate or generate Foundations and Components.
- A failed dependency must stop the current action and show its exact error.

## Safe reruns

- Use stable names plus pluginData IDs.
- Delete or replace only plugin-owned generated roots.
- Do not clear an entire Page that may contain user work.
- Wait for async node removal and page switching where the API requires it.

## Status and error reporting

Wrap the generation message handler with try/catch, send progress such as "1/3 Creating foundations...", and report the original error message in both plugin UI and figma.notify. Do not replace actionable Plugin API errors with a generic failure.

## SVG is not the deliverable

Use SVG parsing only for visual measurements, icons, or source auditing. Importing the whole SVG produces Vector/Path-heavy output and does not establish variables, components, variants, Hug/Fill behavior, or inspectable spacing.