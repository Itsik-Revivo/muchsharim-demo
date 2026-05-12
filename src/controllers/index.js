const { get, all, run } = require('../db');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const XLSX  = require('xlsx');
const jp = (s) => { try { return JSON.parse(s||'[]'); } catch { return []; } };
const mapProj = p => p ? ({...p, employee_services:jp(p.employee_services), project_attributes:jp(p.project_attributes), waxman_services:jp(p.waxman_services)}) : null;

// ── AUTH ─────────────────────────────────────────────────────
exports.devLogin = (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });
  const jwt = require('jsonwebtoken');
  const SECRET = process.env.JWT_SECRET || 'muchsharim-demo-secret-2024';
  const emp = get('SELECT * FROM employees WHERE email=? AND is_active=1', [email]);
  if (!emp) return res.status(404).json({ error: `No active employee: ${email}` });
  const token = jwt.sign({ employee_id:emp.employee_id, email:emp.email, first_name:emp.first_name, last_name:emp.last_name, department:'', is_admin:emp.is_admin===1 }, SECRET, { expiresIn:'24h' });
  res.json({ token, user:{ employee_id:emp.employee_id, email:emp.email, name:`${emp.first_name} ${emp.last_name}`, is_admin:emp.is_admin===1 } });
};

// ── WAXMAN PROJECTS (mock) ────────────────────────────────────
exports.listWaxmanProjects = (req, res) => res.json({ projects: [], message: 'שליפת CRM בוטלה בגרסה 1.2' });
exports.getWaxmanProject   = (req, res) => res.status(410).json({ error: 'שליפת פרויקטי CRM בוטלה בגרסה 1.2' });

// ── EMPLOYEES ────────────────────────────────────────────────
exports.getMe = (req, res) => {
  const emp = get('SELECT * FROM employees WHERE employee_id=?', [req.user.employee_id]);
  if (!emp) return res.status(404).json({ error: 'Not found' });
  const degrees = all('SELECT * FROM employee_degrees WHERE employee_id=?', [emp.employee_id]);
  const pc = get('SELECT COUNT(*) as n FROM employee_projects WHERE employee_id=?', [emp.employee_id]);
  res.json({ ...emp, degrees, project_count: pc.n });
};

exports.updateMe = (req, res) => {
  const { first_name, last_name, first_name_en, last_name_en, phone, current_role,
          education_type, is_licensed_engineer, engineer_license_no, engineer_license_year,
          is_licensed_professional, license_expiry_date, additional_certs, degrees=[] } = req.body;
  run(`UPDATE employees SET first_name=?,last_name=?,first_name_en=?,last_name_en=?,phone=?,current_role=?,education_type=?,is_licensed_engineer=?,engineer_license_no=?,engineer_license_year=?,is_licensed_professional=?,license_expiry_date=?,additional_certs=?,updated_at=datetime('now') WHERE employee_id=?`,
    [first_name,last_name,first_name_en||null,last_name_en||null,phone,current_role,education_type||'מהנדס',is_licensed_engineer?1:0,engineer_license_no||null,engineer_license_year||null,is_licensed_professional?1:0,license_expiry_date||null,additional_certs||null,req.user.employee_id]);
  run('DELETE FROM employee_degrees WHERE employee_id=?', [req.user.employee_id]);
  for (const d of degrees)
    run('INSERT INTO employee_degrees (employee_id,degree_type,field_of_study,field_of_study_en,institution,study_start_year,graduation_year) VALUES (?,?,?,?,?,?,?)',
      [req.user.employee_id,d.degree_type,d.field_of_study,d.field_of_study_en||null,d.institution,d.study_start_year||null,d.graduation_year]);
  res.json({ message: 'Profile updated' });
};

