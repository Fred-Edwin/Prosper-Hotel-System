import type { Preview } from "@storybook/nextjs-vite";
import { Geist } from "next/font/google";
import { TooltipProvider } from "../src/components/ui/tooltip";
import { Toaster } from "../src/components/ui/sonner";
import { cn } from "../src/lib/utils";

// The theme tokens are the single source of truth. Storybook renders against
// the same file the app does, so a story can never drift from the real styling.
import "../src/app/globals.css";

/**
 * Everything `src/app/layout.tsx` provides, provided here too.
 *
 * Without this a story is not rendering the same component the app renders —
 * the sidebar's tooltips throw for want of a provider, and the type falls back
 * to a serif because the font variable is missing. A story that lies about its
 * component is worse than no story.
 */
const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

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
      <div className={cn("font-sans bg-background text-foreground", geist.variable)}>
        <TooltipProvider>
          <Story />
        </TooltipProvider>
        <Toaster />
      </div>
    ),
  ],
};

export default preview;
