const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET /api/reports/suppliers
// shows which suppliers sold the most products (by quantity)
// and the total inventory value associated to each one
router.get('/suppliers', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.name                          AS supplier,
        s.email                         AS supplier_email,
        SUM(oi.quantity)                AS total_items_sold,
        SUM(oi.quantity * oi.unit_price_at_sale) AS total_inventory_value
      FROM suppliers s
      JOIN products p ON p.supplier_id = s.id
      JOIN order_items oi ON oi.product_id = p.id
      GROUP BY s.id, s.name, s.email
      ORDER BY total_items_sold DESC
    `);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Error running supplier report' });
  }
});

// GET /api/reports/customer/:email
// returns the purchase history for a specific customer
// shows each order with the products and the total spent
router.get('/customer/:email', async (req, res) => {
  const { email } = req.params;

  try {
    // first check if the customer exists
    const customerCheck = await pool.query(
      'SELECT * FROM customers WHERE email = $1',
      [email.toLowerCase()]
    );

    if (customerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const result = await pool.query(`
      SELECT
        o.transaction_id,
        o.order_date,
        p.name                              AS product,
        p.sku,
        oi.quantity,
        oi.unit_price_at_sale,
        (oi.quantity * oi.unit_price_at_sale) AS line_total
      FROM customers c
      JOIN orders o ON o.customer_id = c.id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      WHERE c.email = $1
      ORDER BY o.order_date DESC
    `, [email.toLowerCase()]);

    // group lines by transaction so it's easier to read
    const history = {};
    let grandTotal = 0;

    for (const row of result.rows) {
      if (!history[row.transaction_id]) {
        history[row.transaction_id] = {
          transaction_id: row.transaction_id,
          date: row.order_date,
          items: [],
          order_total: 0,
        };
      }
      history[row.transaction_id].items.push({
        product: row.product,
        sku: row.sku,
        quantity: row.quantity,
        unit_price: row.unit_price_at_sale,
        line_total: row.line_total,
      });
      history[row.transaction_id].order_total += Number(row.line_total);
      grandTotal += Number(row.line_total);
    }

    res.status(200).json({
      customer: customerCheck.rows[0].full_name,
      email: customerCheck.rows[0].email,
      total_spent: grandTotal,
      orders: Object.values(history),
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Error fetching customer history' });
  }
});

// GET /api/reports/top-products/:category
// returns the best selling products inside a category, ordered by revenue generated
router.get('/top-products/:category', async (req, res) => {
  const { category } = req.params;

  try {
    const result = await pool.query(`
      SELECT
        p.sku,
        p.name                                   AS product_name,
        c.name                                   AS category,
        SUM(oi.quantity)                         AS total_units_sold,
        SUM(oi.quantity * oi.unit_price_at_sale) AS total_revenue
      FROM products p
      JOIN categories c ON p.category_id = c.id
      JOIN order_items oi ON oi.product_id = p.id
      WHERE LOWER(c.name) = LOWER($1)
      GROUP BY p.id, p.sku, p.name, c.name
      ORDER BY total_revenue DESC
    `, [category]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No products found for that category' });
    }

    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Error running top products report' });
  }
});

module.exports = router;