exports.getStats = (_req, res) => {
  const row = get(`SELECT
    (SELECT COUNT(*) FROM employees WHERE is_active=1) total_employees,
    (SELECT COUNT(*) FROM employees WHERE is_active=1 AND form_submitted_at IS NOT NULL) filled_forms,
    (SELECT COUNT(*) FROM employees WHERE is_active=1 AND form_sent_at IS NOT NULL AND form_submitted_at IS NULL) pending_forms,
    (SELECT COUNT(*) FROM employees WHERE is_active=1 AND form_sent_at IS NULL AND form_submitted_at IS NULL) unsent_forms,
    (SELECT COUNT(*) FROM employee_projects ep JOIN employees e ON e.employee_id=ep.employee_id WHERE e.is_active=1) total_projects,
    (SELECT COUNT(*) FROM employee_projects ep JOIN employees e ON e.employee_id=ep.employee_id WHERE e.is_active=1 AND ep.domain='בינוי') projects_binui,
    (SELECT COUNT(*) FROM employee_projects ep JOIN employees e ON e.employee_id=ep.employee_id WHERE e.is_active=1 AND ep.domain='תשתיות') projects_tashtioth,
    (SELECT COUNT(*) FROM employee_projects ep JOIN employees e ON e.employee_id=ep.employee_id WHERE e.is_active=1 AND ep.domain='תב"ע') projects_tba,
    (SELECT COUNT(*) FROM employees WHERE is_active=1 AND is_licensed_professional=1 AND license_expiry_date IS NOT NULL AND license_expiry_date < date('now','+60 days')) expiring_licenses,
    (SELECT COUNT(*) FROM employees WHERE is_active=0) inactive_employees`);
  res.json(row);
};

exports.listEmployees = (req, res) => {
  const { domain, is_licensed_engineer, is_licensed_professional, license_status, service,
          education_type, employer_name, project_type, name, show_inactive, page=1, limit=50 } = req.query;
  const conditions = [show_inactive==='true' ? '1=1' : 'e.is_active=1'];
  const params = [];

  if (name) { conditions.push('(e.first_name LIKE ? OR e.last_name LIKE ? OR e.email LIKE ?)'); params.push(`%${name}%`,`%${name}%`,`%${name}%`); }
  if (is_licensed_engineer!==undefined&&is_licensed_engineer!=='') { conditions.push('e.is_licensed_engineer=?'); params.push(is_licensed_engineer==='true'?1:0); }
  if (is_licensed_professional!==undefined&&is_licensed_professional!=='') { conditions.push('e.is_licensed_professional=?'); params.push(is_licensed_professional==='true'?1:0); }
  if (license_status==='expired') { conditions.push("e.license_expiry_date < date('now')"); }
  else if (license_status==='expiring') { conditions.push("e.license_expiry_date BETWEEN date('now') AND date('now','+60 days')"); }
  if (education_type) { conditions.push('e.education_type=?'); params.push(education_type); }
  if (domain) { conditions.push('EXISTS (SELECT 1 FROM employee_projects ep WHERE ep.employee_id=e.employee_id AND ep.domain=?)'); params.push(domain); }
  if (project_type) { conditions.push('EXISTS (SELECT 1 FROM employee_projects ep WHERE ep.employee_id=e.employee_id AND ep.project_type=?)'); params.push(project_type); }
  if (employer_name) { conditions.push('EXISTS (SELECT 1 FROM employee_projects ep WHERE ep.employee_id=e.employee_id AND ep.employer_name LIKE ?)'); params.push(`%${employer_name}%`); }
  if (service) {
    const svcs = service.split(',');
    for (const s of svcs) { conditions.push('EXISTS (SELECT 1 FROM employee_projects ep WHERE ep.employee_id=e.employee_id AND ep.employee_services LIKE ?)'); params.push(`%${s}%`); }
  }

  const where = conditions.join(' AND ');
  const total = get(`SELECT COUNT(*) as n FROM employees e WHERE ${where}`, params).n;
  const offset = (parseInt(page)-1)*parseInt(limit);
  const rows = all(`SELECT e.employee_id,e.first_name,e.last_name,e.email,e.current_role,e.education_type,e.is_licensed_engineer,e.is_licensed_professional,e.license_expiry_date,e.form_submitted_at,e.form_sent_at,e.is_admin,e.is_active,(SELECT COUNT(*) FROM employee_projects ep WHERE ep.employee_id=e.employee_id) project_count,(SELECT GROUP_CONCAT(DISTINCT ep.domain) FROM employee_projects ep WHERE ep.employee_id=e.employee_id) domains,(SELECT ed.degree_type FROM employee_degrees ed WHERE ed.employee_id=e.employee_id ORDER BY ed.graduation_year DESC LIMIT 1) top_degree FROM employees e WHERE ${where} ORDER BY e.last_name,e.first_name LIMIT ? OFFSET ?`, [...params,parseInt(limit),offset]);
  res.json({ total, page:parseInt(page), limit:parseInt(limit), pages:Math.ceil(total/parseInt(limit)), employees:rows });
};

