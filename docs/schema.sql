-- drop tables in correct order (fks first)
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS customers;

-- the original csv had customer info repeated in every row, so we extract it here
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    address VARCHAR(255),
    phone VARCHAR(30)
);

-- suppliers table
CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE
);

-- separating category into its own table avoids repeating the string everywhere
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

-- each product belongs to a category and has one main supplier
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    unit_price  NUMERIC(12, 2) NOT NULL CHECK (unit_price > 0),
    category_id INT NOT NULL REFERENCES categories(id),
    supplier_id INT NOT NULL REFERENCES suppliers(id)
);

-- orders table
-- one order per original transaction_id
CREATE TABLE orders (
    id              SERIAL PRIMARY KEY,
    transaction_id  VARCHAR(20)  NOT NULL UNIQUE,
    order_date      DATE         NOT NULL,
    customer_id     INT          NOT NULL REFERENCES customers(id)
);

-- we store the price at the time of purchase so history is preserved
CREATE TABLE order_items (
    id  SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES orders(id),
    product_id INT NOT NULL REFERENCES products(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price_at_sale  NUMERIC(12, 2) NOT NULL
);
