const PLUGIN_KEY = 'flowboard-generator';
const GENERATED_ROOT = 'flowboard-generated-root';
const FONT = { family: 'Noto Sans TC', style: 'Regular' } as FontName;
const FONT_MEDIUM = { family: 'Noto Sans TC', style: 'Medium' } as FontName;
const FONT_BOLD = { family: 'Noto Sans TC', style: 'Bold' } as FontName;
let resolvedFonts = { regular: FONT, medium: FONT_MEDIUM, bold: FONT_BOLD };

type GeneratorAction = 'all' | 'foundations' | 'components' | 'screens';
type Direction = 'HORIZONTAL' | 'VERTICAL';
type ColorMap = Record<string, string>;
type NotificationViewport = 'Desktop' | 'Mobile';
type NotificationState = 'Default' | 'Loading' | 'Empty' | 'Error';
type NotificationReadScope = 'Single' | 'All';
type NotificationReadState = 'Default' | 'Processing' | 'Complete' | 'Error';
type InvitationDetailState = 'Loading' | 'Pending' | 'Responding' | 'Accepted' | 'Declined' | 'Unavailable';
type WorkspaceProjectLayout = 'DesktopRecent' | 'DesktopGrid' | 'TabletRecent' | 'TabletGrid' | 'MobileRecent' | 'MobileGrid';
type WorkspaceProjectPreview = 'Columns' | 'Timeline' | 'Progress';

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
  'bg/dark-raised': '#44506A',
  'text/primary': '#29324A',
  'text/secondary': '#697287',
  'text/tertiary': '#8B95A8',
  'text/on-dark': '#F7F8FA',
  'text/on-dark-muted': '#BFC7D7',
  'border/default': '#D7DCE5',
  'border/strong': '#CDD3DE',
  'action/primary': '#DF6E51',
  'action/primary-hover': '#C4573E',
  'action/primary-soft': '#FCE5DF',
  'feedback/danger': '#B33B2E',
  'feedback/danger-soft': '#FCE8E5',
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

