import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import db, { now } from './database.js';
const root = path.dirname(fileURLToPath(import.meta.url));
const uploads = process.env.UPLOADS_DIR || path.join(process.env.DATA_DIR || root, 'uploads'); fs.mkdirSync(uploads, { recursive: true });
const app = express(); const port = Number(process.env.PORT || 4000); const sessionLifetime = 10 * 365 * 24 * 60 * 60 * 1000;
const configuredClient = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(cors({ origin: (origin, callback) => { if (!origin || origin === configuredClient || /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)/.test(origin)) return callback(null, true); callback(new Error('Origin not allowed')); }, credentials: true })); app.use(express.json()); app.use(cookieParser());
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate'); next(); });
app.get('/', (req, res) => res.json({ ok: true, service: 'Memong Police API', status: 'online' }));
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }); app.use('/api/login', limiter);
const labels = { criminal: 'ដីការព្រហ្មទណ្ឌ', drugs: 'ដីការគ្រឿងញៀន', arrest: 'ដីការចាប់ខ្លួន', release: 'ដីការដោះលែង' };
function audit(userId, action, caseId = null, details = '') { db.prepare('INSERT INTO audit_logs (user_id,action,case_id,details,created_at) VALUES (?,?,?,?,?)').run(userId, action, caseId, details, now()); }
function tokenHash(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function auth(req, res, next) { const token = req.cookies.memong_session; const session = token && db.prepare('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?').get(tokenHash(token), Date.now()); if (!session) return res.status(401).json({ error: 'Session ផុតកំណត់' }); req.user = session; next(); }
function safeCase(row) { return { ...row, category_label: labels[row.category], subcategory_label: labels[row.subcategory], images: db.prepare('SELECT id, original_name, mime_type, size FROM images WHERE case_id=? ORDER BY id').all(row.id).map(image => ({ ...image, url: `/api/images/${image.id}/file` })) }; }
app.post('/api/login', async (req, res) => { const { name, password } = req.body || {}; const user = db.prepare('SELECT * FROM users WHERE name=?').get(name); if (!user || !(await bcrypt.compare(password || '', user.password_hash))) return res.status(401).json({ error: 'ឈ្មោះអ្នកប្រើប្រាស់ ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ' }); const token = crypto.randomBytes(32).toString('hex'); const expiresAt = Date.now() + sessionLifetime; db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)').run(tokenHash(token), user.id, expiresAt, now()); res.cookie('memong_session', token, { httpOnly: true, sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', secure: process.env.NODE_ENV === 'production', maxAge: sessionLifetime }); audit(user.id, 'LOGIN', null, 'Successful login'); res.json({ user: { id: user.id, name: user.name, must_change_password: Boolean(user.must_change_password) } }); });
app.post('/api/logout', auth, (req, res) => { db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash(req.cookies.memong_session)); audit(req.user.id, 'LOGOUT'); res.clearCookie('memong_session'); res.json({ ok: true }); });
app.get('/api/me', auth, (req, res) => res.json({ user: { id: req.user.id, name: req.user.name, must_change_password: Boolean(db.prepare('SELECT must_change_password FROM users WHERE id=?').get(req.user.id).must_change_password) } }));
app.get('/api/users', (req, res) => res.json({ users: db.prepare('SELECT name FROM users ORDER BY name').all().map(user => user.name) }));
app.post('/api/users', auth, async (req, res) => {
	if (req.user.name !== 'រ៉េត ចាន់ឧត្ដម') return res.status(403).json({ error: 'មានតែរ៉េត ចាន់ឧត្ដមប៉ុណ្ណោះអាចបង្កើតអ្នកប្រើប្រាស់ថ្មីបាន' });
	const name = String(req.body?.name || '').trim();
	const password = String(req.body?.password || '');
	if (!name || name.length > 80) return res.status(400).json({ error: 'សូមបញ្ចូលឈ្មោះអ្នកប្រើប្រាស់' });
	if (password.length < 6) return res.status(400).json({ error: 'ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៦ តួអក្សរ' });
	try {
		const result = db.prepare('INSERT INTO users (name,password_hash,must_change_password,created_at,updated_at) VALUES (?,?,?,?,?)').run(name, await bcrypt.hash(password, 12), 1, now(), now());
		audit(req.user.id, 'USER_CREATE', null, name);
		res.status(201).json({ id: result.lastInsertRowid, name });
	} catch (error) {
		if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'ឈ្មោះអ្នកប្រើប្រាស់នេះមានរួចហើយ' });
		throw error;
	}
});
app.post('/api/change-password', auth, async (req, res) => { const { oldPassword, newPassword, confirmPassword } = req.body || {}; const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id); if (!(await bcrypt.compare(oldPassword || '', user.password_hash))) return res.status(400).json({ error: 'ពាក្យសម្ងាត់ចាស់មិនត្រឹមត្រូវ' }); if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'ពាក្យសម្ងាត់ថ្មីត្រូវមានយ៉ាងតិច ៦ តួអក្សរ' }); if (newPassword !== confirmPassword) return res.status(400).json({ error: 'ពាក្យសម្ងាត់ថ្មីមិនដូចគ្នា' }); db.prepare('UPDATE users SET password_hash=?,must_change_password=0,updated_at=? WHERE id=?').run(await bcrypt.hash(newPassword, 12), now(), req.user.id); audit(req.user.id, 'PASSWORD_CHANGE'); res.json({ ok: true }); });
app.get('/api/cases', auth, (req, res) => res.json(db.prepare('SELECT * FROM cases ORDER BY created_at DESC').all().map(safeCase)));
app.get('/api/cases/:id', auth, (req, res) => { const row = db.prepare('SELECT * FROM cases WHERE id=?').get(req.params.id); if (!row) return res.status(404).json({ error: 'មិនមានទិន្នន័យ' }); res.json(safeCase(row)); });
app.get('/api/search', auth, (req, res) => res.json(db.prepare('SELECT * FROM cases WHERE name LIKE ? ORDER BY created_at DESC').all(`%${req.query.q || ''}%`).map(safeCase)));
function validateCase(body) { if (!body.name?.trim()) return 'សូមបញ្ចូលឈ្មោះ'; if (!['criminal','drugs'].includes(body.category)) return 'សូមជ្រើសរើសប្រភេទដីការ'; if (!['arrest','release'].includes(body.subcategory)) return 'សូមជ្រើសរើសថតដីការ'; }
app.post('/api/cases', auth, (req, res) => { const error = validateCase(req.body); if (error) return res.status(400).json({ error }); const stamp = now(); const caseDate = req.body.caseDate || stamp; const result = db.prepare('INSERT INTO cases (name,category,subcategory,case_date,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(req.body.name.trim(), req.body.category, req.body.subcategory, caseDate, req.user.id, stamp, stamp); audit(req.user.id, 'CREATE', result.lastInsertRowid, req.body.name.trim()); res.status(201).json({ id: result.lastInsertRowid }); });
app.put('/api/cases/:id', auth, (req, res) => { const error = validateCase(req.body); if (error) return res.status(400).json({ error }); const result = db.prepare('UPDATE cases SET name=?,category=?,subcategory=?,case_date=?,updated_at=? WHERE id=?').run(req.body.name.trim(), req.body.category, req.body.subcategory, req.body.caseDate || now(), now(), req.params.id); if (!result.changes) return res.status(404).json({ error: 'មិនមានទិន្នន័យ' }); audit(req.user.id, 'UPDATE', req.params.id, req.body.name.trim()); res.json({ ok: true }); });
const upload = multer({ storage: multer.diskStorage({ destination: uploads, filename: (_, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`) }), limits: { fileSize: 10 * 1024 * 1024, files: 20 }, fileFilter: (_, file, cb) => cb(['image/jpeg','image/png','image/webp'].includes(file.mimetype) ? null : new Error('INVALID_IMAGE_TYPE'), true) });
app.post('/api/cases/:id/images', auth, (req, res, next) => upload.array('images', 20)(req, res, (error) => { if (error) return next(error); if (!req.files?.length) return res.status(400).json({ error: 'សូមជ្រើសរើសរូបភាព' }); const row = db.prepare('SELECT id FROM cases WHERE id=?').get(req.params.id); if (!row) { for (const file of req.files) fs.rmSync(file.path, { force: true }); return res.status(404).json({ error: 'មិនមានទិន្នន័យ' }); } const add = db.prepare('INSERT INTO images (case_id,filename,original_name,mime_type,size,created_at) VALUES (?,?,?,?,?,?)'); for (const file of req.files) add.run(req.params.id, file.filename, path.basename(file.originalname), file.mimetype, file.size, now()); audit(req.user.id, 'UPDATE', req.params.id, `Added ${req.files.length} image(s)`); res.json({ ok: true }); }));
app.get('/api/images/:id/file', auth, (req, res) => { const image = db.prepare('SELECT * FROM images WHERE id=?').get(req.params.id); if (!image) return res.sendStatus(404); const file = path.resolve(uploads, image.filename); if (!file.startsWith(path.resolve(uploads)) || !fs.existsSync(file)) return res.sendStatus(404); audit(req.user.id, 'VIEW_IMAGE', image.case_id, image.original_name); res.type(image.mime_type).sendFile(file); });
app.delete('/api/images/:id', auth, (req, res) => { const image = db.prepare('SELECT * FROM images WHERE id=?').get(req.params.id); if (!image) return res.sendStatus(404); const file = path.resolve(uploads, image.filename); if (file.startsWith(path.resolve(uploads)) && fs.existsSync(file)) fs.unlinkSync(file); db.prepare('DELETE FROM images WHERE id=?').run(req.params.id); res.json({ ok: true }); });
app.delete('/api/cases/:id', auth, (req, res) => { const images = db.prepare('SELECT filename FROM images WHERE case_id=?').all(req.params.id); for (const image of images) { const file = path.resolve(uploads, image.filename); if (file.startsWith(path.resolve(uploads)) && fs.existsSync(file)) fs.unlinkSync(file); } const result = db.prepare('DELETE FROM cases WHERE id=?').run(req.params.id); if (!result.changes) return res.status(404).json({ error: 'មិនមានទិន្នន័យ' }); audit(req.user.id, 'DELETE', req.params.id); res.json({ ok: true }); });
app.get('/api/audit-logs', auth, (req, res) => { if (req.user.name !== 'រ៉េត ចាន់ឧត្ដម') return res.status(403).json({ error: 'គ្មានសិទ្ធិមើលកំណត់ត្រា' }); res.json(db.prepare('SELECT audit_logs.*, users.name AS user_name FROM audit_logs JOIN users ON users.id=audit_logs.user_id ORDER BY audit_logs.created_at DESC LIMIT 200').all()); });
app.get('/api/export', auth, (req, res) => {
	const type = req.query.range;
	const end = new Date();
	let start = new Date(end);
	if (type === '1month') start.setMonth(start.getMonth() - 1);
	else if (type === '3months') start.setMonth(start.getMonth() - 3);
	else if (type === 'month') {
		const month = String(req.query.month || '');
		if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'សូមជ្រើសរើសខែត្រឹមត្រូវ' });
		start = new Date(`${month}-01T00:00:00.000Z`);
		end.setTime(new Date(start.getUTCFullYear(), start.getUTCMonth() + 1, 1).getTime() - 1);
	} else return res.status(400).json({ error: 'ជម្រើសរយៈពេលមិនត្រឹមត្រូវ' });
	const cases = db.prepare('SELECT * FROM cases WHERE case_date >= ? AND case_date <= ? ORDER BY case_date DESC').all(start.toISOString(), end.toISOString());
	const document = new PDFDocument({ margin: 42 });
	const filename = `memong-case-export-${new Date().toISOString().slice(0, 10)}.pdf`;
	res.setHeader('Content-Type', 'application/pdf');
	res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
	document.pipe(res);
	document.fontSize(18).text('Memong Police Case Archive', { align: 'center' });
	document.moveDown(0.4).fontSize(10).text(`Exported by ${req.user.name} | ${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}`, { align: 'center' });
	document.moveDown();
	if (!cases.length) document.fontSize(12).text('No case records found for this period.');
	cases.forEach((item, index) => {
		document.fontSize(12).text(`${index + 1}. ${item.name}`);
		const imageCount = db.prepare('SELECT COUNT(*) AS count FROM images WHERE case_id=?').get(item.id).count;
		document.fontSize(10).text(`Category: ${item.category} | Folder: ${item.subcategory} | Date: ${item.case_date || item.created_at} | Images: ${imageCount}`);
		document.moveDown(0.5);
	});
	document.end();
});
app.use((error, req, res, next) => { if (error.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'រូបភាពធំពេក' }); if (error.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ error: 'អាចបញ្ចូលបានត្រឹម ២០ រូបភាព' }); if (error.message === 'INVALID_IMAGE_TYPE') return res.status(400).json({ error: 'ប្រភេទឯកសារមិនត្រឹមត្រូវ' }); console.error(error); res.status(500).json({ error: 'មិនអាចបញ្ចូលរូបភាពបាន' }); });
app.listen(port, '0.0.0.0', () => console.log(`Memong Police API running at http://localhost:${port}`));
