require('dotenv').config();
const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const { initDb } = require('./db');
const routes  = require('./routes');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', version: '1.0.0-demo', db: 'SQLite (sql.js)' }));
app.use('/api', routes);

app.get('/', (_req, res) => res.sendFile(require('path').join(__dirname, '../public/playground.html')));

app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

initDb().then(() => {
  app.listen(PORT, () => console.log('Muchsharim Demo API → http://localhost:' + PORT));
}).catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});

module.exports = app;
