// LoveIsTough Main JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Initialize all components
    initAnimations();
    initModalSystem();
    initScrollEffects();
    initNavigation();
    initLoadingStates();
    initMemeSystem(); // Initialize the new meme system
    initAuthUI();
});

// Animation System
function initAnimations() {
    // Fade in elements on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    // Observe all fade-in elements
    document.querySelectorAll('.fade-in').forEach(el => {
        observer.observe(el);
    });

    // Add fade-in class to cards
    document.querySelectorAll('.feature-card, .latest-card').forEach(card => {
        card.classList.add('fade-in');
    });
}

// Modal System
function initModalSystem() {
    // Create modal container
    const modalContainer = document.createElement('div');
    modalContainer.className = 'modal-overlay';
    modalContainer.innerHTML = `
        <div class="modal-content">
            <button class="modal-close" onclick="closeModal()">&times;</button>
            <div class="modal-body"></div>
        </div>
    `;
    document.body.appendChild(modalContainer);

    // Add modal styles
    const modalStyles = document.createElement('style');
    modalStyles.textContent = `
        .modal-close {
            position: absolute;
            top: 10px;
            right: 15px;
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: var(--slate-gray);
            transition: var(--transition-normal);
        }
        .modal-close:hover {
            color: var(--vibrant-red);
            transform: scale(1.2);
        }
    `;
    document.head.appendChild(modalStyles);
}

// Global modal functions
window.openModal = function(content) {
    const modal = document.querySelector('.modal-overlay');
    const modalBody = modal.querySelector('.modal-body');
    modalBody.innerHTML = content;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
};

window.closeModal = function() {
    const modal = document.querySelector('.modal-overlay');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
};

// Auth Modal + Handlers
function initAuthUI() {
    updateAuthButtons();
    
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (loginBtn) {
        loginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openModal(renderLoginForm());
            attachLoginHandler();
            attachForgotPasswordHandler();
        });
    }

    if (signupBtn) {
        signupBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openModal(renderSignupForm());
            attachSignupHandler();
        });
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
}

function updateAuthButtons() {
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    const token = LoveIsTough.storage.get('token');
    
    if (token) {
        // User is logged in - show logout, hide login/signup
        if (loginBtn) loginBtn.style.display = 'none';
        if (signupBtn) signupBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'inline-block';
    } else {
        // User is not logged in - show login/signup, hide logout
        if (loginBtn) loginBtn.style.display = 'inline-block';
        if (signupBtn) signupBtn.style.display = 'inline-block';
        if (logoutBtn) logoutBtn.style.display = 'none';
    }
}

function logout() {
    LoveIsTough.storage.remove('token');
    updateAuthButtons();
    LoveIsTough.showNotification('Logged out successfully!', 'success');
}

function renderLoginForm() {
    return `
        <h2 style="margin-top:0">Log In</h2>
        <form id="loginForm" class="auth-form">
            <label>Email</label>
            <input type="email" name="email" required />
            <label>Password</label>
            <input type="password" name="password" required />
            <button type="submit" class="hero-card-btn" style="margin-top:1rem">Log In</button>
            <a href="#" id="forgotPwdLink" style="display:block;margin-top:0.75rem;color:var(--slate-gray);text-decoration:underline">Forgot password?</a>
        </form>
    `;
}

function renderSignupForm() {
    return `
        <h2 style="margin-top:0">Sign Up</h2>
        <form id="signupForm" class="auth-form">
            <label>Name</label>
            <input type="text" name="name" required />
            <label>Email</label>
            <input type="email" name="email" required />
            <label>Password</label>
            <input type="password" name="password" required />
            <button type="submit" class="hero-card-btn" style="margin-top:1rem">Create Account</button>
        </form>
    `;
}

function attachLoginHandler() {
    const form = document.getElementById('loginForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form));
        try {
            showLoading();
            const res = await LoveIsTough.apiCall('', {
                method: 'POST',
                body: JSON.stringify({ action: 'login', email: data.email, password: data.password })
            });
            // Store JWT token under the key used elsewhere in the codebase
            if (res && res.data && res.data.token) {
                LoveIsTough.storage.set('token', res.data.token);
            }
            LoveIsTough.showNotification('Logged in successfully!', 'success');
            closeModal();
            updateAuthButtons();
        } catch (err) {
            LoveIsTough.showNotification('Login failed. Check your credentials.', 'error');
        } finally {
            hideLoading();
        }
    });
}

