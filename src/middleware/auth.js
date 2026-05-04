const jwt = require('jsonwebtoken');
const { get } = require('../db');

const SECRET = process.env.JWT_SECRET || 'muchsharim-demo-secret-2024';

function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = jwt.verify(auth.split(' ')[1], SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) return res.status(403).json({ error: 'Admin access required' });
  next();
}

function devLogin(req, res) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });
  const emp = get('SELECT * FROM employees WHERE email=?', [email]);
  if (!emp) return res.status(404).json({ error: `No employee with email: ${email}` });
  const token = jwt.sign(
    { employee_id: emp.employee_id, email: emp.email,
      first_name: emp.first_name, last_name: emp.last_name,
      department: emp.department, is_admin: emp.is_admin === 1 },
    SECRET, { expiresIn: '24h' }
  );
  res.json({ token, user: { employee_id: emp.employee_id, email: emp.email,
    name: emp.first_name + ' ' + emp.last_name, is_admin: emp.is_admin === 1 } });
}

module.exports = { authenticate, requireAdmin, devLogin, SECRET };
