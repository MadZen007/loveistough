const postgres = require('postgres');

// Initialize postgres connection globally
let sql;

function getSql() {
    if (!sql) {
        console.log('🔧 Creating new Postgres connection...');
        console.log('🔧 Database URL exists:', !!process.env.POSTGRES_DATABASE_URL);
        sql = postgres(process.env.POSTGRES_DATABASE_URL, {
            max: 1, // Limit to 1 connection for serverless
            idle_timeout: 20,
            connect_timeout: 10,
            transform: {
                undefined: null
            }
        });
        console.log('🔧 Postgres connection created');
    }
    return sql;
}

// Database schema setup
async function setupDatabase() {
    try {
        console.log('Setting up database schema...');
        const sql = getSql();
        
        // Create stories table
        await sql`
            CREATE TABLE IF NOT EXISTS stories (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'other',
                status TEXT NOT NULL DEFAULT 'pending',
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                reviewed_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `;
        
        // Create analytics table
        await sql`
            CREATE TABLE IF NOT EXISTS analytics (
                id SERIAL PRIMARY KEY,
                session_id TEXT NOT NULL,
                page TEXT NOT NULL,
                event_type TEXT NOT NULL,
                event_data JSONB,
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `;
        
        // Create indexes for better performance
        await sql`
            CREATE INDEX IF NOT EXISTS idx_stories_status ON stories(status)
        `;
        
        await sql`
            CREATE INDEX IF NOT EXISTS idx_stories_timestamp ON stories(timestamp)
        `;
        
        await sql`
            CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics(session_id)
        `;
        
        await sql`
            CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics(timestamp)
        `;
        
        console.log('Database schema setup complete!');
        return true;
    } catch (error) {
        console.error('Error setting up database schema:', error);
        return false;
    }
}

module.exports = { setupDatabase, getSql };
