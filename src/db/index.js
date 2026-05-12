const initSqlJs = require('sql.js');
const fs   = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/muchsharim.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let db = null;

function saveDb() {
  if (db) fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

async function initDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  // Always start fresh for demo
  db = new SQL.Database();

  db.run(`PRAGMA foreign_keys = ON`);
  db.run(`
    CREATE TABLE IF NOT EXISTS employees (
      employee_id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_number TEXT UNIQUE,
      first_name TEXT NOT NULL, last_name TEXT NOT NULL,
      first_name_en TEXT, last_name_en TEXT,
      email TEXT NOT NULL UNIQUE, phone TEXT NOT NULL DEFAULT '',
      current_role TEXT NOT NULL DEFAULT '',
      education_type TEXT DEFAULT 'מהנדס',
      is_licensed_engineer INTEGER NOT NULL DEFAULT 0,
      engineer_license_no TEXT, engineer_license_year INTEGER,
      is_licensed_professional INTEGER NOT NULL DEFAULT 0,
      license_expiry_date TEXT,
      registration_cert_blob TEXT,
      additional_certs TEXT,
      is_admin INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      form_sent_at TEXT, form_submitted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS employee_degrees (
      degree_id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
      degree_type TEXT NOT NULL, field_of_study TEXT NOT NULL,
      field_of_study_en TEXT, institution TEXT NOT NULL,
      study_start_year INTEGER, graduation_year INTEGER NOT NULL,
      degree_cert_blob TEXT
    );
    CREATE TABLE IF NOT EXISTS employee_projects (
      project_id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
      is_waxman_project INTEGER DEFAULT 0,
      employer_name TEXT,
      project_name TEXT NOT NULL, project_name_en TEXT,
      domain TEXT NOT NULL,
      includes_tba INTEGER DEFAULT 0,
      project_type TEXT,
      project_attributes TEXT DEFAULT '[]',
      floors_above INTEGER, floors_below INTEGER,
      description TEXT NOT NULL DEFAULT '', description_en TEXT,
      waxman_services TEXT DEFAULT '[]', employee_services TEXT NOT NULL DEFAULT '[]',
      area_sqm INTEGER,
      client_name TEXT NOT NULL, client_name_en TEXT,
      client_type TEXT NOT NULL,
      financial_scope_known INTEGER DEFAULT 0,
      financial_scope_range TEXT,
      financial_scope INTEGER,
      contractor_cost INTEGER, waxman_partner_name TEXT,
      waxman_service_start TEXT, employee_service_start TEXT NOT NULL,
      waxman_service_end TEXT, employee_service_end TEXT,
      planning_start TEXT, planning_end TEXT,
      execution_start TEXT, execution_end TEXT,
      form4_date TEXT, completion_cert_date TEXT, road_opening_date TEXT,
      referee_name TEXT NOT NULL DEFAULT '',
      referee_role TEXT NOT NULL DEFAULT '',
      referee_phone TEXT NOT NULL DEFAULT '',
      referee_email TEXT NOT NULL DEFAULT '',
      recommendation_files TEXT DEFAULT '[]',
      recommendation_letter_blob TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS form_submissions (
      submission_id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
      sent_at TEXT NOT NULL DEFAULT (datetime('now')), submitted_at TEXT,
      sent_by_id INTEGER, trigger_type TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE, token_expires_at TEXT NOT NULL,
      reminder_sent_at TEXT
    );
  `);

  // Seed
  const employees = [
    ['111111111','ישראל','ישראלי','Israel','Israeli','israel@demo.com','050-1234567','מהנדס בכיר','מהנדס',1,'12345',2012,1,'2025-12-31',0,dayjs().subtract(2,'month').toISOString()],
    ['222222222','דנה','כהן','Dana','Cohen','dana@demo.com','052-9876543','מנהלת פרויקטים','אדריכל',0,null,null,0,null,0,dayjs().subtract(1,'month').toISOString()],
    ['333333333','אבי','לוי','Avi','Levy','avi@demo.com','054-1122334','מהנדס תשתיות','מהנדס',1,'98765',2010,1,'2024-04-01',0,dayjs().subtract(3,'month').toISOString()],
    ['444444444','מיכל','שרון','Michal','Sharon','michal@demo.com','053-4455667','אדריכלית','אדריכל',0,null,null,0,null,0,null],
    ['555555555','יוסי','גולן','Yosi','Golan','yosi@demo.com','050-7788990','מפקח בנייה','הנדסאי',1,'45678',2008,1,'2026-06-30',0,dayjs().subtract(10,'day').toISOString()],
    ['666666666','רחל','אברהם','Rachel','Avraham','rachel@demo.com','052-1234321','מהנדסת תכנון','מהנדס',0,null,null,0,null,0,null],
    ['777777777','עמית','ברק','Amit','Barak','admin@demo.com','054-9988776','מנהל פרויקט','מהנדס',1,'33445',2012,1,'2027-03-01',1,dayjs().subtract(5,'day').toISOString()],
  ];
  for (const [id,fn,ln,fne,lne,email,phone,role,edu,eng,lic,licy,prof,exp,adm,sub] of employees) {
    db.run(`INSERT INTO employees (id_number,first_name,last_name,first_name_en,last_name_en,email,phone,current_role,education_type,is_licensed_engineer,engineer_license_no,engineer_license_year,is_licensed_professional,license_expiry_date,is_admin,form_submitted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id,fn,ln,fne,lne,email,phone,role,edu,eng,lic,licy,prof,exp,adm,sub]);
  }

  const emailToId = {};
  for (const [eid,email] of db.exec('SELECT employee_id,email FROM employees')[0].values) emailToId[email]=eid;

  for (const [email,type,fos,inst,sy,gy] of [
    ['israel@demo.com','M.Sc','הנדסה אזרחית','הטכניון',2008,2012],
    ['dana@demo.com','B.Sc','אדריכלות','אוניברסיטת תל-אביב',2006,2010],
    ['avi@demo.com','B.Sc','הנדסה אזרחית','הטכניון',2004,2008],
    ['michal@demo.com','M.Sc','אדריכלות','הטכניון',2010,2014],
    ['yosi@demo.com','B.Sc','הנדסת בניין','אוניברסיטת בן-גוריון',2002,2006],
    ['rachel@demo.com','Ph.D','הנדסת תחבורה','הטכניון',2012,2018],
    ['admin@demo.com','MBA','ניהול','אוניברסיטת תל-אביב',2013,2016],
  ]) {
    db.run('INSERT INTO employee_degrees (employee_id,degree_type,field_of_study,institution,study_start_year,graduation_year) VALUES (?,?,?,?,?,?)',
      [emailToId[email],type,fos,inst,sy,gy]);
  }

  for (const [email,iswax,emp,name,domain,ptype,client,ctype,scopeknown,range,svc,start,end_,desc,attrs,fa,fb] of [
    ['israel@demo.com',1,'וקסמן גרופ','כביש 531 – הרחבה לשישה נתיבים','תשתיות','כביש בינעירוני','נת"ע','ציבורי',1,'100M-500M',JSON.stringify(['ניהול ביצוע','פיקוח']),'2019-03','2022-11','הרחבת כביש 531 משני נתיבים לשישה נתיבים, כולל מחלפים, ניקוז ותאורה.',JSON.stringify(['מחלף','גשר כלי רכב']),null,null],
    ['israel@demo.com',0,'נתיבי ישראל','מחלף יוקנעם','תשתיות','מחלף','נת"ל','ציבורי',1,'20M-100M',JSON.stringify(['פיקוח']),'2017-01','2019-06','שדרוג מחלף יוקנעם.',JSON.stringify(['כביש עירוני']),null,null],
    ['dana@demo.com',1,'וקסמן גרופ','מתחם מגורים "פארק נוה"','בינוי','מגורים','כנען השקעות','יזם',1,'>500M',JSON.stringify(['ניהול תכנון','פיקוח']),'2020-06','2023-09','פרויקט מגורים בן 280 יחידות.',JSON.stringify(['מגורים']),14,2],
    ['avi@demo.com',1,'וקסמן גרופ','קו רכבת קלה – גוש דן','תשתיות','רכבת קלה','רכבת ישראל','ציבורי',1,'>500M',JSON.stringify(['ניהול תכנון']),'2018-01','2024-12','תכנון וניהול ביצוע של 18 ק"מ מסילה.',JSON.stringify(['רכבת קלה']),null,null],
    ['avi@demo.com',1,'וקסמן גרופ','תכנית מתאר עיר חדרה','תב"ע','תכנית מתאר','עיריית חדרה','ציבורי',1,'1M-20M',JSON.stringify(['ניהול תכנית בניין עיר']),'2021-02','2022-08','ניהול תכנית מתאר מקומית.',JSON.stringify([]),null,null],
    ['yosi@demo.com',1,'וקסמן גרופ','מרכז לוגיסטי "אשדוד לוג"','בינוי','מרלו"ג','דקסל נדל"ן','יזם',1,'100M-500M',JSON.stringify(['ניהול ביצוע','פיקוח']),'2020-09','2022-05','מרכז לוגיסטי 38,000 מ"ר.',JSON.stringify(['מרלו"ג']),3,0],
    ['yosi@demo.com',0,'אלרוב נדל"ן','בניין משרדים תל-אביב','בינוי','משרדים','אלרוב','יזם',1,'>500M',JSON.stringify(['פיקוח']),'2015-03','2018-11','בניין משרדים 22 קומות.',JSON.stringify(['משרדים']),22,3],
    ['admin@demo.com',1,'וקסמן גרופ','מתחם מגורים "פארק נוה"','בינוי','מגורים','כנען השקעות','יזם',1,'>500M',JSON.stringify(['ניהול ביצוע']),'2021-01','2023-09','ניהול ביצוע כולל.',JSON.stringify(['מגורים']),14,2],
  ]) {
    db.run(`INSERT INTO employee_projects (employee_id,is_waxman_project,employer_name,project_name,domain,project_type,client_name,client_type,financial_scope_known,financial_scope_range,employee_services,employee_service_start,employee_service_end,description,project_attributes,floors_above,floors_below,referee_name,referee_role,referee_phone,referee_email) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [emailToId[email],iswax?1:0,emp,name,domain,ptype,client,ctype,scopeknown?1:0,range,svc,start,end_,desc,attrs,fa,fb,'נציג מזמין','מנהל פרויקט','050-0000000','client@example.com']);
  }

  for (const email of ['michal@demo.com','rachel@demo.com']) {
    db.run('INSERT INTO form_submissions (employee_id,trigger_type,token,token_expires_at) VALUES (?,?,?,?)',
      [emailToId[email],'onboarding',uuidv4(),dayjs().add(30,'day').toISOString()]);
  }

  saveDb();
  console.log('[DB] v1.2 schema seeded – 7 employees, 8 projects');
  return db;
}

function get(sql, params=[]) {
  const stmt = db.prepare(sql); stmt.bind(params);
  const row = stmt.step() ? stmt.getAsObject() : null; stmt.free(); return row;
}
function all(sql, params=[]) {
  const res = db.exec(sql, params);
  if (!res.length) return [];
  const { columns, values } = res[0];
  return values.map(row => Object.fromEntries(columns.map((c,i)=>[c,row[i]])));
}
function run(sql, params=[]) {
  db.run(sql, params); saveDb();
  const lid = db.exec('SELECT last_insert_rowid() as id');
  return { changes: db.getRowsModified(), lastInsertRowid: lid[0]?.values[0][0] };
}

module.exports = { initDb, get, all, run, saveDb };
