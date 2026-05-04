const { get, all, run } = require('../db');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const XLSX  = require('xlsx');
const jp = (s) => { try { return JSON.parse(s || '[]'); } catch { return []; } };
const mapProj = p => p ? ({ ...p, employee_services: jp(p.employee_services), project_attributes: jp(p.project_attributes), waxman_services: jp(p.waxman_services) }) : null;

// Waxman projects (mock until API provided)
const WP = [
  { id:'WX-001', project_name:'כביש 531 – הרחבה לשישה נתיבים', domain:'תשתיות', client_name:'נת"ע', client_type:'ציבורי', financial_scope:180000000, project_attributes:['כביש בינעירוני'], waxman_services:['ניהול ביצוע','פיקוח'], waxman_service_start:'2019-03', waxman_service_end:'2022-11', description:'הרחבת כביש 531 משני נתיבים לשישה נתיבים, כולל מחלפים, ניקוז, תאורה.' },
  { id:'WX-002', project_name:'מתחם מגורים "פארק נוה"', domain:'בינוי', client_name:'כנען השקעות', client_type:'יזם', financial_scope:220000000, project_attributes:['מגורים'], floors_above:14, floors_below:2, area_sqm:45000, waxman_services:['ניהול תכנון','פיקוח'], waxman_service_start:'2020-06', waxman_service_end:'2023-09', description:'פרויקט מגורים בן 280 יחידות, 14 קומות עיליות.' },
  { id:'WX-003', project_name:'קו רכבת קלה – פרויקט גוש דן', domain:'תשתיות', client_name:'רכבת ישראל', client_type:'ציבורי', financial_scope:950000000, project_attributes:['רכבת קלה'], waxman_services:['ניהול תכנון','ניהול ביצוע'], waxman_service_start:'2018-01', waxman_service_end:'2024-12', description:'תכנון וניהול ביצוע של 18 ק"מ מסילה עם 22 תחנות.' },
  { id:'WX-004', project_name:'תכנית מתאר עיר חדרה', domain:'תב"ע', client_name:'עיריית חדרה', client_type:'ציבורי', financial_scope:8000000, project_attributes:[], waxman_services:['ניהול תכנית בניין עיר'], waxman_service_start:'2021-02', waxman_service_end:'2022-08', description:'ניהול תכנית מתאר מקומית, ועדה מחוזית.' },
  { id:'WX-005', project_name:'מרכז לוגיסטי "אשדוד לוג"', domain:'בינוי', client_name:'דקסל נדל"ן', client_type:'יזם', financial_scope:130000000, project_attributes:['מרלו"ג'], floors_above:3, floors_below:0, area_sqm:38000, waxman_services:['ניהול ביצוע'], waxman_service_start:'2020-09', waxman_service_end:'2022-05', description:'מרכז לוגיסטי 38,000 מ"ר, 3 קומות.' },
  { id:'WX-006', project_name:'מחלף גלילות – שדרוג', domain:'תשתיות', client_name:'נת"ל', client_type:'ציבורי', financial_scope:320000000, project_attributes:['מחלף'], waxman_services:['ניהול ביצוע','פיקוח'], waxman_service_start:'2022-01', waxman_service_end:null, description:'שדרוג מחלף גלילות – הרחבת גשרים.' },
];
exports.listWaxmanProjects = (req, res) => {
  const { search, domain } = req.query;
  let list = WP;
  if (search) list = list.filter(p => p.project_name.includes(search) || p.client_name.includes(search));
  if (domain) list = list.filter(p => p.domain === domain);
  res.json({ projects: list });
};
exports.getWaxmanProject = (req, res) => {
  const p = WP.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(p);
};

