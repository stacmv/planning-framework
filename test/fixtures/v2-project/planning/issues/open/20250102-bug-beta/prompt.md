# Bug: pagination skips the last page

Listing `/orders?page=N` returns an empty array for the final page whenever the
total row count is an exact multiple of the page size.

## Steps to reproduce

1. Seed exactly 40 orders.
2. Request `/orders?page=2&size=20`.
3. Observe: `[]` instead of orders 21..40.

## Expected

The last full page is returned.
