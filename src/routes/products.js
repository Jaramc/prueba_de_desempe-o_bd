const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const AuditLog = require('../models/AuditLog');

// GET /api/products
// returns all products with their category and supplier info
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.id,
        p.sku,
        p.name,
        p.unit_price,
        c.name AS category,
        s.name AS supplier
      FROM products p
      JOIN categories c ON p.category_id = c.id
      JOIN suppliers s ON p.supplier_id = s.id
      ORDER BY p.id
    `);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Something went wrong getting products' });
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT p.id, p.sku, p.name, p.unit_price,
              c.name AS category, s.name AS supplier
       FROM products p
       JOIN categories c ON p.category_id = c.id
       JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Error fetching product' });
  }
});

// POST /api/products
// body: { sku, name, unit_price, category_id, supplier_id }
router.post('/', async (req, res) => {
  const { sku, name, unit_price, category_id, supplier_id } = req.body;

  if (!sku || !name || !unit_price || !category_id || !supplier_id) {
    return res.status(400).json({ error: 'All fields are required: sku, name, unit_price, category_id, supplier_id' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO products (sku, name, unit_price, category_id, supplier_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [sku, name, unit_price, category_id, supplier_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    // sku already exists
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A product with that SKU already exists' });
    }
    console.error(error.message);
    res.status(500).json({ error: 'Error creating product' });
  }
});

// PUT /api/products/:id
// updates the product data
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { sku, name, unit_price, category_id, supplier_id } = req.body;

  if (!sku || !name || !unit_price || !category_id || !supplier_id) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const result = await pool.query(
      `UPDATE products
       SET sku = $1, name = $2, unit_price = $3, category_id = $4, supplier_id = $5
       WHERE id = $6
       RETURNING *`,
      [sku, name, unit_price, category_id, supplier_id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Error updating product' });
  }
});

// DELETE /api/products/:id
// deletes the product and saves an audit log in mongodb
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // get the product data before deleting it so we can store it in the log
    const found = await pool.query('SELECT * FROM products WHERE id = $1', [id]);

    if (found.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const productData = found.rows[0];

    await pool.query('DELETE FROM products WHERE id = $1', [id]);

    // save the audit log in mongodb
    await AuditLog.create({
      action: 'DELETE',
      entity: 'product',
      deleted_record: productData,
      performed_at: new Date(),
    });

    res.status(200).json({
      message: 'Product deleted successfully',
      deleted: productData,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Error deleting product' });
  }
});

module.exports = router;
