# MegaStore Global API

For this assessment I had to take an Excel file that a company called MegaStore Global had been using to track everything — sales, customers, suppliers, products — all in the same spreadsheet, same rows, mixed together. The goal was to migrate that into an actual database structure and build an API on top of it.

The stack I used is Node.js with Express for the backend, PostgreSQL for the relational data and MongoDB for the audit logs. There's also a small frontend made with Bootstrap so you can interact with everything from the browser without needing Postman.

---

## Things you need installed before starting

- Node.js (v18+)
- PostgreSQL — I used DBeaver Community to manage it, it's easier visually
- MongoDB running locally
- Git

---

## Getting it running

**First, clone the project and install the packages:**

```bash
git clone <repo-url>
cd megastore-api
npm install
```

**Then create the `.env` file.** There's a `.env.example` already in the project, just copy it and fill in your own values:

```
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=tu_contraseña_de_postgres
PG_DATABASE=db_megastore_exam

MONGO_URI=mongodb://localhost:27017/db_megastore_exam

PORT=3000
```

If you don't remember your PostgreSQL password, check your DBeaver connection — it's saved there.

---

**Create the database and tables in DBeaver:**

1. Right click on your PostgreSQL connection → Create → Database → name it `db_megastore_exam`
2. Right click on the new database → SQL Editor → Open SQL Script
3. Open the file `docs/schema.sql` from this project
4. Hit Ctrl + Alt + X to run it

After that you should see 6 tables under `db_megastore_exam → Schemas → public → Tables`.

---

**Start the server:**

```bash
npm run dev
```

If it connected correctly the terminal shows:

```
Server running on port 3000
PostgreSQL connected successfully
MongoDB connected successfully
```

---

**Load the data:**

Go to `http://localhost:3000` in the browser, open the Migration tab and click Run Migration. That reads the CSV from `docs/data.csv` and fills all the tables.

Running it twice won't break anything — it detects existing records and skips them. The second run should show `inserted: 0, skipped: 31`.

---

## Endpoints

### Products

```
GET    /api/products          → list all products
GET    /api/products/:id      → get one by id
POST   /api/products          → create
PUT    /api/products/:id      → update
DELETE /api/products/:id      → delete (also saves a log in MongoDB)
```

Body for POST and PUT:
```json
{
  "sku": "TEST-001",
  "name": "Test Product",
  "unit_price": 99000,
  "category_id": 1,
  "supplier_id": 1
}
```

### Migration

```
POST /api/migrate   → loads docs/data.csv into the database
```

### Reports

```
GET /api/reports/suppliers
GET /api/reports/customer/:email
GET /api/reports/top-products/:category
```

Examples:
```
GET /api/reports/customer/andres.lopez@gmail.com
GET /api/reports/top-products/Electronics
GET /api/reports/top-products/Home
```

There's also a Postman collection at `docs/postman_collection.json` if you prefer testing from there.

---

## Why I structured the database this way

### PostgreSQL

The original CSV had everything in one row — customer name, email, address, product details, supplier info and the transaction, all together. The issue with that is if the same customer made 20 purchases, their address was repeated 20 times. One typo and suddenly you have two different customers in the data.

So I split it into 6 tables. Basically each entity lives in its own place:

- Each customer exists once, identified by their email
- Each product exists once, identified by the SKU
- Suppliers and categories also have their own tables
- Orders link to a customer, and order_items link to an order and a product

That way if a supplier changes their email you update it in one row, not in every product that references them.

```
customers → orders → order_items ← products ← categories
                                            ← suppliers
```

One thing I also kept in mind: `unit_price_at_sale` in order_items is stored separately from the product's current price. That way if a product's price changes later, old orders still show what was actually charged at the time.

### MongoDB

I only used MongoDB for the audit logs. Every time a product gets deleted through the API, a document is saved in `audit_logs` with all the product data from that moment.

I picked MongoDB for this because audit logs don't really fit in a relational table — the structure might change over time if you want to start logging other things, and you don't need joins or foreign keys here.

The deleted product info is stored directly inside the document, not as a reference. The reason is simple: if I only saved the product ID and the product is already gone from PostgreSQL, that reference points to nothing. Embedding saves the full snapshot so you always have the data even after the original record is deleted.
