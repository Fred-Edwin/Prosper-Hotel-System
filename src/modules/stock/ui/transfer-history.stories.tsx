import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StaffShellHome } from "@/components/layout/staff-shell";
import { TransferHistoryView } from "./transfer-history";

const meta = { title: "Modules/Stock/TransferHistory", component: TransferHistoryView, parameters: { layout: "fullscreen", viewport: { defaultViewport: "mobile1" }, nextjs: { appDirectory: true } } } satisfies Meta<typeof TransferHistoryView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { render: () => <StaffShellHome staffName="Janiffer" locationName="restaurant" active="transfer-history" title="Transfers" onHome={() => {}}><TransferHistoryView /></StaffShellHome> };
