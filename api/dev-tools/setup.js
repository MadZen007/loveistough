const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
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
                isAdmin: user.is_admin
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