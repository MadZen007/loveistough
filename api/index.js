const {
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
    pool
} = require('./dev-tools/setup');

// CORS middleware
const cors = require('cors');
// Loosen origins for production while we stabilize deployments
const corsMiddleware = cors({
    origin: (origin, cb) => cb(null, true),
    credentials: true
});

// Authentication middleware
function authenticateRequest(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('No token provided');
    }
    
    const token = authHeader.substring(7);
    return verifyToken(token);
}

// Response helpers compatible with Node HTTP response
function sendJson(res, statusCode, payload) {
    try {
        res.statusCode = statusCode;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(payload));
    } catch (_) {
        // ensure a response is ended to avoid NO_RESPONSE_FROM_FUNCTION
        try { res.end(); } catch { /* noop */ }
    }
}

function sendErrorResponse(res, statusCode, message, details = null) {
    sendJson(res, statusCode, {
        success: false,
        error: { message, details, statusCode }
    });
}

function sendSuccessResponse(res, data, message = 'Success') {
    sendJson(res, 200, { success: true, message, data });
}

// Utility: parse JSON body safely
async function parseJsonBody(req) {
    return await new Promise((resolve) => {
        let raw = '';
        req.on('data', (chunk) => { raw += chunk; });
        req.on('end', () => {
            if (!raw) return resolve({});
            try { resolve(JSON.parse(raw)); } catch { resolve({}); }
        });
        req.on('error', () => resolve({}));
    });
}

module.exports = async (req, res) => {
    // Apply CORS
    try {
        await new Promise((resolve) => corsMiddleware(req, res, resolve));
    } catch (e) {
        // If CORS middleware throws, still ensure a response
        return sendErrorResponse(res, 500, 'CORS error');
    }
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        // Ensure body is parsed in dev and prod
        const body = req.body && Object.keys(req.body).length ? req.body : await parseJsonBody(req);
        const { action, ...params } = body || {};
        const { method } = req;

        // Route based on action parameter
        switch (action) {
            case 'health':
                if (method !== 'GET' && method !== 'POST') {
                    return sendErrorResponse(res, 405, 'Method not allowed');
                }
                await handleHealth(res);
                break;
            case 'setup-database':
                if (method !== 'POST') {
                    return sendErrorResponse(res, 405, 'Method not allowed');
                }
                await handleDatabaseSetup(res);
                break;

            case 'register':
                if (method !== 'POST') {
                    return sendErrorResponse(res, 405, 'Method not allowed');
                }
                await handleUserRegistration(res, params);
                break;

            case 'login':
                if (method !== 'POST') {
                    return sendErrorResponse(res, 405, 'Method not allowed');
                }
                await handleUserLogin(res, params);
                break;

            case 'create-article':
                if (method !== 'POST') {
                    return sendErrorResponse(res, 405, 'Method not allowed');
                }
                await handleCreateArticle(res, params);
                break;

            case 'get-articles':
                if (method !== 'GET' && method !== 'POST') {
                    return sendErrorResponse(res, 405, 'Method not allowed');
                }
                await handleGetArticles(res, method === 'GET' ? req.query : params);
                break;

            case 'create-advice':
                if (method !== 'POST') {
                    return sendErrorResponse(res, 405, 'Method not allowed');
                }
                await handleCreateAdvice(res, params);
                break;

            case 'get-advice':
                if (method !== 'GET' && method !== 'POST') {
                    return sendErrorResponse(res, 405, 'Method not allowed');
                }
                await handleGetAdvice(res, method === 'GET' ? req.query : params);
                break;

            case 'create-community-post':
                if (method !== 'POST') {
                    return sendErrorResponse(res, 405, 'Method not allowed');
                }
                await handleCreateCommunityPost(res, params);
                break;

            case 'get-community-posts':
                if (method !== 'GET' && method !== 'POST') {
                    return sendErrorResponse(res, 405, 'Method not allowed');
                }
                await handleGetCommunityPosts(res, method === 'GET' ? req.query : params);
                break;

            case 'upload-file':
                if (method !== 'POST') {
                    return sendErrorResponse(res, 405, 'Method not allowed');
                }
                await handleFileUpload(res, params);
                break;

            case 'get-stats':
                if (method !== 'GET' && method !== 'POST') {
                    return sendErrorResponse(res, 405, 'Method not allowed');
                }
                await handleGetStats(res);
                break;

            default:
                return sendErrorResponse(res, 400, 'Invalid action specified');
        }

    } catch (error) {
        console.error('API Error:', error);
        
        if (error.message === 'No token provided' || error.message === 'Invalid token') {
            return sendErrorResponse(res, 401, 'Authentication required');
        }
        
        return sendErrorResponse(res, 500, 'Internal server error', error.message);
    }
};

// Database setup handler
async function handleDatabaseSetup(res) {
    try {
        const result = await createTables();
        sendSuccessResponse(res, result, 'Database setup completed successfully');
    } catch (error) {
        sendErrorResponse(res, 500, 'Database setup failed', error.message);
    }
}

// User registration handler
async function handleUserRegistration(res, params) {
    const { username, email, password } = params;
    
    if (!username || !email || !password) {
        return sendErrorResponse(res, 400, 'Username, email, and password are required');
    }
    
    try {
        const user = await createUser({ username, email, password });
        sendSuccessResponse(res, { user }, 'User registered successfully');
    } catch (error) {
        if (error.code === '23505') { // Unique constraint violation
            sendErrorResponse(res, 409, 'Username or email already exists');
        } else {
            sendErrorResponse(res, 500, 'Registration failed', error.message);
        }
    }
}

