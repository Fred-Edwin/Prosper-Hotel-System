// Products, ingredients, recipes, prices. See docs/architecture.md.

export { listProducts, findProductsByIds, listIngredients, findIngredientsByIds } from "./queries";
export {
  createProduct,
  updateProduct,
  deactivateProduct,
  reactivateProduct,
  createIngredient,
  updateIngredient,
  deactivateIngredient,
  reactivateIngredient,
  recordIngredientCost,
  createRecipe,
  getCurrentRecipe,
  getRecipeAt,
  listRecipeVersions,
} from "./logic";
export type { Product, ProductKind, Ingredient, Recipe, RecipeWithCost } from "./schema";
export {
  catalogueRoute,
  activeProductsRoute,
  activeIngredientsRoute,
  createProductRoute,
  updateProductRoute,
  setProductActiveRoute,
  createIngredientRoute,
  updateIngredientRoute,
  setIngredientActiveRoute,
  createRecipeRoute,
  recipeVersionsRoute,
} from "./routes";
