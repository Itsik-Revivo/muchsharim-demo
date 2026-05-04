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
  db = fs.existsSync(DB_PATH) ? new SQL.Database(fs.readFileSync(DB_PATH)) : new SQL.Database();

  db.run(`PRAGMA foreign_keys = ON`);
  db.run(`
    CREATE TABLE IF NOT EXISTS employees (
      employee_id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_number TEXT UNIQUE, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
      first_name_en TEXT, last_name_en TEXT,
      email TEXT NOT NULL UNIQUE, phone TEXT NOT NULL DEFAULT '',
      department TEXT NOT NULL DEFAULT '', current_role TEXT NOT NULL DEFAULT '',
      is_licensed_engineer INTEGER NOT NULL DEFAULT 0,
      engineer_license_no TEXT, engineer_license_year INTEGER,
      additional_certs TEXT, is_admin INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      form_sent_at TEXT, form_submitted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS employee_degrees (
      degree_id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
      degree_type TEXT NOT NULL, field_of_study TEXT NOT NULL,
      field_of_study_en TEXT, institution TEXT NOT NULL, graduation_year INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS employee_projects (
      project_id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
      waxman_project_id TEXT, project_name TEXT NOT NULL, project_name_en TEXT,
      domain TEXT NOT NULL, includes_tba INTEGER DEFAULT 0,
      project_attributes TEXT DEFAULT '[]', floors_above INTEGER, floors_below INTEGER,
      description TEXT NOT NULL DEFAULT '', description_en TEXT,
      waxman_services TEXT DEFAULT '[]', employee_services TEXT NOT NULL DEFAULT '[]',
      area_sqm INTEGER, client_name TEXT NOT NULL, client_name_en TEXT,
      client_type TEXT NOT NULL, financial_scope INTEGER NOT NULL, contractor_cost INTEGER,
      waxman_partner_name TEXT, waxman_service_start TEXT,
      employee_service_start TEXT NOT NULL,
      waxman_service_end TEXT, employee_service_end TEXT,
      planning_start TEXT, planning_end TEXT, execution_start TEXT, execution_end TEXT,
      form4_date TEXT, completion_cert_date TEXT, road_opening_date TEXT,
      referee_name TEXT, referee_role TEXT, referee_phone TEXT, referee_email TEXT,
      recommendation_files TEXT DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS form_submissions (
      submission_id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
      sent_at TEXT NOT NULL DEFAULT (datetime('now')), submitted_at TEXT,
      sent_by_id INTEGER, trigger_type TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE, token_expires_at TEXT NOT NULL, reminder_sent_at TEXT
    );
  `);

  // Seed if empty
  const countResult = db.exec('SELECT COUNT(*) as n FROM employees');
  const count = countResult[0]?.values[0][0] || 0;

  if (count === 0) {
    const employees = [
      ['111111111','ישראל','ישראלי','Israel','Israeli','israel@demo.com','050-1234567','תשתיות','מהנדס בכיר',1,'12345',2015,0,dayjs().subtract(2,'month').toISOString()],
      ['222222222','דנה','כהן','Dana','Cohen','dana@demo.com','052-9876543','בינוי','מנהלת פרויקטים',0,null,null,0,dayjs().subtract(1,'month').toISOString()],
      ['333333333','אבי','לוי','Avi','Levy','avi@demo.com','054-1122334','תשתיות','מהנדס תשתיות',1,'98765',2010,0,dayjs().subtract(3,'month').toISOString()],
      ['444444444','מיכל','שרון','Michal','Sharon','michal@demo.com','053-4455667','תב"ע ותכנון','אדריכלית',0,null,null,0,null],
      ['555555555','יוסי','גולן','Yosi','Golan','yosi@demo.com','050-7788990','בינוי','מפקח בנייה',1,'45678',2008,0,dayjs().subtract(10,'day').toISOString()],
      ['666666666','רחל','אברהם','Rachel','Avraham','rachel@demo.com','052-1234321','תשתיות','מהנדסת תכנון',0,null,null,0,null],
      ['777777777','עמית','ברק','Amit','Barak','admin@demo.com','054-9988776','ניהול פרויקטים','מנהל פרויקט',1,'33445',2012,1,dayjs().subtract(5,'day').toISOString()],
    ];
    for (const e of employees) {
      db.run(`INSERT INTO employees (id_number,first_name,last_name,first_name_en,last_name_en,email,phone,department,current_role,is_licensed_engineer,engineer_license_no,engineer_license_year,is_admin,form_submitted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, e);
    }

    const emailToId = {};
    const empRows = db.exec('SELECT employee_id, email FROM employees');
    for (const [eid, email] of empRows[0].values) emailToId[email] = eid;

    for (const [email, type, fos, inst, year] of [
      ['israel@demo.com','M.Sc','הנדסה אזרחית','הטכניון',2012],
      ['dana@demo.com','B.Sc','אדריכלות','אוניברסיטת תל-אביב',2010],
      ['avi@demo.com','B.Sc','הנדסה אזרחית','הטכניון',2008],
      ['michal@demo.com','M.Sc','אדריכלות','הטכניון',2014],
      ['yosi@demo.com','B.Sc','הנדסת בניין','אוניברסיטת בן-גוריון',2006],
      ['rachel@demo.com','Ph.D','הנדסת תחבורה','הטכניון',2018],
      ['admin@demo.com','MBA','ניהול','אוניברסיטת תל-אביב',2016],
    ]) {
      db.run('INSERT INTO employee_degrees (employee_id,degree_type,field_of_study,institution,graduation_year) VALUES (?,?,?,?,?)',
        [emailToId[email], type, fos, inst, year]);
    }

    for (const [email, wid, name, domain, client, ctype, budget, svc, start, end, desc, attrs, fa, fb, area] of [
      ['israel@demo.com','WX-001','כביש 531 – הרחבה לשישה נתיבים','תשתיות','נת"ע','ציבורי',180000000,JSON.stringify(['ניהול ביצוע','פיקוח']),'2019-03','2022-11','הרחבת כביש 531 משני נתיבים לשישה נתיבים',JSON.stringify(['כביש בינעירוני']),null,null,null],
      ['israel@demo.com',null,'מחלף יוקנעם','תשתיות','נת"ל','ציבורי',65000000,JSON.stringify(['פיקוח']),'2017-01','2019-06','שדרוג מחלף יוקנעם',JSON.stringify(['מחלף']),null,null,null],
      ['dana@demo.com','WX-002','מתחם מגורים "פארק נוה"','בינוי','כנען השקעות','יזם',220000000,JSON.stringify(['ניהול תכנון','פיקוח']),'2020-06','2023-09','פרויקט מגורים בן 280 יחידות',JSON.stringify(['מגורים']),14,2,45000],
      ['avi@demo.com','WX-003','קו רכבת קלה – גוש דן','תשתיות','רכבת ישראל','ציבורי',950000000,JSON.stringify(['ניהול תכנון']),'2018-01','2024-12','תכנון וניהול ביצוע 18 ק"מ מסילה',JSON.stringify(['רכבת קלה']),null,null,null],
      ['avi@demo.com','WX-004','תכנית מתאר עיר חדרה','תב"ע','עיריית חדרה','ציבורי',8000000,JSON.stringify(['ניהול תכנית בניין עיר']),'2021-02','2022-08','ניהול תכנית מתאר מקומית',JSON.stringify([]),null,null,null],
      ['yosi@demo.com','WX-005','מרכז לוגיסטי "אשדוד לוג"','בינוי','דקסל נדל"ן','יזם',130000000,JSON.stringify(['ניהול ביצוע','פיקוח']),'2020-09','2022-05','מרכז לוגיסטי 38,000 מ"ר',JSON.stringify(['מרלו"ג']),3,0,38000],
      ['yosi@demo.com',null,'בניין משרדים תל-אביב','בינוי','אלרוב נדל"ן','יזם',350000000,JSON.stringify(['פיקוח']),'2015-03','2018-11','בניין משרדים 22 קומות',JSON.stringify(['משרדים']),22,3,32000],
      ['admin@demo.com','WX-002','מתחם מגורים "פארק נוה"','בינוי','כנען השקעות','יזם',220000000,JSON.stringify(['ניהול ביצוע']),'2021-01','2023-09','ניהול ביצוע כולל',JSON.stringify(['מגורים']),14,2,45000],
    ]) {
      db.run(`INSERT INTO employee_projects (employee_id,waxman_project_id,project_name,domain,client_name,client_type,financial_scope,employee_services,employee_service_start,employee_service_end,description,project_attributes,floors_above,floors_below,area_sqm) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [emailToId[email], wid, name, domain, client, ctype, budget, svc, start, end, desc, attrs, fa, fb, area]);
    }

    for (const email of ['michal@demo.com','rachel@demo.com']) {
      db.run('INSERT INTO form_submissions (employee_id,trigger_type,token,token_expires_at) VALUES (?,?,?,?)',
        [emailToId[email], 'onboarding', uuidv4(), dayjs().add(30,'day').toISOString()]);
    }

    saveDb();
    console.log('[DB] Demo data seeded – 7 employees, 8 projects');
  }
  return db;
}

function get(sql, params=[]) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

function all(sql, params=[]) {
  const res = db.exec(sql, params);
  if (!res.length) return [];
  const { columns, values } = res[0];
  return values.map(row => Object.fromEntries(columns.map((c,i) => [c, row[i]])));
}

function run(sql, params=[]) {
  db.run(sql, params);
  saveDb();
  const lid = db.exec('SELECT last_insert_rowid() as id');
  return { changes: db.getRowsModified(), lastInsertRowid: lid[0]?.values[0][0] };
}

module.exports = { initDb, get, all, run, saveDb };
