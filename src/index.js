require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const connectMongo = require('./config/mongo');

const app = express();
const PORT = process.env.PORT || 3000;

// middleware to parse json bodies
app.use(express.json());
app.use(cors());

// serve the frontend from the public folder
app.use(express.static(path.join(__dirname, '../public')));

// connect to mongodb
connectMongo();

// routes
app.use('/api/products', require('./routes/products'));
app.use('/api/migrate', require('./routes/migrate'));
app.use('/api/reports', require('./routes/reports'));

// simple health check
app.get('/api/health', (req, res) => {
  res.json({ message: 'MegaStore API is running', status: 'ok' });
});

// handle routes that don't exist
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
