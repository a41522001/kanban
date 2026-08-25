const PLUGIN_KEY = 'flowboard-generator';
const GENERATED_ROOT = 'flowboard-generated-root';
const FONT = { family: 'Noto Sans TC', style: 'Regular' } as FontName;
const FONT_MEDIUM = { family: 'Noto Sans TC', style: 'Medium' } as FontName;
const FONT_BOLD = { family: 'Noto Sans TC', style: 'Bold' } as FontName;
let resolvedFonts = { regular: FONT, medium: FONT_MEDIUM, bold: FONT_BOLD };

type GeneratorAction = 'all' | 'foundations' | 'components' | 'screens';
type Direction = 'HORIZONTAL' | 'VERTICAL';
type ColorMap = Record<string, string>;

interface TokenStore {
  colors: Record<string, Variable>;
  spacing: Record<string, Variable>;
  radii: Record<string, Variable>;
  textStyles: Record<string, TextStyle>;
  shadow?: EffectStyle;
  variablesAvailable: boolean;
}

const tokenStore: TokenStore = {
  colors: {},
  spacing: {},
  radii: {},
  textStyles: {},
  variablesAvailable: false,
};
const componentSets: Record<string, ComponentSetNode | undefined> = {};
const standaloneComponents: Record<string, ComponentNode | undefined> = {};

const colors: ColorMap = {
  'bg/canvas': '#E9ECF1',
  'bg/auth': '#F7F8FA',
  'bg/surface': '#FFFFFF',
  'bg/subtle': '#F7F8FA',
  'bg/dark': '#29324A',
  'text/primary': '#29324A',
  'text/secondary': '#697287',
  'text/tertiary': '#8B95A8',
  'text/on-dark': '#F7F8FA',
  'border/default': '#D7DCE5',
  'border/strong': '#CDD3DE',
  'action/primary': '#DF6E51',
  'action/primary-hover': '#C4573E',
  'action/primary-soft': '#FCE5DF',
  'flow/ready': '#DF6E51',
  'flow/active': '#A9D2C8',
  'flow/active-strong': '#6EA99E',
  'flow/active-soft': '#E3F1EC',
  'flow/review': '#E6B960',
  'flow/review-soft': '#FFF1D8',
  'flow/done': '#907ECE',
  'flow/done-soft': '#E9E6F7',
  'category/coral': '#9F3F2C',
  'category/coral-soft': '#FCE5DF',
  'category/mint': '#31665D',
  'category/mint-soft': '#E3F1EC',
  'category/amber': '#7A4D00',
  'category/amber-soft': '#FFF1D8',
  'category/lavender': '#55438F',
  'category/lavender-soft': '#E9E6F7',
  'category/teal': '#1F6868',
  'category/teal-soft': '#DEF3F1',
  'category/blue': '#315B8F',
  'category/blue-soft': '#E4EEFB',
  'category/rose': '#92324E', 'category/rose-soft': '#FDE7EE',
  'category/orange': '#934510', 'category/orange-soft': '#FFEAD6',
  'category/lime': '#496D17', 'category/lime-soft': '#EDF7DB',
  'category/cyan': '#216A85', 'category/cyan-soft': '#E0F3F9',
  'category/indigo': '#45488E', 'category/indigo-soft': '#E9EAFF',
  'category/violet': '#633C95', 'category/violet-soft': '#F1E6FA',
  'category/pink': '#923565', 'category/pink-soft': '#FBE6F1',
  'category/slate': '#465066', 'category/slate-soft': '#E8EBF0',
};

const categoryColorKeys = ['coral', 'rose', 'orange', 'mint', 'amber', 'lime', 'teal', 'cyan', 'lavender', 'indigo', 'violet', 'pink', 'blue', 'slate'] as const;

const spacing = { 'space/1': 4, 'space/2': 8, 'space/3': 12, 'space/4': 16, 'space/5': 20, 'space/6': 24, 'space/8': 32, 'space/10': 40, 'space/12': 48, 'space/16': 64 };
const radii = { 'radius/sm': 8, 'radius/md': 9, 'radius/lg': 12, 'radius/xl': 18, 'radius/full': 999 };
const typeScale = {
  'Heading / H1': { size: 32, lineHeight: 42, weight: 'bold' },
  'Heading / H2': { size: 24, lineHeight: 34, weight: 'bold' },
  'Heading / H3': { size: 18, lineHeight: 28, weight: 'bold' },
  'Body / Large': { size: 16, lineHeight: 26, weight: 'regular' },
  'Body / Medium': { size: 14, lineHeight: 22, weight: 'regular' },
  'Body / Small': { size: 12, lineHeight: 18, weight: 'regular' },
  'Label / Medium': { size: 14, lineHeight: 20, weight: 'bold' },
  'Label / Small': { size: 11, lineHeight: 16, weight: 'medium' },
} as const;

function hex(hex: string): RGB {
  const normalized = hex.replace('#', '');
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16) / 255,
    g: Number.parseInt(normalized.slice(2, 4), 16) / 255,
    b: Number.parseInt(normalized.slice(4, 6), 16) / 255,
  };
}

function solid(value: string): SolidPaint {
  return { type: 'SOLID', color: hex(value) };
}

function postStatus(text: string): void {
  figma.ui.postMessage({ type: 'status', text });
}

function tag(node: BaseNode, kind: string): void {
  node.setPluginData(PLUGIN_KEY, kind);
}

function applyFill(node: GeometryMixin, colorName: string): void {
  const color = colors[colorName] ?? colors['bg/surface'];
  const variable = tokenStore.colors[colorName];
  try {
    if (variable) {
      const paint = (figma.variables as any).setBoundVariableForPaint(solid(color), 'color', variable);
      node.fills = [paint];
      return;
    }
  } catch {
    // Variables are a progressive enhancement; a native paint is still editable.
  }
  node.fills = [solid(color)];
}

function applyStroke(node: GeometryMixin, colorName = 'border/default', weight = 1): void {
  node.strokes = [solid(colors[colorName])];
  node.strokeWeight = weight;
}

function setRadius(node: RectangleNode | FrameNode | ComponentNode | InstanceNode, tokenName: string): void {
  const value = radii[tokenName as keyof typeof radii] ?? 0;
  node.cornerRadius = value;
  try {
    const variable = tokenStore.radii[tokenName];
    if (variable) (node as any).setBoundVariable('cornerRadius', variable);
  } catch {
    // Keep the literal radius when Variables are unavailable.
  }
}

function setPadding(node: FrameNode | ComponentNode, top: number, right = top, bottom = top, left = right): void {
  node.paddingTop = top;
  node.paddingRight = right;
  node.paddingBottom = bottom;
  node.paddingLeft = left;
}

function auto(name: string, direction: Direction, options: { gap?: number; padding?: [number, number?, number?, number?]; fill?: string; stroke?: string; radius?: string } = {}): FrameNode {
  const node = figma.createFrame();
  node.name = name;
  node.layoutMode = direction;
  node.primaryAxisSizingMode = 'AUTO';
  node.counterAxisSizingMode = 'AUTO';
  node.itemSpacing = options.gap ?? 0;
  if (options.padding) setPadding(node, options.padding[0], options.padding[1], options.padding[2], options.padding[3]);
  if (options.fill) applyFill(node, options.fill);
  else node.fills = [];
  if (options.stroke) applyStroke(node, options.stroke);
  if (options.radius) setRadius(node, options.radius);
  return node;
}

function fixed(node: FrameNode | ComponentNode | InstanceNode, width: number, height: number): void {
  node.resize(width, height);
  if ('primaryAxisSizingMode' in node) {
    node.primaryAxisSizingMode = 'FIXED';
    node.counterAxisSizingMode = 'FIXED';
  }
}

function stretch(node: SceneNode): void {
  try {
    (node as any).layoutAlign = 'STRETCH';
  } catch {
    // Some nodes are deliberately fixed (for example avatars).
  }
}

function loadableFont(weight: 'regular' | 'medium' | 'bold'): FontName {
  return resolvedFonts[weight];
}

function text(name: string, content: string, style: keyof typeof typeScale = 'Body / Medium', colorName = 'text/primary'): TextNode {
  const node = figma.createText();
  node.name = name;
  const definition = typeScale[style];
  node.fontName = loadableFont(definition.weight);
  node.characters = content;
  node.fontSize = definition.size;
  node.lineHeight = { unit: 'PIXELS', value: definition.lineHeight };
  applyFill(node, colorName);
  return node;
}

function icon(name: string, svgBody: string, size: number, colorName = 'text/secondary'): FrameNode {
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">${svgBody.replaceAll('currentColor', colors[colorName])}</svg>`;
  const node = figma.createNodeFromSvg(svg);
  node.name = name;
  node.resize(size, size);
  return node;
}

function dragHandle(size = 44): FrameNode {
  const target = auto('Card drag handle', 'HORIZONTAL', { padding: [(size - 12) / 2], fill: 'bg/surface', radius: 'radius/md' });
  fixed(target, size, size);
  target.appendChild(icon('Grip icon', '<circle cx="8" cy="5" r="1.5" fill="currentColor"/><circle cx="16" cy="5" r="1.5" fill="currentColor"/><circle cx="8" cy="12" r="1.5" fill="currentColor"/><circle cx="16" cy="12" r="1.5" fill="currentColor"/><circle cx="8" cy="19" r="1.5" fill="currentColor"/><circle cx="16" cy="19" r="1.5" fill="currentColor"/>', 12));
  return target;
}

