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
const subscriptions = new Map();

// Simple JSON body parser for Vercel
async function parseJsonBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (e) {
                resolve({});
            }
        });
        req.on('error', () => resolve({}));
    });
}

// Helper functions for responses
function sendSuccessResponse(res, data, message) {
    res.status(200).json({
        success: true,
        message: message,
        data: data
    });
}

function sendErrorResponse(res, statusCode, message, details = null) {
    res.status(statusCode).json({
        success: false,
        message: message,
        details: details
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

        // Handle GET requests without action (browser requests, favicon, etc.)
        if (method === 'GET' && !action) {
            console.log('GET request without action - likely browser request:', req.url);
            return sendErrorResponse(res, 404, 'API endpoint requires action parameter');
        }

        // Route based on action parameter
        console.log('🔧 SWITCH STATEMENT - action:', action, 'TIMESTAMP:', new Date().toISOString());
        switch (action) {
            // Meme endpoints
            case 'list-memes':
                if (method !== 'POST') {
                    return sendErrorResponse(res, 405, 'Method not allowed');
                }
                await handleListMemes(res);
                break;

            // Story endpoints
            case 'submit-story':
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

            // Analytics endpoints
            case 'analytics':
                if (method !== 'POST') {
                    return sendErrorResponse(res, 405, 'Method not allowed');
                }
                await handleAnalyticsTracking(res, params);
                break;

            case 'get-analytics':
                if (method !== 'POST') {
                    return sendErrorResponse(res, 405, 'Method not allowed');
                }
                await handleGetAnalytics(res, params);
                break;

            // Health check
            case 'health':
                if (method !== 'GET' && method !== 'POST') {
                    return sendErrorResponse(res, 405, 'Method not allowed');
                }
                await handleHealth(res);
                break;

            default:
                console.log('Unknown action:', action);
                return sendErrorResponse(res, 404, `Unknown action: ${action}`);
        }

    } catch (error) {
        console.error('API Error:', error);
        sendErrorResponse(res, 500, 'Internal server error', error.message);
    }
};

// Health-check handler
async function handleHealth(res) {
    try {
        return sendSuccessResponse(res, { ok: true, timestamp: new Date().toISOString() }, 'API is healthy');
    } catch (error) {
        return sendErrorResponse(res, 500, 'Health check failed', error.message);
    }
}

// List meme filenames from images/memes
async function handleListMemes(res) {
    try {
        // Simple in-memory list for now - can be replaced with file system reading later
        const memes = [
            'meme1.jpg',
            'meme2.jpg', 
            'meme3.jpg'
        ];
        
        sendSuccessResponse(res, { memes }, 'Memes retrieved successfully');
    } catch (error) {
        sendErrorResponse(res, 500, 'Failed to retrieve memes', error.message);
    }
}

// Simple analytics tracking (in-memory for now)
const analytics = [];

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

        analytics.push(analyticsData);
        console.log('Analytics tracked:', analyticsData);

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
        
        let filteredAnalytics = [...analytics];
        
        // Filter by date and page if specified
        filteredAnalytics = filteredAnalytics.filter(item => 
            new Date(item.timestamp) >= cutoffDate && 
            (!page || item.page === page)
        );

        // Group by page
        const pageStats = filteredAnalytics.reduce((acc, item) => {
            if (item.type === 'page_view') {
                acc[item.page] = (acc[item.page] || 0) + 1;
            }
            return acc;
        }, {});

        sendSuccessResponse(res, { pageStats, totalEvents: filteredAnalytics.length }, 'Analytics retrieved');
    } catch (error) {
        sendErrorResponse(res, 500, 'Failed to retrieve analytics', error.message);
    }
}

// Simple in-memory story storage (replace with database later)
const stories = [];

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
        
        // Create story object
        const story = {
            id: `story_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: title || 'Untitled Story',
            content: content.trim(),
            category: category || 'other',
            status: 'approved', // For now, auto-approve stories
            timestamp: new Date().toISOString()
        };
        
        // Store story in memory
        stories.push(story);
        console.log('Story stored successfully:', story);
        
        sendSuccessResponse(res, { storyId: story.id }, 'Story submitted successfully. Thank you for sharing!');
    } catch (error) {
        sendErrorResponse(res, 500, 'Failed to submit story', error.message);
    }
}

// Get approved stories handler
async function handleGetStories(res, params) {
    try {
        const { limit = 20, offset = 0 } = params;
        
        // Get approved stories, sorted by timestamp (newest first)
        const approvedStories = stories
            .filter(story => story.status === 'approved')
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(parseInt(offset), parseInt(offset) + parseInt(limit));
        
        console.log('handleGetStories - approved stories:', approvedStories.length);
        sendSuccessResponse(res, approvedStories, 'Stories retrieved successfully');
    } catch (error) {
        sendErrorResponse(res, 500, 'Failed to retrieve stories', error.message);
    }
}