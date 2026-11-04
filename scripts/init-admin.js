const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

// 指向 Docker 容器中编译好的产物
const { initDatabase, run, queryOne } = require('../dist/database');

// 兼容容器内 (/app/.env) 与宿主机本地运行的路径
const envPath = path.resolve(__dirname, '../.env');
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
