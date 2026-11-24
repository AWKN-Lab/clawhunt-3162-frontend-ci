// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';
import { formatCents } from './lib/format';

describe('formatCents', () => {
  it('分转元保留两位小数', () => {
    expect(formatCents(123450)).toBe('¥1234.50');
    expect(formatCents(0)).toBe('¥0.00');
  });

  it('非整数分抛错', () => {
    expect(() => formatCents(1.5)).toThrow('金额必须是整数分');
  });
});

describe('App', () => {
  it('渲染标题与演示数据', () => {
    render(<App />);
    expect(screen.getByText('会员空间工作台（示例）')).toBeTruthy();
    expect(screen.getByText('演示空间 A')).toBeTruthy();
    expect(screen.getByText('¥1234.50')).toBeTruthy();
  });
});
