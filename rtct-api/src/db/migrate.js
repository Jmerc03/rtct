const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = async function migrate() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS alerts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      source TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      confidence REAL CHECK (confidence >= 0 AND confidence <= 1),
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      data JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      email TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      photo_url TEXT,
      role TEXT DEFAULT 'operator',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
};
