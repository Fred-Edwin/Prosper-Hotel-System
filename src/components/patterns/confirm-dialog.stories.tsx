import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { ConfirmDialog } from "./confirm-dialog";
import { Button } from "@/components/ui/button";

const meta = {
  title: "Patterns/ConfirmDialog",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Deactivate: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Deactivate Chips
        </Button>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Deactivate Chips?"
          description="It will no longer appear on the till or in new recipes. Its history is kept, and it can be reactivated at any time."
          confirmLabel="Deactivate"
          onConfirm={() => {}}
        />
      </>
    );
  },
};

export const Destructive: Story = {
  name: "Destructive action",
  render: function Render() {
    const [open, setOpen] = useState(true);
    return (
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete invoice INV-2024-0142?"
        description="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {}}
      />
    );
  },
};
