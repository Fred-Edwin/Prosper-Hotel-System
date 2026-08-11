// Products, ingredients, recipes, prices. See docs/architecture.md.

export {
  listProducts,
  findProductsByIds,
  listIngredients,
  findIngredientsByIds,
  listActiveAssets as listAssets,
} from "./queries";
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
  recordProductCost,
  createRecipe,
  getCurrentRecipe,
  getRecipeAt,
  listRecipeVersions,
  createAsset,
  updateAssetQuantity,
  linkAssetExpense,
  retireAsset,
} from "./logic";
export type { Product, ProductKind, Ingredient, Recipe, RecipeWithCost, Asset } from "./schema";
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
  createAssetRoute,
  updateAssetQuantityRoute,
  linkAssetExpenseRoute,
  retireAssetRoute,
} from "./routes";
