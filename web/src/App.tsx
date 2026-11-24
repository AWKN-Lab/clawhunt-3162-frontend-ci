import { Button, Table } from 'tdesign-react';
import type { TableProps } from 'tdesign-react';
import { formatCents } from './lib/format';
import 'tdesign-react/es/style/index.css';

// 全部为虚构的演示数据，不含任何真实个人信息或企业信息。
interface DemoRow {
  id: string;
  name: string;
  members: number;
  amountCents: number;
  status: string;
}

const columns: TableProps<DemoRow>['columns'] = [
  { colKey: 'id', title: '编号', width: 110 },
  { colKey: 'name', title: '演示空间', width: 160 },
  { colKey: 'members', title: '会员数', width: 90 },
  {
    colKey: 'amountCents',
    title: '本月金额',
    width: 130,
    cell: ({ row }: { row: DemoRow }) => formatCents(row.amountCents),
  },
  { colKey: 'status', title: '状态', width: 90 },
];

const rows: DemoRow[] = [
  { id: 'demo-001', name: '演示空间 A', members: 12, amountCents: 123450, status: '活跃' },
  { id: 'demo-002', name: '演示空间 B', members: 8, amountCents: 80200, status: '活跃' },
  { id: 'demo-003', name: '演示空间 C', members: 0, amountCents: 0, status: '待开业' },
];

export default function App() {
  return (
    <main style={{ padding: 24 }}>
      <h1>会员空间工作台（示例）</h1>
      <p>本页为前端 CI 的最小示例工程，仅用于证明流水线可用。</p>
      <Button theme="primary" onClick={() => window.alert('示例按钮，无实际业务')}>
        示例操作
      </Button>
      <div style={{ marginTop: 16 }}>
        <Table rowKey="id" data={rows} columns={columns} />
      </div>
    </main>
  );
}
