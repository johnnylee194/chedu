import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { initDatabase, run, queryOne } from '../src/database';
import fs from 'fs';
import path from 'path';

// Load .env variables
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

async function main() {
  try {
    const adminUsername = process.env.INIT_ADMIN_USER;
    const adminPassword = process.env.INIT_ADMIN_PASS;

    if (!adminUsername || !adminPassword) {
      console.error('Error: INIT_ADMIN_USER and INIT_ADMIN_PASS must be set in .env file');
      process.exit(1);
    }

    console.log('Initializing database...');
    await initDatabase();

    const existingAdmin = queryOne('SELECT id FROM users WHERE username = ?', [adminUsername]);

    if (existingAdmin) {
      console.log(`Admin user '${adminUsername}' already exists.`);
      process.exit(0);
    }

    console.log(`Creating admin user: ${adminUsername}`);
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminPassword, salt);

    run(`
      INSERT INTO users (username, password_hash, role)
      VALUES (?, ?, 'admin')
    `, [adminUsername, passwordHash]);

    console.log('Admin user created successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Failed to initialize admin user:', error);
    process.exit(1);
  }
}

main();