// User login handler
async function handleUserLogin(res, params) {
    const { email, password } = params;
    
    if (!email || !password) {
        return sendErrorResponse(res, 400, 'Email and password are required');
    }
    
    try {
        const result = await authenticateUser(email, password);
        sendSuccessResponse(res, result, 'Login successful');
    } catch (error) {
        sendErrorResponse(res, 401, 'Invalid credentials');
    }
}

// Create article handler
async function handleCreateArticle(res, params) {
    try {
        const user = authenticateRequest(res.req);
        const { title, content, category, tags, featuredImage, status } = params;
        
        if (!title || !content || !category) {
            return sendErrorResponse(res, 400, 'Title, content, and category are required');
        }
        
        const article = await createArticle({
            title,
            content,
            category,
            tags: tags || [],
            featuredImage,
            status: status || 'draft'
        }, user.userId);
        
        sendSuccessResponse(res, { article }, 'Article created successfully');
    } catch (error) {
        sendErrorResponse(res, 500, 'Failed to create article', error.message);
    }
}

// Get articles handler
async function handleGetArticles(res, params) {
    try {
        const { category, status, limit, offset } = params;
        const articles = await getArticles({
            category,
            status: status || 'published',
            limit: parseInt(limit) || 10,
            offset: parseInt(offset) || 0
        });
        
        sendSuccessResponse(res, { articles }, 'Articles retrieved successfully');
    } catch (error) {
        sendErrorResponse(res, 500, 'Failed to retrieve articles', error.message);
    }
}

// Create advice handler
async function handleCreateAdvice(res, params) {
    try {
        const user = authenticateRequest(res.req);
        const { title, content, category, isAnonymous } = params;
        
        if (!title || !content || !category) {
            return sendErrorResponse(res, 400, 'Title, content, and category are required');
        }
        
        const advice = await createAdvicePost({
            title,
            content,
            category,
            isAnonymous: isAnonymous || false
        }, user.userId);
        
        sendSuccessResponse(res, { advice }, 'Advice post created successfully');
    } catch (error) {
        sendErrorResponse(res, 500, 'Failed to create advice post', error.message);
    }
}

// Get advice handler
async function handleGetAdvice(res, params) {
    try {
        const { category, status, limit, offset } = params;
        const advice = await getAdvicePosts({
            category,
            status: status || 'approved',
            limit: parseInt(limit) || 10,
            offset: parseInt(offset) || 0
        });
        
        sendSuccessResponse(res, { advice }, 'Advice posts retrieved successfully');
    } catch (error) {
        sendErrorResponse(res, 500, 'Failed to retrieve advice posts', error.message);
    }
}

// Create community post handler
async function handleCreateCommunityPost(res, params) {
    try {
        const user = authenticateRequest(res.req);
        const { title, content, category, tags } = params;
        
        if (!title || !content || !category) {
            return sendErrorResponse(res, 400, 'Title, content, and category are required');
        }
        
        const post = await createCommunityPost({
            title,
            content,
            category,
            tags: tags || []
        }, user.userId);
        
        sendSuccessResponse(res, { post }, 'Community post created successfully');
    } catch (error) {
        sendErrorResponse(res, 500, 'Failed to create community post', error.message);
    }
}

// Get community posts handler
async function handleGetCommunityPosts(res, params) {
    try {
        const { category, limit, offset } = params;
        const posts = await getCommunityPosts({
            category,
            limit: parseInt(limit) || 10,
            offset: parseInt(offset) || 0
        });
        
        sendSuccessResponse(res, { posts }, 'Community posts retrieved successfully');
    } catch (error) {
        sendErrorResponse(res, 500, 'Failed to retrieve community posts', error.message);
    }
}

// File upload handler
async function handleFileUpload(res, params) {
    try {
        const user = authenticateRequest(res.req);
        const { filename, originalName, mimeType, fileSize, filePath } = params;
        
        if (!filename || !originalName || !mimeType || !fileSize || !filePath) {
            return sendErrorResponse(res, 400, 'All file information is required');
        }
        
        const fileUpload = await saveFileUpload({
            filename,
            originalName,
            mimeType,
            fileSize: parseInt(fileSize),
            filePath
        }, user.userId);
        
        sendSuccessResponse(res, { fileUpload }, 'File uploaded successfully');
    } catch (error) {
        sendErrorResponse(res, 500, 'Failed to upload file', error.message);
    }
}

// Get stats handler
async function handleGetStats(res) {
    try {
        const stats = await getSiteStats();
        sendSuccessResponse(res, { stats }, 'Statistics retrieved successfully');
    } catch (error) {
        sendErrorResponse(res, 500, 'Failed to retrieve statistics', error.message);
    }
} 

// Health-check handler
async function handleHealth(res) {
    try {
        const hasCrdb = Boolean(process.env.COCKROACHDB_CONNECTION_STRING);
        const hasDb = Boolean(process.env.DATABASE_URL);
        const { Pool } = require('pg');
        const connectionString = process.env.COCKROACHDB_CONNECTION_STRING || process.env.DATABASE_URL;

        if (!connectionString) {
            return sendSuccessResponse(res, { ok: false, reason: 'NO_CONNECTION_STRING', hasCrdb, hasDb });
        }

        const poolLocal = new (require('pg').Pool)({
            connectionString,
            ssl: { rejectUnauthorized: false }
        });
        const result = await poolLocal.query('SELECT 1 AS one');
        return sendSuccessResponse(res, { ok: true, hasCrdb, hasDb, result: result.rows });
    } catch (error) {
        return sendSuccessResponse(res, { ok: false, error: String(error && error.message ? error.message : error) });
    }
}