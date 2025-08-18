const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Database connection
const pool = new Pool({
    connectionString: process.env.COCKROACHDB_CONNECTION_STRING || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'loveistough-secret-key';

// Database setup functions
async function createTables() {
    const client = await pool.connect();
    
    try {
        // Users table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_admin BOOLEAN DEFAULT FALSE,
                is_verified BOOLEAN DEFAULT FALSE,
                avatar_url TEXT,
                bio TEXT
            )
        `);

        // Articles table
        await client.query(`
            CREATE TABLE IF NOT EXISTS articles (
                id SERIAL PRIMARY KEY,
                title VARCHAR(200) NOT NULL,
                content TEXT NOT NULL,
                author_id INTEGER REFERENCES users(id),
                category VARCHAR(50) NOT NULL,
                tags TEXT[],
                featured_image TEXT,
                status VARCHAR(20) DEFAULT 'draft',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                published_at TIMESTAMP,
                view_count INTEGER DEFAULT 0
            )
        `);

        // Advice posts table
        await client.query(`
            CREATE TABLE IF NOT EXISTS advice_posts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                title VARCHAR(200) NOT NULL,
                content TEXT NOT NULL,
                category VARCHAR(50) NOT NULL,
                is_anonymous BOOLEAN DEFAULT FALSE,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                view_count INTEGER DEFAULT 0,
                response_count INTEGER DEFAULT 0
            )
        `);

        // Advice responses table
        await client.query(`
            CREATE TABLE IF NOT EXISTS advice_responses (
                id SERIAL PRIMARY KEY,
                advice_id INTEGER REFERENCES advice_posts(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id),
                content TEXT NOT NULL,
                is_expert_response BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Community posts table
        await client.query(`
            CREATE TABLE IF NOT EXISTS community_posts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                title VARCHAR(200) NOT NULL,
                content TEXT NOT NULL,
                category VARCHAR(50) NOT NULL,
                tags TEXT[],
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                view_count INTEGER DEFAULT 0,
                like_count INTEGER DEFAULT 0
            )
        `);

        // Comments table
        await client.query(`
            CREATE TABLE IF NOT EXISTS comments (
                id SERIAL PRIMARY KEY,
                post_id INTEGER NOT NULL,
                post_type VARCHAR(20) NOT NULL, -- 'article', 'advice', 'community'
                user_id INTEGER REFERENCES users(id),
                content TEXT NOT NULL,
                parent_id INTEGER REFERENCES comments(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Likes table
        await client.query(`
            CREATE TABLE IF NOT EXISTS likes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                post_id INTEGER NOT NULL,
                post_type VARCHAR(20) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, post_id, post_type)
            )
        `);

        // File uploads table
        await client.query(`
            CREATE TABLE IF NOT EXISTS file_uploads (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                filename VARCHAR(255) NOT NULL,
                original_name VARCHAR(255) NOT NULL,
                mime_type VARCHAR(100) NOT NULL,
                file_size INTEGER NOT NULL,
                file_path TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Password reset tokens
        await client.query(`
            CREATE TABLE IF NOT EXISTS password_resets (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                token VARCHAR(128) UNIQUE NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                used BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Email verification tokens
        await client.query(`
            CREATE TABLE IF NOT EXISTS email_verifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                token VARCHAR(128) UNIQUE NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                used BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('All tables created successfully');
        return { success: true, message: 'Database tables created successfully' };
        
    } catch (error) {
        console.error('Error creating tables:', error);
        throw error;
    } finally {
        client.release();
    }
}

// User management functions
async function createUser(userData) {
    const { username, email, password, isAdmin = false } = userData;
    
    try {
        const passwordHash = await bcrypt.hash(password, 12);
        
        const result = await pool.query(`
            INSERT INTO users (username, email, password_hash, is_admin)
            VALUES ($1, $2, $3, $4)
            RETURNING id, username, email, created_at
        `, [username, email, passwordHash, isAdmin]);
        
        return result.rows[0];
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    }
}

async function authenticateUser(email, password) {
    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );
        
        if (result.rows.length === 0) {
            throw new Error('User not found');
        }
        
        const user = result.rows[0];
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!isValidPassword) {
            throw new Error('Invalid password');
        }
        
        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email, isAdmin: user.is_admin },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        return {
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                isAdmin: user.is_admin,
                isVerified: user.is_verified
            },
            token
        };
    } catch (error) {
        console.error('Error authenticating user:', error);
        throw error;
    }
}

// JWT verification middleware
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        throw new Error('Invalid token');
    }
}