function attachForgotPasswordHandler() {
    const link = document.getElementById('forgotPwdLink');
    if (!link) return;
    link.addEventListener('click', async (e) => {
        e.preventDefault();
        const emailInput = document.querySelector('#loginForm input[name="email"]');
        const email = emailInput ? emailInput.value.trim() : '';
        if (!email) {
            LoveIsTough.showNotification('Enter your email in the form first.', 'warning');
            return;
        }
        try {
            showLoading();
            const res = await LoveIsTough.apiCall('', {
                method: 'POST',
                body: JSON.stringify({ action: 'request-password-reset', email })
            });
            LoveIsTough.showNotification('If the email exists, a reset link has been sent.', 'info');
        } catch (err) {
            LoveIsTough.showNotification('Could not start password reset.', 'error');
        } finally {
            hideLoading();
        }
    });
}

function attachSignupHandler() {
    const form = document.getElementById('signupForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form));
        try {
            showLoading();
            const res = await LoveIsTough.apiCall('', {
                method: 'POST',
                body: JSON.stringify({ action: 'register', username: data.name, email: data.email, password: data.password })
            });
            // Auto-login to get JWT
            try {
                const loginRes = await LoveIsTough.apiCall('', {
                    method: 'POST',
                    body: JSON.stringify({ action: 'login', email: data.email, password: data.password })
                });
                if (loginRes && loginRes.data && loginRes.data.token) {
                    LoveIsTough.storage.set('token', loginRes.data.token);
                }
                LoveIsTough.showNotification('Account created! You are now signed in.', 'success');
                closeModal();
                updateAuthButtons();
            } catch (e) {
                LoveIsTough.showNotification('Account created. Please log in.', 'info');
            }
        } catch (err) {
            LoveIsTough.showNotification('Signup failed. Email may already be registered.', 'error');
        } finally {
            hideLoading();
        }
    });
}

// Scroll Effects
function initScrollEffects() {
    let ticking = false;

    function updateHeader() {
        const header = document.querySelector('.main-header');
        const scrollTop = window.pageYOffset;

        if (scrollTop > 100) {
            header.style.background = 'rgba(212, 196, 168, 0.95)';
            header.style.backdropFilter = 'blur(10px)';
        } else {
            header.style.background = 'var(--pantone-135)';
            header.style.backdropFilter = 'none';
        }

        ticking = false;
    }

    function requestTick() {
        if (!ticking) {
            requestAnimationFrame(updateHeader);
            ticking = true;
        }
    }

    window.addEventListener('scroll', requestTick);
}

// Navigation System
function initNavigation() {
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            // Ignore bare "#" links (e.g., Login/Signup buttons)
            if (!href || href.trim() === '#') {
                return;
            }
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Active navigation highlighting
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section[id]');

    function updateActiveNav() {
        const scrollPos = window.scrollY + 100;

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');

            if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${sectionId}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }

    window.addEventListener('scroll', updateActiveNav);
}

// Loading States
function initLoadingStates() {
    // Create loading spinner
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    spinner.style.display = 'none';
    spinner.style.position = 'fixed';
    spinner.style.top = '50%';
    spinner.style.left = '50%';
    spinner.style.transform = 'translate(-50%, -50%)';
    spinner.style.zIndex = '3000';
    document.body.appendChild(spinner);

    // Global loading functions
    window.showLoading = function() {
        spinner.style.display = 'block';
    };

    window.hideLoading = function() {
        spinner.style.display = 'none';
    };
}

