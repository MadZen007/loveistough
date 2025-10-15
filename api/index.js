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
    pool,
    createPasswordResetToken,
    resetPasswordWithToken,
    createEmailVerification,
    verifyEmailWithToken,
    exportAllUserEmails
} = require('./dev-tools/setup');

// CORS middleware
const cors = require('cors');
const { setupDatabase, getSql } = require('./database-setup');
// Lock CORS to allowed origins (env ALLOWED_ORIGINS or sane defaults)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://www.loveistough.com,https://loveistough.com').split(',').map(s => s.trim());
const corsMiddleware = cors({
    origin: (origin, cb) => {
        if (!origin) return cb(null, true); // allow same-origin or curl
        const ok = allowedOrigins.includes(origin);
        cb(null, ok);
    },
    credentials: true
});

// Very light in-memory rate limiter per IP per action
const rateMap = new Map(); // key: ip|action -> { count, resetAt }
function rateLimit(req, action, limit = 10, windowMs = 10 * 60 * 1000) {
    const ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'ipless').toString();
    const key = `${ip}|${action}`;
    const now = Date.now();
    const current = rateMap.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > current.resetAt) {
        current.count = 0;
        current.resetAt = now + windowMs;
    }
    current.count += 1;
    rateMap.set(key, current);
    return current.count <= limit;
}

// In-memory subscription store (demo). Replace with DB later.
const subscriptions = new Map(); // key: userId -> subscription
const subscriptionPlans = {
    basic: {
        id: 'basic',
        name: 'Supporter',
        price: 500,
        interval: 'month',
        features: ['No ads', 'Early access', 'Suggestions', 'Profile perks']
    }
};

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

// Helpers for email
function createPublicBaseUrl(req) {
    const envBase = process.env.PUBLIC_BASE_URL;
    if (envBase) return envBase.replace(/\/$/, '');
    // Fallback: derive from host header
    const host = req.headers.host;
    const proto = 'https://';
    return proto + host;
}

async function sendEmailViaResend({ to, subject, html }) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY missing');
    const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ from: process.env.EMAIL_FROM || 'LoveIsTough <noreply@loveistough.com>', to, subject, html })
    });
    if (!resp.ok) throw new Error('Resend API error: ' + resp.status);
}

function buildResetEmailHtml(baseUrl, token) {
    const url = `${baseUrl}/reset.html?token=${encodeURIComponent(token)}`;
    return `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Reset your password</h2>
        <p>Click the button below to set a new password. This link expires in 30 minutes.</p>
        <p><a href="${url}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;border-radius:6px;text-decoration:none">Reset Password</a></p>
        <p>If the button doesn't work, copy and paste this URL into your browser:</p>
        <p><a href="${url}">${url}</a></p>
      </div>
    `;
}

