import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import type { ProjectListItemDto, ProjectMemberDto } from '@kanban/contracts/project';
import { i18n } from '@/i18n';
import ProjectMembers from './ProjectMembers.vue';

const project: ProjectListItemDto = {
  id: 'project-1',
  workspaceId: 'workspace-1',
  name: 'Flowboard',
  description: null,
  status: 'ACTIVE',
  createdAt: '2026-10-24T00:00:00.000Z',
  updatedAt: '2026-10-24T00:00:00.000Z',
  pinnedAt: null,
};

const mountMembers = (members: ProjectMemberDto[]) =>
  mount(ProjectMembers, {
    props: { project, members, loading: false },
    global: { plugins: [i18n] },
  });

describe('ProjectMembers', () => {
  it('有頭像的成員顯示圖片，沒有頭像的顯示名稱首字', () => {
    const wrapper = mountMembers([
      {
        memberId: 'member-1',
        displayName: 'Ada',
        role: 'OWNER',
        avatarUrl: '/media/avatars/ada/sm.webp',
      },
      { memberId: 'member-2', displayName: 'bob', role: 'EDITOR', avatarUrl: null },
    ]);
    const [first, second] = wrapper.findAll('li');

    expect(first!.get('img').attributes('src')).toBe('/media/avatars/ada/sm.webp');
    expect(first!.text()).toContain('Ada');
    expect(second!.find('img').exists()).toBe(false);
    expect(second!.text()).toContain('B');
    expect(second!.text()).toContain('bob');
  });

  it('頭像是裝飾用途，不讓螢幕閱讀器重複念出名稱', () => {
    const wrapper = mountMembers([
      {
        memberId: 'member-1',
        displayName: 'Ada',
        role: 'OWNER',
        avatarUrl: '/media/avatars/ada/sm.webp',
      },
    ]);

    expect(wrapper.get('.shared-avatar').attributes('aria-hidden')).toBe('true');
  });
});