function getOrCreatePage(name: string): PageNode {
  const existing = figma.root.children.find((page) => page.name === name);
  return existing ?? figma.createPage();
}

async function preparePage(name: string, rootName: string): Promise<FrameNode> {
  const page = getOrCreatePage(name);
  page.name = name;
  await figma.setCurrentPageAsync(page);
  const oldRoot = page.children.find((child) => child.getPluginData(PLUGIN_KEY) === GENERATED_ROOT && child.name === rootName);
  oldRoot?.remove();
  const root = auto(rootName, 'HORIZONTAL', { gap: 80 });
  tag(root, GENERATED_ROOT);
  root.x = 80;
  root.y = 80;
  return root;
}

async function existingGeneratedRoot(pageName: string, rootName: string): Promise<FrameNode | undefined> {
  const page = figma.root.children.find((candidate) => candidate.name === pageName);
  if (!page) return undefined;
  await figma.setCurrentPageAsync(page);
  return page?.children.find((child) => child.name === rootName && child.getPluginData(PLUGIN_KEY) === GENERATED_ROOT) as FrameNode | undefined;
}

async function findCollection(name: string): Promise<VariableCollection | undefined> {
  return (await figma.variables.getLocalVariableCollectionsAsync()).find((collection) => collection.name === name);
}

async function getOrCreateCollection(name: string): Promise<VariableCollection> {
  return (await findCollection(name)) ?? figma.variables.createVariableCollection(name);
}

async function getOrCreateVariable(collection: VariableCollection, name: string, type: VariableResolvedDataType, value: VariableValue, scopes: VariableScope[]): Promise<Variable> {
  const current = (await figma.variables.getLocalVariablesAsync(type)).find((variable) => variable.variableCollectionId === collection.id && variable.name === name);
  const variable = current ?? figma.variables.createVariable(name, collection, type);
  variable.scopes = scopes;
  variable.setValueForMode(collection.modes[0].modeId, value);
  return variable;
}

async function getOrCreateTextStyle(name: string, size: number, lineHeight: number, weight: 'regular' | 'medium' | 'bold'): Promise<TextStyle> {
  const style = (await figma.getLocalTextStylesAsync()).find((current) => current.name === name) ?? figma.createTextStyle();
  style.name = name;
  style.fontName = loadableFont(weight);
  style.fontSize = size;
  style.lineHeight = { unit: 'PIXELS', value: lineHeight };
  style.description = `Flowboard ${name}; Noto Sans TC ${size}px / ${lineHeight}px`;
  tokenStore.textStyles[name] = style;
  return style;
}

async function ensureFonts(): Promise<void> {
  try {
    const fonts = await figma.listAvailableFontsAsync();
    const pick = (style: string, fallback: FontName): FontName => {
      const exact = fonts.find((font) => font.fontName.family === 'Noto Sans TC' && font.fontName.style === style);
      const sameFamily = fonts.find((font) => font.fontName.family === 'Noto Sans TC');
      return exact?.fontName ?? sameFamily?.fontName ?? fallback;
    };
    resolvedFonts = {
      regular: pick('Regular', FONT),
      medium: pick('Medium', FONT_MEDIUM),
      bold: pick('Bold', FONT_BOLD),
    };
    await Promise.all(Object.values(resolvedFonts).map((font) => figma.loadFontAsync(font)));
  } catch (error) {
    // A font outage must not lose the whole native-layout generation. The UI makes
    // this explicit so the user can replace the temporary default in Figma later.
    const fallback = { family: 'Inter', style: 'Regular' } as FontName;
    await figma.loadFontAsync(fallback);
    resolvedFonts = { regular: fallback, medium: fallback, bold: fallback };
    figma.notify(`Noto Sans TC could not be loaded; Figma default is temporary. ${String(error)}`, { error: true, timeout: 6000 });
  }
}

async function buildFoundations(): Promise<FrameNode> {
  const root = await preparePage('01 · Foundations', 'Flowboard Foundations');
  root.layoutMode = 'VERTICAL';
  root.itemSpacing = 48;
  root.paddingTop = root.paddingRight = root.paddingBottom = root.paddingLeft = 40;
  applyFill(root, 'bg/auth');

  try {
    const primitives = await getOrCreateCollection('Flowboard / Primitives');
    const semantic = await getOrCreateCollection('Flowboard / Color');
    const layout = await getOrCreateCollection('Flowboard / Layout');
    for (const [name, value] of Object.entries(colors)) {
      const primitive = await getOrCreateVariable(primitives, `color/${name}`, 'COLOR', hex(value), []);
      const scopes: VariableScope[] = name.startsWith('text/') ? ['TEXT_FILL'] : name.startsWith('border/') ? ['STROKE_COLOR'] : ['FRAME_FILL', 'SHAPE_FILL'];
      const semanticVariable = await getOrCreateVariable(semantic, name, 'COLOR', { type: 'VARIABLE_ALIAS', id: primitive.id }, scopes);
      tokenStore.colors[name] = semanticVariable;
    }
    for (const [name, value] of Object.entries(spacing)) tokenStore.spacing[name] = await getOrCreateVariable(layout, name, 'FLOAT', value, ['GAP', 'WIDTH_HEIGHT']);
    for (const [name, value] of Object.entries(radii)) tokenStore.radii[name] = await getOrCreateVariable(layout, name, 'FLOAT', value, ['CORNER_RADIUS']);
    tokenStore.variablesAvailable = true;
  } catch (error) {
    tokenStore.variablesAvailable = false;
    figma.notify(`Variables unavailable; continued with native styles. ${String(error)}`, { error: true, timeout: 5000 });
  }

  await getOrCreateTextStyle('Heading / H1', 32, 42, 'bold');
  await getOrCreateTextStyle('Heading / H2', 24, 34, 'bold');
  await getOrCreateTextStyle('Heading / H3', 18, 28, 'bold');
  await getOrCreateTextStyle('Body / Large', 16, 26, 'regular');
  await getOrCreateTextStyle('Body / Medium', 14, 22, 'regular');
  await getOrCreateTextStyle('Body / Small', 12, 18, 'regular');
  await getOrCreateTextStyle('Label / Medium', 14, 20, 'bold');
  await getOrCreateTextStyle('Label / Small', 11, 16, 'medium');

  const shadow = (await figma.getLocalEffectStylesAsync()).find((style) => style.name === 'Shadow / Card') ?? figma.createEffectStyle();
  shadow.name = 'Shadow / Card';
  shadow.description = '0 4px 14px rgb(41 50 74 / 10%)';
  shadow.effects = [{ type: 'DROP_SHADOW', color: { ...hex('#29324A'), a: 0.1 }, offset: { x: 0, y: 4 }, radius: 14, spread: 0, visible: true, blendMode: 'NORMAL' }];
  tokenStore.shadow = shadow;

  root.appendChild(text('Title', 'Flowboard Foundations', 'Heading / H1'));
  root.appendChild(text('Description', '由 Vue / Tailwind tokens 與既有 SVG 視覺系統重建。所有元件優先綁定 Variables；若 Variables API 不可用則保留可編輯的原生 Styles。', 'Body / Large', 'text/secondary'));

  const swatches = auto('Color / Semantic', 'HORIZONTAL', { gap: 12 });
  Object.entries(colors).forEach(([name, value]) => {
    const swatch = auto(`Color / ${name}`, 'VERTICAL', { gap: 8, padding: [12], fill: 'bg/surface', radius: 'radius/lg' });
    fixed(swatch, 152, 116);
    const chip = figma.createRectangle();
    chip.name = 'Color sample';
    chip.resize(128, 44);
    chip.cornerRadius = 8;
    chip.fills = [solid(value)];
    swatch.appendChild(chip);
    swatch.appendChild(text('Token name', name, 'Label / Small'));
    swatches.appendChild(swatch);
  });
  root.appendChild(swatches);

  const typography = auto('Typography', 'VERTICAL', { gap: 16, padding: [24], fill: 'bg/surface', radius: 'radius/lg' });
  (Object.keys(typeScale) as Array<keyof typeof typeScale>).forEach((styleName) => typography.appendChild(text(styleName, styleName.replace(' / ', ' — Flowboard typography'), styleName)));
  root.appendChild(typography);

  const scale = auto('Layout tokens', 'HORIZONTAL', { gap: 12 });
  [...Object.entries(spacing), ...Object.entries(radii)].forEach(([name, value]) => {
    const token = auto(name, 'VERTICAL', { gap: 8, padding: [12], fill: 'bg/surface', radius: 'radius/md' });
    fixed(token, 128, 80);
    token.appendChild(text('Name', name, 'Label / Small'));
    token.appendChild(text('Value', `${value}px`, 'Heading / H3'));
    scale.appendChild(token);
  });
  root.appendChild(scale);
  return root;
}

function buttonVariant(style: string): ComponentNode {
  const button = figma.createComponent();
  button.name = `Style=${style}, Size=Default`;
  button.description = 'Horizontal Auto Layout · Hug contents · Padding 12px 20px';
  button.layoutMode = 'HORIZONTAL';
  button.primaryAxisSizingMode = 'AUTO';
  button.counterAxisSizingMode = 'AUTO';
  button.primaryAxisAlignItems = 'CENTER';
  button.counterAxisAlignItems = 'CENTER';
  button.itemSpacing = 8;
  setPadding(button, 12, 20);
  setRadius(button, 'radius/md');
  const dark = style === 'Primary' || style === 'Danger';
  applyFill(button, dark ? 'action/primary' : style === 'Ghost' ? 'bg/subtle' : 'bg/surface');
  if (!dark) applyStroke(button);
  const label = text('Label', style === 'Primary' ? '建立' : style === 'Danger' ? '刪除卡片' : style === 'Outline' ? '取消' : '更多操作', 'Label / Medium', dark ? 'text/on-dark' : 'text/primary');
  button.appendChild(label);
  return button;
}