// Utility Functions
const LoveIsTough = {
    // API calls
    async apiCall(endpoint, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const config = { ...defaultOptions, ...options };

        try {
            const response = await fetch(`/api/${endpoint}`, config);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    },

    // Local storage utilities
    storage: {
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (error) {
                console.error('Failed to save to localStorage:', error);
            }
        },

        get(key) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : null;
            } catch (error) {
                console.error('Failed to read from localStorage:', error);
                return null;
            }
        },

        remove(key) {
            try {
                localStorage.removeItem(key);
            } catch (error) {
                console.error('Failed to remove from localStorage:', error);
            }
        }
    },

    // Form validation
    validateForm(formData) {
        const errors = {};

        for (const [key, value] of formData.entries()) {
            if (!value || value.trim() === '') {
                errors[key] = `${key.charAt(0).toUpperCase() + key.slice(1)} is required`;
            }
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    },

    // Show notifications
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Add notification styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 2rem;
            border-radius: 8px;
            color: white;
            font-weight: bold;
            z-index: 4000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            max-width: 300px;
        `;

        // Set background color based on type
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        notification.style.backgroundColor = colors[type] || colors.info;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Remove after 5 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 5000);
    },

    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Throttle function
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
};

// Make LoveIsTough available globally
window.LoveIsTough = LoveIsTough;

// Meme System
function initMemeSystem() {
    const memeButton = document.getElementById('memeButton');
    const memeModal = document.getElementById('memeModal');
    const memeClose = document.getElementById('memeClose');
    const memeImage = document.getElementById('memeImage');
    
    let memeFiles = [];
    
    async function fetchMemeFiles() {
        try {
            const res = await fetch('/api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'list-memes' })
            });
            const data = await res.json();
            memeFiles = Array.isArray(data?.data?.files) ? data.data.files : [];
        } catch (e) {
            memeFiles = [];
        }
    }
    
    // Shuffle queue to minimize repeats
    let shuffledQueue = [];
    function reshuffleQueue() {
        shuffledQueue = [...memeFiles];
        for (let i = shuffledQueue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledQueue[i], shuffledQueue[j]] = [shuffledQueue[j], shuffledQueue[i]];
        }
    }
    function nextFromQueue() {
        if (shuffledQueue.length === 0) reshuffleQueue();
        return shuffledQueue.shift();
    }
    
    // Initialize from API
    fetchMemeFiles().then(() => {
        reshuffleQueue();
        console.log(`Loaded ${memeFiles.length} meme files`);
        memeButton.style.opacity = '1';
        memeButton.style.pointerEvents = 'auto';
    });
    
    // Enable the meme button
    memeButton.style.opacity = '1';
    memeButton.style.pointerEvents = 'auto';
    
    function getRandomMeme() {
        if (memeFiles.length === 0) {
            throw new Error('No meme files available');
        }
        const file = nextFromQueue();
        return `images/memes/${file}`;
    }
    
    let retryCount = 0;
    const maxRetries = 3;
    
    function showRandomMeme() {
        try {
            if (memeFiles.length === 0) {
                LoveIsTough.showNotification('No memes available yet! Add some meme files to the images folder.', 'info');
                return;
            }
            
            if (retryCount >= maxRetries) {
                LoveIsTough.showNotification('Unable to load memes. Please check that meme files exist in the images folder.', 'error');
                retryCount = 0;
                return;
            }
            
            const randomMemeSrc = getRandomMeme();
            
            // Set up event handlers before setting src
            memeImage.onload = function() {
                memeImage.style.opacity = '1';
                retryCount = 0; // Reset retry count on success
            };
            
            memeImage.onerror = function() {
                retryCount++;
                LoveIsTough.showNotification(`Failed to load meme (attempt ${retryCount}/${maxRetries}). Trying another one...`, 'warning');
                // Try another meme if this one fails
                setTimeout(showRandomMeme, 500);
            };
            
            // Now set the source and show modal
            memeImage.style.opacity = '0';
            memeImage.src = randomMemeSrc;
            memeModal.classList.add('active');
            document.body.style.overflow = 'hidden';
            
        } catch (error) {
            console.error('Error showing meme:', error);
            LoveIsTough.showNotification('Error loading meme', 'error');
        }
    }
    
    function closeMemeModal() {
        memeModal.classList.remove('active');
        document.body.style.overflow = 'auto';
        // Remove event handlers to prevent triggering onerror when clearing src
        memeImage.onload = null;
        memeImage.onerror = null;
        // Reset image source to clear memory
        memeImage.src = '';
        // Reset retry count when modal is closed
        retryCount = 0;
    }
    
    // Event listeners
    memeButton.addEventListener('click', showRandomMeme);
    memeClose.addEventListener('click', closeMemeModal);
    
    // Close modal when clicking outside
    memeModal.addEventListener('click', function(e) {
        if (e.target === memeModal) {
            closeMemeModal();
        }
    });
    
    // Close modal with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && memeModal.classList.contains('active')) {
            closeMemeModal();
        }
    });
}

// Error handling
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    LoveIsTough.showNotification('Something went wrong. Please try again.', 'error');
});

// Performance monitoring
window.addEventListener('load', function() {
    // Log page load performance
    const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
    console.log(`Page loaded in ${loadTime}ms`);
});

// Service Worker registration (for PWA features)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
                console.log('SW registered: ', registration);
            })
            .catch(function(registrationError) {
                console.log('SW registration failed: ', registrationError);
            });
    });
} 