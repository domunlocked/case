import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { supabase, bucket, now } from './supabase.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const sessionLifetime = 10 * 365 * 24 * 60 * 60 * 1000;
const configuredClient = process.env.CLIENT_URL || 'http://localhost:5173';
const labels = { criminal: 'ដីការព្រហ្មទណ្ឌ', drugs: 'ដីការគ្រឿងញៀន', arrest: 'ដីការចាប់ខ្លួន', release: 'ដីការដោះលែង' };

app.use(cors({ origin: (origin, callback) => { if (!origin || origin === configuredClient || /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+)/.test(origin)) return callback(null, true); callback(new Error('Origin not allowed')); }, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate'); next(); });
app.get('/', (req, res) => res.json({ ok: true, service: 'Memong Police API', status: 'online' }));
app.use('/api/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

async function audit(userId, action, caseId = null, details = '') {
	const { error } = await supabase.from('audit_logs').insert({ user_id: userId, action, case_id: caseId, details, created_at: now() });
	if (error) throw error;
}
function tokenHash(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
async function auth(req, res, next) {
	try {
		const token = req.cookies.memong_session;
		if (!token) return res.status(401).json({ error: 'Session ផុតកំណត់' });
		const { data, error } = await supabase.from('sessions').select('user_id, users(*)').eq('token_hash', tokenHash(token)).gt('expires_at', Date.now()).maybeSingle();
		if (error || !data?.users) return res.status(401).json({ error: 'Session ផុតកំណត់' });
		req.user = data.users;
		next();
	} catch (error) { next(error); }
}
async function safeCase(row) {
	const { data: images, error } = await supabase.from('images').select('id, original_name, mime_type, size').eq('case_id', row.id).order('id');
	if (error) throw error;
	return { ...row, category_label: labels[row.category], subcategory_label: labels[row.subcategory], images: images.map(image => ({ ...image, url: `/api/images/${image.id}/file` })) };
}
async function caseList(query) {
	const { data, error } = await query;
	if (error) throw error;
	return Promise.all(data.map(safeCase));
}
function validateCase(body) { if (!body.name?.trim()) return 'សូមបញ្ចូលឈ្មោះ'; if (!['criminal', 'drugs'].includes(body.category)) return 'សូមជ្រើសរើសប្រភេទដីការ'; if (!['arrest', 'release'].includes(body.subcategory)) return 'សូមជ្រើសរើសថតដីការ'; }

app.post('/api/login', async (req, res, next) => {
	try {
		const { name, password } = req.body || {};
		const { data: user } = await supabase.from('users').select('*').eq('name', name).maybeSingle();
		if (!user || !(await bcrypt.compare(password || '', user.password_hash))) return res.status(401).json({ error: 'ឈ្មោះអ្នកប្រើប្រាស់ ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ' });
		const token = crypto.randomBytes(32).toString('hex');
		const { error } = await supabase.from('sessions').insert({ token_hash: tokenHash(token), user_id: user.id, expires_at: Date.now() + sessionLifetime, created_at: now() });
		if (error) throw error;
		res.cookie('memong_session', token, { httpOnly: true, sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', secure: process.env.NODE_ENV === 'production', maxAge: sessionLifetime });
		await audit(user.id, 'LOGIN', null, 'Successful login');
		res.json({ user: { id: user.id, name: user.name, must_change_password: Boolean(user.must_change_password) } });
	} catch (error) { next(error); }
});
app.post('/api/logout', auth, async (req, res, next) => { try { const { error } = await supabase.from('sessions').delete().eq('token_hash', tokenHash(req.cookies.memong_session)); if (error) throw error; await audit(req.user.id, 'LOGOUT'); res.clearCookie('memong_session'); res.json({ ok: true }); } catch (error) { next(error); } });
app.get('/api/me', auth, async (req, res, next) => { try { const { data, error } = await supabase.from('users').select('must_change_password').eq('id', req.user.id).single(); if (error) throw error; res.json({ user: { id: req.user.id, name: req.user.name, must_change_password: Boolean(data.must_change_password) } }); } catch (error) { next(error); } });
app.get('/api/users', async (req, res, next) => { try { const { data, error } = await supabase.from('users').select('name').order('name'); if (error) throw error; res.json({ users: data.map(user => user.name) }); } catch (error) { next(error); } });
app.post('/api/users', auth, async (req, res, next) => { try { if (req.user.name !== 'រ៉េត ចាន់ឧត្ដម') return res.status(403).json({ error: 'មានតែរ៉េត ចាន់ឧត្ដមប៉ុណ្ណោះអាចបង្កើតអ្នកប្រើប្រាស់ថ្មីបាន' }); const name = String(req.body?.name || '').trim(); const password = String(req.body?.password || ''); if (!name || name.length > 80) return res.status(400).json({ error: 'សូមបញ្ចូលឈ្មោះអ្នកប្រើប្រាស់' }); if (password.length < 6) return res.status(400).json({ error: 'ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៦ តួអក្សរ' }); const { data, error } = await supabase.from('users').insert({ name, password_hash: await bcrypt.hash(password, 12), must_change_password: true, created_at: now(), updated_at: now() }).select('id,name').single(); if (error) { if (error.code === '23505') return res.status(409).json({ error: 'ឈ្មោះអ្នកប្រើប្រាស់នេះមានរួចហើយ' }); throw error; } await audit(req.user.id, 'USER_CREATE', null, name); res.status(201).json(data); } catch (error) { next(error); } });
app.post('/api/change-password', auth, async (req, res, next) => { try { const { oldPassword, newPassword, confirmPassword } = req.body || {}; const { data: user, error } = await supabase.from('users').select('*').eq('id', req.user.id).single(); if (error) throw error; if (!(await bcrypt.compare(oldPassword || '', user.password_hash))) return res.status(400).json({ error: 'ពាក្យសម្ងាត់ចាស់មិនត្រឹមត្រូវ' }); if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'ពាក្យសម្ងាត់ថ្មីត្រូវមានយ៉ាងតិច ៦ តួអក្សរ' }); if (newPassword !== confirmPassword) return res.status(400).json({ error: 'ពាក្យសម្ងាត់ថ្មីមិនដូចគ្នា' }); const result = await supabase.from('users').update({ password_hash: await bcrypt.hash(newPassword, 12), must_change_password: false, updated_at: now() }).eq('id', req.user.id); if (result.error) throw result.error; await audit(req.user.id, 'PASSWORD_CHANGE'); res.json({ ok: true }); } catch (error) { next(error); } });
app.get('/api/cases', auth, async (req, res, next) => { try { res.json(await caseList(supabase.from('cases').select('*').order('created_at', { ascending: false }))); } catch (error) { next(error); } });
app.get('/api/cases/:id', auth, async (req, res, next) => { try { const { data, error } = await supabase.from('cases').select('*').eq('id', req.params.id).maybeSingle(); if (error) throw error; if (!data) return res.status(404).json({ error: 'មិនមានទិន្នន័យ' }); res.json(await safeCase(data)); } catch (error) { next(error); } });
app.get('/api/search', auth, async (req, res, next) => { try { res.json(await caseList(supabase.from('cases').select('*').ilike('name', `%${req.query.q || ''}%`).order('created_at', { ascending: false }))); } catch (error) { next(error); } });
app.post('/api/cases', auth, async (req, res, next) => { try { const error = validateCase(req.body); if (error) return res.status(400).json({ error }); const stamp = now(); const { data, error: insertError } = await supabase.from('cases').insert({ name: req.body.name.trim(), category: req.body.category, subcategory: req.body.subcategory, case_date: req.body.caseDate || stamp, created_by: req.user.id, created_at: stamp, updated_at: stamp }).select('id').single(); if (insertError) throw insertError; await audit(req.user.id, 'CREATE', data.id, req.body.name.trim()); res.status(201).json(data); } catch (error) { next(error); } });
+app.put('/api/cases/:id', auth, async (req, res, next) => { try { const error = validateCase(req.body); if (error) return res.status(400).json({ error }); const { data, error: updateError } = await supabase.from('cases').update({ name: req.body.name.trim(), category: req.body.category, subcategory: req.body.subcategory, case_date: req.body.caseDate || now(), updated_at: now() }).eq('id', req.params.id).select('id').maybeSingle(); if (updateError) throw updateError; if (!data) return res.status(404).json({ error: 'មិនមានទិន្នន័យ' }); await audit(req.user.id, 'UPDATE', req.params.id, req.body.name.trim()); res.json({ ok: true }); } catch (error) { next(error); } });
+
+const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 20 }, fileFilter: (_, file, cb) => cb(['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype) ? null : new Error('INVALID_IMAGE_TYPE'), true) });
+app.post('/api/cases/:id/images', auth, (req, res, next) => upload.array('images', 20)(req, res, async error => { try { if (error) return next(error); if (!req.files?.length) return res.status(400).json({ error: 'សូមជ្រើសរើសរូបភាព' }); const { data: row, error: caseError } = await supabase.from('cases').select('id').eq('id', req.params.id).maybeSingle(); if (caseError) throw caseError; if (!row) return res.status(404).json({ error: 'មិនមានទិន្នន័យ' }); const uploaded = []; for (const file of req.files) { const filename = `${req.params.id}/${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`; const result = await supabase.storage.from(bucket).upload(filename, file.buffer, { contentType: file.mimetype, upsert: false }); if (result.error) throw result.error; uploaded.push({ case_id: req.params.id, filename, original_name: path.basename(file.originalname), mime_type: file.mimetype, size: file.size, created_at: now() }); } const { error: insertError } = await supabase.from('images').insert(uploaded); if (insertError) throw insertError; await audit(req.user.id, 'UPDATE', req.params.id, `Added ${req.files.length} image(s)`); res.json({ ok: true }); } catch (caught) { next(caught); } }));
+app.get('/api/images/:id/file', auth, async (req, res, next) => { try { const { data: image, error } = await supabase.from('images').select('*').eq('id', req.params.id).maybeSingle(); if (error) throw error; if (!image) return res.sendStatus(404); const result = await supabase.storage.from(bucket).download(image.filename); if (result.error) return res.sendStatus(404); await audit(req.user.id, 'VIEW_IMAGE', image.case_id, image.original_name); res.type(image.mime_type).send(Buffer.from(await result.data.arrayBuffer())); } catch (error) { next(error); } });
+app.delete('/api/images/:id', auth, async (req, res, next) => { try { const { data: image, error } = await supabase.from('images').select('*').eq('id', req.params.id).maybeSingle(); if (error) throw error; if (!image) return res.sendStatus(404); const storageResult = await supabase.storage.from(bucket).remove([image.filename]); if (storageResult.error) throw storageResult.error; const result = await supabase.from('images').delete().eq('id', req.params.id); if (result.error) throw result.error; res.json({ ok: true }); } catch (error) { next(error); } });
+app.delete('/api/cases/:id', auth, async (req, res, next) => { try { const { data: images, error } = await supabase.from('images').select('filename').eq('case_id', req.params.id); if (error) throw error; if (images.length) { const storageResult = await supabase.storage.from(bucket).remove(images.map(image => image.filename)); if (storageResult.error) throw storageResult.error; } const result = await supabase.from('cases').delete().eq('id', req.params.id).select('id').maybeSingle(); if (result.error) throw result.error; if (!result.data) return res.status(404).json({ error: 'មិនមានទិន្នន័យ' }); await audit(req.user.id, 'DELETE', req.params.id); res.json({ ok: true }); } catch (error) { next(error); } });
+app.get('/api/audit-logs', auth, async (req, res, next) => { try { if (req.user.name !== 'រ៉េត ចាន់ឧត្ដម') return res.status(403).json({ error: 'គ្មានសិទ្ធិមើលកំណត់ត្រា' }); const { data, error } = await supabase.from('audit_logs').select('*, users(name)').order('created_at', { ascending: false }).limit(200); if (error) throw error; res.json(data.map(row => ({ ...row, user_name: row.users?.name }))); } catch (error) { next(error); } });
+app.get('/api/export', auth, async (req, res, next) => { try { const type = req.query.range; const end = new Date(); let start = new Date(end); if (type === '1month') start.setMonth(start.getMonth() - 1); else if (type === '3months') start.setMonth(start.getMonth() - 3); else if (type === 'month') { if (!/^\d{4}-\d{2}$/.test(String(req.query.month || ''))) return res.status(400).json({ error: 'សូមជ្រើសរើសខែត្រឹមត្រូវ' }); start = new Date(`${req.query.month}-01T00:00:00.000Z`); end.setTime(new Date(start.getUTCFullYear(), start.getUTCMonth() + 1, 1).getTime() - 1); } else return res.status(400).json({ error: 'ជម្រើសរយៈពេលមិនត្រឹមត្រូវ' }); const { data: cases, error } = await supabase.from('cases').select('*').gte('case_date', start.toISOString()).lte('case_date', end.toISOString()).order('case_date', { ascending: false }); if (error) throw error; const document = new PDFDocument({ margin: 42 }); res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="memong-case-export-${new Date().toISOString().slice(0, 10)}.pdf"`); document.pipe(res); document.fontSize(18).text('Memong Police Case Archive', { align: 'center' }); document.moveDown(0.4).fontSize(10).text(`Exported by ${req.user.name} | ${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}`, { align: 'center' }); document.moveDown(); if (!cases.length) document.fontSize(12).text('No case records found for this period.'); for (const [index, item] of cases.entries()) { const { count } = await supabase.from('images').select('id', { count: 'exact', head: true }).eq('case_id', item.id); document.fontSize(12).text(`${index + 1}. ${item.name}`); document.fontSize(10).text(`Category: ${item.category} | Folder: ${item.subcategory} | Date: ${item.case_date || item.created_at} | Images: ${count || 0}`); document.moveDown(0.5); } document.end(); } catch (error) { next(error); } });
+app.use((error, req, res, next) => { console.error(error); if (error.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'រូបភាពធំពេក' }); if (error.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ error: 'អាចបញ្ចូលបានត្រឹម ២០ រូបភាព' }); if (error.message === 'INVALID_IMAGE_TYPE') return res.status(400).json({ error: 'ប្រភេទឯកសារមិនត្រឹមត្រូវ' }); res.status(500).json({ error: 'មិនអាចបញ្ចូលទិន្នន័យបាន' }); });
+app.listen(port, '0.0.0.0', () => console.log(`Memong Police API running at http://localhost:${port}`));
