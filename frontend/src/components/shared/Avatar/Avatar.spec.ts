import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import Avatar from './Avatar.vue';

describe('SharedAvatar', () => {
  it('沒有 src 時顯示名稱首字（大寫）', () => {
    const wrapper = mount(Avatar, { props: { name: 'jeffery' } });

    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.text()).toBe('J');
  });

  it('有 src 時顯示圖片，alt 為名稱', () => {
    const wrapper = mount(Avatar, { props: { name: 'Jeffery', src: 'http://localhost/a.webp', size: 64 } });
    const image = wrapper.get('img');

    expect(image.attributes('src')).toBe('http://localhost/a.webp');
    expect(image.attributes('alt')).toBe('Jeffery');
    expect(image.attributes('width')).toBe('64');
  });

  it('圖片載入失敗時回退為首字', async () => {
    const wrapper = mount(Avatar, { props: { name: 'Jeffery', src: 'http://localhost/broken.webp' } });

    await wrapper.get('img').trigger('error');

    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.text()).toBe('J');
  });

  it('換成新的 src 後會重新嘗試載入圖片', async () => {
    const wrapper = mount(Avatar, { props: { name: 'Jeffery', src: 'http://localhost/broken.webp' } });
    await wrapper.get('img').trigger('error');

    await wrapper.setProps({ src: 'http://localhost/new.webp' });

    expect(wrapper.get('img').attributes('src')).toBe('http://localhost/new.webp');
  });

  it('空白名稱顯示問號', () => {
    expect(mount(Avatar, { props: { name: '  ' } }).text()).toBe('?');
  });
});