function icon(name: string, svgBody: string, size: number, colorName = 'text/secondary', viewBox = '0 0 24 24'): FrameNode {
  const svg = `<svg width="${size}" height="${size}" viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg">${svgBody.replaceAll('currentColor', colors[colorName])}</svg>`;
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
  button.description = 'shadcn-vue/Button · Horizontal Auto Layout · Hug contents · Padding 12px 20px';
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
  input.description = 'common/Input + common/FormField · Vertical Auto Layout · Label + control + helper text';
  input.layoutMode = 'VERTICAL';
  input.primaryAxisSizingMode = 'AUTO';
  input.counterAxisSizingMode = 'FIXED';
  input.itemSpacing = 8;
  input.resize(320, 100);
  input.fills = [];
  input.appendChild(text('Label', '電子郵件', 'Label / Medium'));
  const control = auto('Input control', 'HORIZONTAL', { padding: [14, 16], fill: 'bg/surface', radius: 'radius/md' });
  fixed(control, 320, 52);
  stretch(control);
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

type ProjectCardViewport = 'Desktop' | 'Tablet' | 'Mobile';
type ProjectCardState = 'Default' | 'Selected' | 'Expanded';
type ProjectStatus = 'Active' | 'OnHold' | 'Completed';
type ProjectMemberViewport = 'Desktop' | 'Mobile';
type ProjectMemberCandidateState = 'Available' | 'Selected' | 'Joined';
type ProjectAssignableRole = 'EDITOR' | 'VIEWER';
type ProjectAddMemberState = 'Default' | 'Loading' | 'Empty' | 'Error' | 'Processing';

const projectStatusDetails: Record<ProjectStatus, { label: string; color: string; soft: string }> = {
  Active: { label: '進行中', color: 'flow/active-strong', soft: 'flow/active-soft' },
  OnHold: { label: '暫停中', color: 'flow/review', soft: 'flow/review-soft' },
  Completed: { label: '已完成', color: 'flow/done', soft: 'flow/done-soft' },
};

function projectStatusBadge(status: ProjectStatus): FrameNode {
  const details = projectStatusDetails[status];
  const badge = auto('Status badge', 'HORIZONTAL', { gap: 8, padding: [3, 10], fill: details.soft, radius: 'radius/full' });
  const dot = figma.createEllipse();
  dot.name = 'Status dot';
  dot.resize(8, 8);
  applyFill(dot, details.color);
  badge.appendChild(dot);
  badge.appendChild(text('Status label', details.label, 'Label / Small', `category/${status === 'Active' ? 'mint' : status === 'OnHold' ? 'amber' : 'lavender'}`));
  return badge;
}

function projectMemberAvatar(initial: string, size = 32): InstanceNode | FrameNode {
  const avatar = instance(componentVariant('Avatar', `Size=${size}`), 'Project member avatar');
  overrideText(avatar, 'Initial', initial);
  return avatar;
}

function projectMemberRail(initials: string[], size = 32): FrameNode {
  const rail = auto('Member avatars', 'HORIZONTAL', { gap: 4 });
  initials.forEach((initial) => rail.appendChild(projectMemberAvatar(initial, size)));
  return rail;
}

function workspaceColumnsPreview(width: number, height: number): FrameNode {
  const preview = auto('Column summary', 'HORIZONTAL', { gap: 8 });
  fixed(preview, width, height);
  const columnWidth = (width - 24) / 4;
  const fills = ['action/primary-soft', 'flow/active-soft', 'flow/review-soft', 'flow/done-soft'];
  const accents = ['flow/ready', 'flow/active-strong', 'flow/review', 'flow/done'];
  fills.forEach((fillName, index) => {
    const column = auto(`Column ${index + 1}`, 'VERTICAL', { gap: 8, padding: [8], fill: fillName, radius: 'radius/sm' });
    fixed(column, columnWidth, height);
    const accent = figma.createRectangle();
    accent.name = 'Column accent';
    accent.resize(Math.max(columnWidth - 16, 8), 4);
    accent.cornerRadius = 2;
    applyFill(accent, accents[index]);
    const task = figma.createRectangle();
    task.name = 'Task preview';
    task.resize(Math.max(columnWidth - 16, 8), Math.max(height - 36 - (index % 2) * 8, 14));
    task.cornerRadius = 4;
    applyFill(task, 'bg/surface');
    column.appendChild(accent);
    column.appendChild(task);
    preview.appendChild(column);
  });
  return preview;
}

function workspaceTimelinePreview(width: number, labels = false): FrameNode {
  const preview = auto('Timeline summary', 'VERTICAL', { gap: 10 });
  fixed(preview, width, labels ? 54 : 28);
  const track = auto('Timeline track', 'HORIZONTAL');
  fixed(track, width, 16);
  const line = figma.createRectangle();
  line.name = 'Timeline line';
  line.resize(width - 16, 2);
  line.cornerRadius = 1;
  applyFill(line, 'border/strong');
  track.appendChild(line);
  line.layoutPositioning = 'ABSOLUTE';
  line.x = 8;
  line.y = 7;
  ['flow/ready', 'flow/active', 'flow/review', 'flow/done'].forEach((colorName, index) => {
    const dot = figma.createEllipse();
    dot.name = `Milestone ${index + 1}`;
    dot.resize(16, 16);
    applyFill(dot, colorName);
    track.appendChild(dot);
    dot.layoutPositioning = 'ABSOLUTE';
    dot.x = index * ((width - 16) / 3);
    dot.y = 0;
  });
  preview.appendChild(track);
  if (labels) {
    const labelRow = auto('Timeline labels', 'HORIZONTAL');
    fixed(labelRow, width, 18);
    labelRow.primaryAxisAlignItems = 'SPACE_BETWEEN';
    ['需求確認', '建置', '驗收', '上線'].forEach((label) => labelRow.appendChild(text('Milestone label', label, 'Label / Small', 'text/secondary')));
    preview.appendChild(labelRow);
  }
  return preview;
}

function workspaceProgressPreview(width: number): FrameNode {
  const preview = auto('Progress summary', 'VERTICAL', { gap: 8, padding: [12], fill: 'flow/done-soft', radius: 'radius/sm' });
  fixed(preview, width, 52);
  preview.appendChild(text('Progress label', '本週進度', 'Label / Small', 'text/secondary'));
  const track = auto('Progress track', 'HORIZONTAL', { fill: 'border/default', radius: 'radius/full' });
  fixed(track, width - 24, 6);
  const value = figma.createRectangle();
  value.name = 'Progress value';
  value.resize((width - 24) * 0.66, 6);
  value.cornerRadius = 3;
  applyFill(value, 'flow/done');
  track.appendChild(value);
  preview.appendChild(track);
  return preview;
}

function workspaceProjectPreviewVariant(layout: WorkspaceProjectLayout, previewType: WorkspaceProjectPreview): ComponentNode {
  const recent = layout.endsWith('Recent');
  const mobile = layout.startsWith('Mobile');
  const tablet = layout.startsWith('Tablet');
  const width = mobile ? 342 : tablet ? 352 : recent ? 552 : 352;
  const height = recent ? 132 : mobile ? 136 : tablet ? 180 : 212;
  const contentWidth = width - 40;
  const card = figma.createComponent();
  card.name = `Layout=${layout}, Preview=${previewType}`;
  card.description = 'Workspace overview project preview · recent or all-project summary · separate from Project Overview cards';
  card.layoutMode = 'VERTICAL';
  card.primaryAxisSizingMode = 'FIXED';
  card.counterAxisSizingMode = 'FIXED';
  card.itemSpacing = recent ? 12 : 10;
  fixed(card, width, height);
  setPadding(card, 18, 20, 16, 20);
  applyFill(card, 'bg/subtle');
  setRadius(card, 'radius/lg');
  card.effects = tokenStore.shadow?.effects ?? [{ type: 'DROP_SHADOW', color: { ...hex('#29324A'), a: 0.1 }, offset: { x: 0, y: 4 }, radius: 14, spread: 0, visible: true, blendMode: 'NORMAL' }];

  const accentColor = previewType === 'Columns' ? 'flow/ready' : previewType === 'Timeline' ? 'flow/active' : 'flow/done';
  if (recent || mobile) {
    const accent = figma.createRectangle();
    accent.name = 'Project accent';
    accent.resize(4, height);
    accent.cornerRadius = 2;
    applyFill(accent, accentColor);
    card.appendChild(accent);
    accent.layoutPositioning = 'ABSOLUTE';
    accent.x = 0;
    accent.y = 0;
  } else {
    const accent = auto('Project accent', 'HORIZONTAL');
    fixed(accent, width, 4);
    const accentColors = previewType === 'Columns'
      ? ['flow/ready', 'flow/active', 'flow/review', 'flow/done']
      : [accentColor];
    accentColors.forEach((colorName) => {
      const segment = figma.createRectangle();
      segment.name = 'Accent segment';
      segment.resize(width / accentColors.length, 4);
      applyFill(segment, colorName);
      accent.appendChild(segment);
    });
    card.appendChild(accent);
    accent.layoutPositioning = 'ABSOLUTE';
    accent.x = 0;
    accent.y = 0;
  }

  if (recent) {
    const body = auto('Project summary', 'HORIZONTAL', { gap: 16 });
    fixed(body, contentWidth, 66);
    body.primaryAxisAlignItems = 'SPACE_BETWEEN';
    const copy = auto('Project copy', 'VERTICAL', { gap: 4 });
    fixed(copy, mobile ? 196 : tablet ? 210 : 300, 62);
    copy.appendChild(text('Title', 'Flowboard 即時協作', 'Heading / H3'));
    copy.appendChild(text('Description', '主要看板 · WebSocket 練習', 'Body / Small', 'text/secondary'));
    body.appendChild(copy);
    const previewWidth = mobile ? 88 : tablet ? 96 : 184;
    body.appendChild(previewType === 'Timeline'
      ? workspaceTimelinePreview(previewWidth)
      : previewType === 'Progress'
        ? workspaceProgressPreview(previewWidth)
        : workspaceColumnsPreview(previewWidth, mobile ? 52 : 64));
    card.appendChild(body);
    const meta = auto('Recent metadata', 'HORIZONTAL', { gap: 12 });
    meta.appendChild(text('Meta', '9 張卡片 · 剛剛開啟', 'Body / Small', 'text/secondary'));
    card.appendChild(meta);
    return card;
  }

  card.appendChild(text('Title', 'Flowboard 即時協作', 'Heading / H3'));
  card.appendChild(text('Description', '主要看板 · WebSocket 練習', 'Body / Small', 'text/secondary'));
  const previewWidth = contentWidth;
  if (previewType === 'Timeline') card.appendChild(workspaceTimelinePreview(previewWidth, !mobile));
  else if (previewType === 'Progress') card.appendChild(workspaceProgressPreview(previewWidth));
  else card.appendChild(workspaceColumnsPreview(previewWidth, mobile ? 40 : tablet ? 40 : 48));
  if (!mobile) {
    const divider = figma.createRectangle();
    divider.name = 'Divider';
    divider.resize(contentWidth, 1);
    applyFill(divider, 'border/default');
    card.appendChild(divider);
  }
  card.appendChild(text('Meta', previewType === 'Timeline' ? '更新於昨天' : previewType === 'Progress' ? '更新於 8 月 18 日' : '更新於 5 分鐘前', 'Body / Small', 'text/secondary'));
  return card;
}

function projectOverviewCardVariant(viewport: ProjectCardViewport, state: ProjectCardState, status: ProjectStatus): ComponentNode {
  const mobile = viewport === 'Mobile';
  const tablet = viewport === 'Tablet';
  const compact = mobile || tablet;
  const expanded = compact && state === 'Expanded';
  const selected = state === 'Selected' || expanded;
  const cardWidth = mobile ? 342 : tablet ? 720 : 704;
  const compactContentWidth = cardWidth - (mobile ? 40 : 48);
  const card = figma.createComponent();
  card.name = `Viewport=${viewport}, State=${state}, Status=${status}`;
  card.description = compact
    ? `Project Card · ${viewport} · Collapsed cards use Project list data only; expanding loads member detail and reveals the board action`
    : 'Project Card · Desktop · Project status, description, main board preview and updated time';
  card.layoutMode = 'VERTICAL';
  card.primaryAxisSizingMode = 'FIXED';
  card.counterAxisSizingMode = 'FIXED';
  card.itemSpacing = compact ? 10 : 12;
  card.resize(cardWidth, compact ? (expanded ? (tablet ? 330 : 354) : (tablet ? 132 : 148)) : (selected ? 168 : 148));
  setPadding(card, mobile ? 18 : 20, mobile ? 20 : 24, mobile ? 14 : 20, mobile ? 20 : 24);
  applyFill(card, selected ? 'bg/surface' : 'bg/subtle');
  applyStroke(card, selected ? 'action/primary' : 'border/default', selected ? 2 : 1);
  setRadius(card, 'radius/lg');
  if (selected) {
    card.effects = tokenStore.shadow?.effects ?? [{ type: 'DROP_SHADOW', color: { ...hex('#29324A'), a: 0.1 }, offset: { x: 0, y: 4 }, radius: 14, spread: 0, visible: true, blendMode: 'NORMAL' }];
  }

  card.appendChild(projectStatusBadge(status));

  if (compact) {
    card.appendChild(text('Title', 'Flowboard 即時協作', 'Heading / H3'));
    card.appendChild(text('Description', 'Socket.IO 通知與多人 Kanban 協作。', 'Body / Small', 'text/secondary'));
    if (!expanded) {
      const footer = auto('Expand member details', 'HORIZONTAL', { gap: 8 });
      fixed(footer, compactContentWidth, 20);
      footer.primaryAxisAlignItems = 'SPACE_BETWEEN';
      footer.appendChild(text('Updated', '更新於昨天', 'Body / Small', 'text/secondary'));
      footer.appendChild(icon('Chevron down', '<path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>', 16, 'text/secondary'));
      card.appendChild(footer);
      return card;
    }

    const divider = figma.createRectangle();
    divider.name = 'Member detail divider';
    divider.resize(compactContentWidth, 1);
    applyFill(divider, 'border/default');
    card.appendChild(divider);
    card.appendChild(text('Member detail label', '專案成員 · 展開後載入', 'Label / Small', 'text/secondary'));
    const memberRows: Array<[string, string, string]> = [['J', 'Jeffery', '加入於 9 月 13 日'], ['M', 'Mina', '加入於 9 月 13 日'], ['A', 'Alex', '加入於 9 月 14 日'], ['L', 'Lena', '加入於 9 月 14 日']];
    const createMemberRow = ([initial, name, joinedAt]: [string, string, string], width: number) => {
      const row = auto(`Member / ${name}`, 'HORIZONTAL', { gap: 12 });
      fixed(row, width, 32);
      row.appendChild(projectMemberAvatar(initial, 32));
      const copy = auto('Member copy', 'VERTICAL', { gap: 0 });
      copy.appendChild(text('Display name', name, 'Label / Small'));
      copy.appendChild(text('Joined at', joinedAt, 'Body / Small', 'text/secondary'));
      row.appendChild(copy);
      return row;
    };
    if (tablet) {
      const grid = auto('Tablet member grid', 'HORIZONTAL', { gap: 24 });
      const left = auto('Member column 1', 'VERTICAL', { gap: 12 });
      const right = auto('Member column 2', 'VERTICAL', { gap: 12 });
      memberRows.slice(0, 2).forEach((member) => left.appendChild(createMemberRow(member, 324)));
      memberRows.slice(2).forEach((member) => right.appendChild(createMemberRow(member, 324)));
      grid.appendChild(left);
      grid.appendChild(right);
      card.appendChild(grid);
    } else {
      memberRows.forEach((member) => card.appendChild(createMemberRow(member, compactContentWidth)));
    }
    const actions = auto('Project actions', 'HORIZONTAL', { gap: 12 });
    fixed(actions, compactContentWidth, mobile ? 48 : 44);
    const actionWidth = (compactContentWidth - 12) / 2;
    actions.appendChild(projectOverviewAction('Outline', '管理成員', 'Manage members', actionWidth));
    actions.appendChild(projectOverviewAction('Primary', '進入看板', 'Enter board', actionWidth));
    card.appendChild(actions);
    return card;
  }

  const content = auto('Project content', 'HORIZONTAL', { gap: 16 });
  content.resize(656, 72);
  const copy = auto('Project copy', 'VERTICAL', { gap: 8 });
  fixed(copy, 500, 72);
  copy.appendChild(text('Title', 'Flowboard 即時協作', 'Heading / H3'));
  copy.appendChild(text('Description', 'Socket.IO 即時通知與多人 Kanban 協作練習。', 'Body / Small', 'text/secondary'));
  content.appendChild(copy);

  const preview = auto('Board preview', 'HORIZONTAL', { gap: 8, padding: [14], fill: 'bg/subtle', radius: 'radius/md' });
  fixed(preview, 120, 72);
  ['action/primary-soft', 'flow/active-soft', 'flow/review-soft', 'flow/done-soft'].forEach((colorName, index) => {
    const column = figma.createRectangle();
    column.name = `Board preview column ${index + 1}`;
    column.resize(18, index % 2 === 0 ? 44 : 32);
    column.cornerRadius = 5;
    applyFill(column, colorName);
    preview.appendChild(column);
  });
  content.appendChild(preview);
  card.appendChild(content);

  const meta = auto('Project metadata', 'HORIZONTAL', { gap: 8 });
  meta.appendChild(text('Board label', '主要看板', 'Body / Small', 'text/secondary'));
  meta.appendChild(text('Board name', '產品交付看板', 'Label / Medium'));
  meta.appendChild(text('Updated', '更新於 5 分鐘前', 'Body / Small', 'text/secondary'));
  card.appendChild(meta);
  return card;
}

function selectedProjectMembersComponent(): ComponentNode {
  const panel = figma.createComponent();
  panel.name = 'Selected Project Members';
  panel.description = 'Project overview master-detail panel · ProjectMember displayName, avatarUrl and joinedAt only';
  panel.layoutMode = 'VERTICAL';
  panel.primaryAxisSizingMode = 'FIXED';
  panel.counterAxisSizingMode = 'FIXED';
  panel.itemSpacing = 16;
  panel.resize(392, 516);
  setPadding(panel, 30, 24, 24, 24);
  applyFill(panel, 'bg/surface');
  setRadius(panel, 'radius/xl');
  panel.effects = tokenStore.shadow?.effects ?? [{ type: 'DROP_SHADOW', color: { ...hex('#29324A'), a: 0.1 }, offset: { x: 0, y: 4 }, radius: 14, spread: 0, visible: true, blendMode: 'NORMAL' }];

  const accent = figma.createRectangle();
  accent.name = 'Selection accent';
  accent.resize(344, 6);
  accent.cornerRadius = 3;
  applyFill(accent, 'action/primary');
  panel.insertChild(0, accent);

  panel.appendChild(text('Eyebrow', '已選取的專案', 'Label / Small', 'text/secondary'));
  panel.appendChild(text('Title', 'Flowboard 即時協作', 'Heading / H3'));
  panel.appendChild(text('Member count', '4 位成員', 'Body / Small', 'text/secondary'));
  panel.appendChild(text('Section label', '專案成員', 'Label / Small', 'text/secondary'));

  [['J', 'Jeffery', '加入於 9 月 13 日'], ['M', 'Mina', '加入於 9 月 13 日'], ['A', 'Alex', '加入於 9 月 14 日'], ['L', 'Lena', '加入於 9 月 14 日']].forEach(([initial, name, joinedAt]) => {
    const row = auto(`Member / ${name}`, 'HORIZONTAL', { gap: 16 });
    fixed(row, 344, 48);
    row.appendChild(projectMemberAvatar(initial, 40));
    const copy = auto('Member copy', 'VERTICAL', { gap: 2 });
    copy.appendChild(text('Display name', name, 'Label / Medium'));
    copy.appendChild(text('Joined at', joinedAt, 'Body / Small', 'text/secondary'));
    row.appendChild(copy);
    panel.appendChild(row);
  });

  const actions = auto('Project actions', 'HORIZONTAL', { gap: 8 });
  const manage = instance(componentVariant('Button', 'Outline'), 'Manage members');
  fixed(manage, 164, 44);
  overrideText(manage, 'Label', '管理成員');
  const enter = instance(componentVariant('Button', 'Primary'), 'Enter board');
  fixed(enter, 168, 44);
  overrideText(enter, 'Label', '進入看板');
  actions.appendChild(manage);
  actions.appendChild(enter);
  panel.appendChild(actions);
  return panel;
}

function dialogComponent(): ComponentNode {
  const dialog = figma.createComponent();
  dialog.name = 'Dialog';
  dialog.description = 'shadcn-vue/DialogContent · Vertical Auto Layout · Padding 32px · modal content container';
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

function workspaceInviteDialogComponent(mobile = false): ComponentNode {
  const width = mobile ? 358 : 520;
  const padding = mobile ? 24 : 32;
  const contentWidth = width - padding * 2;
  const dialog = figma.createComponent();
  dialog.name = `Workspace Invite Dialog / ${mobile ? 'Mobile' : 'Desktop'}`;
  dialog.description = 'shadcn-vue/DialogContent · common/Input · shadcn-vue/Button · Workspace invitation flow';
  dialog.layoutMode = 'VERTICAL';
  dialog.primaryAxisSizingMode = 'AUTO';
  dialog.counterAxisSizingMode = 'FIXED';
  dialog.itemSpacing = 20;
  dialog.resize(width, 480);
  setPadding(dialog, padding);
  applyFill(dialog, 'bg/surface');
  setRadius(dialog, 'radius/xl');
  dialog.effects = [{ type: 'DROP_SHADOW', color: { ...hex('#111827'), a: 0.2 }, offset: { x: 0, y: 16 }, radius: 24, spread: 0, visible: true, blendMode: 'NORMAL' }];

  const header = auto('Dialog header', 'VERTICAL', { gap: 8 });
  header.resize(contentWidth, 82);
  header.counterAxisSizingMode = 'FIXED';
  const titleRow = auto('Title row', 'HORIZONTAL');
  fixed(titleRow, contentWidth, 40);
  titleRow.primaryAxisAlignItems = 'SPACE_BETWEEN';
  titleRow.counterAxisAlignItems = 'CENTER';
  titleRow.appendChild(text('Title', '邀請工作區成員', 'Heading / H2'));
  const close = auto('Close button', 'HORIZONTAL', { fill: 'bg/subtle', radius: 'radius/md' });
  fixed(close, 40, 40);
  close.primaryAxisAlignItems = 'CENTER';
  close.counterAxisAlignItems = 'CENTER';
  close.appendChild(icon('Close icon', '<path d="M5 5l14 14M19 5 5 19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', 18));
  titleRow.appendChild(close);
  header.appendChild(titleRow);
  const description = text('Description', mobile
    ? '輸入已註冊的電子郵件，邀請會出現在對方的通知中心。'
    : '輸入已註冊 Flowboard 的電子郵件，邀請會出現在對方的通知中心。', 'Body / Medium', 'text/secondary');
  description.textAutoResize = 'HEIGHT';
  description.resize(contentWidth, 44);
  header.appendChild(description);
  dialog.appendChild(header);

  const workspace = auto('Workspace context', 'HORIZONTAL', { gap: 12, padding: [12], fill: 'bg/subtle', stroke: 'border/default', radius: 'radius/lg' });
  fixed(workspace, contentWidth, 76);
  workspace.counterAxisAlignItems = 'CENTER';
  const mark = auto('Workspace avatar', 'HORIZONTAL', { fill: 'action/primary', radius: 'radius/lg' });
  fixed(mark, 48, 48);
  mark.primaryAxisAlignItems = 'CENTER';
  mark.counterAxisAlignItems = 'CENTER';
  mark.appendChild(text('Workspace initial', '無', 'Heading / H3', 'text/on-dark'));
  workspace.appendChild(mark);
  const workspaceCopy = auto('Workspace copy', 'VERTICAL', { gap: 2 });
  workspaceCopy.appendChild(text('Workspace name', '無限有限公司', 'Label / Medium'));
  workspaceCopy.appendChild(text('Workspace hint', mobile ? '將以「成員」身分加入' : '邀請接受後才會加入成員列表', 'Body / Small', 'text/secondary'));
  workspace.appendChild(workspaceCopy);
  if (!mobile) {
    const role = auto('Role badge', 'HORIZONTAL', { padding: [6, 10], fill: 'action/primary-soft', radius: 'radius/full' });
    role.appendChild(text('Role', '成員 MEMBER', 'Label / Small', 'category/coral'));
    workspace.appendChild(role);
  }
  dialog.appendChild(workspace);

  const inputField = instance(componentVariant('Input', 'Focused'), 'Input');
  inputField.resize(contentWidth, 106);
  overrideText(inputField, 'Label', '電子郵件 *');
  overrideText(inputField, 'Value', 'member@example.com');
  overrideText(inputField, 'Helper', mobile ? '僅能邀請已註冊的 Flowboard 使用者。' : '目前僅能邀請已註冊的 Flowboard 使用者。');
  dialog.appendChild(inputField);

  const divider = figma.createRectangle();
  divider.name = 'Divider';
  divider.resize(contentWidth, 1);
  applyFill(divider, 'border/default');
  dialog.appendChild(divider);

  const actions = auto('Dialog footer', 'HORIZONTAL', { gap: 12 });
  fixed(actions, contentWidth, mobile ? 48 : 44);
  actions.primaryAxisAlignItems = 'MAX';
  const cancel = instance(componentVariant('Button', 'Outline'), 'Cancel button');
  const submit = instance(componentVariant('Button', 'Primary'), 'Submit button');
  overrideText(cancel, 'Label', '取消');
  overrideText(submit, 'Label', '傳送邀請');
  if (mobile) {
    fixed(cancel, 149, 48);
    fixed(submit, 149, 48);
  }
  actions.appendChild(cancel);
  actions.appendChild(submit);
  dialog.appendChild(actions);
  return dialog;
}

function projectMemberCandidateVariant(
  viewport: ProjectMemberViewport,
  state: ProjectMemberCandidateState,
): ComponentNode {
  const mobile = viewport === 'Mobile';
  const width = mobile ? 310 : 536;
  const row = figma.createComponent();
  row.name = `Viewport=${viewport}, State=${state}`;
  row.description = 'Workspace member candidate · selectable by workspaceMemberId · joined members are disabled';
  row.layoutMode = 'HORIZONTAL';
  row.primaryAxisSizingMode = 'FIXED';
  row.counterAxisSizingMode = 'FIXED';
  row.primaryAxisAlignItems = 'SPACE_BETWEEN';
  row.counterAxisAlignItems = 'CENTER';
  row.itemSpacing = 12;
  fixed(row, width, mobile ? 50 : 52);
  setPadding(row, mobile ? 8 : 6, 12);
  applyFill(row, state === 'Selected' ? 'action/primary-soft' : state === 'Joined' ? 'bg/subtle' : 'bg/surface');
  applyStroke(row, state === 'Selected' ? 'action/primary' : 'border/default', state === 'Selected' ? 2 : 1);
  setRadius(row, 'radius/md');
  if (state === 'Joined') row.opacity = 0.68;

  const identity = auto('Member identity', 'HORIZONTAL', { gap: 12 });
  identity.counterAxisAlignItems = 'CENTER';
  const avatar = instance(componentVariant('Avatar', mobile ? 'Size=32' : 'Size=40'), 'Member avatar');
  overrideText(avatar, 'Initial', state === 'Joined' ? 'J' : state === 'Selected' ? 'M' : 'A');
  identity.appendChild(avatar);
  const copy = auto('Member copy', 'VERTICAL', { gap: 1 });
  copy.appendChild(text('Display name', state === 'Joined' ? 'Jeffery' : state === 'Selected' ? 'Mina' : 'Alex', 'Label / Medium'));
  copy.appendChild(text('Member status', state === 'Joined' ? '已是專案成員 · OWNER' : '工作區成員', 'Body / Small', 'text/secondary'));
  identity.appendChild(copy);
  row.appendChild(identity);

  if (state === 'Joined') {
    const badge = auto('Joined badge', 'HORIZONTAL', { padding: [4, 8], fill: 'bg/canvas', radius: 'radius/full' });
    badge.appendChild(text('Joined label', '已加入', 'Label / Small', 'text/secondary'));
    row.appendChild(badge);
  } else {
    const control = auto('Selection control', 'HORIZONTAL', {
      fill: state === 'Selected' ? 'action/primary' : 'bg/surface',
      stroke: state === 'Selected' ? 'action/primary' : 'border/strong',
      radius: 'radius/full',
    });
    fixed(control, 24, 24);
    control.primaryAxisAlignItems = 'CENTER';
    control.counterAxisAlignItems = 'CENTER';
    if (state === 'Selected') control.appendChild(text('Selection check', '✓', 'Label / Small', 'text/on-dark'));
    row.appendChild(control);
  }
  return row;
}

function projectRoleOptionVariant(
  viewport: ProjectMemberViewport,
  role: ProjectAssignableRole,
  selected: boolean,
): ComponentNode {
  const mobile = viewport === 'Mobile';
  const option = figma.createComponent();
  option.name = `Viewport=${viewport}, Role=${role}, Selected=${selected ? 'True' : 'False'}`;
  option.description = 'Assignable project role option · OWNER is intentionally excluded';
  option.layoutMode = 'HORIZONTAL';
  option.primaryAxisSizingMode = 'FIXED';
  option.counterAxisSizingMode = 'FIXED';
  option.primaryAxisAlignItems = 'SPACE_BETWEEN';
  option.counterAxisAlignItems = 'CENTER';
  fixed(option, mobile ? 149 : 260, mobile ? 62 : 58);
  setPadding(option, 10, 12);
  applyFill(option, selected ? 'action/primary-soft' : 'bg/surface');
  applyStroke(option, selected ? 'action/primary' : 'border/default', selected ? 2 : 1);
  setRadius(option, 'radius/md');

  const copy = auto('Role copy', 'VERTICAL', { gap: 2 });
  copy.appendChild(text('Role label', role, 'Label / Medium'));
  copy.appendChild(text('Role description', role === 'EDITOR' ? '可編輯看板' : '僅能查看', 'Body / Small', 'text/secondary'));
  option.appendChild(copy);
  const radio = auto('Role radio', 'HORIZONTAL', {
    fill: selected ? 'action/primary' : 'bg/surface',
    stroke: selected ? 'action/primary' : 'border/strong',
    radius: 'radius/full',
  });
  fixed(radio, 20, 20);
  radio.primaryAxisAlignItems = 'CENTER';
  radio.counterAxisAlignItems = 'CENTER';
  if (selected) {
    const dot = figma.createEllipse();
    dot.name = 'Selected dot';
    dot.resize(8, 8);
    applyFill(dot, 'text/on-dark');
    radio.appendChild(dot);
  }
  option.appendChild(radio);
  return option;
}

function projectAddMemberSearch(width: number, state: ProjectAddMemberState): FrameNode {
  const search = auto('Member search', 'HORIZONTAL', { gap: 10, padding: [12, 14], fill: 'bg/surface', stroke: state === 'Error' ? 'feedback/danger' : 'border/default', radius: 'radius/md' });
  fixed(search, width, 46);
  search.counterAxisAlignItems = 'CENTER';
  search.appendChild(icon('Search icon', '<circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="m16 16 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', 18, 'text/secondary'));
  search.appendChild(text('Search value', state === 'Empty' ? '不存在的成員' : '搜尋工作區成員', 'Body / Medium', state === 'Empty' ? 'text/primary' : 'text/tertiary'));
  return search;
}

function projectMemberSkeleton(width: number): FrameNode {
  const row = auto('Candidate skeleton', 'HORIZONTAL', { gap: 12, padding: [8, 12], fill: 'bg/subtle', radius: 'radius/md' });
  fixed(row, width, 52);
  row.counterAxisAlignItems = 'CENTER';
  const avatar = figma.createEllipse(); avatar.name = 'Avatar skeleton'; avatar.resize(36, 36); applyFill(avatar, 'border/default'); row.appendChild(avatar);
  const copy = auto('Copy skeleton', 'VERTICAL', { gap: 6 });
  const title = figma.createRectangle(); title.name = 'Name skeleton'; title.resize(116, 10); title.cornerRadius = 5; applyFill(title, 'border/default');
  const meta = figma.createRectangle(); meta.name = 'Meta skeleton'; meta.resize(84, 8); meta.cornerRadius = 4; applyFill(meta, 'bg/canvas');
  copy.appendChild(title); copy.appendChild(meta); row.appendChild(copy);
  return row;
}

function projectAddMemberDialogVariant(
  viewport: ProjectMemberViewport,
  state: ProjectAddMemberState,
): ComponentNode {
  const mobile = viewport === 'Mobile';
  const width = mobile ? 358 : 600;
  const height = mobile ? 776 : 736;
  const padding = mobile ? 24 : 32;
  const contentWidth = width - padding * 2;
  const dialog = figma.createComponent();
  dialog.name = `Viewport=${viewport}, State=${state}`;
  dialog.description = 'Add project member · single selection from workspace members · submits workspaceMemberId with EDITOR or VIEWER';
  dialog.layoutMode = 'VERTICAL';
  dialog.primaryAxisSizingMode = 'FIXED';
  dialog.counterAxisSizingMode = 'FIXED';
  dialog.primaryAxisAlignItems = 'SPACE_BETWEEN';
  fixed(dialog, width, height);
  setPadding(dialog, padding);
  applyFill(dialog, 'bg/surface');
  setRadius(dialog, 'radius/xl');
  dialog.effects = [{ type: 'DROP_SHADOW', color: { ...hex('#111827'), a: 0.22 }, offset: { x: 0, y: 18 }, radius: 30, spread: 0, visible: true, blendMode: 'NORMAL' }];

  const header = auto('Dialog header', 'VERTICAL', { gap: 6 });
  fixed(header, contentWidth, mobile ? 66 : 64);
  const titleRow = auto('Title row', 'HORIZONTAL');
  fixed(titleRow, contentWidth, 34);
  titleRow.primaryAxisAlignItems = 'SPACE_BETWEEN';
  titleRow.counterAxisAlignItems = 'CENTER';
  titleRow.appendChild(text('Title', '新增專案成員', 'Heading / H2'));
  const close = auto('Close button', 'HORIZONTAL', { fill: 'bg/subtle', radius: 'radius/md' });
  fixed(close, 34, 34); close.primaryAxisAlignItems = 'CENTER'; close.counterAxisAlignItems = 'CENTER';
  close.appendChild(icon('Close icon', '<path d="M5 5l14 14M19 5 5 19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', 18));
  titleRow.appendChild(close); header.appendChild(titleRow);
  header.appendChild(text('Description', '從「Jeffery 的工作區」選擇成員加入此專案。', 'Body / Small', 'text/secondary'));
  dialog.appendChild(header);

  const context = auto('Project context', 'HORIZONTAL', { gap: 12, padding: [10, 12], fill: 'bg/subtle', stroke: 'border/default', radius: 'radius/lg' });
  fixed(context, contentWidth, mobile ? 58 : 64); context.counterAxisAlignItems = 'CENTER';
  const mark = auto('Project mark', 'HORIZONTAL', { fill: 'action/primary', radius: 'radius/md' });
  fixed(mark, 40, 40); mark.primaryAxisAlignItems = 'CENTER'; mark.counterAxisAlignItems = 'CENTER'; mark.appendChild(text('Project initial', 'F', 'Label / Medium', 'text/on-dark'));
  context.appendChild(mark);
  const contextCopy = auto('Project copy', 'VERTICAL', { gap: 2 });
  contextCopy.appendChild(text('Project name', 'Flowboard 即時協作', 'Label / Medium'));
  contextCopy.appendChild(text('Project hint', '目前 4 位專案成員', 'Body / Small', 'text/secondary'));
  context.appendChild(contextCopy); dialog.appendChild(context);

  const searchSection = auto('Search section', 'VERTICAL', { gap: 6 });
  searchSection.appendChild(text('Search label', '工作區成員', 'Label / Small', 'text/secondary'));
  searchSection.appendChild(projectAddMemberSearch(contentWidth, state));
  dialog.appendChild(searchSection);

  const body = auto('Dialog body', 'VERTICAL', { gap: 10 });
  fixed(body, contentWidth, mobile ? 400 : 366);
  if (state === 'Loading') {
    body.appendChild(text('Candidate label', '可加入成員', 'Label / Small', 'text/secondary'));
    [0, 1, 2, 3].forEach(() => body.appendChild(projectMemberSkeleton(contentWidth)));
    body.appendChild(text('Loading status', '正在載入工作區成員…', 'Body / Small', 'text/secondary'));
  } else if (state === 'Empty' || state === 'Error') {
    const panel = auto(`${state} state`, 'VERTICAL', { gap: 10, padding: [24], fill: state === 'Error' ? 'feedback/danger-soft' : 'bg/subtle', radius: 'radius/lg' });
    fixed(panel, contentWidth, mobile ? 250 : 220); panel.primaryAxisAlignItems = 'CENTER'; panel.counterAxisAlignItems = 'CENTER';
    panel.appendChild(text('State icon', state === 'Error' ? '!' : '⌕', 'Heading / H1', state === 'Error' ? 'feedback/danger' : 'text/secondary'));
    panel.appendChild(text('State title', state === 'Error' ? '無法載入成員' : '找不到符合的成員', 'Heading / H3'));
    panel.appendChild(text('State description', state === 'Error' ? '請檢查網路後重新嘗試。' : '請調整關鍵字，或確認對方已加入工作區。', 'Body / Small', 'text/secondary'));
    if (state === 'Error') {
      const retry = instance(componentVariant('Button', 'Outline'), 'Retry button'); overrideText(retry, 'Label', '重新載入'); panel.appendChild(retry);
    }
    body.appendChild(panel);
  } else {
    body.appendChild(text('Candidate label', '可加入成員', 'Label / Small', 'text/secondary'));
    const candidateStates: ProjectMemberCandidateState[] = ['Joined', 'Selected', 'Available', 'Joined'];
    candidateStates.forEach((candidateState, index) => {
      const candidate = instance(componentVariant('Project Member Candidate', `Viewport=${viewport}, State=${candidateState}`), `Candidate ${index + 1}`);
      if (index === 3) {
        overrideText(candidate, 'Initial', 'L'); overrideText(candidate, 'Display name', 'Lena'); overrideText(candidate, 'Member status', '已是專案成員 · EDITOR');
      }
      if (state === 'Processing') candidate.opacity = 0.62;
      body.appendChild(candidate);
    });
    body.appendChild(text('Role section label', '專案角色', 'Label / Small', 'text/secondary'));
    const roles = auto('Project roles', 'HORIZONTAL', { gap: 12 });
    (['EDITOR', 'VIEWER'] as const).forEach((role) => roles.appendChild(instance(componentVariant('Project Role Option', `Viewport=${viewport}, Role=${role}, Selected=${role === 'EDITOR' ? 'True' : 'False'}`), `${role} role`)));
    if (state === 'Processing') roles.opacity = 0.62;
    body.appendChild(roles);
  }
  dialog.appendChild(body);

  const footer = auto('Dialog footer', 'HORIZONTAL', { gap: 12 });
  fixed(footer, contentWidth, mobile ? 48 : 44); footer.primaryAxisAlignItems = 'MAX';
  const cancel = instance(componentVariant('Button', 'Outline'), 'Cancel button'); overrideText(cancel, 'Label', '取消');
  const submit = instance(componentVariant('Button', 'Primary'), 'Submit button'); overrideText(submit, 'Label', state === 'Processing' ? '新增中…' : '新增成員');
  if (mobile) { fixed(cancel, 149, 48); fixed(submit, 149, 48); }
  if (state === 'Loading' || state === 'Empty' || state === 'Error' || state === 'Processing') submit.opacity = 0.5;
  footer.appendChild(cancel); footer.appendChild(submit); dialog.appendChild(footer);
  return dialog;
}

function notificationTriggerVariant(state: 'Default' | 'Unread' | 'Open'): ComponentNode {
  const trigger = figma.createComponent();
  trigger.name = `State=${state}`;
  trigger.description = 'shadcn-vue/DropdownMenuTrigger · Badge · 40×40 notification control';
  trigger.resize(40, 40);
  trigger.layoutMode = 'NONE';
  applyFill(trigger, state === 'Open' ? 'bg/subtle' : 'bg/dark');
  setRadius(trigger, 'radius/md');
  const bell = icon(
    'Bell icon',
    '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    20,
    state === 'Open' ? 'text/primary' : 'text/on-dark',
  );
  bell.x = 10;
  bell.y = 10;
  trigger.appendChild(bell);
  if (state !== 'Default') {
    const badge = auto('Unread badge', 'HORIZONTAL', { fill: 'action/primary', radius: 'radius/full' });
    fixed(badge, 18, 18);
    badge.primaryAxisAlignItems = 'CENTER';
    badge.counterAxisAlignItems = 'CENTER';
    badge.appendChild(text('Count', '2', 'Label / Small', 'text/on-dark'));
    badge.x = 24;
    badge.y = -4;
    trigger.appendChild(badge);
  }
  return trigger;
}

function notificationReadActionVariant(
  viewport: NotificationViewport,
  scope: NotificationReadScope,
  state: NotificationReadState,
): ComponentNode {
  const mobile = viewport === 'Mobile';
  const compact = scope === 'Single';
  const width = compact ? (mobile ? 44 : 40) : (mobile ? 138 : 132);
  const height = compact ? (mobile ? 44 : 40) : 32;
  const action = figma.createComponent();
  action.name = `Viewport=${viewport}, Scope=${scope}, State=${state}`;
  action.description = compact
    ? 'Notification single read action · aria-label: 標記為已讀 · Desktop tooltip / Mobile 44px touch target'
    : 'Notification bulk read action · aria-live completion feedback · disabled while processing';
  action.layoutMode = 'HORIZONTAL';
  action.primaryAxisAlignItems = 'CENTER';
  action.counterAxisAlignItems = 'CENTER';
  action.itemSpacing = 6;
  fixed(action, width, height);
  setPadding(action, compact ? 8 : 6, compact ? 8 : 10);
  setRadius(action, 'radius/md');

  const tone = state === 'Complete'
    ? 'category/mint'
    : state === 'Error'
      ? 'feedback/danger'
      : 'text/secondary';
  const background = state === 'Complete'
    ? 'category/mint-soft'
    : state === 'Error'
      ? 'feedback/danger-soft'
      : 'bg/surface';
  applyFill(action, background);
  applyStroke(action, state === 'Error' ? 'feedback/danger' : 'border/default');
  if (state === 'Processing') action.opacity = 0.58;

  const iconBody = state === 'Processing'
    ? '<path d="M12 3a9 9 0 1 0 9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
    : state === 'Error'
      ? '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7v6M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
      : '<path d="m2 8 4 4L14 4M10 12l2 2 6-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
  const iconViewBox = state === 'Processing' || state === 'Error' ? '0 0 24 24' : '0 0 20 20';
  action.appendChild(icon('Read action icon', iconBody, compact ? 18 : 16, tone, iconViewBox));

  if (!compact) {
    const label = state === 'Processing'
      ? '處理中'
      : state === 'Complete'
        ? '已全部讀取'
        : state === 'Error'
          ? scope === 'All' ? '全部設為已讀' : '再試一次'
          : '全部設為已讀';
    action.appendChild(text('Action label', label, 'Label / Small', tone === 'text/secondary' ? 'text/primary' : tone));
  }
  return action;
}

function notificationItemVariant(viewport: NotificationViewport, state: 'Unread' | 'Read'): ComponentNode {
  const mobile = viewport === 'Mobile';
  const width = mobile ? 326 : 368;
  const height = state === 'Unread' ? (mobile ? 142 : 132) : (mobile ? 116 : 108);
  const actionWidth = mobile ? 44 : 40;
  const item = figma.createComponent();
  item.name = `Viewport=${viewport}, State=${state}`;
  item.description = 'Notification item · content action and read action are independent targets · Type routes the content action only';
  item.layoutMode = 'HORIZONTAL';
  item.itemSpacing = 12;
  item.counterAxisAlignItems = 'MIN';
  fixed(item, width, height);
  setPadding(item, 14);
  applyFill(item, state === 'Unread' ? 'action/primary-soft' : 'bg/surface');
  applyStroke(item, state === 'Unread' ? 'action/primary' : 'border/default');
  setRadius(item, 'radius/lg');

  const contentWidth = width - 28 - (state === 'Unread' ? actionWidth + 12 : 0);
  const contentAction = auto('Content action · opens domain UI', 'HORIZONTAL', { gap: 12 });
  fixed(contentAction, contentWidth, height - 28);
  contentAction.counterAxisAlignItems = 'MIN';

  const avatar = auto('Actor avatar', 'HORIZONTAL', { fill: state === 'Unread' ? 'action/primary' : 'flow/active', radius: 'radius/full' });
  fixed(avatar, 40, 40);
  avatar.primaryAxisAlignItems = 'CENTER';
  avatar.counterAxisAlignItems = 'CENTER';
  avatar.appendChild(text('Actor initial', state === 'Unread' ? 'J' : 'M', 'Label / Medium', state === 'Unread' ? 'text/on-dark' : 'text/primary'));
  contentAction.appendChild(avatar);

  const copyWidth = contentWidth - 40 - 24 - 20;
  const copy = auto('Notification copy', 'VERTICAL', { gap: 6 });
  fixed(copy, copyWidth, height - 28);
  const eyebrow = text('Type label', state === 'Unread' ? '工作區邀請' : '工作區動態', 'Label / Small', state === 'Unread' ? 'category/coral' : 'text/secondary');
  copy.appendChild(eyebrow);
  const titleNode = text('Notification title', state === 'Unread'
    ? 'Mia 邀請你加入「產品開發中心」'
    : 'Flowboard 即時協作有 2 項更新', 'Label / Medium');
  titleNode.textAutoResize = 'HEIGHT';
  titleNode.resize(copyWidth, state === 'Unread' ? 42 : 22);
  copy.appendChild(titleNode);
  if (state === 'Unread') {
    const body = text('Notification body', '點擊查看邀請內容與回覆選項', 'Body / Small', 'text/secondary');
    body.textAutoResize = 'HEIGHT';
    body.resize(copyWidth, 36);
    copy.appendChild(body);
  }
  copy.appendChild(text('Created at', state === 'Unread' ? '5 分鐘前' : '昨天 · 已讀', 'Body / Small', 'text/secondary'));
  contentAction.appendChild(copy);
  contentAction.appendChild(icon('Open content chevron', '<path d="m9 18 6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>', 20, 'text/tertiary'));
  item.appendChild(contentAction);

  if (state === 'Unread') {
    const readAction = instance(
      componentVariant('Notification Read Action', `Viewport=${viewport}, Scope=Single, State=Default`),
      'Mark as read action',
    );
    fixed(readAction, actionWidth, actionWidth);
    item.appendChild(readAction);
    readAction.layoutPositioning = 'ABSOLUTE';
    readAction.x = width - actionWidth - 14;
    readAction.y = 14;

    const dot = figma.createEllipse();
    dot.name = 'Unread indicator';
    dot.resize(8, 8);
    applyFill(dot, 'action/primary');
    item.appendChild(dot);
    dot.layoutPositioning = 'ABSOLUTE';
    dot.x = width - actionWidth - 28;
    dot.y = 18;
  }
  return item;
}

function responseAction(
  style: 'Primary' | 'Outline',
  label: string,
  width: number,
  height: number,
  disabled = false,
): InstanceNode | FrameNode {
  const action = instance(componentVariant('Button', style), `${label} button`);
  overrideText(action, 'Label', label);
  fixed(action, width, height);
  if (disabled) action.opacity = 0.5;
  return action;
}

function workspaceInvitationDetailDialogVariant(
  viewport: NotificationViewport,
  state: InvitationDetailState,
): ComponentNode {
  const mobile = viewport === 'Mobile';
  const width = mobile ? 358 : 520;
  const height = mobile ? 570 : 456;
  const contentWidth = width - 48;
  const response = figma.createComponent();
  response.name = `Viewport=${viewport}, State=${state}`;
  response.description = 'Workspace Invitation Detail Dialog · loaded by notificationId · domain response state is independent from Notification read state';
  response.layoutMode = 'VERTICAL';
  response.primaryAxisAlignItems = 'SPACE_BETWEEN';
  response.itemSpacing = mobile ? 16 : 14;
  fixed(response, width, height);
  setPadding(response, 24);
  applyFill(response, 'bg/surface');
  applyStroke(response, 'border/default');
  setRadius(response, 'radius/xl');
  response.effects = [{ type: 'DROP_SHADOW', color: { ...hex('#29324A'), a: 0.2 }, offset: { x: 0, y: 16 }, radius: 32, spread: 0, visible: true, blendMode: 'NORMAL' }];

  const accent = figma.createRectangle();
  accent.name = 'Dialog accent';
  accent.resize(width, 6);
  applyFill(accent, 'action/primary');
  response.appendChild(accent);
  accent.layoutPositioning = 'ABSOLUTE';
  accent.x = 0;
  accent.y = 0;

  const header = auto('Invitation header', 'HORIZONTAL', { gap: 12 });
  fixed(header, contentWidth, 48);
  header.primaryAxisAlignItems = 'SPACE_BETWEEN';
  header.counterAxisAlignItems = 'CENTER';
  const identity = auto('Inviter identity', 'HORIZONTAL', { gap: 12 });
  identity.counterAxisAlignItems = 'CENTER';
  const avatar = auto('Inviter avatar', 'HORIZONTAL', {
    fill: state === 'Accepted' ? 'category/mint-soft' : state === 'Declined' ? 'bg/subtle' : state === 'Unavailable' ? 'flow/review-soft' : 'action/primary-soft',
    radius: 'radius/full',
  });
  fixed(avatar, 40, 40);
  avatar.primaryAxisAlignItems = 'CENTER';
  avatar.counterAxisAlignItems = 'CENTER';
  if (state === 'Accepted') {
    avatar.appendChild(icon('Accepted icon', '<path d="m5 12 4 4L19 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>', 20, 'category/mint'));
  } else if (state === 'Declined') {
    avatar.appendChild(icon('Declined icon', '<path d="m7 7 10 10M17 7 7 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', 20, 'text/secondary'));
  } else if (state === 'Unavailable') {
    avatar.appendChild(icon('Unavailable icon', '<path d="M12 9v4M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M10.3 3.7 2.4 17.4A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.6L13.7 3.7a2 2 0 0 0-3.4 0Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>', 20, 'category/amber'));
  } else if (state === 'Loading') {
    avatar.appendChild(icon('Loading icon', '<path d="M12 3a9 9 0 1 0 9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', 20, 'category/coral'));
  } else {
    avatar.appendChild(text('Inviter initial', 'M', 'Label / Medium', 'category/coral'));
  }
  identity.appendChild(avatar);
  const heading = auto('Dialog heading', 'VERTICAL', { gap: 2 });
  heading.appendChild(text('Dialog title', state === 'Accepted' ? '邀請已接受' : state === 'Declined' ? '邀請已婉拒' : state === 'Unavailable' ? '這則邀請已無法回覆' : '工作區邀請', 'Heading / H3', state === 'Accepted' ? 'category/mint' : 'text/primary'));
  heading.appendChild(text('Dialog subtitle', state === 'Loading' ? '正在載入邀請內容' : state === 'Responding' ? '正在處理' : state === 'Pending' ? '等待你的回覆' : '已完成回覆', 'Body / Small', 'text/secondary'));
  identity.appendChild(heading);
  header.appendChild(identity);
  header.appendChild(icon('Close dialog', '<path d="m7 7 10 10M17 7 7 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', mobile ? 24 : 20, 'text/secondary'));
  response.appendChild(header);

  const cardFill = state === 'Accepted' ? 'flow/active-soft' : state === 'Unavailable' ? 'flow/review-soft' : state === 'Declined' ? 'bg/subtle' : 'action/primary-soft';
  const detailCard = auto('Invitation detail card', 'VERTICAL', { gap: 10, padding: [18], fill: cardFill, radius: 'radius/lg' });
  fixed(detailCard, contentWidth, mobile ? 210 : 188);
  if (state === 'Loading') {
    [contentWidth - 72, contentWidth - 136, contentWidth - 104].forEach((skeletonWidth, index) => {
      const skeleton = figma.createRectangle(); skeleton.name = `Detail skeleton ${index + 1}`; skeleton.resize(skeletonWidth, index === 0 ? 18 : 12); skeleton.cornerRadius = 6; applyFill(skeleton, 'border/default'); detailCard.appendChild(skeleton);
    });
  } else {
    detailCard.appendChild(text('Invitation actor', state === 'Accepted' ? '你已加入' : state === 'Declined' ? '你已婉拒加入' : state === 'Responding' ? '正在接受邀請' : state === 'Unavailable' ? '通知歷史紀錄' : 'Mia 邀請你加入', 'Body / Small', 'text/secondary'));
    detailCard.appendChild(text('Workspace name', '產品開發中心', 'Heading / H3'));
    const detailCopy = state === 'Accepted' ? '工作區已加入你的列表。' : state === 'Declined' ? '這則邀請不再提供回覆操作。' : state === 'Responding' ? '請稍候，不需要重複操作。' : state === 'Unavailable' ? '邀請可能已過期或被取消，不再提供接受或婉拒操作。' : '加入後可查看工作區內的專案，並以成員身分參與協作。';
    const detail = text('Invitation detail', detailCopy, 'Body / Small', 'text/secondary'); detail.textAutoResize = 'HEIGHT'; detail.resize(contentWidth - 36, mobile ? 56 : 40); detailCard.appendChild(detail);
    if (state === 'Pending') detailCard.appendChild(text('Invitation meta', '成員 · 7 天後到期', 'Body / Small', 'text/tertiary'));
  }
  response.appendChild(detailCard);

  const divider = figma.createRectangle();
  divider.name = 'Action divider';
  divider.resize(contentWidth, 1);
  applyFill(divider, 'border/default');
  response.appendChild(divider);

  const actionHeight = mobile ? 48 : 44;
  if (state === 'Accepted') {
    response.appendChild(responseAction('Primary', '前往工作區', contentWidth, actionHeight));
  } else if (state === 'Declined') {
    response.appendChild(responseAction('Outline', '關閉', contentWidth, actionHeight));
  } else if (state === 'Unavailable') {
    response.appendChild(responseAction('Outline', '關閉', contentWidth, actionHeight));
  } else if (state === 'Loading') {
    response.appendChild(responseAction('Outline', '載入中', contentWidth, actionHeight, true));
  } else {
    const actions = auto('Invitation actions', mobile ? 'VERTICAL' : 'HORIZONTAL', { gap: mobile ? 12 : 10 });
    const actionWidth = mobile ? contentWidth : (contentWidth - 10) / 2;
    const accept = responseAction('Primary', state === 'Responding' ? '接受中' : '接受邀請', actionWidth, actionHeight, state === 'Responding');
    const decline = responseAction('Outline', '婉拒', actionWidth, actionHeight, state === 'Responding');
    if (mobile) {
      actions.appendChild(accept);
      actions.appendChild(decline);
    } else {
      actions.appendChild(decline);
      actions.appendChild(accept);
    }
    response.appendChild(actions);
  }
  return response;
}

function notificationSkeletonRow(width: number, index: number): FrameNode {
  const row = auto(`Notification skeleton ${index + 1}`, 'HORIZONTAL', { gap: 12, padding: [14], fill: 'bg/subtle', radius: 'radius/lg' });
  fixed(row, width, 76);
  const avatar = figma.createEllipse();
  avatar.name = 'Avatar skeleton';
  avatar.resize(40, 40);
  applyFill(avatar, 'border/default');
  row.appendChild(avatar);
  const lines = auto('Text skeletons', 'VERTICAL', { gap: 8 });
  const first = figma.createRectangle(); first.name = 'Title skeleton'; first.resize(width - 110, 12); first.cornerRadius = 6; applyFill(first, 'border/default');
  const second = figma.createRectangle(); second.name = 'Body skeleton'; second.resize(width - (index === 1 ? 170 : 140), 10); second.cornerRadius = 5; applyFill(second, 'border/strong');
  lines.appendChild(first); lines.appendChild(second); row.appendChild(lines);
  return row;
}

function notificationDropdownVariant(viewport: NotificationViewport, state: NotificationState): ComponentNode {
  const mobile = viewport === 'Mobile';
  const width = mobile ? 358 : 400;
  const contentWidth = width - 32;
  const height = state === 'Default' ? (mobile ? 532 : 510) : 350;
  const menu = figma.createComponent();
  menu.name = `Viewport=${viewport}, State=${state}`;
  menu.description = 'shadcn-vue/DropdownMenuContent + ScrollArea · Notification read model';
  menu.layoutMode = 'VERTICAL';
  menu.itemSpacing = 12;
  fixed(menu, width, height);
  setPadding(menu, 16);
  applyFill(menu, 'bg/surface');
  applyStroke(menu);
  setRadius(menu, 'radius/xl');
  menu.effects = [{ type: 'DROP_SHADOW', color: { ...hex('#29324A'), a: 0.18 }, offset: { x: 0, y: 12 }, radius: 24, spread: 0, visible: true, blendMode: 'NORMAL' }];

  const header = auto('Notification header', 'HORIZONTAL');
  fixed(header, contentWidth, 32);
  header.primaryAxisAlignItems = 'SPACE_BETWEEN';
  header.counterAxisAlignItems = 'CENTER';
  header.appendChild(text('Title', '通知', 'Heading / H3'));
  if (state === 'Default') {
    const headerActions = auto('Notification header actions', 'HORIZONTAL', { gap: 8 });
    headerActions.counterAxisAlignItems = 'CENTER';
    const count = auto('Unread count', 'HORIZONTAL', { padding: [5, 10], fill: 'action/primary-soft', radius: 'radius/full' });
    count.appendChild(text('Count label', '2 則未讀', 'Label / Small', 'category/coral'));
    headerActions.appendChild(count);
    headerActions.appendChild(instance(
      componentVariant('Notification Read Action', `Viewport=${viewport}, Scope=All, State=Default`),
      'Mark all as read action',
    ));
    header.appendChild(headerActions);
  } else {
    header.appendChild(text('State label', state === 'Loading' ? '載入中' : state === 'Empty' ? '0 則未讀' : '暫時無法顯示', 'Body / Small', 'text/secondary'));
  }
  menu.appendChild(header);
  const divider = figma.createRectangle(); divider.name = 'Divider'; divider.resize(contentWidth, 1); applyFill(divider, 'border/default'); menu.appendChild(divider);

  if (state === 'Default') {
    const list = auto('Notification list', 'VERTICAL', { gap: 8 });
    const unread = instance(componentVariant('Notification Item', `Viewport=${viewport}, State=Unread`), 'Unread notification');
    const read = instance(componentVariant('Notification Item', `Viewport=${viewport}, State=Read`), 'Read notification');
    list.appendChild(unread);
    list.appendChild(read);
    menu.appendChild(list);
    menu.appendChild(text('Pagination hint', '目前顯示最近通知', 'Body / Small', 'text/tertiary'));
    return menu;
  }

  if (state === 'Loading') {
    const loading = auto('Loading notifications', 'VERTICAL', { gap: 8 });
    [0, 1, 2].forEach((index) => loading.appendChild(notificationSkeletonRow(contentWidth, index)));
    menu.appendChild(loading);
    return menu;
  }

  const message = auto(`Notification ${state.toLowerCase()} state`, 'VERTICAL', { gap: 10, padding: [28, 20] });
  fixed(message, contentWidth, 244);
  message.primaryAxisAlignItems = 'CENTER';
  message.counterAxisAlignItems = 'CENTER';
  const iconBox = auto('State icon', 'HORIZONTAL', { fill: state === 'Error' ? 'feedback/danger-soft' : 'bg/subtle', radius: 'radius/full' });
  fixed(iconBox, 52, 52);
  iconBox.primaryAxisAlignItems = 'CENTER';
  iconBox.counterAxisAlignItems = 'CENTER';
  iconBox.appendChild(icon(
    state === 'Error' ? 'Error icon' : 'Empty bell icon',
    state === 'Error'
      ? '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7v6M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
      : '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    24,
    state === 'Error' ? 'feedback/danger' : 'text/secondary',
  ));
  message.appendChild(iconBox);
  message.appendChild(text('State title', state === 'Error' ? '通知載入失敗' : '還沒有通知', 'Heading / H3'));
  message.appendChild(text('State description', state === 'Error' ? '請稍後再試一次。' : '有新的工作區邀請時會顯示在這裡。', 'Body / Small', 'text/secondary'));
  if (state === 'Error') {
    const retry = instance(componentVariant('Button', 'Primary'), 'Retry button');
    overrideText(retry, 'Label', '重新載入');
    message.appendChild(retry);
  }
  menu.appendChild(message);
  return menu;
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
  const columns = variants.length >= 12 ? 4 : variants.length >= 6 ? 3 : Math.max(variants.length, 1);
  const columnWidth = Math.max(...variants.map((variant) => variant.width)) + 24;
  const rowHeight = Math.max(...variants.map((variant) => variant.height)) + 24;
  variants.forEach((variant, index) => {
    variant.x = (index % columns) * columnWidth;
    variant.y = Math.floor(index / columns) * rowHeight;
  });
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

  const projectMemberCandidateRow = auto('Project Member Candidate', 'HORIZONTAL', { gap: 24 });
  root.appendChild(projectMemberCandidateRow);
  componentSets['Project Member Candidate'] = componentSet(
    'Project Member Candidate',
    (['Desktop', 'Mobile'] as const).flatMap((viewport) =>
      (['Available', 'Selected', 'Joined'] as const).map((state) => projectMemberCandidateVariant(viewport, state)),
    ),
    projectMemberCandidateRow,
  );

  const projectRoleOptionRow = auto('Project Role Option', 'HORIZONTAL', { gap: 24 });
  root.appendChild(projectRoleOptionRow);
  componentSets['Project Role Option'] = componentSet(
    'Project Role Option',
    (['Desktop', 'Mobile'] as const).flatMap((viewport) =>
      (['EDITOR', 'VIEWER'] as const).flatMap((role) =>
        [true, false].map((selected) => projectRoleOptionVariant(viewport, role, selected)),
      ),
    ),
    projectRoleOptionRow,
  );

  const projectAddMemberDialogRow = auto('Project Add Member Dialog', 'HORIZONTAL', { gap: 24 });
  root.appendChild(projectAddMemberDialogRow);
  componentSets['Project Add Member Dialog'] = componentSet(
    'Project Add Member Dialog',
    (['Desktop', 'Mobile'] as const).flatMap((viewport) =>
      (['Default', 'Loading', 'Empty', 'Error', 'Processing'] as const).map((state) => projectAddMemberDialogVariant(viewport, state)),
    ),
    projectAddMemberDialogRow,
  );

  const notificationTriggerRow = auto('Notification Trigger', 'HORIZONTAL', { gap: 24 });
  root.appendChild(notificationTriggerRow);
  componentSets['Notification Trigger'] = componentSet(
    'Notification Trigger',
    (['Default', 'Unread', 'Open'] as const).map(notificationTriggerVariant),
    notificationTriggerRow,
  );

  const notificationReadActionRow = auto('Notification Read Action', 'HORIZONTAL', { gap: 24 });
  root.appendChild(notificationReadActionRow);
  componentSets['Notification Read Action'] = componentSet(
    'Notification Read Action',
    (['Desktop', 'Mobile'] as const).flatMap((viewport) =>
      (['Single', 'All'] as const).flatMap((scope) =>
        (['Default', 'Processing', 'Complete', 'Error'] as const).map((state) =>
          notificationReadActionVariant(viewport, scope, state),
        ),
      ),
    ),
    notificationReadActionRow,
  );

  const notificationItemRow = auto('Notification Item', 'HORIZONTAL', { gap: 24 });
  root.appendChild(notificationItemRow);
  componentSets['Notification Item'] = componentSet(
    'Notification Item',
    (['Desktop', 'Mobile'] as const).flatMap((viewport) =>
      (['Unread', 'Read'] as const).map((state) => notificationItemVariant(viewport, state)),
    ),
    notificationItemRow,
  );

  const invitationDetailRow = auto('Workspace Invitation Detail Dialog', 'HORIZONTAL', { gap: 24 });
  root.appendChild(invitationDetailRow);
  componentSets['Workspace Invitation Detail Dialog'] = componentSet(
    'Workspace Invitation Detail Dialog',
    (['Desktop', 'Mobile'] as const).flatMap((viewport) =>
      (['Loading', 'Pending', 'Responding', 'Accepted', 'Declined', 'Unavailable'] as const).map((state) =>
        workspaceInvitationDetailDialogVariant(viewport, state),
      ),
    ),
    invitationDetailRow,
  );

  const notificationDropdownRow = auto('Notification Dropdown', 'HORIZONTAL', { gap: 24 });
  root.appendChild(notificationDropdownRow);
  componentSets['Notification Dropdown'] = componentSet(
    'Notification Dropdown',
    (['Desktop', 'Mobile'] as const).flatMap((viewport) =>
      (['Default', 'Loading', 'Empty', 'Error'] as const).map((state) => notificationDropdownVariant(viewport, state)),
    ),
    notificationDropdownRow,
  );

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

  const projectCardRow = auto('Project Card', 'HORIZONTAL', { gap: 24 });
  root.appendChild(projectCardRow);
  componentSets['Project Card'] = componentSet(
    'Project Card',
    (['Desktop', 'Tablet', 'Mobile'] as const).flatMap((viewport) => {
      const states: readonly ProjectCardState[] = viewport === 'Desktop'
        ? ['Default', 'Selected']
        : ['Default', 'Expanded'];
      return states.flatMap((state) =>
        (['Active', 'OnHold', 'Completed'] as const).map((status) => projectOverviewCardVariant(viewport, state, status)),
      );
    }),
    projectCardRow,
  );

  const core = auto('Core components', 'HORIZONTAL', { gap: 48 });
  root.appendChild(core);
  [
    boardColumnComponent(),
    selectedProjectMembersComponent(),
    dialogComponent(),
    workspaceInviteDialogComponent(),
    workspaceInviteDialogComponent(true),
    emptyStateComponent(),
  ].forEach((component) => {
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
  if (componentSets.Button && componentSets['Task Card'] && componentSets['Project Card'] && componentSets['Project Member Candidate'] && componentSets['Project Role Option'] && componentSets['Project Add Member Dialog'] && componentSets['Notification Read Action'] && componentSets['Notification Dropdown'] && componentSets['Workspace Invitation Detail Dialog'] && standaloneComponents['Selected Project Members']) return;
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
  const notification = instance(componentVariant('Notification Trigger', 'State=Unread'), 'Notification trigger');
  const avatar = instance(componentVariant('Avatar', 'Size=32'), 'Avatar');
  actions.appendChild(plus); actions.appendChild(notification); actions.appendChild(avatar);
  header.appendChild(brand); header.appendChild(nav); header.appendChild(actions);
  return header;
}

function workspaceOverviewSidebar(): FrameNode {
  const sidebar = auto('Workspace overview sidebar', 'VERTICAL', { padding: [32, 16, 24, 16], fill: 'bg/canvas' });
  fixed(sidebar, 256, 844);
  sidebar.primaryAxisAlignItems = 'SPACE_BETWEEN';

  const upper = auto('Workspace navigation', 'VERTICAL', { gap: 16 });
  fixed(upper, 224, 420);
  upper.appendChild(text('Workspace label', '你的工作區', 'Label / Small', 'text/secondary'));
  const workspace = auto('Selected workspace', 'HORIZONTAL', { gap: 12, padding: [10, 12], fill: 'bg/dark', radius: 'radius/lg' });
  fixed(workspace, 224, 56);
  workspace.counterAxisAlignItems = 'CENTER';
  const logo = auto('Workspace avatar', 'HORIZONTAL', { fill: 'action/primary', radius: 'radius/md' });
  fixed(logo, 40, 40);
  logo.primaryAxisAlignItems = 'CENTER';
  logo.counterAxisAlignItems = 'CENTER';
  logo.appendChild(text('Initial', 'J', 'Label / Medium', 'text/on-dark'));
  const labels = auto('Workspace labels', 'VERTICAL', { gap: 2 });
  labels.appendChild(text('Workspace name', 'Jeffery 的工作區', 'Label / Medium', 'text/on-dark'));
  labels.appendChild(text('Workspace meta', '擁有者 · 3 個專案', 'Body / Small', 'text/on-dark-muted'));
  workspace.appendChild(logo);
  workspace.appendChild(labels);
  upper.appendChild(workspace);

  const createWorkspace = auto('Create workspace', 'HORIZONTAL', { gap: 12, padding: [10, 12], fill: 'bg/surface', stroke: 'border/default', radius: 'radius/md' });
  fixed(createWorkspace, 224, 44);
  createWorkspace.counterAxisAlignItems = 'CENTER';
  createWorkspace.appendChild(icon('Plus icon', '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', 18));
  createWorkspace.appendChild(text('Label', '新增工作區', 'Body / Medium'));
  upper.appendChild(createWorkspace);

  const divider = figma.createRectangle();
  divider.name = 'Sidebar divider';
  divider.resize(224, 1);
  applyFill(divider, 'border/strong');
  upper.appendChild(divider);
  upper.appendChild(text('Management label', '工作區管理', 'Label / Small', 'text/secondary'));
  const management = auto('Management links', 'VERTICAL', { gap: 4 });
  const rows: Array<[string, string, string]> = [
    ['Members', '成員', '5'],
    ['Archive', '已封存專案', '1'],
  ];
  rows.forEach(([name, label, count]) => {
    const row = auto(`Management / ${name}`, 'HORIZONTAL', { gap: 12, padding: [9, 4] });
    fixed(row, 224, 36);
    row.counterAxisAlignItems = 'CENTER';
    row.appendChild(icon(`${name} icon`, name === 'Members'
      ? '<circle cx="9" cy="8" r="3" stroke="currentColor" stroke-width="2"/><path d="M3 20c0-4 2.5-6 6-6s6 2 6 6M17 7c2 0 4 1.5 4 4M17 14c2.5 0 4 2 4 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
      : '<path d="M3 6h18v14H3zM2 3h20v4H2zM9 12h6" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>', 18));
    const labelNode = text('Label', label, 'Body / Medium');
    labelNode.resize(164, 22);
    row.appendChild(labelNode);
    row.appendChild(text('Count', count, 'Body / Small', 'text/secondary'));
    management.appendChild(row);
  });
  upper.appendChild(management);
  sidebar.appendChild(upper);

  const members = auto('Workspace members', 'VERTICAL', { gap: 12 });
  members.appendChild(text('Members label', '工作區成員', 'Label / Small', 'text/secondary'));
  members.appendChild(projectMemberRail(['J', 'M', 'A', '+2'], 32));
  members.appendChild(text('Members hint', '5 位成員正在一起推進工作', 'Body / Small', 'text/secondary'));
  sidebar.appendChild(members);
  return sidebar;
}

function workspaceProjectCard(
  layout: WorkspaceProjectLayout,
  preview: WorkspaceProjectPreview,
  titleValue: string,
  description: string,
  meta: string,
): InstanceNode | FrameNode {
  const card = instance(componentVariant('Workspace Project Preview', `Layout=${layout}, Preview=${preview}`), 'Workspace Project Preview');
  overrideText(card, 'Title', titleValue);
  overrideText(card, 'Description', description);
  overrideText(card, 'Meta', meta);
  return card;
}

function workspacePrimaryAction(width: number): InstanceNode | FrameNode {
  const action = instance(componentVariant('Button', 'Primary'), 'Create project');
  fixed(action, width, 48);
  overrideText(action, 'Label', '新增專案');
  return action;
}

function workspaceSelector(width: number): FrameNode {
  const selector = auto('Current workspace switcher', 'HORIZONTAL', { gap: 12, padding: [10, 12], fill: 'bg/subtle', stroke: 'border/default', radius: 'radius/lg' });
  fixed(selector, width, 56);
  selector.counterAxisAlignItems = 'CENTER';
  const avatar = auto('Workspace avatar', 'HORIZONTAL', { fill: 'action/primary', radius: 'radius/md' });
  fixed(avatar, 32, 32);
  avatar.primaryAxisAlignItems = 'CENTER';
  avatar.counterAxisAlignItems = 'CENTER';
  avatar.appendChild(text('Initial', 'J', 'Label / Medium', 'text/on-dark'));
  selector.appendChild(avatar);
  const copy = auto('Workspace copy', 'VERTICAL', { gap: 2 });
  const copyWidth = width - 100;
  fixed(copy, copyWidth, 38);
  copy.appendChild(text('Workspace name', 'Jeffery 的工作區', 'Label / Medium'));
  copy.appendChild(text('Workspace meta', '3 個專案 · 5 位成員', 'Body / Small', 'text/secondary'));
  selector.appendChild(copy);
  selector.appendChild(icon('Chevron down', '<path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>', 20));
  return selector;
}

function workspaceCompactHeader(width: 768 | 390): FrameNode {
  const mobile = width === 390;
  const header = auto('Workspace header', 'HORIZONTAL', { padding: [12, mobile ? 20 : 24], fill: 'bg/dark' });
  fixed(header, width, 64);
  header.primaryAxisAlignItems = 'SPACE_BETWEEN';
  header.counterAxisAlignItems = 'CENTER';
  const brand = auto('Brand', 'HORIZONTAL', { gap: 12 });
  brand.counterAxisAlignItems = 'CENTER';
  if (mobile) {
    const menu = auto('Menu button', 'HORIZONTAL', { fill: 'bg/dark-raised', radius: 'radius/md' });
    fixed(menu, 40, 40);
    menu.primaryAxisAlignItems = 'CENTER';
    menu.counterAxisAlignItems = 'CENTER';
    menu.appendChild(icon('Menu icon', '<path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', 20, 'text/on-dark'));
    brand.appendChild(menu);
  }
  const mark = auto('Logo mark', 'HORIZONTAL', { gap: 6 });
  const coral = figma.createRectangle(); coral.resize(18, 24); coral.cornerRadius = 4; applyFill(coral, 'action/primary');
  const mint = figma.createRectangle(); mint.resize(18, 16); mint.cornerRadius = 4; applyFill(mint, 'flow/active');
  mark.appendChild(coral); mark.appendChild(mint); brand.appendChild(mark);
  brand.appendChild(text('Wordmark', 'Flowboard', mobile ? 'Heading / H2' : 'Heading / H3', 'text/on-dark'));
  const actions = auto('Header actions', 'HORIZONTAL', { gap: 16 });
  actions.counterAxisAlignItems = 'CENTER';
  const plus = auto('Create project shortcut', 'HORIZONTAL', { fill: 'bg/dark-raised', radius: 'radius/md' });
  fixed(plus, 40, 40);
  plus.primaryAxisAlignItems = 'CENTER';
  plus.counterAxisAlignItems = 'CENTER';
  plus.appendChild(icon('Plus icon', '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', 22, 'text/on-dark'));
  actions.appendChild(plus);
  actions.appendChild(instance(componentVariant('Avatar', 'Size=32'), 'Avatar'));
  header.appendChild(brand);
  header.appendChild(actions);
  return header;
}

function workspaceCreateProjectTile(): FrameNode {
  const tile = auto('Create new project', 'VERTICAL', { gap: 10, fill: 'bg/canvas', stroke: 'text/tertiary', radius: 'radius/lg' });
  fixed(tile, 352, 180);
  tile.primaryAxisAlignItems = 'CENTER';
  tile.counterAxisAlignItems = 'CENTER';
  tile.dashPattern = [8, 8];
  const plus = auto('Create icon', 'HORIZONTAL', { fill: 'bg/subtle', radius: 'radius-full' });
  fixed(plus, 48, 48);
  plus.primaryAxisAlignItems = 'CENTER';
  plus.counterAxisAlignItems = 'CENTER';
  plus.appendChild(icon('Plus icon', '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', 20));
  tile.appendChild(plus);
  tile.appendChild(text('Title', '建立新的專案', 'Label / Medium'));
  tile.appendChild(text('Description', '從主要看板與四個預設欄位開始', 'Body / Small', 'text/secondary'));
  return tile;
}

function workspaceScreen(): FrameNode {
  const screen = auto('Workspace / Desktop / 1440×900', 'VERTICAL', { fill: 'bg/canvas' });
  fixed(screen, 1440, 900);
  setRadius(screen, 'radius/xl');
  screen.appendChild(appHeader());
  const shell = auto('App shell', 'HORIZONTAL');
  fixed(shell, 1440, 844);
  shell.appendChild(workspaceOverviewSidebar());
  const main = auto('Main content', 'VERTICAL', { gap: 24, padding: [40, 32], fill: 'bg/canvas' });
  fixed(main, 1184, 844);
  const pageHeader = auto('Page header', 'HORIZONTAL');
  pageHeader.primaryAxisAlignItems = 'SPACE_BETWEEN';
  fixed(pageHeader, 1120, 84);
  const heading = auto('Heading', 'VERTICAL', { gap: 8 });
  heading.appendChild(text('Eyebrow', '工作區', 'Label / Small', 'text/secondary'));
  heading.appendChild(text('Title', 'Jeffery 的工作區', 'Heading / H1'));
  heading.appendChild(text('Description', '集中查看所有專案，選一個進入主要看板。', 'Body / Medium', 'text/secondary'));
  pageHeader.appendChild(heading);
  pageHeader.appendChild(workspacePrimaryAction(200));
  main.appendChild(pageHeader);
  const recentSection = auto('Recent section', 'VERTICAL', { gap: 12 });
  const recentHeading = auto('Recent heading', 'HORIZONTAL');
  fixed(recentHeading, 1120, 28);
  recentHeading.primaryAxisAlignItems = 'SPACE_BETWEEN';
  recentHeading.appendChild(text('Section title', '最近開啟', 'Heading / H3'));
  recentHeading.appendChild(text('View all', '查看全部', 'Body / Small', 'action/primary-hover'));
  recentSection.appendChild(recentHeading);
  const recent = auto('Recent projects', 'HORIZONTAL', { gap: 16 });
  recent.appendChild(workspaceProjectCard('DesktopRecent', 'Columns', 'Flowboard 即時協作', '主要看板 · WebSocket 練習', '9 張卡片 · 剛剛開啟'));
  recent.appendChild(workspaceProjectCard('DesktopRecent', 'Timeline', '發佈自動化', '主要看板 · CI/CD 與部署檢查', '14 張卡片 · 昨天開啟'));
  recentSection.appendChild(recent);
  main.appendChild(recentSection);

  const allSection = auto('All projects section', 'VERTICAL', { gap: 12 });
  const allHeading = auto('All projects heading', 'VERTICAL', { gap: 2 });
  allHeading.appendChild(text('Section title', '所有專案', 'Heading / H3'));
  allHeading.appendChild(text('Section meta', '3 個專案 · 依最近更新排序', 'Body / Small', 'text/secondary'));
  allSection.appendChild(allHeading);
  const projects = auto('Project grid', 'HORIZONTAL', { gap: 16 });
  projects.appendChild(workspaceProjectCard('DesktopGrid', 'Columns', 'Flowboard 即時協作', '主要看板 · WebSocket 練習', '更新於 5 分鐘前'));
  projects.appendChild(workspaceProjectCard('DesktopGrid', 'Timeline', '發佈自動化', '主要看板 · CI/CD 與部署檢查', '更新於昨天'));
  projects.appendChild(workspaceProjectCard('DesktopGrid', 'Progress', '技術成長計畫', '主要看板 · .NET、AWS、系統設計', '更新於 8 月 18 日'));
  allSection.appendChild(projects);
  allSection.appendChild(text('Archived projects', '已封存 1 個專案　›', 'Body / Small', 'text/secondary'));
  main.appendChild(allSection);
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
  const screen = auto('Workspace / Tablet / 768×1024', 'VERTICAL', { fill: 'bg/canvas' });
  fixed(screen, 768, 1024);
  screen.clipsContent = true;
  screen.appendChild(workspaceCompactHeader(768));
  const content = auto('Workspace tablet content', 'VERTICAL', { gap: 20, padding: [32, 24], fill: 'bg/canvas' });
  fixed(content, 768, 960);
  const context = auto('Workspace context', 'VERTICAL', { gap: 8 });
  context.appendChild(text('Eyebrow', '目前工作區', 'Label / Small', 'text/secondary'));
  context.appendChild(workspaceSelector(720));
  content.appendChild(context);

  const pageHeader = auto('Page heading', 'HORIZONTAL');
  fixed(pageHeader, 720, 72);
  pageHeader.primaryAxisAlignItems = 'SPACE_BETWEEN';
  pageHeader.counterAxisAlignItems = 'CENTER';
  const heading = auto('Heading copy', 'VERTICAL', { gap: 4 });
  heading.appendChild(text('Title', '所有專案都在這裡', 'Heading / H1'));
  heading.appendChild(text('Description', '選一個專案，進入主要看板繼續推進。', 'Body / Medium', 'text/secondary'));
  pageHeader.appendChild(heading);
  pageHeader.appendChild(workspacePrimaryAction(184));
  content.appendChild(pageHeader);

  const recentSection = auto('Recent section', 'VERTICAL', { gap: 12 });
  recentSection.appendChild(text('Section title', '最近開啟', 'Heading / H3'));
  const recent = auto('Recent projects', 'HORIZONTAL', { gap: 16 });
  recent.appendChild(workspaceProjectCard('TabletRecent', 'Columns', 'Flowboard 即時協作', '主要看板 · WebSocket 練習', '9 張卡片 · 剛剛'));
  recent.appendChild(workspaceProjectCard('TabletRecent', 'Timeline', '發佈自動化', '主要看板 · CI/CD 與部署檢查', '14 張卡片 · 昨天'));
  recentSection.appendChild(recent);
  content.appendChild(recentSection);

  const allSection = auto('All projects section', 'VERTICAL', { gap: 12 });
  const allHeading = auto('All projects heading', 'VERTICAL', { gap: 2 });
  allHeading.appendChild(text('Section title', '所有專案', 'Heading / H3'));
  allHeading.appendChild(text('Sort label', '依最近更新排序', 'Body / Small', 'text/secondary'));
  allSection.appendChild(allHeading);
  const projectRows = auto('Project rows', 'VERTICAL', { gap: 16 });
  const firstRow = auto('Project row 1', 'HORIZONTAL', { gap: 16 });
  firstRow.appendChild(workspaceProjectCard('TabletGrid', 'Columns', 'Flowboard 即時協作', '主要看板 · WebSocket 練習', '更新於 5 分鐘前'));
  firstRow.appendChild(workspaceProjectCard('TabletGrid', 'Timeline', '發佈自動化', '主要看板 · CI/CD 與部署檢查', '更新於昨天'));
  const secondRow = auto('Project row 2', 'HORIZONTAL', { gap: 16 });
  secondRow.appendChild(workspaceProjectCard('TabletGrid', 'Progress', '技術成長計畫', '主要看板 · .NET、AWS、系統設計', '更新於 8 月 18 日'));
  secondRow.appendChild(workspaceCreateProjectTile());
  projectRows.appendChild(firstRow);
  projectRows.appendChild(secondRow);
  allSection.appendChild(projectRows);
  content.appendChild(allSection);
  screen.appendChild(content);
  return screen;
}

function workspaceProjectOverviewTabletScreen(): FrameNode {
  const screen = auto('Workspace Project Overview / Tablet / 768×1024', 'VERTICAL', { fill: 'bg/canvas' });
  fixed(screen, 768, 1024);
  screen.clipsContent = true;
  screen.appendChild(workspaceCompactHeader(768));

  const content = auto('Workspace project overview tablet content', 'VERTICAL', { gap: 20, padding: [32, 24], fill: 'bg/canvas' });
  fixed(content, 768, 960);
  const context = auto('Workspace context', 'VERTICAL', { gap: 8 });
  context.appendChild(text('Eyebrow', '目前工作區', 'Label / Small', 'text/secondary'));
  context.appendChild(workspaceSelector(720));
  content.appendChild(context);

  const pageHeader = auto('Page heading', 'HORIZONTAL');
  fixed(pageHeader, 720, 72);
  pageHeader.primaryAxisAlignItems = 'SPACE_BETWEEN';
  pageHeader.counterAxisAlignItems = 'CENTER';
  const heading = auto('Heading copy', 'VERTICAL', { gap: 6 });
  heading.appendChild(text('Title', '專案中心', 'Heading / H1'));
  heading.appendChild(text('Description', '選取專案查看成員；進入主要看板是獨立操作。', 'Body / Small', 'text/secondary'));
  pageHeader.appendChild(heading);
  pageHeader.appendChild(projectOverviewAction('Primary', '新增專案', 'Create project', 216));
  content.appendChild(pageHeader);

  const toolbar = auto('Tablet project toolbar', 'VERTICAL', { gap: 8, padding: [12, 16], fill: 'bg/subtle', stroke: 'border/default', radius: 'radius/lg' });
  fixed(toolbar, 720, 100);
  const toolbarRow = auto('Toolbar controls', 'HORIZONTAL', { gap: 8 });
  const search = auto('Search projects', 'HORIZONTAL', { gap: 12, padding: [10, 14], fill: 'bg/surface', stroke: 'border/default', radius: 'radius/md' });
  fixed(search, 300, 40);
  search.appendChild(icon('Search icon', '<circle cx="10" cy="10" r="6" stroke="currentColor" stroke-width="2"/><path d="m15 15 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', 16));
  search.appendChild(text('Placeholder', '搜尋專案', 'Body / Medium', 'text/tertiary'));
  toolbarRow.appendChild(search);
  toolbarRow.appendChild(projectOverviewStatusTab('全部', '3', true));
  toolbarRow.appendChild(projectOverviewStatusTab('進行中', '', false, 'flow/active-strong'));
  toolbarRow.appendChild(projectOverviewStatusTab('暫停', '', false, 'flow/review'));
  toolbarRow.appendChild(projectOverviewStatusTab('完成', '', false, 'flow/done'));
  toolbar.appendChild(toolbarRow);
  toolbar.appendChild(text('Sort label', '依最近更新排序 · 展開後才載入 Project members', 'Body / Small', 'text/secondary'));
  content.appendChild(toolbar);

  const list = auto('Tablet project list', 'VERTICAL', { gap: 16 });
  const listHeader = auto('Tablet list header', 'HORIZONTAL');
  fixed(listHeader, 720, 28);
  listHeader.primaryAxisAlignItems = 'SPACE_BETWEEN';
  listHeader.appendChild(text('List title', '所有專案', 'Heading / H3'));
  listHeader.appendChild(text('Selection hint', '選取專案即可查看成員', 'Body / Small', 'text/secondary'));
  list.appendChild(listHeader);
  list.appendChild(projectOverviewCard('Tablet', 'Expanded', 'Active', 'Flowboard 即時協作', 'Socket.IO 通知與多人 Kanban 協作。'));
  list.appendChild(projectOverviewCard('Tablet', 'Default', 'OnHold', '發佈自動化', 'CI/CD、部署檢查與環境穩定性追蹤。'));
  content.appendChild(list);
  screen.appendChild(content);
  return screen;
}

function workspaceMobileScreen(): FrameNode {
  const screen = auto('Workspace / Mobile / 390×844', 'VERTICAL', { fill: 'bg/canvas' });
  fixed(screen, 390, 844);
  screen.clipsContent = true;
  screen.appendChild(workspaceCompactHeader(390));
  const content = auto('Workspace mobile content', 'VERTICAL', { gap: 16, padding: [24], fill: 'bg/canvas' });
  fixed(content, 390, 780);
  const context = auto('Workspace context', 'VERTICAL', { gap: 8 });
  context.appendChild(text('Eyebrow', '目前工作區', 'Label / Small', 'text/secondary'));
  context.appendChild(workspaceSelector(342));
  content.appendChild(context);
  const heading = auto('Page heading', 'VERTICAL', { gap: 4 });
  heading.appendChild(text('Title', '選一個專案繼續', 'Heading / H1'));
  heading.appendChild(text('Description', '所有專案都集中在這個工作區。', 'Body / Small', 'text/secondary'));
  content.appendChild(heading);
  content.appendChild(workspacePrimaryAction(342));

  const recentSection = auto('Recent section', 'VERTICAL', { gap: 12 });
  recentSection.appendChild(text('Section title', '最近開啟', 'Heading / H3'));
  recentSection.appendChild(workspaceProjectCard('MobileRecent', 'Columns', 'Flowboard 即時協作', '主要看板 · WebSocket 練習', '9 張卡片 · 剛剛開啟'));
  content.appendChild(recentSection);

  const allSection = auto('All projects section', 'VERTICAL', { gap: 12 });
  const allHeading = auto('All projects heading', 'HORIZONTAL');
  fixed(allHeading, 342, 28);
  allHeading.primaryAxisAlignItems = 'SPACE_BETWEEN';
  allHeading.appendChild(text('Section title', '所有專案', 'Heading / H3'));
  allHeading.appendChild(text('Sort label', '最近更新', 'Body / Small', 'text/secondary'));
  allSection.appendChild(allHeading);
  allSection.appendChild(workspaceProjectCard('MobileGrid', 'Timeline', '發佈自動化', '主要看板 · CI/CD 與部署檢查', '14 張卡片'));
  allSection.appendChild(workspaceProjectCard('MobileGrid', 'Progress', '技術成長計畫', '主要看板 · .NET、AWS、系統設計', '本週進度'));
  content.appendChild(allSection);
  screen.appendChild(content);
  return screen;
}

function projectOverviewCard(viewport: ProjectCardViewport, state: ProjectCardState, status: ProjectStatus, titleValue: string, description: string): InstanceNode | FrameNode {
  const card = instance(componentVariant('Project Card', `Viewport=${viewport}, State=${state}, Status=${status}`), 'Project Card');
  overrideText(card, 'Title', titleValue);
  overrideText(card, 'Description', description);
  return card;
}

function projectOverviewSidebar(): FrameNode {
  const sidebar = auto('Project overview sidebar', 'VERTICAL', { gap: 24, padding: [24, 16], fill: 'bg/auth' });
  fixed(sidebar, 256, 844);

  sidebar.appendChild(text('Workspace label', '你的工作區', 'Label / Small', 'text/secondary'));
  const workspace = auto('Workspace context', 'HORIZONTAL', { gap: 12, padding: [12], fill: 'bg/dark', radius: 'radius/lg' });
  fixed(workspace, 224, 56);
  const workspaceAvatar = auto('Workspace avatar', 'HORIZONTAL', { padding: [8], fill: 'action/primary', radius: 'radius/md' });
  fixed(workspaceAvatar, 32, 32);
  workspaceAvatar.appendChild(text('Initial', 'J', 'Label / Medium', 'text/on-dark'));
  workspace.appendChild(workspaceAvatar);
  const workspaceCopy = auto('Workspace copy', 'VERTICAL', { gap: 2 });
  workspaceCopy.appendChild(text('Workspace name', 'Jeffery 的工作區', 'Label / Medium', 'text/on-dark'));
  workspaceCopy.appendChild(text('Workspace meta', '擁有者 · 3 個專案', 'Body / Small', 'text/on-dark-muted'));
  workspace.appendChild(workspaceCopy);
  sidebar.appendChild(workspace);

  const createWorkspace = auto('Create workspace', 'HORIZONTAL', { gap: 12, padding: [10, 12], fill: 'bg/surface', radius: 'radius/md' });
  fixed(createWorkspace, 224, 44);
  createWorkspace.appendChild(icon('Plus icon', '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', 16));
  createWorkspace.appendChild(text('Label', '新增工作區', 'Body / Medium'));
  sidebar.appendChild(createWorkspace);

  sidebar.appendChild(text('Workspace management', '工作區管理', 'Label / Small', 'text/secondary'));
  const navigation = auto('Workspace navigation', 'VERTICAL', { gap: 4 });
  const navItems: Array<[string, string, string]> = [
    ['Projects icon', '專案', '3'],
    ['Members icon', '工作區成員', '5'],
    ['Archive icon', '已封存專案', '1'],
  ];
  navItems.forEach(([iconName, label, count], index) => {
    const item = auto(`Navigation / ${label}`, 'HORIZONTAL', { gap: 12, padding: [10, 12], fill: index === 0 ? 'bg/surface' : 'bg/auth', radius: 'radius/md' });
    fixed(item, 224, 40);
    const iconBody = iconName === 'Projects icon'
      ? '<path d="M3 7h6l2 2h10v10H3z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'
      : iconName === 'Members icon'
        ? '<circle cx="9" cy="8" r="3" stroke="currentColor" stroke-width="2"/><path d="M3 20c0-4 2.5-6 6-6s6 2 6 6M17 7c2 0 4 1.5 4 4M17 14c2.5 0 4 2 4 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
        : '<path d="M3 6h18v14H3zM2 3h20v4H2zM9 12h6" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>';
    item.appendChild(icon(iconName, iconBody, 16, index === 0 ? 'text/primary' : 'text/secondary'));
    item.appendChild(text('Label', label, 'Body / Medium', index === 0 ? 'text/primary' : 'text/secondary'));
    item.appendChild(text('Count', count, 'Body / Small', 'text/secondary'));
    navigation.appendChild(item);
  });
  sidebar.appendChild(navigation);

  const membersSection = auto('Workspace members', 'VERTICAL', { gap: 12 });
  membersSection.appendChild(text('Members label', '工作區成員', 'Label / Small', 'text/secondary'));
  membersSection.appendChild(projectMemberRail(['J', 'M', 'A', 'L', '+1'], 32));
  membersSection.appendChild(text('Members hint', '5 位成員，可分配到不同專案', 'Body / Small', 'text/secondary'));
  sidebar.appendChild(membersSection);
  return sidebar;
}

function projectOverviewStatusTab(label: string, count: string, active: boolean, colorName?: string): FrameNode {
  const tab = auto(`Status filter / ${label}`, 'HORIZONTAL', { gap: 8, padding: [10, 14], fill: active ? 'bg/dark' : 'bg/surface', radius: 'radius/full' });
  fixed(tab, label === '全部' ? 80 : 92, 40);
  if (!active && colorName) {
    const dot = figma.createEllipse();
    dot.name = 'Status dot';
    dot.resize(8, 8);
    applyFill(dot, colorName);
    tab.appendChild(dot);
  }
  tab.appendChild(text('Label', `${label} ${count}`, 'Label / Small', active ? 'text/on-dark' : 'text/primary'));
  return tab;
}

function projectOverviewToolbar(): FrameNode {
  const toolbar = auto('Project toolbar', 'HORIZONTAL', { gap: 16, padding: [12, 16], fill: 'bg/subtle', stroke: 'border/default', radius: 'radius/lg' });
  fixed(toolbar, 1104, 64);
  toolbar.primaryAxisAlignItems = 'SPACE_BETWEEN';
  const search = auto('Search projects', 'HORIZONTAL', { gap: 12, padding: [10, 14], fill: 'bg/surface', stroke: 'border/default', radius: 'radius/md' });
  fixed(search, 296, 40);
  search.appendChild(icon('Search icon', '<circle cx="10" cy="10" r="6" stroke="currentColor" stroke-width="2"/><path d="m15 15 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', 16));
  search.appendChild(text('Placeholder', '搜尋專案', 'Body / Medium', 'text/tertiary'));
  const filters = auto('Status filters', 'HORIZONTAL', { gap: 8 });
  filters.appendChild(projectOverviewStatusTab('全部', '3', true));
  filters.appendChild(projectOverviewStatusTab('進行中', '1', false, 'flow/active-strong'));
  filters.appendChild(projectOverviewStatusTab('暫停', '1', false, 'flow/review'));
  filters.appendChild(projectOverviewStatusTab('完成', '1', false, 'flow/done'));
  const sorting = auto('Project sorting', 'VERTICAL', { gap: 2 });
  sorting.appendChild(text('Sort label', '依最近更新排序', 'Body / Small', 'text/secondary'));
  sorting.appendChild(text('Visible count', '3 個可見專案', 'Label / Small', 'text/secondary'));
  toolbar.appendChild(search);
  toolbar.appendChild(filters);
  toolbar.appendChild(sorting);
  return toolbar;
}

function projectOverviewAction(style: 'Primary' | 'Outline', label: string, name: string, width: number): InstanceNode | FrameNode {
  const button = instance(componentVariant('Button', style), name);
  fixed(button, width, 44);
  overrideText(button, 'Label', label);
  return button;
}

function workspaceProjectOverviewDesktopScreen(): FrameNode {
  const screen = auto('Workspace Project Overview / Desktop / 1440×900', 'VERTICAL', { fill: 'bg/canvas' });
  fixed(screen, 1440, 900);
  setRadius(screen, 'radius/xl');
  screen.appendChild(appHeader());
  const shell = auto('Project overview shell', 'HORIZONTAL');
  fixed(shell, 1440, 844);
  shell.appendChild(projectOverviewSidebar());

  const main = auto('Project overview main', 'VERTICAL', { gap: 24, padding: [32, 40, 40, 40], fill: 'bg/canvas' });
  fixed(main, 1184, 844);
  const pageHeader = auto('Project overview header', 'HORIZONTAL');
  fixed(pageHeader, 1104, 84);
  pageHeader.primaryAxisAlignItems = 'SPACE_BETWEEN';
  const heading = auto('Page heading', 'VERTICAL', { gap: 8 });
  heading.appendChild(text('Breadcrumb', 'JEFFERY 的工作區 / 專案', 'Label / Small', 'text/secondary'));
  heading.appendChild(text('Title', '專案中心', 'Heading / H1'));
  heading.appendChild(text('Description', '選擇專案進入主要看板，或查看各專案的協作成員。', 'Body / Medium', 'text/secondary'));
  pageHeader.appendChild(heading);
  const actions = auto('Project overview actions', 'HORIZONTAL', { gap: 12 });
  actions.appendChild(projectOverviewAction('Outline', '邀請成員', 'Invite members', 156));
  actions.appendChild(projectOverviewAction('Primary', '新增專案', 'Create project', 208));
  pageHeader.appendChild(actions);
  main.appendChild(pageHeader);
  main.appendChild(projectOverviewToolbar());

  const content = auto('Project overview content', 'HORIZONTAL', { gap: 24 });
  const list = auto('Project list', 'VERTICAL', { gap: 16 });
  fixed(list, 704, 548);
  list.appendChild(text('List title', '所有專案', 'Heading / H3'));
  list.appendChild(projectOverviewCard('Desktop', 'Selected', 'Active', 'Flowboard 即時協作', 'Socket.IO 即時通知與多人 Kanban 協作練習。'));
  list.appendChild(projectOverviewCard('Desktop', 'Default', 'OnHold', '發佈自動化', 'CI/CD、部署檢查與環境穩定性追蹤。'));
  list.appendChild(projectOverviewCard('Desktop', 'Default', 'Completed', '技術成長計畫', '.NET、AWS 與系統設計學習路線。'));
  content.appendChild(list);
  content.appendChild(instance(localComponent('Selected Project Members'), 'Selected project members'));
  main.appendChild(content);
  shell.appendChild(main);
  screen.appendChild(shell);
  return screen;
}

function projectOverviewMobileHeader(): FrameNode {
  const header = auto('Project overview mobile header', 'HORIZONTAL', { gap: 12, padding: [16, 20], fill: 'bg/dark' });
  fixed(header, 390, 64);
  header.primaryAxisAlignItems = 'SPACE_BETWEEN';
  const brand = auto('Mobile brand', 'HORIZONTAL', { gap: 12 });
  brand.appendChild(icon('Menu icon', '<path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', 20, 'text/on-dark'));
  const mark = auto('Logo mark', 'HORIZONTAL', { gap: 4 });
  const coral = figma.createRectangle(); coral.resize(14, 22); coral.cornerRadius = 4; applyFill(coral, 'action/primary');
  const mint = figma.createRectangle(); mint.resize(14, 14); mint.cornerRadius = 4; applyFill(mint, 'flow/active');
  mark.appendChild(coral); mark.appendChild(mint);
  brand.appendChild(mark);
  brand.appendChild(text('Wordmark', 'Flowboard', 'Heading / H3', 'text/on-dark'));
  const actions = auto('Mobile header actions', 'HORIZONTAL', { gap: 12 });
  actions.appendChild(instance(componentVariant('Notification Trigger', 'State=Unread'), 'Notification trigger'));
  actions.appendChild(instance(componentVariant('Avatar', 'Size=32'), 'Avatar'));
  header.appendChild(brand);
  header.appendChild(actions);
  return header;
}

function workspaceProjectOverviewMobileScreen(): FrameNode {
  const screen = auto('Workspace Project Overview / Mobile / 390×844', 'VERTICAL', { fill: 'bg/canvas' });
  fixed(screen, 390, 844);
  setRadius(screen, 'radius/xl');
  screen.clipsContent = true;
  screen.appendChild(projectOverviewMobileHeader());
  const content = auto('Project overview mobile content', 'VERTICAL', { gap: 16, padding: [24] });
  fixed(content, 390, 780);

  const workspace = auto('Mobile workspace context', 'HORIZONTAL', { gap: 12, padding: [10], fill: 'bg/subtle', stroke: 'border/default', radius: 'radius/lg' });
  fixed(workspace, 342, 52);
  const avatar = auto('Workspace avatar', 'HORIZONTAL', { padding: [8], fill: 'action/primary', radius: 'radius/md' });
  fixed(avatar, 32, 32);
  avatar.appendChild(text('Initial', 'J', 'Label / Medium', 'text/on-dark'));
  workspace.appendChild(avatar);
  const copy = auto('Workspace copy', 'VERTICAL', { gap: 2 });
  copy.appendChild(text('Workspace name', 'Jeffery 的工作區', 'Label / Medium'));
  copy.appendChild(text('Workspace meta', '3 個專案 · 5 位成員', 'Label / Small', 'text/secondary'));
  workspace.appendChild(copy);
  workspace.appendChild(icon('Chevron down', '<path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>', 16));
  content.appendChild(workspace);

  const heading = auto('Mobile page heading', 'VERTICAL', { gap: 6 });
  heading.appendChild(text('Title', '專案中心', 'Heading / H1'));
  heading.appendChild(text('Description', '選擇專案進入主要看板。', 'Body / Small', 'text/secondary'));
  content.appendChild(heading);
  content.appendChild(projectOverviewAction('Primary', '新增專案', 'Create project', 342));
  const search = auto('Mobile project search', 'HORIZONTAL', { gap: 12, padding: [12, 14], fill: 'bg/surface', stroke: 'border/default', radius: 'radius/md' });
  fixed(search, 342, 44);
  search.appendChild(icon('Search icon', '<circle cx="10" cy="10" r="6" stroke="currentColor" stroke-width="2"/><path d="m15 15 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', 16));
  search.appendChild(text('Placeholder', '搜尋專案', 'Body / Medium', 'text/tertiary'));
  content.appendChild(search);
  const tabs = auto('Mobile status filters', 'HORIZONTAL', { gap: 8 });
  tabs.appendChild(projectOverviewStatusTab('全部', '3', true));
  tabs.appendChild(projectOverviewStatusTab('進行中', '', false, 'flow/active-strong'));
  tabs.appendChild(projectOverviewStatusTab('暫停', '', false, 'flow/review'));
  tabs.appendChild(projectOverviewStatusTab('完成', '', false, 'flow/done'));
  content.appendChild(tabs);
  const list = auto('Mobile project list', 'VERTICAL', { gap: 16 });
  const listHeader = auto('Mobile list header', 'HORIZONTAL');
  listHeader.primaryAxisAlignItems = 'SPACE_BETWEEN';
  listHeader.appendChild(text('List title', '所有專案', 'Heading / H3'));
  listHeader.appendChild(text('Sort label', '最近更新', 'Body / Small', 'text/secondary'));
  list.appendChild(listHeader);
  list.appendChild(projectOverviewCard('Mobile', 'Expanded', 'Active', 'Flowboard 即時協作', 'Socket.IO 通知與多人 Kanban 協作。'));
  list.appendChild(projectOverviewCard('Mobile', 'Default', 'OnHold', '發佈自動化', 'CI/CD、部署檢查與環境穩定性追蹤。'));
  content.appendChild(list);
  screen.appendChild(content);
  return screen;
}

function workspaceInviteDialogScreen(mobile = false): FrameNode {
  const width = mobile ? 390 : 1440;
  const height = mobile ? 844 : 900;
  const screen = auto(`Workspace Invite / ${mobile ? 'Mobile / 390×844' : 'Desktop / 1440×900'}`, 'VERTICAL', { fill: 'bg/canvas' });
  fixed(screen, width, height);
  screen.clipsContent = true;

  const background = mobile ? workspaceProjectOverviewMobileScreen() : workspaceProjectOverviewDesktopScreen();
  background.name = 'Workspace backdrop';
  screen.appendChild(background);
  background.layoutPositioning = 'ABSOLUTE';
  background.x = 0;
  background.y = 0;

  const scrim = auto('Dialog scrim', 'VERTICAL', { fill: 'bg/dark' });
  fixed(scrim, width, height);
  scrim.opacity = 0.58;
  screen.appendChild(scrim);
  scrim.layoutPositioning = 'ABSOLUTE';
  scrim.x = 0;
  scrim.y = 0;

  const dialog = instance(localComponent(`Workspace Invite Dialog / ${mobile ? 'Mobile' : 'Desktop'}`), 'Workspace Invite Dialog');
  screen.appendChild(dialog);
  dialog.layoutPositioning = 'ABSOLUTE';
  dialog.x = mobile ? 16 : 460;
  dialog.y = mobile ? 150 : 200;
  return screen;
}

function projectAddMemberDialogScreen(mobile = false): FrameNode {
  const width = mobile ? 390 : 1440;
  const height = mobile ? 844 : 900;
  const viewport: ProjectMemberViewport = mobile ? 'Mobile' : 'Desktop';
  const screen = auto(`Project Add Member / ${mobile ? 'Mobile / 390×844' : 'Desktop / 1440×900'}`, 'VERTICAL', { fill: 'bg/canvas' });
  fixed(screen, width, height);
  screen.clipsContent = true;

  const background = mobile ? workspaceProjectOverviewMobileScreen() : workspaceProjectOverviewDesktopScreen();
  background.name = 'Workspace project overview backdrop';
  screen.appendChild(background);
  background.layoutPositioning = 'ABSOLUTE';
  background.x = 0;
  background.y = 0;

  const scrim = auto('Dialog scrim', 'VERTICAL', { fill: 'bg/dark' });
  fixed(scrim, width, height);
  scrim.opacity = 0.58;
  screen.appendChild(scrim);
  scrim.layoutPositioning = 'ABSOLUTE';
  scrim.x = 0;
  scrim.y = 0;

  const dialog = instance(componentVariant('Project Add Member Dialog', `Viewport=${viewport}, State=Default`), 'Project add member dialog');
  screen.appendChild(dialog);
  dialog.layoutPositioning = 'ABSOLUTE';
  dialog.x = mobile ? 16 : 420;
  dialog.y = mobile ? 34 : 82;
  return screen;
}

function projectAddMemberStatesScreen(): FrameNode {
  const screen = auto('Project Add Member / Runtime States / 1440×1840', 'VERTICAL', { gap: 24, padding: [40], fill: 'bg/canvas' });
  fixed(screen, 1440, 1840);
  screen.appendChild(text('Title', 'PROJECT ADD MEMBER / RUNTIME STATES', 'Heading / H2'));
  screen.appendChild(text(
    'Description',
    '候選人從 workspace members 載入；已加入專案者 disabled，送出僅允許 EDITOR 或 VIEWER。',
    'Body / Medium',
    'text/secondary',
  ));
  const rows = auto('Add member states', 'VERTICAL', { gap: 32 });
  const states: ProjectAddMemberState[] = ['Loading', 'Empty', 'Error', 'Processing'];
  for (let index = 0; index < states.length; index += 2) {
    const row = auto(`State row ${index / 2 + 1}`, 'HORIZONTAL', { gap: 32 });
    states.slice(index, index + 2).forEach((state) => {
      const panel = auto(`State / ${state}`, 'VERTICAL', { gap: 12 });
      panel.appendChild(text('State label', state, 'Heading / H3'));
      panel.appendChild(instance(componentVariant('Project Add Member Dialog', `Viewport=Desktop, State=${state}`), `Project add member ${state}`));
      row.appendChild(panel);
    });
    rows.appendChild(row);
  }
  screen.appendChild(rows);
  return screen;
}

function notificationDropdownScreen(mobile = false): FrameNode {
  const width = mobile ? 390 : 1440;
  const height = mobile ? 844 : 900;
  const screen = auto(`Notification Dropdown / ${mobile ? 'Mobile / 390×844' : 'Desktop / 1440×900'}`, 'VERTICAL', { fill: 'bg/canvas' });
  fixed(screen, width, height);
  screen.clipsContent = true;

  const background = mobile ? workspaceProjectOverviewMobileScreen() : workspaceProjectOverviewDesktopScreen();
  background.name = 'Workspace backdrop';
  screen.appendChild(background);
  background.layoutPositioning = 'ABSOLUTE';
  background.x = 0;
  background.y = 0;

  const dropdown = instance(
    componentVariant('Notification Dropdown', `Viewport=${mobile ? 'Mobile' : 'Desktop'}, State=Default`),
    'Notification Dropdown',
  );
  screen.appendChild(dropdown);
  dropdown.layoutPositioning = 'ABSOLUTE';
  dropdown.x = mobile ? 16 : 1008;
  dropdown.y = 68;
  return screen;
}

function workspaceInvitationDetailDialogScreen(mobile = false): FrameNode {
  const width = mobile ? 390 : 1440;
  const height = mobile ? 844 : 900;
  const screen = auto(`Workspace Invitation Detail Dialog / ${mobile ? 'Mobile / 390×844' : 'Desktop / 1440×900'}`, 'VERTICAL', { fill: 'bg/canvas' });
  fixed(screen, width, height);
  screen.clipsContent = true;

  const background = mobile ? workspaceProjectOverviewMobileScreen() : workspaceProjectOverviewDesktopScreen();
  background.name = 'Workspace backdrop';
  screen.appendChild(background);
  background.layoutPositioning = 'ABSOLUTE';
  background.x = 0;
  background.y = 0;

  const scrim = auto('Dialog scrim', 'VERTICAL', { fill: 'bg/dark' });
  fixed(scrim, width, height);
  scrim.opacity = 0.58;
  screen.appendChild(scrim);
  scrim.layoutPositioning = 'ABSOLUTE';
  scrim.x = 0;
  scrim.y = 0;

  const dialog = instance(
    componentVariant('Workspace Invitation Detail Dialog', `Viewport=${mobile ? 'Mobile' : 'Desktop'}, State=Pending`),
    'Workspace invitation detail dialog',
  );
  screen.appendChild(dialog);
  dialog.layoutPositioning = 'ABSOLUTE';
  dialog.x = mobile ? 16 : 460;
  dialog.y = mobile ? 137 : 222;
  return screen;
}

function workspaceInvitationDetailDialogStatesScreen(): FrameNode {
  const screen = auto('Workspace Invitation Detail Dialog / States / 1440×1660', 'VERTICAL', { gap: 24, padding: [40], fill: 'bg/canvas' });
  fixed(screen, 1440, 1660);
  screen.appendChild(text('Title', 'WORKSPACE INVITATION DETAIL DIALOG / STATES', 'Heading / H2'));
  screen.appendChild(text(
    'Description',
    '由 notificationId 載入最新邀請詳情；通知只管理已讀，Dialog 管理資源狀態與接受／婉拒。',
    'Body / Medium',
    'text/secondary',
  ));

  const rows = auto('Invitation detail states', 'VERTICAL', { gap: 32 });
  const states: InvitationDetailState[] = ['Loading', 'Pending', 'Responding', 'Accepted', 'Declined', 'Unavailable'];
  for (let index = 0; index < states.length; index += 2) {
    const row = auto(`State row ${index / 2 + 1}`, 'HORIZONTAL', { gap: 32 });
    states.slice(index, index + 2).forEach((state) => {
      const panel = auto(`State / ${state}`, 'VERTICAL', { gap: 12 });
      panel.appendChild(text('State label', state, 'Heading / H3'));
      panel.appendChild(instance(componentVariant('Workspace Invitation Detail Dialog', `Viewport=Desktop, State=${state}`), `Invitation detail ${state}`));
      row.appendChild(panel);
    });
    rows.appendChild(row);
  }
  screen.appendChild(rows);
  return screen;
}

function notificationItemInteractionsScreen(): FrameNode {
  const screen = auto('Notification Item / Interaction Contract / 1440×900', 'VERTICAL', { gap: 24, padding: [40], fill: 'bg/canvas' });
  fixed(screen, 1440, 900);
  screen.appendChild(text('Title', 'NOTIFICATION ITEM / INTERACTION CONTRACT', 'Heading / H2'));
  screen.appendChild(text('Description', '通知內容與已讀控制是兩個獨立操作目標；Type 只決定內容區點擊後開啟的 domain UI。', 'Body / Medium', 'text/secondary'));

  const examples = auto('Interaction examples', 'HORIZONTAL', { gap: 32 });
  const itemPanel = auto('Independent targets', 'VERTICAL', { gap: 14, padding: [20], fill: 'bg/surface', radius: 'radius/lg' });
  itemPanel.appendChild(text('Panel title', 'Desktop · Unread', 'Heading / H3'));
  itemPanel.appendChild(instance(componentVariant('Notification Item', 'Viewport=Desktop, State=Unread'), 'Unread notification'));
  itemPanel.appendChild(text('Target note', 'Content action → Workspace Invitation Dialog     Read action → readAt only', 'Body / Small', 'text/secondary'));
  examples.appendChild(itemPanel);

  const routing = auto('Type routing', 'VERTICAL', { gap: 14, padding: [24], fill: 'bg/dark', radius: 'radius/lg' });
  fixed(routing, 480, 286);
  routing.appendChild(text('Routing title', 'Type routing', 'Heading / H3', 'text/on-dark'));
  [
    'WORKSPACE_INVITED → Workspace Invitation Dialog',
    'CARD_ASSIGNED → Card Detail',
    'CARD_MENTIONED → Card comment anchor',
    'CARD_REMINDER → Card Detail',
  ].forEach((route) => routing.appendChild(text('Route', route, 'Body / Small', 'text/on-dark-muted')));
  routing.appendChild(text('API contract', 'Client sends notificationId only; backend resolves Type, resource and authorization.', 'Body / Small', 'text/on-dark'));
  examples.appendChild(routing);
  screen.appendChild(examples);

  const semantics = auto('Focus and read semantics', 'VERTICAL', { gap: 12, padding: [24], fill: 'bg/surface', stroke: 'border/default', radius: 'radius/lg' });
  fixed(semantics, 1130, 180);
  semantics.appendChild(text('Semantics title', 'Focus and read semantics', 'Heading / H3'));
  [
    'Enter／Space on content action opens detail; focus moves into the Dialog.',
    'Read action only changes readAt; it never accepts, declines, or navigates.',
    'Closing the Dialog returns focus to the originating notification item.',
    'Mobile content and read targets are each at least 44 × 44.',
  ].forEach((note) => semantics.appendChild(text('Semantic note', `• ${note}`, 'Body / Small', 'text/secondary')));
  screen.appendChild(semantics);
  return screen;
}

function notificationDropdownStatesScreen(): FrameNode {
  const screen = auto('Notification Dropdown / States / 1440×900', 'VERTICAL', { gap: 24, padding: [40], fill: 'bg/canvas' });
  fixed(screen, 1440, 900);
  screen.appendChild(text('Title', 'NOTIFICATION DROPDOWN / RUNTIME STATES', 'Heading / H2'));
  screen.appendChild(text('Description', 'HTTP read model 支援列表、未讀數與已讀操作；Loading／Error 停用已讀動作，Empty 顯示 0 則未讀。', 'Body / Medium', 'text/secondary'));

  const states = auto('Dropdown states', 'HORIZONTAL', { gap: 24 });
  (['Loading', 'Empty', 'Error'] as const).forEach((state) => {
    const panel = auto(`State / ${state}`, 'VERTICAL', { gap: 12 });
    panel.appendChild(text('State label', state, 'Heading / H3'));
    panel.appendChild(instance(componentVariant('Notification Dropdown', `Viewport=Desktop, State=${state}`), `Notification ${state}`));
    states.appendChild(panel);
  });
  screen.appendChild(states);

  const triggers = auto('Trigger states', 'HORIZONTAL', { gap: 20, padding: [20], fill: 'bg/dark', radius: 'radius/lg' });
  (['Default', 'Unread', 'Open'] as const).forEach((state) => {
    const sample = auto(`Trigger / ${state}`, 'VERTICAL', { gap: 8 });
    sample.appendChild(instance(componentVariant('Notification Trigger', `State=${state}`), `Notification trigger ${state}`));
    sample.appendChild(text('Label', state, 'Label / Small', 'text/on-dark-muted'));
    triggers.appendChild(sample);
  });
  screen.appendChild(triggers);
  return screen;
}

function notificationReadActionStatePanel(
  viewport: NotificationViewport,
  scope: NotificationReadScope,
  state: NotificationReadState,
  label: string,
): FrameNode {
  const panelWidth = scope === 'Single' ? 248 : 320;
  const panel = auto(`State / ${label}`, 'VERTICAL', { gap: 12, padding: [16], fill: 'bg/surface', radius: 'radius/lg' });
  fixed(panel, panelWidth, 174);
  panel.appendChild(text('State label', label, 'Label / Medium'));

  const preview = auto('Read action preview', 'HORIZONTAL', { gap: 12, padding: [10], fill: 'bg/subtle', radius: 'radius/md' });
  fixed(preview, panelWidth - 32, 62);
  preview.counterAxisAlignItems = 'CENTER';
  preview.appendChild(instance(
    componentVariant('Notification Read Action', `Viewport=${viewport}, Scope=${scope}, State=${state}`),
    `${scope} read action`,
  ));
  preview.appendChild(text(
    'Preview copy',
    scope === 'Single' ? '通知卡內單筆處理' : 'Dropdown header 批次處理',
    'Body / Small',
    'text/secondary',
  ));
  panel.appendChild(preview);
  panel.appendChild(text(
    'State note',
    state === 'Processing'
      ? '只鎖定目前請求範圍，避免重複送出。'
      : state === 'Complete'
        ? '原地更新未讀樣式與 badge。'
        : state === 'Error'
          ? '保留未讀狀態，提供再次嘗試。'
          : scope === 'Single'
            ? 'Desktop 顯示 tooltip；Mobile 保留 44px 觸控區。'
            : '按鈕位於通知選單 header。',
    'Body / Small',
    'text/secondary',
  ));
  return panel;
}

function notificationReadActionsStatesScreen(): FrameNode {
  const screen = auto('Notification Read Actions / States / 1440×900', 'VERTICAL', { gap: 24, padding: [40], fill: 'bg/canvas' });
  fixed(screen, 1440, 900);
  screen.appendChild(text('Title', 'NOTIFICATION / READ ACTIONS / INTERACTION STATES', 'Heading / H2'));
  screen.appendChild(text(
    'Description',
    '單筆操作只鎖定目標通知；全部已讀會暫停所有已讀操作。成功後原地更新，不關閉通知選單。',
    'Body / Medium',
    'text/secondary',
  ));

  const rows = auto('Read action state rows', 'VERTICAL', { gap: 24 });
  const firstRow = auto('Default and processing states', 'HORIZONTAL', { gap: 24 });
  [
    ['Single', 'Default', 'Single / Default'],
    ['Single', 'Processing', 'Single / Processing'],
    ['Single', 'Complete', 'Single / Complete'],
    ['All', 'Default', 'All / Default'],
  ].forEach(([scope, state, label]) => {
    firstRow.appendChild(notificationReadActionStatePanel('Desktop', scope as NotificationReadScope, state as NotificationReadState, label));
  });
  rows.appendChild(firstRow);

  const secondRow = auto('Completion and recovery states', 'HORIZONTAL', { gap: 24 });
  [
    ['All', 'Processing', 'All / Processing'],
    ['All', 'Complete', 'All / Complete'],
    ['Single', 'Error', 'Single / Error'],
    ['All', 'Error', 'All / Error'],
  ].forEach(([scope, state, label]) => {
    secondRow.appendChild(notificationReadActionStatePanel('Desktop', scope as NotificationReadScope, state as NotificationReadState, label));
  });
  rows.appendChild(secondRow);

  const notes = auto('Read action accessibility notes', 'VERTICAL', { gap: 8, padding: [20], fill: 'bg/dark', radius: 'radius/lg' });
  fixed(notes, 1360, 110);
  notes.appendChild(text('Notes title', 'Focus 與狀態', 'Heading / H3', 'text/on-dark'));
  notes.appendChild(text(
    'Notes copy',
    '單筆成功後焦點移到下一個合理操作；全部成功後焦點保留在完成狀態。Unread 以底色、左側 rail、文字與 dot 同時表達，不只靠顏色。',
    'Body / Small',
    'text/on-dark-muted',
  ));
  screen.appendChild(rows);
  screen.appendChild(notes);
  return screen;
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
    { name: 'Workspace Project Overview', screens: [workspaceProjectOverviewDesktopScreen, workspaceProjectOverviewTabletScreen, workspaceProjectOverviewMobileScreen] },
    { name: 'Workspace Invite', screens: [() => workspaceInviteDialogScreen(false), () => workspaceInviteDialogScreen(true)] },
    { name: 'Project Add Member', screens: [() => projectAddMemberDialogScreen(false), () => projectAddMemberDialogScreen(true), projectAddMemberStatesScreen] },
    { name: 'Notifications', screens: [() => notificationDropdownScreen(false), () => notificationDropdownScreen(true), notificationDropdownStatesScreen, notificationReadActionsStatesScreen, notificationItemInteractionsScreen] },
    { name: 'Workspace Invitation Detail Dialog', screens: [() => workspaceInvitationDetailDialogScreen(false), () => workspaceInvitationDetailDialogScreen(true), workspaceInvitationDetailDialogStatesScreen] },
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
  if (action === 'components' || action === 'screens') {
    postStatus('Preparing foundations…');
    await buildFoundations();
  }
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
    if (!componentSets['Task Card'] || !componentSets['Project Card'] || !componentSets['Project Member Candidate'] || !componentSets['Project Role Option'] || !componentSets['Project Add Member Dialog'] || !componentSets['Notification Read Action'] || !componentSets['Notification Dropdown'] || !componentSets['Workspace Invitation Detail Dialog'] || !standaloneComponents['Selected Project Members'] || !standaloneComponents['Workspace Invite Dialog / Desktop']) await buildComponents();
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