// Employees
exports.getMe = (req, res) => {
  const emp = get('SELECT * FROM employees WHERE employee_id=?', [req.user.employee_id]);
  if (!emp) return res.status(404).json({ error: 'Not found' });
  const degrees = all('SELECT * FROM employee_degrees WHERE employee_id=?', [emp.employee_id]);
  const pc = get('SELECT COUNT(*) as n FROM employee_projects WHERE employee_id=?', [emp.employee_id]);
  res.json({ ...emp, degrees, project_count: pc.n });
};
exports.updateMe = (req, res) => {
  const { first_name, last_name, first_name_en, last_name_en, phone, department, current_role,
          is_licensed_engineer, engineer_license_no, engineer_license_year, additional_certs, degrees=[] } = req.body;
  run(`UPDATE employees SET first_name=?,last_name=?,first_name_en=?,last_name_en=?,phone=?,department=?,current_role=?,is_licensed_engineer=?,engineer_license_no=?,engineer_license_year=?,additional_certs=?,updated_at=datetime('now') WHERE employee_id=?`,
    [first_name,last_name,first_name_en||null,last_name_en||null,phone,department,current_role,
     is_licensed_engineer?1:0,engineer_license_no||null,engineer_license_year||null,additional_certs||null,req.user.employee_id]);
  run('DELETE FROM employee_degrees WHERE employee_id=?', [req.user.employee_id]);
  for (const d of degrees)
    run('INSERT INTO employee_degrees (employee_id,degree_type,field_of_study,field_of_study_en,institution,graduation_year) VALUES (?,?,?,?,?,?)',
      [req.user.employee_id, d.degree_type, d.field_of_study, d.field_of_study_en||null, d.institution, d.graduation_year]);
  res.json({ message: 'Profile updated' });
};
exports.getStats = (_req, res) => {
  const row = get(`SELECT (SELECT COUNT(*) FROM employees WHERE is_active=1) total_employees,(SELECT COUNT(*) FROM employees WHERE is_active=1 AND form_submitted_at IS NOT NULL) filled_forms,(SELECT COUNT(*) FROM employees WHERE is_active=1 AND form_sent_at IS NOT NULL AND form_submitted_at IS NULL) pending_forms,(SELECT COUNT(*) FROM employees WHERE is_active=1 AND form_sent_at IS NULL AND form_submitted_at IS NULL) unsent_forms,(SELECT COUNT(*) FROM employee_projects) total_projects,(SELECT COUNT(*) FROM employee_projects WHERE domain='בינוי') projects_binui,(SELECT COUNT(*) FROM employee_projects WHERE domain='תשתיות') projects_tashtioth,(SELECT COUNT(DISTINCT employee_id) FROM employee_projects) employees_with_projects`);
  res.json(row);
};
exports.listEmployees = (req, res) => {
  const { domain, is_licensed_engineer, min_budget, service, degree_type, name, page=1, limit=50 } = req.query;
  const conditions = ['e.is_active=1'];
  const params = [];
  if (name) { conditions.push('(e.first_name LIKE ? OR e.last_name LIKE ? OR e.email LIKE ?)'); params.push(`%${name}%`,`%${name}%`,`%${name}%`); }
  if (is_licensed_engineer !== undefined && is_licensed_engineer !== '') { conditions.push('e.is_licensed_engineer=?'); params.push(is_licensed_engineer==='true'?1:0); }
  if (degree_type) { conditions.push('EXISTS (SELECT 1 FROM employee_degrees ed WHERE ed.employee_id=e.employee_id AND ed.degree_type=?)'); params.push(degree_type); }
  if (domain) { conditions.push('EXISTS (SELECT 1 FROM employee_projects ep WHERE ep.employee_id=e.employee_id AND ep.domain=?)'); params.push(domain); }
  if (min_budget) { conditions.push('EXISTS (SELECT 1 FROM employee_projects ep WHERE ep.employee_id=e.employee_id AND ep.financial_scope>=?)'); params.push(parseInt(min_budget)); }
  if (service) { conditions.push('EXISTS (SELECT 1 FROM employee_projects ep WHERE ep.employee_id=e.employee_id AND ep.employee_services LIKE ?)'); params.push(`%${service}%`); }
  const where = conditions.join(' AND ');
  const total = get(`SELECT COUNT(*) as n FROM employees e WHERE ${where}`, params).n;
  const offset = (parseInt(page)-1)*parseInt(limit);
  const rows = all(`SELECT e.employee_id,e.first_name,e.last_name,e.email,e.department,e.current_role,e.is_licensed_engineer,e.form_submitted_at,e.form_sent_at,e.is_admin,(SELECT COUNT(*) FROM employee_projects ep WHERE ep.employee_id=e.employee_id) project_count,(SELECT GROUP_CONCAT(DISTINCT ep.domain) FROM employee_projects ep WHERE ep.employee_id=e.employee_id) domains,(SELECT ed.degree_type FROM employee_degrees ed WHERE ed.employee_id=e.employee_id ORDER BY ed.graduation_year DESC LIMIT 1) top_degree FROM employees e WHERE ${where} ORDER BY e.last_name,e.first_name LIMIT ? OFFSET ?`, [...params, parseInt(limit), offset]);
  res.json({ total, page:parseInt(page), limit:parseInt(limit), pages:Math.ceil(total/parseInt(limit)), employees: rows });
};
exports.getEmployee = (req, res) => {
  const emp = get('SELECT * FROM employees WHERE employee_id=?', [parseInt(req.params.id)]);
  if (!emp) return res.status(404).json({ error: 'Not found' });
  const degrees  = all('SELECT * FROM employee_degrees WHERE employee_id=?', [emp.employee_id]);
  const projects = all('SELECT * FROM employee_projects WHERE employee_id=? ORDER BY employee_service_start DESC', [emp.employee_id]).map(mapProj);
  res.json({ ...emp, degrees, projects });
};

