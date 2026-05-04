const router = require('express').Router();
const { authenticate, requireAdmin, devLogin } = require('../middleware/auth');
const c = require('../controllers');

// Auth
router.post('/auth/login', devLogin);

// Employee (self)
router.get ('/employees/me',                  authenticate, c.getMe);
router.put ('/employees/me',                  authenticate, c.updateMe);
router.get ('/employees/me/projects',         authenticate, c.getMyProjects);
router.post('/employees/me/projects',         authenticate, c.createProject);
router.put ('/employees/me/projects/:projectId', authenticate, c.updateProject);
router.delete('/employees/me/projects/:projectId', authenticate, c.deleteProject);

// Waxman projects
router.get('/waxman-projects',     authenticate, c.listWaxmanProjects);
router.get('/waxman-projects/:id', authenticate, c.getWaxmanProject);

// Form tokens (public)
router.get ('/forms/token/:token',        c.validateToken);
router.post('/forms/token/:token/submit', c.submitToken);

// Admin
router.get ('/admin/stats',         authenticate, requireAdmin, c.getStats);
router.get ('/admin/employees',     authenticate, requireAdmin, c.listEmployees);
router.get ('/admin/employees/:id', authenticate, requireAdmin, c.getEmployee);
router.post('/admin/forms/send',    authenticate, requireAdmin, c.sendForms);
router.get ('/admin/export',        authenticate, requireAdmin, c.exportExcel);

module.exports = router;
