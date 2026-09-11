import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import WorkspaceInvitationResponseCard from '@/components/notifications/WorkspaceInvitationResponseCard/WorkspaceInvitationResponseCard.vue';
import { i18n } from '@/i18n';
import type { WorkspaceInvitationResponseState } from '@/types/workspaceInvitation';

const mountCard = (state: WorkspaceInvitationResponseState = 'pending') => {
  return mount(WorkspaceInvitationResponseCard, {
    props: {
      actorInitial: 'M',
      inviterDisplayName: 'Mia',
      workspaceName: '產品開發中心',
      createdAt: '2026-09-12T00:00:00.000Z',
      createdAtLabel: '5 分鐘前',
      expiresAtLabel: '邀請將於 7 天後到期',
      isUnread: true,
      state,
    },
    global: {
      plugins: [i18n],
    },
  });
};

describe('WorkspaceInvitationResponseCard', () => {
  it('顯示邀請內容並送出接受或婉拒事件', async () => {
    const wrapper = mountCard();
    const buttons = wrapper.findAll('button');

    expect(wrapper.text()).toContain('Mia 邀請你加入「產品開發中心」');
    expect(wrapper.text()).toContain('邀請將於 7 天後到期');
    expect(buttons.map((button) => button.text())).toEqual(['接受邀請', '婉拒']);

    await buttons[0]?.trigger('click');
    await buttons[1]?.trigger('click');

    expect(wrapper.emitted('accept')).toHaveLength(1);
    expect(wrapper.emitted('decline')).toHaveLength(1);
  });

  it('處理中鎖定兩個動作並顯示目前操作', () => {
    const wrapper = mountCard('accepting');
    const buttons = wrapper.findAll('button');

    expect(wrapper.text()).toContain('正在接受「產品開發中心」的工作區邀請');
    expect(buttons[0]?.attributes('disabled')).toBeDefined();
    expect(buttons[1]?.attributes('disabled')).toBeDefined();
    expect(buttons[0]?.attributes('aria-busy')).toBe('true');
  });

  it('接受後提供前往工作區的下一步', async () => {
    const wrapper = mountCard('accepted');
    const button = wrapper.get('button');

    expect(wrapper.text()).toContain('你已加入「產品開發中心」');
    expect(button.text()).toContain('前往工作區');

    await button.trigger('click');

    expect(wrapper.emitted('openWorkspace')).toHaveLength(1);
  });

  it('婉拒後顯示完成狀態且不再顯示操作', () => {
    const wrapper = mountCard('declined');

    expect(wrapper.text()).toContain('已婉拒「產品開發中心」的邀請');
    expect(wrapper.text()).toContain('這則邀請已完成回覆');
    expect(wrapper.find('button').exists()).toBe(false);
  });

  it('錯誤時顯示可重新載入的回復操作', async () => {
    const wrapper = mountCard('error');
    const reloadButton = wrapper.get('button');

    expect(wrapper.get('[role="alert"]').text()).toContain('無法回覆這則邀請');

    await reloadButton.trigger('click');

    expect(wrapper.emitted('reload')).toHaveLength(1);
  });
});