exports.listProjects = (req, res) => {
  const { domain, project_type, employer_name, service, name, is_waxman } = req.query;
  const conditions = ['e.is_active=1'];
  const params = [];
  if (domain) { conditions.push('ep.domain=?'); params.push(domain); }
  if (project_type) { conditions.push('ep.project_type=?'); params.push(project_type); }
  if (employer_name) { conditions.push('ep.employer_name LIKE ?'); params.push(`%${employer_name}%`); }
  if (service) { conditions.push('ep.employee_services LIKE ?'); params.push(`%${service}%`); }
  if (name) { conditions.push('(ep.project_name LIKE ? OR ep.client_name LIKE ?)'); params.push(`%${name}%`,`%${name}%`); }
  if (is_waxman!==undefined&&is_waxman!=='') { conditions.push('ep.is_waxman_project=?'); params.push(is_waxman==='true'?1:0); }
  const where = conditions.join(' AND ');
  const rows = all(`SELECT ep.*,e.first_name||' '||e.last_name emp_name,e.email emp_email FROM employee_projects ep JOIN employees e ON e.employee_id=ep.employee_id WHERE ${where} ORDER BY ep.employee_service_start DESC LIMIT 100`, params);
  res.json({ total: rows.length, projects: rows.map(p=>({...p,employee_services:jp(p.employee_services),project_attributes:jp(p.project_attributes)})) });
};

exports.getEmployee = (req, res) => {
  const emp = get('SELECT * FROM employees WHERE employee_id=?', [parseInt(req.params.id)]);
  if (!emp) return res.status(404).json({ error: 'Not found' });
  const degrees  = all('SELECT * FROM employee_degrees WHERE employee_id=?', [emp.employee_id]);
  const projects = all('SELECT * FROM employee_projects WHERE employee_id=? ORDER BY employee_service_start DESC', [emp.employee_id]).map(mapProj);
  res.json({ ...emp, degrees, projects });
};

exports.toggleActive = (req, res) => {
  const id = parseInt(req.params.id);
  const emp = get('SELECT is_active FROM employees WHERE employee_id=?', [id]);
  if (!emp) return res.status(404).json({ error: 'Not found' });
  run('UPDATE employees SET is_active=?,updated_at=datetime(\'now\') WHERE employee_id=?', [emp.is_active?0:1, id]);
  res.json({ message: 'Updated', is_active: !emp.is_active });
};

exports.getExpiringLicenses = (req, res) => {
  const { days=60 } = req.query;
  const rows = all(`SELECT employee_id,first_name,last_name,email,engineer_license_no,license_expiry_date FROM employees WHERE is_active=1 AND is_licensed_professional=1 AND license_expiry_date IS NOT NULL AND license_expiry_date <= date('now','+${parseInt(days)} days') ORDER BY license_expiry_date`);
  res.json({ count: rows.length, employees: rows });
};

// ── PROJECTS ─────────────────────────────────────────────────
exports.getMyProjects = (req, res) => {
  res.json(all('SELECT * FROM employee_projects WHERE employee_id=? ORDER BY employee_service_start DESC', [req.user.employee_id]).map(mapProj));
};