function inputVariant(state: string): ComponentNode {
  const input = figma.createComponent();
  input.name = `State=${state}`;
  input.description = 'Vertical Auto Layout · Label + control + helper text';
  input.layoutMode = 'VERTICAL';
  input.primaryAxisSizingMode = 'AUTO';
  input.counterAxisSizingMode = 'FIXED';
  input.itemSpacing = 8;
  input.resize(320, 100);
  input.fills = [];
  input.appendChild(text('Label', '電子郵件', 'Label / Medium'));
  const control = auto('Input control', 'HORIZONTAL', { padding: [14, 16], fill: 'bg/surface', radius: 'radius/md' });
  fixed(control, 320, 52);
  applyStroke(control, state === 'Focused' ? 'action/primary' : 'border/default', state === 'Focused' ? 2 : 1);
  control.appendChild(text('Value', state === 'Filled' ? 'you@example.com' : '輸入內容', 'Body / Medium', state === 'Filled' ? 'text/primary' : 'text/tertiary'));
  input.appendChild(control);
  input.appendChild(text('Helper', state === 'Error' ? '請輸入有效的電子郵件地址' : '請使用工作用電子郵件', 'Body / Small', state === 'Error' ? 'action/primary' : 'text/secondary'));
  return input;
}

function avatarVariant(size: number): ComponentNode {
  const avatar = figma.createComponent();
  avatar.name = `Size=${size}`;
  avatar.description = 'Avatar · fixed square · circular';
  avatar.resize(size, size);
  applyFill(avatar, 'flow/active');
  avatar.cornerRadius = size / 2;
  const initial = text('Initial', 'J', size >= 32 ? 'Label / Medium' : 'Label / Small');
  initial.textAlignHorizontal = 'CENTER';
  initial.textAutoResize = 'WIDTH_AND_HEIGHT';
  initial.resize(size, size);
  initial.textAlignVertical = 'CENTER';
  avatar.appendChild(initial);
  return avatar;
}

function badgeVariant(style: string, color: string): ComponentNode {
  const badge = figma.createComponent();
  badge.name = `Style=${style}`;
  badge.description = 'Horizontal Auto Layout · Hug contents · 20px high';
  badge.layoutMode = 'HORIZONTAL';
  badge.primaryAxisSizingMode = 'AUTO';
  badge.counterAxisSizingMode = 'AUTO';
  badge.primaryAxisAlignItems = 'CENTER';
  badge.counterAxisAlignItems = 'CENTER';
  setPadding(badge, 3, 10);
  badge.cornerRadius = 999;
  applyFill(badge, `${color}-soft`);
  badge.appendChild(text('Label', style, 'Label / Small', color));
  return badge;
}

function taskCardVariant(state: 'Default' | 'Progress' | 'Locked' | 'Done'): ComponentNode {
  const card = figma.createComponent();
  card.name = `State=${state}`;
  card.description = 'Task Card · Vertical Auto Layout · Padding 16px · Gap 12px · 44px drag target';
  card.layoutMode = 'VERTICAL';
  card.primaryAxisSizingMode = 'AUTO';
  card.counterAxisSizingMode = 'FIXED';
  card.itemSpacing = 12;
  card.resize(256, state === 'Progress' ? 160 : state === 'Locked' ? 168 : 152);
  setPadding(card, 16);
  applyFill(card, 'bg/surface');
  setRadius(card, 'radius/lg');
  card.effects = [{ type: 'DROP_SHADOW', color: { ...hex('#29324A'), a: 0.1 }, offset: { x: 0, y: 4 }, radius: 14, spread: 0, visible: true, blendMode: 'NORMAL' }];
  const top = auto('Header', 'HORIZONTAL');
  top.primaryAxisSizingMode = 'AUTO';
  top.counterAxisSizingMode = 'FIXED';
  top.resize(224, 20);
  top.primaryAxisAlignItems = 'SPACE_BETWEEN';
  const category = auto('Badge', 'HORIZONTAL', { padding: [3, 10], fill: 'category/coral-soft', radius: 'radius/full' });
  category.appendChild(text('Badge label', 'API', 'Label / Small', 'category/coral'));
  top.appendChild(category);
  top.appendChild(dragHandle());
  card.appendChild(top);
  card.appendChild(text('Title', '建立使用者註冊 API', 'Label / Medium'));
  card.appendChild(text('Metadata', 'Auth · Backend', 'Body / Small', 'text/secondary'));
  if (state === 'Progress') {
    const progress = auto('Progress', 'HORIZONTAL', { fill: 'border/default', radius: 'radius/full' }); fixed(progress, 120, 6);
    const value = figma.createRectangle(); value.name = 'Progress value'; value.resize(76, 6); value.cornerRadius = 3; applyFill(value, 'flow/active-strong'); progress.appendChild(value); card.appendChild(progress);
  }
  if (state === 'Locked') {
    const lock = auto('Soft lock', 'HORIZONTAL', { gap: 8, padding: [4, 8], fill: 'bg/subtle', radius: 'radius/full' });
    const avatar = figma.createEllipse(); avatar.name = 'Lock owner avatar'; avatar.resize(16, 16); applyFill(avatar, 'flow/done'); lock.appendChild(avatar); lock.appendChild(text('Message', 'Mia 正在移動', 'Body / Small', 'text/secondary')); card.appendChild(lock);
  }
  if (state === 'Done') card.appendChild(text('Completion', '✓　完成於今天', 'Body / Small', 'flow/active-strong'));
  return card;
}

function boardColumnComponent(): ComponentNode {
  const column = figma.createComponent();
  column.name = 'Board Column';
  column.description = 'Vertical Auto Layout · fixed width 280px · Padding 16px · Gap 12px';
  column.layoutMode = 'VERTICAL';
  column.primaryAxisSizingMode = 'FIXED';
  column.counterAxisSizingMode = 'FIXED';
  column.itemSpacing = 12;
  column.resize(280, 680);
  setPadding(column, 16);
  applyFill(column, 'bg/subtle');
  applyStroke(column);
  setRadius(column, 'radius/lg');
  const header = auto('Column header', 'HORIZONTAL');
  header.resize(248, 28);
  header.counterAxisSizingMode = 'FIXED';
  const accent = figma.createRectangle();
  accent.name = 'Status accent';
  accent.resize(4, 28);
  accent.cornerRadius = 2;
  applyFill(accent, 'flow/ready');
  header.appendChild(accent);
  header.appendChild(text('Title', '準備開始', 'Label / Medium'));
  header.appendChild(text('Count', '03', 'Body / Small', 'text/secondary'));
  column.appendChild(header);
  column.appendChild(text('Drop zone', 'Cards are instances on screens', 'Body / Small', 'text/tertiary'));
  return column;
}

function projectCardComponent(): ComponentNode {
  const card = figma.createComponent();
  card.name = 'Project Card';
  card.description = 'Vertical Auto Layout · Padding 20px · Gap 12px';
  card.layoutMode = 'VERTICAL';
  card.primaryAxisSizingMode = 'AUTO';
  card.counterAxisSizingMode = 'FIXED';
  card.itemSpacing = 12;
  card.resize(352, 188);
  setPadding(card, 20);
  applyFill(card, 'bg/subtle');
  setRadius(card, 'radius/lg');
  card.appendChild(text('Title', 'Flowboard 即時協作', 'Heading / H3'));
  card.appendChild(text('Description', '主要看板 · WebSocket 練習', 'Body / Small', 'text/secondary'));
  card.appendChild(text('Meta', '9 張卡片 · 剛剛開啟', 'Body / Small', 'text/secondary'));
  return card;
}

function dialogComponent(): ComponentNode {
  const dialog = figma.createComponent();
  dialog.name = 'Dialog';
  dialog.description = 'Vertical Auto Layout · Padding 32px · modal content container';
  dialog.layoutMode = 'VERTICAL';
  dialog.primaryAxisSizingMode = 'AUTO';
  dialog.counterAxisSizingMode = 'FIXED';
  dialog.itemSpacing = 24;
  dialog.resize(600, 440);
  setPadding(dialog, 32);
  applyFill(dialog, 'bg/surface');
  setRadius(dialog, 'radius/xl');
  dialog.effects = [{ type: 'DROP_SHADOW', color: { ...hex('#29324A'), a: 0.1 }, offset: { x: 0, y: 4 }, radius: 14, spread: 0, visible: true, blendMode: 'NORMAL' }];
  dialog.appendChild(text('Title', '新增卡片', 'Heading / H2'));
  dialog.appendChild(text('Body', 'Dialog body is composed from Input and Button instances on a screen.', 'Body / Medium', 'text/secondary'));
  return dialog;
}

function selectComponent(): ComponentNode {
  const select = figma.createComponent();
  select.name = 'Select';
  select.description = 'Horizontal Auto Layout · fixed width 320px · selected value with chevron';
  select.layoutMode = 'HORIZONTAL'; select.primaryAxisAlignItems = 'SPACE_BETWEEN';
  fixed(select, 320, 52); setPadding(select, 14, 16); applyFill(select, 'bg/surface'); applyStroke(select); setRadius(select, 'radius/md');
  select.appendChild(text('Value', '後端', 'Body / Medium'));
  select.appendChild(text('Chevron', '⌄', 'Heading / H3', 'text/secondary'));
  return select;
}

