// Simple analytics tracking system
class AnalyticsTracker {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.pageStartTime = Date.now();
        this.init();
    }

    init() {
        // Track page view on load
        this.trackPageView();
        
        // Track page unload (time on page)
        window.addEventListener('beforeunload', () => {
            this.trackPageExit();
        });

        // Track clicks on important elements
        this.trackClicks();
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getCurrentPage() {
        const path = window.location.pathname;
        const page = path === '/' ? 'home' : path.replace(/^\//, '').replace('.html', '');
        return page;
    }

    trackPageView() {
        const data = {
            type: 'page_view',
            page: this.getCurrentPage(),
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            referrer: document.referrer || 'direct',
            url: window.location.href,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            }
        };

        this.sendAnalytics(data);
    }

    trackPageExit() {
        const timeOnPage = Date.now() - this.pageStartTime;
        const data = {
            type: 'page_exit',
            page: this.getCurrentPage(),
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            timeOnPage: timeOnPage
        };

        // Use sendBeacon for reliable tracking on page unload
        if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/analytics', JSON.stringify(data));
        } else {
            this.sendAnalytics(data);
        }
    }

    trackClicks() {
        // Track clicks on important buttons and links
        document.addEventListener('click', (event) => {
            const target = event.target;
            
            // Track hero card clicks
            if (target.closest('.hero-card-btn')) {
                const button = target.closest('.hero-card-btn');
                const text = button.textContent.trim();
                const href = button.href;
                
                this.trackEvent('button_click', {
                    buttonText: text,
                    destination: href,
                    location: 'hero_card'
                });
            }

            // Track meme button clicks
            if (target.closest('#memeButton')) {
                this.trackEvent('meme_click', {
                    location: 'meme_button'
                });
            }

            // Track story submissions
            if (target.closest('#storyForm')) {
                this.trackEvent('story_form_interaction', {
                    formAction: 'form_start'
                });
            }
        });
    }

    trackEvent(eventType, eventData = {}) {
        const data = {
            type: 'event',
            eventType: eventType,
            page: this.getCurrentPage(),
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            ...eventData
        };

        this.sendAnalytics(data);
    }

    sendAnalytics(data) {
        try {
            const payload = {
                action: 'analytics',
                ...data
            };
            console.log('Sending analytics:', payload);
            
            fetch('/api', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            }).then(response => {
                if (!response.ok) {
                    console.log('Analytics response not ok:', response.status, response.statusText);
                }
                return response.json();
            }).then(data => {
                console.log('Analytics response:', data);
            }).catch(error => {
                // Silently fail for analytics - don't break user experience
                console.log('Analytics tracking failed:', error);
            });
        } catch (error) {
            // Silently fail for analytics
            console.log('Analytics tracking failed:', error);
        }
    }
}

// Initialize analytics when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.analytics = new AnalyticsTracker();
});

// Track story form submission
document.addEventListener('DOMContentLoaded', () => {
    const storyForm = document.getElementById('storyForm');
    if (storyForm) {
        storyForm.addEventListener('submit', () => {
            if (window.analytics) {
                window.analytics.trackEvent('story_submitted', {
                    formLocation: 'stories_page'
                });
            }
        });
    }
});
