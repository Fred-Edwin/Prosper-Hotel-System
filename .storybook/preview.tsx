import type { Preview } from "@storybook/nextjs-vite";

// The theme tokens are the single source of truth. Storybook renders against
// the same file the app does, so a story can never drift from the real styling.
import "../src/app/globals.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // Enterprise density: stories are judged at real sizes, not zoomed.
    layout: "padded",
    a11y: { test: "todo" },
  },
  decorators: [
    (Story) => (
      <div className="bg-background text-foreground">
        <Story />
      </div>
    ),
  ],
};

export default preview;