function colorSwatchVariant(colorName: typeof categoryColorKeys[number]): ComponentNode {
  const swatch = figma.createComponent();
  swatch.name = `Color=${colorName}, Selected=${colorName === 'mint' ? 'True' : 'False'}`;
  swatch.description = '44×44 touch target · Category color';
  fixed(swatch, 44, 44); applyFill(swatch, `category/${colorName}-soft`); setRadius(swatch, 'radius/md');
  const dot = figma.createEllipse(); dot.name = 'Color dot'; dot.resize(26, 26); dot.x = 9; dot.y = 9; applyFill(dot, `category/${colorName}`); swatch.appendChild(dot);
  if (colorName === 'mint') swatch.appendChild(text('Selected', '✓', 'Label / Medium', 'text/on-dark'));
  return swatch;
}

function emptyStateComponent(): ComponentNode {
  const state = figma.createComponent(); state.name = 'Empty State'; state.description = 'Vertical Auto Layout · empty board column';
  state.layoutMode = 'VERTICAL'; state.primaryAxisAlignItems = 'CENTER'; state.counterAxisAlignItems = 'CENTER'; state.itemSpacing = 12;
  fixed(state, 280, 220); setPadding(state, 24); applyFill(state, 'bg/subtle'); applyStroke(state); setRadius(state, 'radius/lg');
  state.appendChild(text('Icon', '＋', 'Heading / H1', 'text/secondary'));
  state.appendChild(text('Title', '這個欄位還沒有卡片', 'Label / Medium'));
  state.appendChild(text('Description', '新增卡片開始整理下一步。', 'Body / Small', 'text/secondary'));
  return state;
}

function componentSet(name: string, variants: ComponentNode[], parent: FrameNode): ComponentSetNode {
  const set = figma.combineAsVariants(variants, parent);
  set.name = name;
  set.description = `Flowboard reusable ${name} variants`;
  tag(set, 'component-set');
  return set;
}

async function buildComponents(replace = true): Promise<FrameNode> {
  if (!replace) {
    const existing = await existingGeneratedRoot('02 · Components', 'Flowboard Components');
    if (existing) return existing;
  }
  const root = await preparePage('02 · Components', 'Flowboard Components');
  root.layoutMode = 'VERTICAL';
  root.itemSpacing = 48;
  root.paddingTop = root.paddingRight = root.paddingBottom = root.paddingLeft = 40;
  applyFill(root, 'bg/auth');
  root.appendChild(text('Title', 'Flowboard Components', 'Heading / H1'));
  root.appendChild(text('Description', '每個可重複使用的 Pattern 都有一個 main component 或 component set；Screens 僅使用 Instances。', 'Body / Large', 'text/secondary'));

  const buttonRow = auto('Button', 'HORIZONTAL', { gap: 24 });
  root.appendChild(buttonRow);
  componentSets.Button = componentSet('Button', ['Primary', 'Secondary', 'Outline', 'Ghost', 'Danger'].map(buttonVariant), buttonRow);

  const inputRow = auto('Input', 'HORIZONTAL', { gap: 24 });
  root.appendChild(inputRow);
  componentSets.Input = componentSet('Input', ['Default', 'Focused', 'Filled', 'Error'].map(inputVariant), inputRow);

  const avatarRow = auto('Avatar', 'HORIZONTAL', { gap: 24 });
  root.appendChild(avatarRow);
  componentSets.Avatar = componentSet('Avatar', [24, 32, 40].map(avatarVariant), avatarRow);

  const badgeRow = auto('Badge', 'HORIZONTAL', { gap: 24 });
  root.appendChild(badgeRow);
  componentSets.Badge = componentSet('Badge', [['API', 'category/coral'], ['Session', 'category/mint'], ['Review', 'category/amber'], ['Done', 'category/lavender']].map(([label, color]) => badgeVariant(label, color)), badgeRow);

  const fieldRow = auto('Form controls', 'HORIZONTAL', { gap: 24 });
  root.appendChild(fieldRow);
  const select = selectComponent(); tag(select, 'component'); standaloneComponents[select.name] = select; fieldRow.appendChild(select);
  componentSets['Category Color'] = componentSet('Category Color', categoryColorKeys.map(colorSwatchVariant), fieldRow);

  const taskCardRow = auto('Task Card', 'HORIZONTAL', { gap: 24 });
  root.appendChild(taskCardRow);
  componentSets['Task Card'] = componentSet('Task Card', (['Default', 'Progress', 'Locked', 'Done'] as const).map(taskCardVariant), taskCardRow);

  const core = auto('Core components', 'HORIZONTAL', { gap: 48 });
  root.appendChild(core);
  [boardColumnComponent(), projectCardComponent(), dialogComponent(), emptyStateComponent()].forEach((component) => {
    tag(component, 'component');
    standaloneComponents[component.name] = component;
    core.appendChild(component);
  });
  return root;
}

function componentVariant(setName: string, includes = ''): ComponentNode | undefined {
  const set = componentSets[setName];
  return set?.children.find((child) => child.type === 'COMPONENT' && child.name.includes(includes)) as ComponentNode | undefined;
}

function localComponent(name: string): ComponentNode | undefined {
  return standaloneComponents[name];
}

async function hydrateComponentCache(): Promise<void> {
  if (componentSets.Button && componentSets['Task Card']) return;
  const page = figma.root.children.find((candidate) => candidate.name === '02 · Components');
  if (!page) return;
  await figma.setCurrentPageAsync(page);
  page.findAllWithCriteria({ types: ['COMPONENT_SET'] }).forEach((set) => {
    componentSets[set.name] = set;
  });
  page.findAllWithCriteria({ types: ['COMPONENT'] }).forEach((component) => {
    if (!component.parent || component.parent.type !== 'COMPONENT_SET') standaloneComponents[component.name] = component;
  });
}

function instance(component: ComponentNode | undefined, fallbackName: string): InstanceNode | FrameNode {
  if (component) return component.createInstance();
  const fallback = auto(fallbackName, 'VERTICAL', { padding: [16], fill: 'bg/surface', radius: 'radius/lg' });
  fallback.appendChild(text('Fallback', fallbackName, 'Body / Small'));
  return fallback;
}

function overrideText(node: SceneNode, layerName: string, value: string): void {
  const target = (node as any).findOne((child: SceneNode) => child.type === 'TEXT' && child.name === layerName) as TextNode | null;
  if (target) target.characters = value;
}

function appHeader(): FrameNode {
  const header = auto('Header', 'HORIZONTAL', { gap: 24, padding: [12, 32], fill: 'bg/dark' });
  fixed(header, 1440, 56);
  header.primaryAxisAlignItems = 'SPACE_BETWEEN';
  const brand = auto('Brand', 'HORIZONTAL', { gap: 12 });
  const mark = auto('Logo mark', 'HORIZONTAL', { gap: 6 });
  const coral = figma.createRectangle(); coral.resize(18, 24); coral.cornerRadius = 4; applyFill(coral, 'action/primary');
  const mint = figma.createRectangle(); mint.resize(18, 16); mint.cornerRadius = 4; applyFill(mint, 'flow/active');
  mark.appendChild(coral); mark.appendChild(mint);
  brand.appendChild(mark); brand.appendChild(text('Wordmark', 'Flowboard', 'Heading / H3', 'text/on-dark'));
  const nav = auto('Navigation', 'HORIZONTAL', { gap: 24 });
  nav.appendChild(text('Workspace', '工作區', 'Body / Medium', 'text/on-dark'));
  nav.appendChild(text('Recent', '最近', 'Body / Medium', 'text/on-dark'));
  const actions = auto('Header actions', 'HORIZONTAL', { gap: 16 });
  const plus = auto('Create button', 'HORIZONTAL', { padding: [8, 12], fill: 'action/primary', radius: 'radius/md' });
  plus.appendChild(text('Icon', '+', 'Heading / H3', 'text/on-dark'));
  const avatar = instance(componentVariant('Avatar', 'Size=32'), 'Avatar');
  actions.appendChild(plus); actions.appendChild(avatar);
  header.appendChild(brand); header.appendChild(nav); header.appendChild(actions);
  return header;
}

function sidebar(): FrameNode {
  const sidebar = auto('Sidebar', 'VERTICAL', { gap: 24, padding: [24, 16], fill: 'bg/dark' });
  fixed(sidebar, 256, 844);
  const workspace = auto('Workspace switcher', 'HORIZONTAL', { gap: 12, padding: [12], fill: 'bg/dark', radius: 'radius/lg' });
  const logo = auto('Workspace avatar', 'HORIZONTAL', { padding: [8], fill: 'action/primary', radius: 'radius/md' });
  logo.appendChild(text('Initial', 'J', 'Label / Medium', 'text/on-dark'));
  workspace.appendChild(logo);
  const labels = auto('Workspace labels', 'VERTICAL', { gap: 2 });
  labels.appendChild(text('Workspace name', 'Jeffery 的工作區', 'Label / Medium', 'text/on-dark'));
  labels.appendChild(text('Workspace meta', '擁有者 · 3 個專案', 'Body / Small', 'text/on-dark'));
  workspace.appendChild(labels);
  sidebar.appendChild(workspace);
  const navigation = auto('Navigation', 'VERTICAL', { gap: 4 });
  ['工作區', '最近', '成員', '已封存專案'].forEach((label, index) => {
    const item = auto(`Nav item / ${label}`, 'HORIZONTAL', { padding: [10, 12], fill: index === 0 ? 'bg/subtle' : 'bg/dark', radius: 'radius/md' });
    item.appendChild(text('Label', label, 'Label / Medium', index === 0 ? 'text/primary' : 'text/on-dark'));
    navigation.appendChild(item);
  });
  sidebar.appendChild(navigation);
  sidebar.appendChild(text('Members label', '工作區成員', 'Label / Small', 'text/on-dark'));
  const members = auto('Members', 'HORIZONTAL', { gap: 8 });
  [32, 32, 32].forEach(() => members.appendChild(instance(componentVariant('Avatar', 'Size=32'), 'Avatar')));
  sidebar.appendChild(members);
  return sidebar;
}

