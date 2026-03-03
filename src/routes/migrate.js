const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const pool = require('../config/db');

// POST /api/migrate
// reads the csv file and loads all the data into postgres
// it skips duplicates using ON CONFLICT so it's safe to run multiple times
router.post('/', async (req, res) => {
  const csvPath = path.join(__dirname, '../../docs/data.csv');

  // check if the file exists before trying to read it
  if (!fs.existsSync(csvPath)) {
    return res.status(404).json({ error: 'CSV file not found in /docs folder' });
  }

  const rows = [];

  // first i read all the rows into memory, then i process them
  fs.createReadStream(csvPath)
    .pipe(csv())
    .on('data', (row) => {
      rows.push(row);
    })
    .on('error', (err) => {
      return res.status(500).json({ error: 'Error reading CSV: ' + err.message });
    })
    .on('end', async () => {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        let inserted = 0;
        let skipped = 0;

        for (const row of rows) {
          // -- STEP 1: upsert category --
          const catResult = await client.query(
            `INSERT INTO categories (name)
             VALUES ($1)
             ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
             RETURNING id`,
            [row.product_category.trim()]
          );
          const categoryId = catResult.rows[0].id;

          // -- STEP 2: upsert supplier --
          const supResult = await client.query(
            `INSERT INTO suppliers (name, email)
             VALUES ($1, $2)
             ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
             RETURNING id`,
            [row.supplier_name.trim(), row.supplier_email.trim().toLowerCase()]
          );
          const supplierId = supResult.rows[0].id;

          // -- STEP 3: upsert customer --
          const custResult = await client.query(
            `INSERT INTO customers (full_name, email, address, phone)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
             RETURNING id`,
            [
              row.customer_name.trim(),
              row.customer_email.trim().toLowerCase(),
              row.customer_address.trim(),
              row.customer_phone.trim(),
            ]
          );
          const customerId = custResult.rows[0].id;

          // -- STEP 4: upsert product --
          const prodResult = await client.query(
            `INSERT INTO products (sku, name, unit_price, category_id, supplier_id)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (sku) DO UPDATE SET name = EXCLUDED.name, unit_price = EXCLUDED.unit_price
             RETURNING id`,
            [
              row.product_sku.trim(),
              row.product_name.trim(),
              parseFloat(row.unit_price),
              categoryId,
              supplierId,
            ]
          );
          const productId = prodResult.rows[0].id;

          // -- STEP 5: insert order (skip if transaction_id already exists) --
          const orderCheck = await client.query(
            'SELECT id FROM orders WHERE transaction_id = $1',
            [row.transaction_id.trim()]
          );

          if (orderCheck.rows.length > 0) {
            skipped++;
            continue; // this transaction was already loaded, skip it
          }

          const orderResult = await client.query(
            `INSERT INTO orders (transaction_id, order_date, customer_id)
             VALUES ($1, $2, $3)
             RETURNING id`,
            [row.transaction_id.trim(), row.date.trim(), customerId]
          );
          const orderId = orderResult.rows[0].id;

          // -- STEP 6: insert order item --
          await client.query(
            `INSERT INTO order_items (order_id, product_id, quantity, unit_price_at_sale)
             VALUES ($1, $2, $3, $4)`,
            [orderId, productId, parseInt(row.quantity), parseFloat(row.unit_price)]
          );

          inserted++;
        }

        await client.query('COMMIT');

        res.status(200).json({
          message: 'Migration completed',
          total_rows: rows.length,
          inserted,
          skipped,
        });
      } catch (error) {
        await client.query('ROLLBACK');
        console.error('Migration error:', error.message);
        res.status(500).json({ error: 'Migration failed: ' + error.message });
      } finally {
        client.release();
      }
    });
});

module.exports = router;
