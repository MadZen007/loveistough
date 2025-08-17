const { Pool } = require('pg');

module.exports = async (req, res) => {
  const hasCrdb = Boolean(process.env.COCKROACHDB_CONNECTION_STRING);
  const hasDb = Boolean(process.env.DATABASE_URL);
  const connectionString = process.env.COCKROACHDB_CONNECTION_STRING || process.env.DATABASE_URL || '';

  const base = { hasCrdb, hasDb, hasConnectionString: Boolean(connectionString) };

  try {
    if (!connectionString) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ ok: false, reason: 'NO_CONNECTION_STRING', ...base }));
    }

    const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
    const result = await pool.query('SELECT 1 AS one');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: true, ...base, result: result.rows }));
  } catch (err) {
    res.statusCode = 200; // return JSON instead of hard error for easier debugging
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: false, ...base, error: String(err && err.message ? err.message : err) }));
  }
};