// Projects
exports.getMyProjects = (req, res) => {
  res.json(all('SELECT * FROM employee_projects WHERE employee_id=? ORDER BY employee_service_start DESC', [req.user.employee_id]).map(mapProj));
};
exports.createProject = (req, res) => {
  const p = req.body;
  if (!p.project_name||!p.domain||!p.client_name||!p.client_type||!p.financial_scope||!p.employee_services?.length||!p.employee_service_start)
    return res.status(422).json({ error: 'Missing required fields' });
  const result = run(`INSERT INTO employee_projects (employee_id,waxman_project_id,project_name,project_name_en,domain,includes_tba,project_attributes,floors_above,floors_below,description,description_en,waxman_services,employee_services,area_sqm,client_name,client_name_en,client_type,financial_scope,contractor_cost,waxman_partner_name,waxman_service_start,employee_service_start,waxman_service_end,employee_service_end,planning_start,planning_end,execution_start,execution_end,form4_date,completion_cert_date,road_opening_date,referee_name,referee_role,referee_phone,referee_email) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [req.user.employee_id,p.waxman_project_id||null,p.project_name,p.project_name_en||null,p.domain,p.includes_tba?1:0,JSON.stringify(p.project_attributes||[]),p.floors_above||null,p.floors_below||null,p.description||'',p.description_en||null,JSON.stringify(p.waxman_services||[]),JSON.stringify(p.employee_services),p.area_sqm||null,p.client_name,p.client_name_en||null,p.client_type,p.financial_scope,p.contractor_cost||null,p.waxman_partner_name||null,p.waxman_service_start||null,p.employee_service_start,p.waxman_service_end||null,p.employee_service_end||null,p.planning_start||null,p.planning_end||null,p.execution_start||null,p.execution_end||null,p.form4_date||null,p.completion_cert_date||null,p.road_opening_date||null,p.referee_name||null,p.referee_role||null,p.referee_phone||null,p.referee_email||null]);
  const created = get('SELECT * FROM employee_projects WHERE project_id=?', [result.lastInsertRowid]);
  res.status(201).json(mapProj(created));
};
exports.updateProject = (req, res) => {
  const pid = parseInt(req.params.projectId);
  const own = get('SELECT project_id FROM employee_projects WHERE project_id=? AND employee_id=?', [pid, req.user.employee_id]);
  if (!own) return res.status(404).json({ error: 'Project not found' });
  const p = req.body;
  run(`UPDATE employee_projects SET project_name=?,domain=?,client_name=?,client_type=?,financial_scope=?,description=?,employee_services=?,employee_service_start=?,employee_service_end=?,updated_at=datetime('now') WHERE project_id=?`,
    [p.project_name,p.domain,p.client_name,p.client_type,p.financial_scope,p.description||'',JSON.stringify(p.employee_services||[]),p.employee_service_start,p.employee_service_end||null,pid]);
  res.json({ message: 'Project updated' });
};
exports.deleteProject = (req, res) => {
  const pid = parseInt(req.params.projectId);
  const result = run('DELETE FROM employee_projects WHERE project_id=? AND employee_id=?', [pid, req.user.employee_id]);
  if (result.changes === 0) return res.status(404).json({ error: 'Project not found' });
  res.json({ message: 'Deleted' });
};

// Forms
exports.validateToken = (req, res) => {
  const row = get(`SELECT fs.*,e.first_name,e.last_name,e.email,e.department FROM form_submissions fs JOIN employees e ON e.employee_id=fs.employee_id WHERE fs.token=? AND fs.token_expires_at > datetime('now') AND fs.submitted_at IS NULL`, [req.params.token]);
  if (!row) return res.status(404).json({ error: 'Token not found, expired, or already used' });
  res.json({ employee_id:row.employee_id, first_name:row.first_name, last_name:row.last_name, email:row.email, department:row.department, expires_at:row.token_expires_at });
};
exports.submitToken = (req, res) => {
  const row = get(`SELECT * FROM form_submissions WHERE token=? AND token_expires_at > datetime('now') AND submitted_at IS NULL`, [req.params.token]);
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
  let sent = 0;
  for (const emp of targets) {
    run('INSERT INTO form_submissions (employee_id,sent_by_id,trigger_type,token,token_expires_at) VALUES (?,?,?,?,?)',
      [emp.employee_id, req.user.employee_id, 'manual', uuidv4(), expires]);
    run(`UPDATE employees SET form_sent_at=datetime('now') WHERE employee_id=?`, [emp.employee_id]);
    sent++;
  }
  res.json({ sent, total: targets.length, message: 'טפסים נשלחו ל-' + sent + ' עובדים' });
};
exports.exportExcel = (_req, res) => {
  const emps = all(`SELECT e.first_name||' '||e.last_name name,e.email,e.phone,e.department,e.current_role,CASE e.is_licensed_engineer WHEN 1 THEN 'כן' ELSE 'לא' END licensed,e.engineer_license_no,(SELECT GROUP_CONCAT(ed.degree_type||' '||ed.field_of_study,'; ') FROM employee_degrees ed WHERE ed.employee_id=e.employee_id) degrees FROM employees e WHERE e.is_active=1 ORDER BY e.last_name`);
  const projs = all(`SELECT e.first_name||' '||e.last_name emp_name,e.email,ep.project_name,ep.domain,ep.client_name,ep.client_type,ep.financial_scope,ep.employee_service_start,ep.employee_service_end,ep.employee_services,ep.description FROM employee_projects ep JOIN employees e ON e.employee_id=ep.employee_id ORDER BY e.last_name,ep.employee_service_start DESC`);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(emps.map(e => ({'שם מלא':e.name,'דוא"ל':e.email,'טלפון':e.phone,'מחלקה':e.department,'תפקיד':e.current_role,'מהנדס רשום':e.licensed,'מספר רישיון':e.engineer_license_no||'','תארים':e.degrees||''}))), 'עובדים');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(projs.map(p => ({'שם עובד':p.emp_name,'שם פרויקט':p.project_name,'תחום':p.domain,'מזמין':p.client_name,'סוג מזמין':p.client_type,'היקף כספי ₪':p.financial_scope,'תחילת שירות':p.employee_service_start||'','סיום שירות':p.employee_service_end||'','שירותים':p.employee_services||''}))), 'פרויקטים');
  const buf = XLSX.write(wb, { type:'buffer', bookType:'xlsx' });
  res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition',`attachment; filename="muchsharim_${dayjs().format('YYYY-MM-DD')}.xlsx"`);
  res.send(buf);
};
