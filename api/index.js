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