// Article management functions
async function createArticle(articleData, authorId) {
    const { title, content, category, tags, featuredImage, status = 'draft' } = articleData;
    
    try {
        const result = await pool.query(`
            INSERT INTO articles (title, content, author_id, category, tags, featured_image, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [title, content, authorId, category, tags, featuredImage, status]);
        
        return result.rows[0];
    } catch (error) {
        console.error('Error creating article:', error);
        throw error;
    }
}

async function getArticles(filters = {}) {
    const { category, status = 'published', limit = 10, offset = 0 } = filters;
    
    try {
        let query = `
            SELECT a.*, u.username as author_name
            FROM articles a
            LEFT JOIN users u ON a.author_id = u.id
            WHERE a.status = $1
        `;
        const params = [status];
        let paramCount = 1;
        
        if (category) {
            paramCount++;
            query += ` AND a.category = $${paramCount}`;
            params.push(category);
        }
        
        query += ` ORDER BY a.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
        params.push(limit, offset);
        
        const result = await pool.query(query, params);
        return result.rows;
    } catch (error) {
        console.error('Error getting articles:', error);
        throw error;
    }
}

// Advice management functions
async function createAdvicePost(postData, userId) {
    const { title, content, category, isAnonymous = false } = postData;
    
    try {
        const result = await pool.query(`
            INSERT INTO advice_posts (user_id, title, content, category, is_anonymous)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [userId, title, content, category, isAnonymous]);
        
        return result.rows[0];
    } catch (error) {
        console.error('Error creating advice post:', error);
        throw error;
    }
}

async function getAdvicePosts(filters = {}) {
    const { category, status = 'approved', limit = 10, offset = 0 } = filters;
    
    try {
        let query = `
            SELECT ap.*, u.username as author_name
            FROM advice_posts ap
            LEFT JOIN users u ON ap.user_id = u.id
            WHERE ap.status = $1
        `;
        const params = [status];
        let paramCount = 1;
        
        if (category) {
            paramCount++;
            query += ` AND ap.category = $${paramCount}`;
            params.push(category);
        }
        
        query += ` ORDER BY ap.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
        params.push(limit, offset);
        
        const result = await pool.query(query, params);
        return result.rows;
    } catch (error) {
        console.error('Error getting advice posts:', error);
        throw error;
    }
}

// Community management functions
async function createCommunityPost(postData, userId) {
    const { title, content, category, tags } = postData;
    
    try {
        const result = await pool.query(`
            INSERT INTO community_posts (user_id, title, content, category, tags)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [userId, title, content, category, tags]);
        
        return result.rows[0];
    } catch (error) {
        console.error('Error creating community post:', error);
        throw error;
    }
}

async function getCommunityPosts(filters = {}) {
    const { category, limit = 10, offset = 0 } = filters;
    
    try {
        let query = `
            SELECT cp.*, u.username as author_name
            FROM community_posts cp
            LEFT JOIN users u ON cp.user_id = u.id
        `;
        const params = [];
        let paramCount = 0;
        
        if (category) {
            paramCount++;
            query += ` WHERE cp.category = $${paramCount}`;
            params.push(category);
        }
        
        query += ` ORDER BY cp.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
        params.push(limit, offset);
        
        const result = await pool.query(query, params);
        return result.rows;
    } catch (error) {
        console.error('Error getting community posts:', error);
        throw error;
    }
}

// File upload functions
async function saveFileUpload(fileData, userId) {
    const { filename, originalName, mimeType, fileSize, filePath } = fileData;
    
    try {
        const result = await pool.query(`
            INSERT INTO file_uploads (user_id, filename, original_name, mime_type, file_size, file_path)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [userId, filename, originalName, mimeType, fileSize, filePath]);
        
        return result.rows[0];
    } catch (error) {
        console.error('Error saving file upload:', error);
        throw error;
    }
}

// Statistics functions
async function getSiteStats() {
    try {
        const stats = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM articles WHERE status = 'published') as published_articles,
                (SELECT COUNT(*) FROM advice_posts WHERE status = 'approved') as approved_advice,
                (SELECT COUNT(*) FROM community_posts) as community_posts,
                (SELECT COUNT(*) FROM comments) as total_comments
        `);
        
        return stats.rows[0];
    } catch (error) {
        console.error('Error getting site stats:', error);
        throw error;
    }
}

module.exports = {
    pool,
    createTables,
    createUser,
    authenticateUser,
    verifyToken,
    // Password reset helpers
    async createPasswordResetToken(email) {
        const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userRes.rows.length === 0) return null; // do not leak existence
        const userId = userRes.rows[0].id;
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes
        await pool.query(
            'INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [userId, token, expiresAt]
        );
        return { token, expiresAt };
    },
    async resetPasswordWithToken(token, newPassword) {
        const resetRes = await pool.query(
            'SELECT * FROM password_resets WHERE token = $1 AND used = FALSE',
            [token]
        );
        if (resetRes.rows.length === 0) throw new Error('Invalid or used token');
        const reset = resetRes.rows[0];
        if (new Date(reset.expires_at) < new Date()) throw new Error('Token expired');
        const passwordHash = await bcrypt.hash(newPassword, 12);
        await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, reset.user_id]);
        await pool.query('UPDATE password_resets SET used = TRUE WHERE id = $1', [reset.id]);
        return true;
    },
    // Email verification helpers
    async createEmailVerification(userId) {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours
        await pool.query(
            'INSERT INTO email_verifications (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [userId, token, expiresAt]
        );
        return { token, expiresAt };
    },
    async verifyEmailWithToken(token) {
        const verRes = await pool.query(
            'SELECT * FROM email_verifications WHERE token = $1 AND used = FALSE',
            [token]
        );
        if (verRes.rows.length === 0) throw new Error('Invalid or used token');
        const ver = verRes.rows[0];
        if (new Date(ver.expires_at) < new Date()) throw new Error('Token expired');
        await pool.query('UPDATE users SET is_verified = TRUE WHERE id = $1', [ver.user_id]);
        await pool.query('UPDATE email_verifications SET used = TRUE WHERE id = $1', [ver.id]);
        return true;
    },
    async exportAllUserEmails() {
        const res = await pool.query('SELECT email, username, created_at, is_verified FROM users ORDER BY created_at DESC');
        return res.rows;
    },
    createArticle,
    getArticles,
    createAdvicePost,
    getAdvicePosts,
    createCommunityPost,
    getCommunityPosts,
    saveFileUpload,
    getSiteStats,
    JWT_SECRET
}; 