function projectCard(titleValue: string, description: string, flowColor: string): InstanceNode | FrameNode {
  const card = instance(localComponent('Project Card'), 'Project Card');
  overrideText(card, 'Title', titleValue);
  overrideText(card, 'Description', description);
  return card;
}

function workspaceScreen(): FrameNode {
  const screen = auto('Workspace / Desktop / 1440×900', 'VERTICAL', { fill: 'bg/canvas' });
  fixed(screen, 1440, 900);
  setRadius(screen, 'radius/xl');
  screen.appendChild(appHeader());
  const shell = auto('App shell', 'HORIZONTAL');
  fixed(shell, 1440, 844);
  shell.appendChild(sidebar());
  const main = auto('Main content', 'VERTICAL', { gap: 32, padding: [40], fill: 'bg/canvas' });
  fixed(main, 1184, 844);
  const pageHeader = auto('Page header', 'HORIZONTAL');
  pageHeader.primaryAxisAlignItems = 'SPACE_BETWEEN';
  pageHeader.resize(1104, 84);
  const heading = auto('Heading', 'VERTICAL', { gap: 8 });
  heading.appendChild(text('Eyebrow', '工作區', 'Label / Small', 'text/secondary'));
  heading.appendChild(text('Title', 'Jeffery 的工作區', 'Heading / H1'));
  heading.appendChild(text('Description', '集中查看所有專案，選一個進入主要看板。', 'Body / Medium', 'text/secondary'));
  pageHeader.appendChild(heading);
  pageHeader.appendChild(instance(componentVariant('Button', 'Primary'), 'Button'));
  main.appendChild(pageHeader);
  main.appendChild(text('Section title', '最近開啟', 'Heading / H3'));
  const recent = auto('Recent projects', 'HORIZONTAL', { gap: 20 });
  recent.appendChild(projectCard('Flowboard 即時協作', '主要看板 · WebSocket 練習', 'flow/ready'));
  recent.appendChild(projectCard('發佈自動化', '主要看板 · CI/CD 與部署檢查', 'flow/active'));
  main.appendChild(recent);
  main.appendChild(text('Section title', '所有專案', 'Heading / H3'));
  const projects = auto('Project grid', 'HORIZONTAL', { gap: 20 });
  ['Flowboard 即時協作', '發佈自動化', '技術成長計畫'].forEach((name, index) => projects.appendChild(projectCard(name, ['WebSocket 練習', 'CI/CD 與部署檢查', '.NET、AWS、系統設計'][index], 'flow/done')));
  main.appendChild(projects);
  shell.appendChild(main);
  screen.appendChild(shell);
  return screen;
}

function taskCard(titleValue: string, meta: string, badge?: string, state: 'Default' | 'Progress' | 'Locked' | 'Done' = 'Default'): InstanceNode | FrameNode {
  const card = instance(componentVariant('Task Card', `State=${state}`), 'Task Card');
  overrideText(card, 'Title', titleValue);
  overrideText(card, 'Metadata', meta);
  if (badge) overrideText(card, 'Badge label', badge);
  return card;
}

function boardColumn(name: string, count: string, colorName: string, cards: Array<[string, string, string?]>): FrameNode {
  const column = auto(`Column / ${name}`, 'VERTICAL', { gap: 12, padding: [16], fill: 'bg/subtle', radius: 'radius/lg' });
  fixed(column, 280, 680);
  applyStroke(column);
  const header = auto('Column header', 'HORIZONTAL', { gap: 12 });
  header.resize(248, 28);
  header.primaryAxisAlignItems = 'SPACE_BETWEEN';
  const accent = figma.createRectangle(); accent.name = 'Status accent'; accent.resize(4, 28); accent.cornerRadius = 2; applyFill(accent, colorName);
  header.appendChild(accent);
  const copy = auto('Column title', 'HORIZONTAL', { gap: 8 }); copy.appendChild(text('Title', name, 'Label / Medium')); copy.appendChild(text('Count', count, 'Body / Small', 'text/secondary'));
  header.appendChild(copy); header.appendChild(dragHandle(40));
  column.appendChild(header);
  cards.forEach(([titleValue, meta, badge]) => column.appendChild(taskCard(titleValue, meta, badge)));
  const add = auto('Add card', 'HORIZONTAL', { gap: 8, padding: [8] });
  add.appendChild(text('Icon', '+', 'Heading / H3', 'text/secondary'));
  add.appendChild(text('Label', '新增卡片', 'Body / Medium', 'text/secondary'));
  column.appendChild(add);
  return column;
}

function boardScreen(): FrameNode {
  const screen = auto('Board / Desktop / 1440×900', 'VERTICAL', { gap: 0, fill: 'bg/canvas' });
  fixed(screen, 1440, 900);
  setRadius(screen, 'radius/xl');
  screen.appendChild(appHeader());
  const content = auto('Main content', 'VERTICAL', { gap: 28, padding: [32], fill: 'bg/canvas' });
  fixed(content, 1440, 844);
  const heading = auto('Page header', 'HORIZONTAL');
  heading.primaryAxisAlignItems = 'SPACE_BETWEEN';
  heading.resize(1376, 72);
  const copy = auto('Board name', 'VERTICAL', { gap: 6 });
  copy.appendChild(text('Breadcrumb', 'Jeffery 的工作區 / Flowboard 即時協作 / 主要看板', 'Label / Small', 'text/secondary'));
  copy.appendChild(text('Title', '產品開發看板', 'Heading / H2'));
  copy.appendChild(text('Subtitle', '專案主要看板 · 即時同步中', 'Body / Small', 'text/secondary'));
  heading.appendChild(copy);
  const avatars = auto('Collaborators', 'HORIZONTAL', { gap: 4 });
  [32, 32, 32].forEach(() => avatars.appendChild(instance(componentVariant('Avatar', 'Size=32'), 'Avatar')));
  const memberActions = auto('Project members', 'HORIZONTAL', { gap: 16 }); memberActions.appendChild(avatars);
  const membersButton = auto('Project members button', 'HORIZONTAL', { gap: 8, padding: [12, 20], fill: 'bg/dark', radius: 'radius/md' }); membersButton.appendChild(icon('Users icon', '<circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="2"/><path d="M2 20c0-3.5 2.5-6 6-6s6 2.5 6 6M16 5c3 0 5 2 5 5M16 14c3 0 5 2 5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', 16, 'text/on-dark')); membersButton.appendChild(text('Label', '專案成員', 'Label / Medium', 'text/on-dark')); memberActions.appendChild(membersButton);
  heading.appendChild(memberActions);
  content.appendChild(heading);
  const columns = auto('Kanban columns', 'HORIZONTAL', { gap: 16 });
  const ready = boardColumn('準備開始', '03', 'flow/ready', []); ready.appendChild(taskCard('建立使用者註冊 API', 'Auth · Backend', 'API')); ready.appendChild(taskCard('登入頁表單驗證', 'Frontend')); ready.appendChild(taskCard('整理 Socket.IO 事件命名', '文件 · 8 月 16 日')); columns.appendChild(ready);
  const active = boardColumn('正在進行', '02', 'flow/active', []); active.appendChild(taskCard('Session Cookie 驗證流程', 'Redis · Auth', 'Session', 'Progress')); active.appendChild(taskCard('Socket handshake middleware', '今天到期')); columns.appendChild(active);
  const review = boardColumn('等待檢視', '02', 'flow/review', []); review.appendChild(taskCard('AuthService 錯誤處理', '等待 review')); review.appendChild(taskCard('更新 session 文件', '2 則留言', undefined, 'Locked')); columns.appendChild(review);
  const done = boardColumn('已完成', '02', 'flow/done', []); done.appendChild(taskCard('建立 Redis 連線模組', '完成於今天', undefined, 'Done')); columns.appendChild(done);
  const addColumn = auto('Add column', 'HORIZONTAL', { gap: 8, padding: [14, 20], fill: 'bg/subtle', radius: 'radius/md' }); fixed(addColumn, 192, 48); applyStroke(addColumn, 'border/strong'); addColumn.appendChild(text('Icon', '+', 'Heading / H3', 'text/secondary')); addColumn.appendChild(text('Label', '新增欄位', 'Label / Medium')); columns.appendChild(addColumn);
  content.appendChild(columns);
  screen.appendChild(content);
  return screen;
}

