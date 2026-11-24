// 首页：展示虚构的演示空间列表，不含任何真实个人信息或企业信息。
interface DemoSite {
  id: string;
  name: string;
  members: number;
}

Page({
  data: {
    title: '会员空间（示例）',
    platform: '',
    sites: [
      { id: 'demo-001', name: '演示空间 A', members: 12 },
      { id: 'demo-002', name: '演示空间 B', members: 8 },
    ] as DemoSite[],
  },

  onLoad() {
    const info = wx.getSystemInfoSync();
    this.setData({ platform: info.platform });
  },
});
