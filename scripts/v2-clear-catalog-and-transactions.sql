-- Clears catalogue + all transactional data that references it, so the
-- real catalog can be imported clean. Mirrors
-- scripts/clear-catalog-and-transactions.ts exactly. Does NOT touch
-- locations, staff_members, or sessions.
BEGIN;

DELETE FROM drawing_repayments;
DELETE FROM drawing_debts;
DELETE FROM assets;
DELETE FROM expenses;
DELETE FROM days_worked;
DELETE FROM handovers;
DELETE FROM stock_count_lines;
DELETE FROM stock_counts;
DELETE FROM payment_lines;
DELETE FROM sale_lines;
DELETE FROM sales;
DELETE FROM repayments;
DELETE FROM customers;
DELETE FROM recipe_lines;
DELETE FROM recipes;
DELETE FROM ingredient_movements;
DELETE FROM ingredients;
DELETE FROM transfers;
DELETE FROM stock_movements;
DELETE FROM products;
DELETE FROM categories;

COMMIT;