function authScreen(kind: 'Login' | 'Signup'): FrameNode {
  const screen = auto(`Auth / ${kind} / 1440×900`, 'HORIZONTAL', { fill: 'bg/auth' });
  fixed(screen, 1440, 900);
  setRadius(screen, 'radius/xl');
  const visual = auto('Product visual', 'VERTICAL', { gap: 28, padding: [56], fill: 'bg/dark' });
  fixed(visual, kind === 'Login' ? 500 : 420, 900);
  visual.appendChild(text('Brand', 'Flowboard', 'Heading / H2', 'text/on-dark'));
  visual.appendChild(text('Tagline', kind === 'Login' ? '不只同步訊息，\n也同步下一步。' : '從第一張卡片，\n開始建立節奏。', 'Heading / H1', 'text/on-dark'));
  visual.appendChild(text('Description', '把工作切成能推進的小塊，讓每個人看見流程正在往哪裡走。', 'Body / Large', 'text/on-dark'));
  screen.appendChild(visual);
  const content = auto('Auth content', 'VERTICAL', { gap: 20, padding: [120, 160], fill: 'bg/auth' });
  fixed(content, 1440 - visual.width, 900);
  content.primaryAxisAlignItems = 'CENTER';
  const form = auto('Form', 'VERTICAL', { gap: 20 });
  fixed(form, kind === 'Login' ? 450 : 480, kind === 'Login' ? 610 : 720);
  form.appendChild(text('Eyebrow', kind === 'Login' ? '登入你的工作區' : '建立帳號', 'Label / Small', 'text/secondary'));
  form.appendChild(text('Title', kind === 'Login' ? '回到正在推進的工作' : '開始你的工作區', 'Heading / H1'));
  form.appendChild(text('Description', kind === 'Login' ? '輸入帳號後，繼續上次停下的地方。' : '只需要一分鐘，之後可以再邀請成員。', 'Body / Medium', 'text/secondary'));
  if (kind === 'Signup') form.appendChild(instance(componentVariant('Input', 'Default'), 'Input'));
  form.appendChild(instance(componentVariant('Input', 'Filled'), 'Input'));
  form.appendChild(instance(componentVariant('Input', 'Default'), 'Input'));
  form.appendChild(instance(componentVariant('Button', 'Primary'), 'Button'));
  form.appendChild(text('Footer link', kind === 'Login' ? '第一次使用？ 建立帳號' : '已經有帳號？ 返回登入', 'Body / Medium', 'text/secondary'));
  content.appendChild(form);
  screen.appendChild(content);
  return screen;
}

function mobileAuthScreen(kind: 'Login' | 'Signup'): FrameNode {
  const screen = auto(`Auth / ${kind} / Mobile / 390×844`, 'VERTICAL', { gap: 24, padding: [32, 24], fill: 'bg/auth' });
  fixed(screen, 390, 844); setRadius(screen, 'radius/xl');
  const brand = auto('Brand', 'HORIZONTAL', { gap: 12 });
  const mark = auto('Logo mark', 'HORIZONTAL', { gap: 6 });
  const coral = figma.createRectangle(); coral.resize(16, 24); coral.cornerRadius = 4; applyFill(coral, 'action/primary');
  const mint = figma.createRectangle(); mint.resize(16, 16); mint.cornerRadius = 4; applyFill(mint, 'flow/active');
  mark.appendChild(coral); mark.appendChild(mint); brand.appendChild(mark); brand.appendChild(text('Wordmark', 'Flowboard', 'Heading / H3')); screen.appendChild(brand);
  const accent = figma.createRectangle(); accent.name = 'Brand accent'; accent.resize(42, 4); accent.cornerRadius = 2; applyFill(accent, 'action/primary'); screen.appendChild(accent);
  screen.appendChild(text('Title', kind === 'Login' ? '回到正在推進的工作' : '建立你的工作區', 'Heading / H1'));
  screen.appendChild(text('Description', kind === 'Login' ? '登入後，接續上次停下的地方。' : '從第一張卡片，開始建立節奏。', 'Body / Medium', 'text/secondary'));
  if (kind === 'Signup') screen.appendChild(instance(componentVariant('Input', 'Default'), 'Display name input'));
  screen.appendChild(instance(componentVariant('Input', 'Filled'), 'Email input'));
  screen.appendChild(instance(componentVariant('Input', 'Default'), 'Password input'));
  if (kind === 'Signup') screen.appendChild(instance(componentVariant('Input', 'Default'), 'Confirm password input'));
  screen.appendChild(instance(componentVariant('Button', 'Primary'), 'Primary action'));
  screen.appendChild(text('Footer link', kind === 'Login' ? '第一次使用？ 建立帳號' : '已經有帳號？ 返回登入', 'Body / Medium', 'text/secondary'));
  return screen;
}

function cardDialogScreen(): FrameNode {
  const canvas = auto('Create Card Dialog / Desktop / 1440×900', 'VERTICAL', { fill: 'bg/canvas' });
  fixed(canvas, 1440, 900);
  const background = boardScreen();
  background.name = 'Board backdrop';
  background.opacity = 0.35;
  canvas.appendChild(background);
  background.layoutPositioning = 'ABSOLUTE';
  const dialog = instance(localComponent('Dialog'), 'Dialog');
  fixed(dialog, 600, 628);
  canvas.appendChild(dialog);
  dialog.layoutPositioning = 'ABSOLUTE';
  dialog.x = 420;
  dialog.y = 136;
  const body = auto('Form content', 'VERTICAL', { gap: 20 });
  body.appendChild(text('Destination', '新增至　準備開始 · 目前 3 張卡片', 'Body / Small', 'text/secondary'));
  body.appendChild(instance(componentVariant('Input', 'Focused'), 'Input'));
  body.appendChild(instance(componentVariant('Input', 'Filled'), 'Input'));
  const actions = auto('Actions', 'HORIZONTAL', { gap: 12 });
  actions.appendChild(instance(componentVariant('Button', 'Outline'), 'Button'));
  actions.appendChild(instance(componentVariant('Button', 'Primary'), 'Button'));
  body.appendChild(actions);
  dialog.appendChild(body);
  return canvas;
}

function mobileBoardScreen(): FrameNode {
  const screen = auto('Board / Mobile / 390×844', 'VERTICAL', { gap: 0, fill: 'bg/canvas' });
  fixed(screen, 390, 844);
  const header = auto('Mobile header', 'HORIZONTAL', { gap: 12, padding: [12, 16], fill: 'bg/dark' });
  fixed(header, 390, 56);
  header.appendChild(text('Back', '←', 'Heading / H3', 'text/on-dark'));
  header.appendChild(text('Brand', 'Flowboard', 'Label / Medium', 'text/on-dark'));
  header.appendChild(instance(componentVariant('Avatar', 'Size=32'), 'Avatar'));
  screen.appendChild(header);
  const content = auto('Main content', 'VERTICAL', { gap: 20, padding: [20, 16], fill: 'bg/canvas' });
  fixed(content, 390, 788);
  const titleRow = auto('Board heading', 'HORIZONTAL'); titleRow.primaryAxisAlignItems = 'SPACE_BETWEEN'; titleRow.resize(358, 40);
  const heading = auto('Board name', 'VERTICAL', { gap: 4 }); heading.appendChild(text('Breadcrumb', 'Flowboard 即時協作　/　主要看板', 'Label / Small', 'text/secondary')); heading.appendChild(text('Title', '產品開發看板', 'Heading / H2')); titleRow.appendChild(heading); titleRow.appendChild(icon('More icon', '<circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/>', 24)); content.appendChild(titleRow);
  content.appendChild(text('Subtitle', '即時同步中', 'Body / Small', 'text/secondary'));
  const column = boardColumn('準備開始', '03', 'flow/ready', [['建立使用者註冊 API', 'Auth · Backend', 'API'], ['登入頁表單驗證', 'Frontend'], ['整理 Socket.IO 事件命名', '文件 · 8 月 16 日']]);
  fixed(column, 358, 620);
  const overflow = auto('Horizontal board overflow', 'HORIZONTAL', { gap: 16 }); overflow.appendChild(column); overflow.appendChild(boardColumn('正在進行', '02', 'flow/active', [])); content.appendChild(overflow);
  const track = auto('Scroll indicator', 'HORIZONTAL', { fill: 'border/strong', radius: 'radius/full' }); fixed(track, 196, 4); const thumb = figma.createRectangle(); thumb.name = 'Scroll thumb'; thumb.resize(84, 4); thumb.cornerRadius = 2; applyFill(thumb, 'bg/dark'); track.appendChild(thumb); content.appendChild(track);
  screen.appendChild(content);
  return screen;
}

function dragStatesScreen(): FrameNode {
  const screen = auto('Board / Drag States / 1520×920', 'VERTICAL', { gap: 20, padding: [40], fill: 'bg/canvas' });
  fixed(screen, 1520, 920);
  screen.appendChild(text('Title', 'BOARD / DRAG & COLLABORATION STATES', 'Heading / H2'));
  const grid = auto('States grid', 'HORIZONTAL', { gap: 20 });
  [['01 / Default', '卡片內容可開啟，只有把手能拖曳。'], ['02 / Dragging', '原位置保留 placeholder，卡片適度浮起。'], ['03 / Valid drop target', '欄位與插入位置同時提供靜態提示。'], ['04 / Soft locked', '只停用這張卡，不鎖整欄或整個 Board。']].forEach(([titleValue, description]) => {
    const state = auto(`State / ${titleValue}`, 'VERTICAL', { gap: 16, padding: [20], fill: 'bg/subtle', radius: 'radius/xl' });
    fixed(state, 344, 300);
    state.appendChild(text('Title', titleValue, 'Heading / H3'));
    state.appendChild(text('Description', description, 'Body / Small', 'text/secondary'));
    state.appendChild(taskCard('Session Cookie 驗證流程', 'Redis · Auth', 'Session'));
    grid.appendChild(state);
  });
  screen.appendChild(grid);
  return screen;
}

