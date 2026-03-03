const { Pool } = require('pg');
require('dotenv').config();

// creating the connection pool for postgresql
const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
});

// test the connection when the app starts
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to PostgreSQL:', err.message);
    return;
  }
  release();
  console.log('PostgreSQL connected successfully');
});

module.exports = pool;