exports.createProject = (req, res) => {
  const p = req.body;
  if (!p.project_name||!p.domain||!p.client_name||!p.client_type||!p.employee_services?.length||!p.employee_service_start||!p.description)
    return res.status(422).json({ error: 'Missing required fields' });
  const result = run(`INSERT INTO employee_projects (employee_id,is_waxman_project,employer_name,project_name,project_name_en,domain,project_type,includes_tba,project_attributes,floors_above,floors_below,description,description_en,waxman_services,employee_services,area_sqm,client_name,client_name_en,client_type,financial_scope_known,financial_scope_range,financial_scope,contractor_cost,waxman_partner_name,waxman_service_start,employee_service_start,waxman_service_end,employee_service_end,planning_start,planning_end,execution_start,execution_end,form4_date,completion_cert_date,road_opening_date,referee_name,referee_role,referee_phone,referee_email) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [req.user.employee_id,p.is_waxman_project?1:0,p.employer_name||null,p.project_name,p.project_name_en||null,p.domain,p.project_type||null,p.includes_tba?1:0,JSON.stringify(p.project_attributes||[]),p.floors_above||null,p.floors_below||null,p.description,p.description_en||null,JSON.stringify(p.waxman_services||[]),JSON.stringify(p.employee_services),p.area_sqm||null,p.client_name,p.client_name_en||null,p.client_type,p.financial_scope_known?1:0,p.financial_scope_range||null,p.financial_scope||null,p.contractor_cost||null,p.waxman_partner_name||null,p.waxman_service_start||null,p.employee_service_start,p.waxman_service_end||null,p.employee_service_end||null,p.planning_start||null,p.planning_end||null,p.execution_start||null,p.execution_end||null,p.form4_date||null,p.completion_cert_date||null,p.road_opening_date||null,p.referee_name||'',p.referee_role||'',p.referee_phone||'',p.referee_email||'']);
  const pid = result.lastInsertRowid;
  const created = get('SELECT * FROM employee_projects WHERE project_id=?', [pid]);
  res.status(201).json(mapProj(created) || { project_id: pid, project_name: req.body.project_name });
};

exports.updateProject = (req, res) => {
  const pid = parseInt(req.params.projectId);
  if (!get('SELECT project_id FROM employee_projects WHERE project_id=? AND employee_id=?', [pid,req.user.employee_id]))
    return res.status(404).json({ error: 'Project not found' });
  const p = req.body;
  run(`UPDATE employee_projects SET project_name=?,domain=?,project_type=?,employer_name=?,is_waxman_project=?,client_name=?,client_type=?,financial_scope_known=?,financial_scope_range=?,financial_scope=?,description=?,employee_services=?,employee_service_start=?,employee_service_end=?,referee_name=?,referee_role=?,referee_phone=?,referee_email=?,updated_at=datetime('now') WHERE project_id=?`,
    [p.project_name,p.domain,p.project_type||null,p.employer_name||null,p.is_waxman_project?1:0,p.client_name,p.client_type,p.financial_scope_known?1:0,p.financial_scope_range||null,p.financial_scope||null,p.description||'',JSON.stringify(p.employee_services||[]),p.employee_service_start,p.employee_service_end||null,p.referee_name||'',p.referee_role||'',p.referee_phone||'',p.referee_email||'',pid]);
  res.json({ message: 'Updated' });
};

exports.deleteProject = (req, res) => {
  const result = run('DELETE FROM employee_projects WHERE project_id=? AND employee_id=?', [parseInt(req.params.projectId),req.user.employee_id]);
  if (result.changes===0) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Deleted' });
};

// ── FORMS ────────────────────────────────────────────────────
exports.validateToken = (req, res) => {
  const row = get(`SELECT fs.*,e.first_name,e.last_name,e.email FROM form_submissions fs JOIN employees e ON e.employee_id=fs.employee_id WHERE fs.token=? AND fs.token_expires_at>datetime('now') AND fs.submitted_at IS NULL`, [req.params.token]);
  if (!row) return res.status(404).json({ error: 'Token not found or expired' });
  res.json({ employee_id:row.employee_id, first_name:row.first_name, last_name:row.last_name, email:row.email, expires_at:row.token_expires_at });
};
exports.submitToken = (req, res) => {
  const row = get(`SELECT * FROM form_submissions WHERE token=? AND token_expires_at>datetime('now') AND submitted_at IS NULL`, [req.params.token]);
  if (!row) return res.status(404).json({ error: 'Invalid token' });
  run(`UPDATE form_submissions SET submitted_at=datetime('now') WHERE submission_id=?`, [row.submission_id]);
  run(`UPDATE employees SET form_submitted_at=datetime('now') WHERE employee_id=?`, [row.employee_id]);
  res.json({ message: 'Submitted', employee_id: row.employee_id });
};
exports.sendForms = (req, res) => {
  const { scope, department, employee_ids } = req.body;
  let targets = [];
  if (scope==='all') targets = all('SELECT employee_id,email,first_name FROM employees WHERE is_active=1');
  else if (scope==='department') targets = all('SELECT employee_id,email,first_name FROM employees WHERE is_active=1 AND department=?', [department]);
  else if (scope==='manual') targets = all(`SELECT employee_id,email,first_name FROM employees WHERE employee_id IN (${employee_ids.map(()=>'?').join(',')})`, employee_ids);
  const expires = dayjs().add(30,'day').toISOString();
  let sent=0;
  for (const emp of targets) {
    run('INSERT INTO form_submissions (employee_id,sent_by_id,trigger_type,token,token_expires_at) VALUES (?,?,?,?,?)', [emp.employee_id,req.user.employee_id,'manual',uuidv4(),expires]);
    run(`UPDATE employees SET form_sent_at=datetime('now') WHERE employee_id=?`, [emp.employee_id]);
    sent++;
  }
  res.json({ sent, total:targets.length, message:`טפסים נשלחו ל-${sent} עובדים` });
};

exports.exportExcel = (_req, res) => {
  const emps = all(`SELECT e.first_name||' '||e.last_name name,e.email,e.phone,e.current_role,e.education_type,CASE e.is_licensed_engineer WHEN 1 THEN 'כן' ELSE 'לא' END lic_eng,e.engineer_license_no,CASE e.is_licensed_professional WHEN 1 THEN 'כן' ELSE 'לא' END lic_prof,e.license_expiry_date,(SELECT GROUP_CONCAT(ed.degree_type||' '||ed.field_of_study,'; ') FROM employee_degrees ed WHERE ed.employee_id=e.employee_id) degrees FROM employees e WHERE e.is_active=1 ORDER BY e.last_name`);
  const projs = all(`SELECT e.first_name||' '||e.last_name emp_name,e.email,ep.project_name,ep.domain,ep.project_type,ep.employer_name,CASE ep.is_waxman_project WHEN 1 THEN 'וקסמן' ELSE 'חיצוני' END source,ep.client_name,ep.client_type,ep.financial_scope_range,ep.employee_service_start,ep.employee_service_end,ep.employee_services,ep.description FROM employee_projects ep JOIN employees e ON e.employee_id=ep.employee_id ORDER BY e.last_name,ep.employee_service_start DESC`);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(emps.map(e=>({'שם מלא':e.name,'דוא"ל':e.email,'טלפון':e.phone,'תפקיד':e.current_role,'סוג השכלה':e.education_type,'מהנדס רשום':e.lic_eng,'מספר רישום':e.engineer_license_no||'','מהנדס רשוי':e.lic_prof,'תוקף רישוי':e.license_expiry_date||'','תארים':e.degrees||''}))), 'עובדים');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(projs.map(p=>({'שם עובד':p.emp_name,'שם פרויקט':p.project_name,'תחום':p.domain,'סוג פרויקט':p.project_type||'','מקור':p.source,'מעסיק':p.employer_name||'','מזמין':p.client_name,'סוג מזמין':p.client_type,'היקף':p.financial_scope_range||'','תחילת':p.employee_service_start||'','סיום':p.employee_service_end||'','שירותים':p.employee_services||''}))), 'פרויקטים');
  const buf = XLSX.write(wb, { type:'buffer', bookType:'xlsx' });
  res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition',`attachment; filename="muchsharim_${dayjs().format('YYYY-MM-DD')}.xlsx"`);
  res.send(buf);
};
