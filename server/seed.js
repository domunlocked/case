import bcrypt from 'bcryptjs';
import db, { now } from './database.js';
const names = ['Hor Nalen', 'Keo Sothea', 'ET Samoul', 'Leng Samnang', 'Chan Dalen', 'DomZzz'];
const insert = db.prepare('INSERT OR IGNORE INTO users (name,password_hash,must_change_password,created_at,updated_at) VALUES (?,?,?,?,?)');
for (const name of names) insert.run(name, await bcrypt.hash('123', 12), 1, now(), now());
console.log('Seed complete: six users available with initial password 123. Existing passwords were preserved.');
