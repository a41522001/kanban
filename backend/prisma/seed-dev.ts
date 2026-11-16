/**
 * Local development seed: users, a workspace, projects, columns, categories and cards.
 *
 * Run from backend/:  npx ts-node --transpile-only prisma/seed-dev.ts [your-login-email]
 * - Reads DATABASE_URL from backend/.env. Refuses to run when NODE_ENV=production.
 * - Idempotent: removes the previous seed workspace and seed users before inserting again.
 * - Optional email argument: an existing account that is added to the seed workspace
 *   as OWNER, so you can open the seed boards with your normal login.
 * All seed accounts use the password below and are already email-verified.
 */
import bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const SEED_PASSWORD = 'Password123!';
const SEED_EMAIL_DOMAIN = '@seed.flowboard.dev';
const SEED_WORKSPACE_NAME = 'Seed 測試工作區';
const GAP = 1024;

type ColorKey =
  | 'coral'
  | 'rose'
  | 'orange'
  | 'mint'
  | 'amber'
  | 'lime'
  | 'teal'
  | 'cyan'
  | 'lavender'
  | 'indigo'
  | 'violet'
  | 'pink'
  | 'blue'
  | 'slate';

interface SeedProject {
  name: string;
  description: string | null;
  categories: Array<[name: string, colorKey: ColorKey]>;
  // column title → [card title, description, category name?]
  columns: Array<{
    title: string;
    colorKey: 'coral' | 'mint' | 'amber' | 'violet';
    cards: Array<[string, string | null, string?]>;
  }>;
}

const SEED_USERS = [
  { key: 'owner', displayName: 'Seed Owner' },
  { key: 'editor', displayName: 'Seed Editor' },
  { key: 'viewer', displayName: 'Seed Viewer' },
  { key: 'member', displayName: 'Seed 未加入專案' },
] as const;

const PROJECTS: SeedProject[] = [
  {
    name: '產品開發看板',
    description: '主要的開發看板：卡片多、類別齊全，用來測試捲動與類別顯示。',
    categories: [
      ['企劃', 'coral'],
      ['前端', 'lavender'],
      ['後端', 'mint'],
      ['設計', 'amber'],
      ['測試', 'teal'],
      ['DevOps', 'slate'],
    ],
    columns: [
      {
        title: '準備開始',
        colorKey: 'coral',
        cards: [
          ['規劃工作區首頁資訊架構', '整理首頁需要的區塊與導覽。', '企劃'],
          [
            '設計卡片類別選單',
            '依 card-taxonomy-states-phase-a-plus.svg。',
            '設計',
          ],
          [
            '移動卡片 API',
            'PATCH /board/moveCard，以 afterCardId 計算 position。',
            '後端',
          ],
          ['卡片拖曳把手樣式', null, '前端'],
          ['整理 Bruno 測試順序', null, '測試'],
          ['調查 GCS signed URL', '頭像步驟 11 需要。', 'DevOps'],
          ['沒有類別的卡片', '用來確認沒有類別時不顯示 chip。'],
          [
            '一張標題很長很長的卡片，用來測試標題換行與卡片高度在看板上的表現是否正常',
            null,
            '企劃',
          ],
        ],
      },
      {
        title: '正在進行',
        colorKey: 'mint',
        cards: [
          [
            'Session Cookie 驗證流程',
            '使用隨機 session id 作為 Cookie 值；Redis 保存雜湊後的 key。\n完成後由 Socket handshake middleware 驗證登入狀態。',
            '後端',
          ],
          ['看板卡片樣式', '類別 chip 在標題上方。', '前端'],
          ['卡片詳情 Dialog', null, '前端'],
          ['設定 Seq 正式環境', null, 'DevOps'],
        ],
      },
      {
        title: '等待檢視',
        colorKey: 'amber',
        cards: [
          ['新增卡片 API', 'A-3 已完成，等待 review。', '後端'],
          ['封存確認 AlertDialog', null, '設計'],
          ['409 衝突提示', null],
        ],
      },
      {
        title: '已完成',
        colorKey: 'violet',
        cards: Array.from(
          { length: 15 },
          (_, index): [string, string | null, string?] => [
            `已完成的工作 #${index + 1}`,
            index % 3 === 0 ? '用來測試欄位很長時的垂直捲動。' : null,
            ['企劃', '前端', '後端', '設計', '測試', undefined][index % 6],
          ],
        ),
      },
    ],
  },
  {
    name: '行銷活動',
    description: '卡片數量少、類別少的一般專案。',
    categories: [
      ['社群', 'pink'],
      ['廣告', 'orange'],
    ],
    columns: [
      {
        title: '準備開始',
        colorKey: 'coral',
        cards: [
          ['規劃 11 月貼文', null, '社群'],
          ['準備廣告素材', '尺寸 1080×1080。', '廣告'],
        ],
      },
      {
        title: '正在進行',
        colorKey: 'mint',
        cards: [['撰寫產品介紹文', null]],
      },
      { title: '等待檢視', colorKey: 'amber', cards: [] },
      {
        title: '已完成',
        colorKey: 'violet',
        cards: [['建立粉絲專頁', null, '社群']],
      },
    ],
  },
  {
    name: '空白專案',
    description: null,
    categories: [],
    columns: [
      { title: '準備開始', colorKey: 'coral', cards: [] },
      { title: '正在進行', colorKey: 'mint', cards: [] },
      { title: '等待檢視', colorKey: 'amber', cards: [] },
      { title: '已完成', colorKey: 'violet', cards: [] },
    ],
  },
];

