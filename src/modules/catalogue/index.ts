// Products, ingredients, recipes, prices. See docs/architecture.md.

export { listProducts, findProductsByIds, listIngredients } from "./queries";
export {
  createProduct,
  updateProduct,
  deactivateProduct,
  reactivateProduct,
  createIngredient,
  updateIngredient,
  deactivateIngredient,
  reactivateIngredient,
  createRecipe,
  getCurrentRecipe,
  getRecipeAt,
  listRecipeVersions,
} from "./logic";
export type { Product, ProductKind, Ingredient, Recipe, RecipeWithCost } from "./schema";
export {
  catalogueRoute,
  createProductRoute,
  updateProductRoute,
  setProductActiveRoute,
  createIngredientRoute,
  updateIngredientRoute,
  setIngredientActiveRoute,
  createRecipeRoute,
  recipeVersionsRoute,
} from "./routes";