function workspaceTabletScreen(): FrameNode {
  const screen = auto('Workspace / Tablet / 768×1024', 'VERTICAL', { gap: 24, padding: [24], fill: 'bg/canvas' }); fixed(screen, 768, 1024);
  const header = appHeader(); header.resize(720, 56); screen.appendChild(header);
  screen.appendChild(text('Eyebrow', '目前工作區', 'Label / Small', 'text/secondary'));
  screen.appendChild(text('Title', 'Jeffery 的工作區', 'Heading / H2'));
  screen.appendChild(text('Description', '選一個專案，進入主要看板繼續推進。', 'Body / Medium', 'text/secondary'));
  const recent = auto('Recent projects', 'HORIZONTAL', { gap: 16 }); recent.appendChild(projectCard('Flowboard 即時協作', '主要看板 · WebSocket 練習', 'flow/ready')); recent.appendChild(projectCard('發佈自動化', '主要看板 · CI/CD 與部署檢查', 'flow/active')); screen.appendChild(recent);
  screen.appendChild(text('Section title', '所有專案', 'Heading / H3')); return screen;
}

function workspaceMobileScreen(): FrameNode {
  const screen = auto('Workspace / Mobile / 390×844', 'VERTICAL', { gap: 20, padding: [20, 16], fill: 'bg/canvas' }); fixed(screen, 390, 844);
  const header = auto('Mobile header', 'HORIZONTAL', { gap: 12, padding: [12, 16], fill: 'bg/dark' }); fixed(header, 358, 56); header.primaryAxisAlignItems = 'SPACE_BETWEEN'; header.appendChild(text('Brand', 'Flowboard', 'Label / Medium', 'text/on-dark')); header.appendChild(instance(componentVariant('Avatar', 'Size=32'), 'Avatar')); screen.appendChild(header);
  screen.appendChild(text('Eyebrow', '目前工作區', 'Label / Small', 'text/secondary')); screen.appendChild(text('Title', '選一個專案繼續', 'Heading / H2')); screen.appendChild(text('Description', '所有專案都集中在這個工作區。', 'Body / Medium', 'text/secondary'));
  screen.appendChild(projectCard('Flowboard 即時協作', '主要看板 · WebSocket 練習', 'flow/ready')); screen.appendChild(projectCard('發佈自動化', '主要看板 · CI/CD 與部署檢查', 'flow/active')); return screen;
}

function responsiveDialogScreen(): FrameNode {
  const canvas = auto('Create Card Dialog / Mobile / 390×844', 'VERTICAL', { fill: 'bg/canvas' }); fixed(canvas, 390, 844);
  const background = mobileBoardScreen(); background.name = 'Board backdrop'; background.opacity = 0.36; canvas.appendChild(background); background.layoutPositioning = 'ABSOLUTE';
  const sheet = auto('Create card bottom sheet', 'VERTICAL', { gap: 16, padding: [24, 16], fill: 'bg/surface', radius: 'radius/xl' }); fixed(sheet, 390, 710); canvas.appendChild(sheet); sheet.layoutPositioning = 'ABSOLUTE'; sheet.x = 0; sheet.y = 134;
  sheet.appendChild(text('Handle', '━━━━', 'Label / Small', 'text/tertiary'));
  const header = auto('Sheet header', 'HORIZONTAL'); header.primaryAxisAlignItems = 'SPACE_BETWEEN'; header.resize(358, 32); header.appendChild(text('Title', '新增卡片', 'Heading / H2')); header.appendChild(text('Close', '×', 'Heading / H2', 'text/secondary')); sheet.appendChild(header);
  sheet.appendChild(text('Destination', '準備開始 · 目前 3 張卡片', 'Body / Small', 'text/secondary'));
  const titleField = instance(componentVariant('Input', 'Focused'), 'Input'); overrideText(titleField, 'Label', '卡片標題 ＊'); overrideText(titleField, 'Value', '規劃工作區首頁資訊架構'); sheet.appendChild(titleField);
  const category = instance(localComponent('Select'), 'Select'); overrideText(category, 'Value', '後端'); sheet.appendChild(category);
  sheet.appendChild(categoryColorPicker(6));
  sheet.appendChild(instance(componentVariant('Button', 'Primary'), 'Button'));
  return canvas;
}

function categoryColorPicker(columnsPerRow = 10): FrameNode {
  const picker = auto('Category color picker', 'VERTICAL', { gap: 8 });
  picker.appendChild(text('Label', '類別顏色', 'Label / Medium'));
  const rows = auto('Colors', 'VERTICAL', { gap: 12 });
  for (let index = 0; index < categoryColorKeys.length; index += columnsPerRow) {
    const row = auto(`Color row ${index / columnsPerRow + 1}`, 'HORIZONTAL', { gap: 8 });
    categoryColorKeys.slice(index, index + columnsPerRow).forEach((color) => row.appendChild(instance(componentVariant('Category Color', `Color=${color}`), 'Color swatch')));
    rows.appendChild(row);
  }
  picker.appendChild(rows);
  return picker;
}

function fullCreateCardDialog(): FrameNode {
  const canvas = auto('Create Card Dialog / Desktop / 1440×900', 'VERTICAL', { fill: 'bg/canvas' }); fixed(canvas, 1440, 900);
  const background = boardScreen(); background.name = 'Board backdrop'; background.opacity = 0.35; canvas.appendChild(background); background.layoutPositioning = 'ABSOLUTE';
  const dialog = auto('Create card dialog', 'VERTICAL', { gap: 20, padding: [32], fill: 'bg/surface', radius: 'radius/xl' }); fixed(dialog, 600, 760); canvas.appendChild(dialog); dialog.layoutPositioning = 'ABSOLUTE'; dialog.x = 420; dialog.y = 70;
  const titleRow = auto('Dialog header', 'HORIZONTAL'); titleRow.primaryAxisAlignItems = 'SPACE_BETWEEN'; titleRow.resize(536, 36);
  titleRow.appendChild(text('Title', '新增卡片', 'Heading / H2')); titleRow.appendChild(text('Close', '×', 'Heading / H2', 'text/secondary')); dialog.appendChild(titleRow);
  dialog.appendChild(text('Destination label', '新增至欄位', 'Label / Medium')); dialog.appendChild(text('Destination', '準備開始 · 目前 3 張卡片', 'Body / Medium', 'text/secondary'));
  const titleField = instance(componentVariant('Input', 'Focused'), 'Input'); overrideText(titleField, 'Label', '卡片標題 ＊'); overrideText(titleField, 'Value', '規劃工作區首頁資訊架構'); dialog.appendChild(titleField);
  dialog.appendChild(text('Category label', '類別', 'Label / Medium')); const category = instance(localComponent('Select'), 'Select'); overrideText(category, 'Value', '後端'); dialog.appendChild(category);
  dialog.appendChild(categoryColorPicker());
  dialog.appendChild(text('Labels', '標籤：API、Auth（可多選）', 'Body / Medium', 'text/secondary'));
  const actions = auto('Dialog footer', 'HORIZONTAL', { gap: 12 }); actions.primaryAxisAlignItems = 'MAX'; actions.appendChild(instance(componentVariant('Button', 'Outline'), 'Button')); actions.appendChild(instance(componentVariant('Button', 'Primary'), 'Button')); dialog.appendChild(actions);
  return canvas;
}

function cardDetailScreen(mobile = false): FrameNode {
  const width = mobile ? 390 : 1440; const height = mobile ? 844 : 900;
  const screen = auto(`Card Detail / ${mobile ? 'Mobile / 390×844' : 'Desktop / 1440×900'}`, 'VERTICAL', { gap: 0, fill: 'bg/canvas' }); fixed(screen, width, height);
  if (!mobile) screen.appendChild(appHeader());
  else { const header = auto('Mobile header', 'HORIZONTAL', { gap: 12, padding: [12, 16], fill: 'bg/dark' }); fixed(header, 390, 56); header.appendChild(text('Back', '←', 'Heading / H3', 'text/on-dark')); header.appendChild(text('Title', '卡片詳情', 'Label / Medium', 'text/on-dark')); screen.appendChild(header); }
  const content = auto('Card detail content', mobile ? 'VERTICAL' : 'HORIZONTAL', { gap: 24, padding: mobile ? [24, 16] : [40, 72], fill: 'bg/canvas' }); fixed(content, width, height - (mobile ? 56 : 56));
  const main = auto('Card content', 'VERTICAL', { gap: 20, padding: [28], fill: 'bg/surface', radius: 'radius/lg' }); fixed(main, mobile ? 358 : 760, mobile ? 620 : 720); applyStroke(main);
  main.appendChild(text('Breadcrumb', '產品開發看板 / 準備開始', 'Body / Small', 'text/secondary'));
  const badge = instance(componentVariant('Badge', 'API'), 'Badge'); overrideText(badge, 'Label', '後端'); main.appendChild(badge);
  main.appendChild(text('Title', '建立使用者註冊 API', 'Heading / H1'));
  main.appendChild(text('Description', '完成註冊流程、輸入驗證與 API 回應格式，讓登入頁可以串接。', 'Body / Large', 'text/secondary'));
  main.appendChild(text('Labels', '標籤　API　Auth　Backend', 'Body / Medium'));
  main.appendChild(text('Activity', '活動紀錄\nJeffery 建立卡片 · 剛剛\nMia 將卡片移至「準備開始」 · 3 分鐘前', 'Body / Medium', 'text/secondary'));
  content.appendChild(main);
  if (!mobile) { const meta = auto('Card metadata', 'VERTICAL', { gap: 16, padding: [24], fill: 'bg/subtle', radius: 'radius/lg' }); fixed(meta, 360, 360); meta.appendChild(text('Title', '卡片資訊', 'Heading / H3')); meta.appendChild(text('Category', '類別　後端（薄荷綠）', 'Body / Medium')); meta.appendChild(text('Column', '欄位　準備開始', 'Body / Medium')); meta.appendChild(text('Version', '版本　v12', 'Body / Small', 'text/secondary')); content.appendChild(meta); }
  screen.appendChild(content); return screen;
}