const main = async (): Promise<void> => {
  process.loadEnvFile('.env');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed-dev must not run against production.');
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is missing in backend/.env.');
  const attachEmail = process.argv[2]?.trim().toLowerCase();

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  try {
    // Clean up a previous run. Projects/columns/cards/categories cascade from the workspace's projects.
    const oldWorkspaces = await prisma.workspace.findMany({
      where: { name: SEED_WORKSPACE_NAME },
      select: { id: true },
    });
    const oldIds = oldWorkspaces.map((workspace) => workspace.id);
    await prisma.card.deleteMany({
      where: { column: { project: { workspaceId: { in: oldIds } } } },
    });
    await prisma.project.deleteMany({ where: { workspaceId: { in: oldIds } } });
    await prisma.notification.deleteMany({
      where: {
        OR: [
          { recipient: { email: { endsWith: SEED_EMAIL_DOMAIN } } },
          { actor: { email: { endsWith: SEED_EMAIL_DOMAIN } } },
        ],
      },
    });
    await prisma.workspaceInvitation.deleteMany({
      where: { workspaceId: { in: oldIds } },
    });
    await prisma.workspace.deleteMany({ where: { id: { in: oldIds } } });
    await prisma.user.deleteMany({
      where: { email: { endsWith: SEED_EMAIL_DOMAIN } },
    });

    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
    const now = new Date();
    const users: Record<(typeof SEED_USERS)[number]['key'], string> = {
      owner: '',
      editor: '',
      viewer: '',
      member: '',
    };
    for (const seedUser of SEED_USERS) {
      const user = await prisma.user.create({
        data: {
          email: `${seedUser.key}${SEED_EMAIL_DOMAIN}`,
          displayName: seedUser.displayName,
          passwordHash,
          emailVerifiedAt: now,
        },
        select: { id: true },
      });
      users[seedUser.key] = user.id;
    }

    const attached = attachEmail
      ? await prisma.user.findUnique({
          where: { email: attachEmail },
          select: { id: true },
        })
      : null;
    if (attachEmail && !attached)
      console.warn(`[seed] ${attachEmail} not found; skipped attaching it.`);

    const workspace = await prisma.workspace.create({
      data: {
        name: SEED_WORKSPACE_NAME,
        createdById: users.owner,
        members: {
          create: [
            { userId: users.owner, role: 'OWNER' },
            { userId: users.editor, role: 'MEMBER' },
            { userId: users.viewer, role: 'MEMBER' },
            { userId: users.member, role: 'MEMBER' },
            ...(attached
              ? [{ userId: attached.id, role: 'OWNER' as const }]
              : []),
          ],
        },
      },
      select: { id: true },
    });

    let cardTotal = 0;
    for (const seedProject of PROJECTS) {
      const project = await prisma.project.create({
        data: {
          workspaceId: workspace.id,
          name: seedProject.name,
          description: seedProject.description,
          createdById: users.owner,
          members: {
            create: [
              { userId: users.owner, role: 'OWNER' },
              { userId: users.editor, role: 'EDITOR' },
              { userId: users.viewer, role: 'VIEWER' },
              ...(attached
                ? [{ userId: attached.id, role: 'OWNER' as const }]
                : []),
            ],
          },
        },
        select: { id: true },
      });

      const categoryIds = new Map<string, string>();
      for (const [name, colorKey] of seedProject.categories) {
        const category = await prisma.cardCategory.create({
          data: {
            projectId: project.id,
            name,
            normalizedName: name.toLowerCase(),
            colorKey,
          },
          select: { id: true },
        });
        categoryIds.set(name, category.id);
      }

      let revision = seedProject.categories.length;
      for (const [columnIndex, seedColumn] of seedProject.columns.entries()) {
        const column = await prisma.boardColumn.create({
          data: {
            projectId: project.id,
            title: seedColumn.title,
            colorKey: seedColumn.colorKey,
            position: (columnIndex + 1) * GAP,
          },
          select: { id: true },
        });
        revision += 1;
        await prisma.card.createMany({
          data: seedColumn.cards.map(
            ([title, description, categoryName], cardIndex) => ({
              columnId: column.id,
              title,
              description,
              categoryId: categoryName
                ? (categoryIds.get(categoryName) ?? null)
                : null,
              position: (cardIndex + 1) * GAP,
              createdById: users.editor,
            }),
          ),
        });
        revision += seedColumn.cards.length;
        cardTotal += seedColumn.cards.length;
      }

      // Every mutation bumps boardRevision in the app; keep the seed consistent with that.
      await prisma.project.update({
        where: { id: project.id },
        data: { boardRevision: BigInt(revision) },
      });
    }

    console.log('[seed] done');
    console.log(`  workspace: ${SEED_WORKSPACE_NAME}`);
    console.log(`  projects: ${PROJECTS.length}, cards: ${cardTotal}`);
    console.log(`  logins (password ${SEED_PASSWORD}):`);
    for (const seedUser of SEED_USERS)
      console.log(
        `    ${seedUser.key}${SEED_EMAIL_DOMAIN}  ${seedUser.displayName}`,
      );
    if (attached) console.log(`  attached ${attachEmail} as OWNER`);
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
