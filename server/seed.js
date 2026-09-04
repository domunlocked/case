import bcrypt from 'bcryptjs';
import { supabase, now } from './supabase.js';
const names = ['ហោ ណាឡែន', 'កែវ សុទ្ធា', 'អ៊ិត សំអុល', 'ឡេង សំណាង', 'ចាន់ ដាឡែន', 'រ៉េត ចាន់ឧត្ដម'];
for (const name of names) {
	const { error } = await supabase.from('users').upsert({ name, password_hash: await bcrypt.hash('123', 12), must_change_password: true, created_at: now(), updated_at: now() }, { onConflict: 'name', ignoreDuplicates: true });
	if (error) throw error;
}
console.log('Seed complete: six users available with initial password 123. Existing passwords were preserved.');