function boardTabletScreen(): FrameNode {
  const screen = auto('Board / Tablet / 768×1024', 'VERTICAL', { gap: 0, fill: 'bg/canvas' }); fixed(screen, 768, 1024); screen.clipsContent = true;
  const header = appHeader(); header.resize(768, 56); screen.appendChild(header);
  const content = auto('Main content', 'VERTICAL', { gap: 20, padding: [24], fill: 'bg/canvas' }); fixed(content, 768, 968);
  content.appendChild(text('Title', '產品開發看板', 'Heading / H2')); content.appendChild(text('Overflow hint', '← 左右滑動查看其他欄位 →', 'Body / Small', 'text/secondary'));
  const columns = auto('Horizontal board overflow', 'HORIZONTAL', { gap: 16 }); ['準備開始', '正在進行', '等待檢視', '已完成'].forEach((name, index) => columns.appendChild(boardColumn(name, `0${index + 2}`, ['flow/ready', 'flow/active', 'flow/review', 'flow/done'][index], index === 0 ? [['建立使用者註冊 API', 'Auth · Backend', 'API']] : []))); content.appendChild(columns);
  const track = auto('Scroll indicator', 'HORIZONTAL', { fill: 'border/strong', radius: 'radius/full' }); fixed(track, 208, 4); const thumb = figma.createRectangle(); thumb.name = 'Scroll thumb'; thumb.resize(88, 4); thumb.cornerRadius = 2; applyFill(thumb, 'bg/dark'); track.appendChild(thumb); content.appendChild(track); screen.appendChild(content); return screen;
}

function operationalStatesScreen(): FrameNode {
  const screen = auto('Board / Operational states / 1440×900', 'VERTICAL', { gap: 24, padding: [40], fill: 'bg/canvas' }); fixed(screen, 1440, 900);
  screen.appendChild(text('Title', 'BOARD / EMPTY · LOADING · ERROR · DELETE', 'Heading / H2'));
  const states = auto('State panels', 'HORIZONTAL', { gap: 20 });
  const empty = instance(localComponent('Empty State'), 'Empty State'); states.appendChild(empty);
  [['Loading', '正在同步看板…\n請保留目前頁面。'], ['Load error', '無法載入看板\n重新整理後再試一次。'], ['Move rejected', '伺服器已回復為\n最新欄位位置。'], ['Delete confirmation', '刪除「建立使用者註冊 API」？\n此動作無法復原。']].forEach(([name, body]) => { const panel = auto(name, 'VERTICAL', { gap: 16, padding: [24], fill: 'bg/surface', radius: 'radius/lg' }); fixed(panel, 280, 220); applyStroke(panel); panel.appendChild(text('Title', name, 'Heading / H3')); panel.appendChild(text('Body', body, 'Body / Medium', 'text/secondary')); if (name === 'Delete confirmation') panel.appendChild(instance(componentVariant('Button', 'Danger'), 'Button')); states.appendChild(panel); });
  screen.appendChild(states); return screen;
}

function deleteConfirmationScreen(): FrameNode {
  const canvas = auto('Delete Card Confirmation / Desktop / 1440×900', 'VERTICAL', { fill: 'bg/canvas' }); fixed(canvas, 1440, 900);
  const background = cardDetailScreen(); background.name = 'Card detail backdrop'; background.opacity = 0.35; canvas.appendChild(background); background.layoutPositioning = 'ABSOLUTE';
  const dialog = auto('Delete confirmation dialog', 'VERTICAL', { gap: 20, padding: [32], fill: 'bg/surface', radius: 'radius/xl' }); fixed(dialog, 480, 300); canvas.appendChild(dialog); dialog.layoutPositioning = 'ABSOLUTE'; dialog.x = 480; dialog.y = 300;
  dialog.appendChild(text('Title', '刪除這張卡片？', 'Heading / H2')); dialog.appendChild(text('Description', '「建立使用者註冊 API」及其活動紀錄將被永久刪除，無法復原。', 'Body / Medium', 'text/secondary'));
  const actions = auto('Actions', 'HORIZONTAL', { gap: 12 }); actions.appendChild(instance(componentVariant('Button', 'Outline'), 'Button')); actions.appendChild(instance(componentVariant('Button', 'Danger'), 'Button')); dialog.appendChild(actions);
  return canvas;
}

async function buildScreens(): Promise<FrameNode> {
  const generatedPageNames = [
    '03 · Auth · Login · Desktop', '04 · Auth · Login · Mobile', '05 · Auth · Signup · Desktop', '06 · Auth · Signup · Mobile',
    '07 · Workspace · Desktop', '08 · Workspace · Tablet', '09 · Workspace · Mobile', '10 · Board · Desktop',
    '11 · Board · Tablet', '12 · Board · Mobile', '13 · Create Card · Desktop', '14 · Create Card · Mobile',
    '15 · Card Detail · Desktop', '16 · Card Detail · Mobile', '17 · Board · Drag States', '18 · Board · System States',
  ];

  let targetPage = figma.root.children.find((page) => page.name === '03 · Screens');
  const migrationPage = figma.root.children.find((page) => page.name === '03 · Auth · Login · Desktop');
  if (!targetPage && migrationPage && migrationPage.children.every((child) => child.getPluginData(PLUGIN_KEY) === GENERATED_ROOT)) {
    migrationPage.children.forEach((child) => child.remove());
    migrationPage.name = '03 · Screens';
    targetPage = migrationPage;
  }

  for (const pageName of generatedPageNames) {
    const page = figma.root.children.find((candidate) => candidate.name === pageName);
    if (!page || page === targetPage) continue;
    page.children.filter((child) => child.getPluginData(PLUGIN_KEY) === GENERATED_ROOT).forEach((child) => child.remove());
    if (page.children.length === 0) page.remove();
  }

  const root = await preparePage('03 · Screens', 'Flowboard Screens');
  root.layoutMode = 'VERTICAL'; root.itemSpacing = 80; setPadding(root, 40); applyFill(root, 'bg/auth');
  root.appendChild(text('Title', 'Flowboard Screens', 'Heading / H1'));
  root.appendChild(text('Description', '每個 SVG 對應一個 Screen Frame；Desktop、Tablet、Mobile 在同一 Figma Page 依功能分區。', 'Body / Large', 'text/secondary'));

  const groups: Array<{ name: string; screens: Array<() => FrameNode> }> = [
    { name: 'Auth / Login', screens: [() => authScreen('Login'), () => mobileAuthScreen('Login')] },
    { name: 'Auth / Signup', screens: [() => authScreen('Signup'), () => mobileAuthScreen('Signup')] },
    { name: 'Workspace', screens: [workspaceScreen, workspaceTabletScreen, workspaceMobileScreen] },
    { name: 'Board', screens: [boardScreen, boardTabletScreen, mobileBoardScreen] },
    { name: 'Create Card', screens: [fullCreateCardDialog, responsiveDialogScreen] },
    { name: 'Card Detail', screens: [() => cardDetailScreen(false), () => cardDetailScreen(true)] },
    { name: 'Board States', screens: [dragStatesScreen, operationalStatesScreen] },
  ];

  for (const group of groups) {
    postStatus(`Creating ${group.name}…`);
    const section = auto(`Section / ${group.name}`, 'VERTICAL', { gap: 24 });
    section.appendChild(text('Section title', group.name, 'Heading / H2'));
    const row = auto(`Screens / ${group.name}`, 'HORIZONTAL', { gap: 48 });
    group.screens.forEach((create) => { const screen = create(); tag(screen, 'screen'); row.appendChild(screen); });
    section.appendChild(row); root.appendChild(section);
  }
  return root;
}

async function generate(action: GeneratorAction): Promise<void> {
  await ensureFonts();
  let result: FrameNode | undefined;
  if (action === 'all' || action === 'foundations') {
    postStatus('1/3 Creating foundations…');
    result = await buildFoundations();
  }
  if (action === 'all' || action === 'components') {
    postStatus(action === 'all' ? '2/3 Creating components…' : 'Creating components…');
    result = await buildComponents(action === 'all');
  }
  if (action === 'all' || action === 'screens') {
    postStatus(action === 'all' ? '3/3 Building screens…' : 'Building screens…');
    await hydrateComponentCache();
    if (!componentSets['Task Card']) await buildComponents();
    result = await buildScreens();
  }
  if (result) {
    await figma.setCurrentPageAsync(result.parent as PageNode);
    figma.viewport.scrollAndZoomIntoView([result]);
  }
  postStatus(`Completed: ${action === 'all' ? 'Foundations, Components and Screens' : action}.`);
  figma.notify('Flowboard native design is ready.', { timeout: 3000 });
}

figma.showUI(__html__, { width: 360, height: 330, title: 'Flowboard Design Generator' });

figma.ui.onmessage = async (message: { type: string; action?: GeneratorAction }) => {
  if (message.type !== 'generate' || !message.action) return;
  try {
    await generate(message.action);
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    postStatus(`Generation stopped: ${messageText}`);
    figma.notify(`Flowboard generator: ${messageText}`, { error: true, timeout: 6000 });
  }
};