function buildVerifyEmailHtml(baseUrl, token) {
    const url = `${baseUrl}/verify.html?token=${encodeURIComponent(token)}`;
    return `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Verify your email</h2>
        <p>Thanks for joining LoveIsTough. Click to verify your email.</p>
        <p><a href="${url}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;border-radius:6px;text-decoration:none">Verify Email</a></p>
        <p>If the button doesn't work, copy and paste this URL into your browser:</p>
        <p><a href="${url}">${url}</a></p>
      </div>
    `;
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

// Helper function to get stories from Postgres
async function getStoriesFromDB() {
    try {
        console.log('getStoriesFromDB called - fetching from Postgres...');
        const sql = getSql();
        
        const result = await sql`
            SELECT id, title, content, category, status, timestamp, reviewed_at
            FROM stories 
            ORDER BY timestamp DESC
        `;
        
        console.log('Postgres returned stories:', result.rows?.length || 0);
        return result.rows || [];
    } catch (error) {
        console.log('Error loading stories from Postgres:', error.message);
        return [];
    }
}

// Helper function to save a single story to Postgres
async function saveStoryToDB(story) {
    try {
        console.log('saveStoryToDB called - saving to Postgres:', story.id);
        const sql = getSql();
        
        await sql`
            INSERT INTO stories (id, title, content, category, status, timestamp, reviewed_at)
            VALUES (${story.id}, ${story.title}, ${story.content}, ${story.category}, ${story.status}, ${story.timestamp}, ${story.reviewed_at || null})
            ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title,
                content = EXCLUDED.content,
                category = EXCLUDED.category,
                status = EXCLUDED.status,
                reviewed_at = EXCLUDED.reviewed_at
        `;
        
        console.log('Story saved to Postgres:', story.id);
        return true;
    } catch (error) {
        console.log('Error saving story to Postgres:', error.message);
        return false;
    }
}

// Helper function to get analytics from Postgres
async function getAnalyticsFromDB() {
    try {
        console.log('getAnalyticsFromDB called - fetching from Postgres...');
        const sql = getSql();
        
        const result = await sql`
            SELECT session_id, page, event_type, event_data, timestamp
            FROM analytics 
            ORDER BY timestamp DESC
        `;
        
        console.log('Postgres returned analytics:', result.rows?.length || 0);
        return result.rows || [];
    } catch (error) {
        console.log('Error loading analytics from Postgres:', error.message);
        return [];
    }
}

// Helper function to save analytics to Postgres
async function saveAnalyticsToDB(analytics) {
    try {
        console.log('saveAnalyticsToDB called - saving to Postgres:', analytics.length, 'events');
        const sql = getSql();
        
        for (const event of analytics) {
            // Ensure all required fields have default values to prevent UNDEFINED_VALUE errors
              const safeEvent = {
                  sessionId: event.sessionId || 'unknown',
                  page: event.page || 'unknown',
                  eventType: event.eventType || event.type || 'unknown',
                  eventData: event.eventData || {},
                  timestamp: event.timestamp || new Date().toISOString()
              };
            
            console.log('Saving analytics event:', safeEvent);
            
            await sql`
                INSERT INTO analytics (session_id, page, event_type, event_data, timestamp)
                VALUES (${safeEvent.sessionId}, ${safeEvent.page}, ${safeEvent.eventType}, ${JSON.stringify(safeEvent.eventData)}, ${safeEvent.timestamp})
            `;
        }
        
        console.log('Analytics saved to Postgres:', analytics.length, 'events');
        return true;
    } catch (error) {
        console.log('Error saving analytics to Postgres:', error.message);
        return false;
    }
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
          let body = {};
          if (req.body && Object.keys(req.body).length > 0) {
              body = req.body;
          } else {
              body = await parseJsonBody(req);
          }
          
          const { action, ...params } = body || {};
          const { method } = req;

        // Debug logging
        console.log('API Request:', { method, action, params, body, url: req.url, headers: req.headers });
        console.log('Body keys:', Object.keys(body || {}));
        console.log('Action extracted:', action);
        console.log('Params extracted:', params);
        
        // Initialize database schema on first request
        if (!global.dbInitialized) {
            await setupDatabase();
            global.dbInitialized = true;
        }

        // Handle GET requests without action (browser requests, favicon, etc.)
        if (method === 'GET' && !action) {
            console.log('GET request without action - likely browser request:', req.url);
            return sendErrorResponse(res, 404, 'API endpoint requires action parameter');
        }

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
                if (!rateLimit(req, 'login')) return sendErrorResponse(res, 429, 'Too many attempts, try again later');
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

            case 'list-memes':
                if (method !== 'GET' && method !== 'POST') {
                    return sendErrorResponse(res, 405, 'Method not allowed');
                }
                await handleListMemes(res);
                break;

            // Story submission endpoints
            case 'stories':
                if (method !== 'POST') {
                    return sendErrorResponse(res, 405, 'Method not allowed');
                }
                if (!rateLimit(req, 'story-submission', 5)) return sendErrorResponse(res, 429, 'Too many submissions, try again later');
                await handleSubmitStory(res, params);
                break;

            case 'get-stories':
                if (method !== 'POST') {
                    return sendErrorResponse(res, 405, 'Method not allowed');
                }
                await handleGetStories(res, params);
                break;

            // Admin story management endpoints
            case 'admin/stats':
                if (method !== 'GET' && method !== 'POST') {
                    return sendErrorResponse(res, 405, 'Method not allowed');
                }
                await handleAdminStats(res, params);
                break;

            case 'admin/submissions':
                if (method !== 'POST') {
                    return sendErrorResponse(res, 405, 'Method not allowed');
                }
                if (params.method === 'PATCH') {
                    await handleUpdateSubmission(res, params);
                } else {
                    await handleGetSubmissions(res, params);
                }
                break;

            case 'get-submissions':
                if (method !== 'POST') {
                    return sendErrorResponse(res, 405, 'Method not allowed');
                }
                await handleGetSubmissions(res, params);
                break;

            // Analytics endpoints
            case 'analytics':
                if (method === 'POST') {
                    await handleAnalyticsTracking(res, params);
                } else if (method === 'GET') {
                    await handleGetAnalytics(res, req.query);
                } else {
                    return sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;

            case 'admin/analytics':
                if (method === 'GET') {
                    await handleAdminAnalytics(res, req.query);
                } else if (method === 'POST') {
                    await handleAdminAnalytics(res, params);
                } else {
                    return sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;

            // Auth enhancements
            case 'request-password-reset':
                if (method !== 'POST') return sendErrorResponse(res, 405, 'Method not allowed');
                if (!rateLimit(req, 'request-password-reset', 5)) return sendErrorResponse(res, 429, 'Too many requests');
                await handleRequestPasswordReset(req, res, params);
                break;
            case 'reset-password':
                if (method !== 'POST') return sendErrorResponse(res, 405, 'Method not allowed');
                await handleResetPassword(res, params);
                break;
            case 'request-email-verification':
                if (method !== 'POST') return sendErrorResponse(res, 405, 'Method not allowed');
                await handleRequestEmailVerification(res);
                break;
            case 'verify-email':
                if (method !== 'POST') return sendErrorResponse(res, 405, 'Method not allowed');
                await handleVerifyEmail(res, params);
                break;
            case 'export-emails':
                if (method !== 'GET' && method !== 'POST') return sendErrorResponse(res, 405, 'Method not allowed');
                await handleExportEmails(req, res);
                break;

            // Subscription demo endpoints
            case 'subscription-status':
                if (method !== 'GET' && method !== 'POST') return sendErrorResponse(res, 405, 'Method not allowed');
                await handleSubscriptionStatus(res);
                break;
            case 'subscription-create':
                if (method !== 'POST') return sendErrorResponse(res, 405, 'Method not allowed');
                await handleSubscriptionCreate(res, params);
                break;
            case 'subscription-cancel':
                if (method !== 'POST') return sendErrorResponse(res, 405, 'Method not allowed');
                await handleSubscriptionCancel(res);
                break;
            case 'subscription-reactivate':
                if (method !== 'POST') return sendErrorResponse(res, 405, 'Method not allowed');
                await handleSubscriptionReactivate(res);
                break;
            case 'subscription-plans':
                if (method !== 'GET' && method !== 'POST') return sendErrorResponse(res, 405, 'Method not allowed');
                await handleSubscriptionPlans(res);
                break;

            // Go-link redirects (302) for spokes
            case 'go-vent':
                return handleGo(res, process.env.SPOKE_VENT_URL);
            case 'go-advice':
                return handleGo(res, process.env.SPOKE_ADVICE_URL);
            case 'go-discover':
                return handleGo(res, process.env.SPOKE_DISCOVER_URL);
            case 'go-toolkit':
                return handleGo(res, process.env.SPOKE_TOOLKIT_URL);

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

// List meme filenames from images/memes
async function handleListMemes(res) {
    try {
        const fs = require('fs');
        const path = require('path');
        const dir = path.join(process.cwd(), 'images', 'memes');
        const supported = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.JPG', '.PNG', '.WEBP']);
        let files = [];
        try {
            files = fs.readdirSync(dir)
                .filter((f) => supported.has(path.extname(f)))
                .sort();
        } catch (e) {
            // If directory not found, return empty
            files = [];
        }
        return sendSuccessResponse(res, { files }, 'Memes listed');
    } catch (e) {
        return sendErrorResponse(res, 500, 'Failed to list memes');
    }
}

// Request password reset
async function handleRequestPasswordReset(req, res, params) {
    const { email } = params || {};
    if (!email) return sendErrorResponse(res, 400, 'Email is required');
    try {
        const created = await createPasswordResetToken(email);
        // Send email if configured via RESEND_API_KEY
        if (created && process.env.RESEND_API_KEY) {
            try {
                await sendEmailViaResend({
                    to: email,
                    subject: 'Reset your LoveIsTough password',
                    html: buildResetEmailHtml(createPublicBaseUrl(req), created.token)
                });
            } catch (e) {
                // Log but do not fail the flow
                console.error('Email send failed:', e?.message || e);
            }
        }
        // Do not reveal if user exists; return success regardless
        return sendSuccessResponse(res, { ok: true }, 'If the email exists, a reset link has been sent');
    } catch (e) {
        return sendErrorResponse(res, 500, 'Could not create reset request');
    }
}

// Reset password
async function handleResetPassword(res, params) {
    const { token, newPassword } = params || {};
    if (!token || !newPassword) return sendErrorResponse(res, 400, 'Token and newPassword are required');
    try {
        await resetPasswordWithToken(token, newPassword);
        return sendSuccessResponse(res, { ok: true }, 'Password updated');
    } catch (e) {
        return sendErrorResponse(res, 400, e.message || 'Invalid token');
    }
}

// Request email verification (for logged-in users)
async function handleRequestEmailVerification(res) {
    try {
        const user = authenticateRequest(res.req);
        const created = await createEmailVerification(user.userId);
        // Send verification email if configured
        if (process.env.RESEND_API_KEY) {
            try {
                await sendEmailViaResend({
                    to: user.email,
                    subject: 'Verify your LoveIsTough email',
                    html: buildVerifyEmailHtml(createPublicBaseUrl(res.req), created.token)
                });
            } catch (e) {
                console.error('Verification email send failed:', e?.message || e);
            }
        }
        return sendSuccessResponse(res, { token: created.token, expiresAt: created.expiresAt }, 'Verification created');
    } catch (e) {
        return sendErrorResponse(res, 401, 'Authentication required');
    }
}

// Verify email
async function handleVerifyEmail(res, params) {
    const { token } = params || {};
    if (!token) return sendErrorResponse(res, 400, 'Token is required');
    try {
        await verifyEmailWithToken(token);
        return sendSuccessResponse(res, { ok: true }, 'Email verified');
    } catch (e) {
        return sendErrorResponse(res, 400, e.message || 'Invalid token');
    }
}

// Export emails (admin only)
async function handleExportEmails(req, res) {
    try {
        const user = authenticateRequest(res.req);
        const adminEmail = process.env.ADMIN_EMAIL || '';
        if (!user || (!user.isAdmin && (!adminEmail || user.email !== adminEmail))) {
            return sendErrorResponse(res, 403, 'Admin required');
        }
        const rows = await exportAllUserEmails();
        return sendSuccessResponse(res, { emails: rows }, 'Emails exported');
    } catch (e) {
        return sendErrorResponse(res, 401, 'Authentication required');
    }
}

// Helpers to get userId from Authorization (demo: token value)
function requireUserId(req) {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) throw new Error('Authentication required');
    const token = authHeader.substring(7);
    if (!token) throw new Error('Authentication required');
    return token; // In production, decode JWT
}

async function handleSubscriptionStatus(res) {
    try {
        const userId = requireUserId(res.req);
        const sub = subscriptions.get(userId) || null;
        return sendSuccessResponse(res, { isSubscribed: !!sub && sub.status === 'active', subscription: sub }, 'Subscription status');
    } catch (e) {
        return sendErrorResponse(res, 401, 'Authentication required');
    }
}

async function handleSubscriptionCreate(res, params) {
    try {
        const userId = requireUserId(res.req);
        const planId = params?.planId || 'basic';
        if (!subscriptionPlans[planId]) return sendErrorResponse(res, 400, 'Invalid plan');
        const sub = {
            id: `sub_${Date.now()}`,
            userId,
            planId,
            status: 'active',
            createdAt: new Date().toISOString(),
            currentPeriodStart: new Date().toISOString(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            cancelAtPeriodEnd: false
        };
        subscriptions.set(userId, sub);
        return sendSuccessResponse(res, { subscription: sub }, 'Subscription created');
    } catch (e) {
        return sendErrorResponse(res, 401, 'Authentication required');
    }
}

async function handleSubscriptionCancel(res) {
    try {
        const userId = requireUserId(res.req);
        const sub = subscriptions.get(userId);
        if (!sub) return sendErrorResponse(res, 400, 'No active subscription found');
        sub.cancelAtPeriodEnd = true;
        subscriptions.set(userId, sub);
        return sendSuccessResponse(res, { subscription: sub }, 'Will cancel at period end');
    } catch (e) {
        return sendErrorResponse(res, 401, 'Authentication required');
    }
}

async function handleSubscriptionReactivate(res) {
    try {
        const userId = requireUserId(res.req);
        const sub = subscriptions.get(userId);
        if (!sub) return sendErrorResponse(res, 400, 'No subscription found');
        sub.cancelAtPeriodEnd = false;
        sub.status = 'active';
        subscriptions.set(userId, sub);
        return sendSuccessResponse(res, { subscription: sub }, 'Subscription reactivated');
    } catch (e) {
        return sendErrorResponse(res, 401, 'Authentication required');
    }
}

async function handleSubscriptionPlans(res) {
    return sendSuccessResponse(res, { plans: Object.values(subscriptionPlans) }, 'Plans');
}

// Story submission handler
async function handleSubmitStory(res, params) {
    try {
        console.log('handleSubmitStory called with params:', params);
        const { action, title, content, category } = params;
        console.log('Extracted fields:', { action, title, content: content ? content.substring(0, 50) + '...' : 'null', category });
        
        if (!content || content.trim().length < 10) {
            console.log('Validation failed - content too short:', content ? content.length : 0);
            return sendErrorResponse(res, 400, `Story content is required and must be at least 10 characters. You provided ${content ? content.length : 0} characters.`);
        }
        
        // In a real implementation, you'd save to database
        // For now, we'll use a simple in-memory store
        const story = {
            id: `story_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: title || 'Untitled Story',
            content: content.trim(),
            category: category || 'other',
            status: 'pending',
            timestamp: new Date().toISOString()
        };
        
        // Save story to Postgres
        const saved = await saveStoryToDB(story);
        if (!saved) {
            return sendErrorResponse(res, 500, 'Failed to save story to database');
        }
        
        console.log('Story stored successfully:', story);
        
        sendSuccessResponse(res, { storyId: story.id }, 'Story submitted successfully. It will be reviewed before being published.');
    } catch (error) {
        sendErrorResponse(res, 500, 'Failed to submit story', error.message);
    }
}

// Get approved stories handler
async function handleGetStories(res, params) {
    try {
        const { action, limit = 20, offset = 0 } = params;
        
        // Load stories from Postgres
        const allStories = await getStoriesFromDB();
        console.log('handleGetStories - all stories from Postgres:', allStories);
        
        const stories = allStories
            .filter(story => story.status === 'approved')
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(parseInt(offset), parseInt(offset) + parseInt(limit));
        
        console.log('handleGetStories - approved stories:', stories);
        sendSuccessResponse(res, stories, 'Stories retrieved successfully');
    } catch (error) {
        sendErrorResponse(res, 500, 'Failed to retrieve stories', error.message);
    }
}

// Admin stats handler
async function handleAdminStats(res, params = {}) {
    try {
        // Load stories from Postgres
        const stories = await getStoriesFromDB();
        
        console.log('Admin stats - stories loaded from Postgres:', stories);
        console.log('Admin stats - stories length:', stories.length);
        console.log('Admin stats - stories statuses:', stories.map(s => ({ id: s.id, status: s.status, timestamp: s.timestamp })));
        
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        const stats = {
            total: stories.length,
            pending: stories.filter(s => s.status === 'pending').length,
            approved: stories.filter(s => s.status === 'approved').length,
            denied: stories.filter(s => s.status === 'denied').length,
            thisWeek: stories.filter(s => new Date(s.timestamp) >= oneWeekAgo).length,
            thisMonth: stories.filter(s => new Date(s.timestamp) >= oneMonthAgo).length
        };
        
        console.log('Admin stats - calculated stats:', stats);
        sendSuccessResponse(res, stats, 'Admin stats retrieved successfully');
    } catch (error) {
        sendErrorResponse(res, 500, 'Failed to retrieve admin stats', error.message);
    }
}

// Get all submissions for admin
async function handleGetSubmissions(res, params) {
    try {
        console.log('handleGetSubmissions called with params:', params);
        const { action, status, category, limit = 50, offset = 0 } = params;
        
        // Load stories directly from Postgres
        let stories = await getStoriesFromDB();
        
        console.log('Current stories loaded from Postgres:', stories);
        
        // Apply filters
        if (status && status !== 'all') {
            stories = stories.filter(s => s.status === status);
        }
        if (category && category !== 'all') {
            stories = stories.filter(s => s.category === category);
        }
        
        // Sort by timestamp (newest first)
        stories = stories.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Apply pagination
        stories = stories.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
        
        sendSuccessResponse(res, stories, 'Submissions retrieved successfully');
    } catch (error) {
        sendErrorResponse(res, 500, 'Failed to retrieve submissions', error.message);
    }
}

// Update submission status (approve/deny)
async function handleUpdateSubmission(res, params) {
    try {
        const { id, action, submissionAction } = params;
        const actionToUse = submissionAction || action;
        
        if (!id || !actionToUse || !['approve', 'deny'].includes(actionToUse)) {
            return sendErrorResponse(res, 400, 'Valid id and action (approve/deny) are required');
        }
        
        // Update story status in Postgres
        const newStatus = actionToUse === 'approve' ? 'approved' : 'denied';
        const reviewedAt = new Date().toISOString();
        const sql = getSql();
        
        const result = await sql`
            UPDATE stories 
            SET status = ${newStatus}, reviewed_at = ${reviewedAt}
            WHERE id = ${id}
            RETURNING *
        `;
        
        if (result.rows.length === 0) {
            return sendErrorResponse(res, 404, 'Story not found');
        }
        
        console.log('Story status updated in Postgres');
        
        sendSuccessResponse(res, { story: result.rows[0] }, `Story ${actionToUse}d successfully`);
    } catch (error) {
        sendErrorResponse(res, 500, 'Failed to update submission', error.message);
    }
}

// Analytics tracking handler
async function handleAnalyticsTracking(res, params) {
    try {
        const { action, type, page, sessionId, timestamp, eventType, ...eventData } = params;
        
        if (!type || !page || !timestamp) {
            return sendErrorResponse(res, 400, 'Missing required analytics data');
        }

        // Store analytics data in memory (replace with database in production)
        const analyticsData = {
            id: `analytics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type,
            page,
            sessionId,
            timestamp,
            eventType,
            ...eventData,
            ip: res.req.headers['x-forwarded-for'] || res.req.connection.remoteAddress || 'unknown'
        };

        // Save analytics to Postgres
        const saved = await saveAnalyticsToDB([analyticsData]);
        if (!saved) {
            console.log('Failed to save analytics to Postgres, but continuing...');
        }

        sendSuccessResponse(res, { id: analyticsData.id }, 'Analytics tracked');
    } catch (error) {
        sendErrorResponse(res, 500, 'Failed to track analytics', error.message);
    }
}

// Get analytics data (public endpoint for basic stats)
async function handleGetAnalytics(res, params) {
    try {
        const { page, days = 30 } = params;
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        
        let analytics = global.analytics || [];
        
        // Filter by date and page if specified
        analytics = analytics.filter(item => 
            new Date(item.timestamp) >= cutoffDate && 
            (!page || item.page === page)
        );

        // Group by page
        const pageStats = analytics.reduce((acc, item) => {
            if (item.type === 'page_view') {
                acc[item.page] = (acc[item.page] || 0) + 1;
            }
            return acc;
        }, {});

        sendSuccessResponse(res, { pageStats, totalEvents: analytics.length }, 'Analytics retrieved');
    } catch (error) {
        sendErrorResponse(res, 500, 'Failed to retrieve analytics', error.message);
    }
}

// Admin analytics handler with detailed stats and time filtering
async function handleAdminAnalytics(res, params) {
    try {
        const { action, period = 'week', page, startDate, endDate } = params;
        
        let analytics = await getAnalyticsFromDB();
        
        console.log('Admin analytics - loaded from Postgres:', analytics.length);
        
        let filteredAnalytics = [...analytics];

        // Apply date filtering
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            filteredAnalytics = filteredAnalytics.filter(item => {
                const itemDate = new Date(item.timestamp);
                return itemDate >= start && itemDate <= end;
            });
        } else {
            // Apply period filtering
            const now = new Date();
            let cutoffDate;
            
            switch (period) {
                case 'day':
                    cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                    break;
                case 'week':
                    cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                case 'total':
                    cutoffDate = new Date(0); // All time
                    break;
                default:
                    cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            }
            
            filteredAnalytics = filteredAnalytics.filter(item => 
                new Date(item.timestamp) >= cutoffDate
            );
        }

        // Filter by page if specified
        if (page && page !== 'all') {
            filteredAnalytics = filteredAnalytics.filter(item => item.page === page);
        }

        // Calculate statistics
        const stats = {
            totalEvents: filteredAnalytics.length,
            pageViews: filteredAnalytics.filter(item => item.type === 'page_view').length,
            uniqueSessions: new Set(filteredAnalytics.map(item => item.sessionId)).size,
            events: filteredAnalytics.filter(item => item.type === 'event').length,
            pageExits: filteredAnalytics.filter(item => item.type === 'page_exit').length
        };

        // Page breakdown
        const pageBreakdown = filteredAnalytics
            .filter(item => item.type === 'page_view')
            .reduce((acc, item) => {
                acc[item.page] = (acc[item.page] || 0) + 1;
                return acc;
            }, {});

        // Event breakdown
        const eventBreakdown = filteredAnalytics
            .filter(item => item.type === 'event')
            .reduce((acc, item) => {
                const key = `${item.page}:${item.eventType}`;
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {});

        // Daily/hourly breakdown
        const timeBreakdown = filteredAnalytics.reduce((acc, item) => {
            const date = new Date(item.timestamp);
            const key = period === 'day' ? 
                date.getHours().toString().padStart(2, '0') + ':00' :
                date.toISOString().split('T')[0];
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});

        // Average time on page
        const pageExitData = filteredAnalytics.filter(item => item.type === 'page_exit' && item.timeOnPage);
        const avgTimeOnPage = pageExitData.length > 0 ? 
            pageExitData.reduce((sum, item) => sum + item.timeOnPage, 0) / pageExitData.length : 0;

        const analyticsData = {
            stats,
            pageBreakdown,
            eventBreakdown,
            timeBreakdown,
            avgTimeOnPage: Math.round(avgTimeOnPage / 1000), // Convert to seconds
            period,
            filteredCount: filteredAnalytics.length,
            totalCount: analytics.length
        };

        sendSuccessResponse(res, analyticsData, 'Admin analytics retrieved');
    } catch (error) {
        sendErrorResponse(res, 500, 'Failed to retrieve admin analytics', error.message);
    }
}

// Minimal 302 helper for go-links
function handleGo(res, target) {
    if (!target) return sendErrorResponse(res, 404, 'Destination not configured');
    try {
        res.statusCode = 302;
        res.setHeader('Location', target);
        res.end();
    } catch (_) {
        try { res.end(); } catch { /* noop */ }
    }
}