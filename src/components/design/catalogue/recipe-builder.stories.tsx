import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecipeBuilder } from "./recipe-builder";
import { VersionHistory } from "./versions";
import { DetailCard } from "@/components/patterns/detail-page";
import { recipes } from "@/lib/fixtures";

/**
 * The recipe builder.
 *
 * Frozen here deliberately, because it is **a page, not a template** — two
 * panels with a pinned cost exists nowhere else in the app, and only recipes
 * use it. A story is how a future ticket sees that it exists rather than
 * inventing a third editor shape.
 *
 * Its hierarchy comes from surfaces at three weights, not from colour: the
 * picker recesses on a muted ground, the recipe sits forward on white, and the
 * cost panel is a filled dark surface because it is the output — the one number
 * every profit figure in the app depends on.
 */
const meta = {
  title: "Pages/RecipeBuilder",
  component: RecipeBuilder,
  parameters: { layout: "padded" },
} satisfies Meta<typeof RecipeBuilder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { recipe: recipes[0] },
};

/** With the version history in its own column, under the cost it explains. */
export const WithHistory: Story = {
  args: {
    recipe: recipes[0],
    aside: (
      <DetailCard
        title="Version history"
        flush
        footnote="A change is a new version from a date. Past figures keep the recipe they were costed with, so a closed month never restates itself."
      >
        <VersionHistory recipe={recipes[0]} />
      </DetailCard>
    ),
  },
};

/** A longer recipe — the case the arithmetic form handled badly. */
export const LongerRecipe: Story = {
  args: { recipe: recipes[2] },
};

/**
 * A recipe with nothing in it yet. The cost reads KSh 0 rather than "—" because
 * a batch of nothing genuinely costs nothing; the per-unit figure is what goes
 * unknown when the yield is blank.
 */
export const Empty: Story = {
  args: {
    recipe: {
      ...recipes[0],
      versions: [{ ...recipes[0].versions[0], lines: [], yield: 0 }],
    },
  },
};
