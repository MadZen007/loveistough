// LoveIsTough Main JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Initialize all components
    initAnimations();
    initModalSystem();
    initScrollEffects();
    initNavigation();
    initLoadingStates();
    initMemeSystem(); // Initialize the new meme system
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
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
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
    
    // Supported meme file extensions
    const supportedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    
    // Function to get all meme files from the images folder
    async function loadMemeFiles() {
        try {
            // Try to fetch a list of files from the images directory
            // This is a fallback approach - you can also manually specify files
            const response = await fetch('/api/memes');
            if (response.ok) {
                const files = await response.json();
                return files.filter(file => 
                    supportedExtensions.some(ext => 
                        file.toLowerCase().endsWith(ext)
                    )
                );
            }
        } catch (error) {
            console.log('Could not fetch meme list from API, using fallback');
        }
        
        // Fallback: manually specify your meme files here
        // Update this array with your actual meme filenames
        return [
            // Add your meme filenames here, for example:
            // 'meme1.jpg',
            // 'funny-meme.png',
            // 'dating-meme.gif',
            // etc.
        ];
    }
    
    let memeFiles = [];
    
    // Initialize meme files
    loadMemeFiles().then(files => {
        memeFiles = files;
        console.log(`Loaded ${memeFiles.length} meme files`);
        
        // Enable the meme button if we have files
        if (memeFiles.length > 0) {
            memeButton.style.opacity = '1';
            memeButton.style.pointerEvents = 'auto';
        } else {
            memeButton.style.opacity = '0.5';
            memeButton.style.pointerEvents = 'none';
            console.log('No meme files found. Add files to the images folder and update the memeFiles array.');
        }
    });
    
    function getRandomMeme() {
        if (memeFiles.length === 0) {
            throw new Error('No meme files available');
        }
        const randomIndex = Math.floor(Math.random() * memeFiles.length);
        return `images/${memeFiles[randomIndex]}`;
    }
    
    function showRandomMeme() {
        try {
            if (memeFiles.length === 0) {
                LoveIsTough.showNotification('No memes available yet!', 'info');
                return;
            }
            
            const randomMemeSrc = getRandomMeme();
            memeImage.src = randomMemeSrc;
            memeModal.classList.add('active');
            document.body.style.overflow = 'hidden';
            
            // Add loading state
            memeImage.style.opacity = '0';
            memeImage.onload = function() {
                memeImage.style.opacity = '1';
            };
            memeImage.onerror = function() {
                LoveIsTough.showNotification('Failed to load meme. Trying another one...', 'warning');
                // Try another meme if this one fails
                setTimeout(showRandomMeme, 500);
            };
        } catch (error) {
            console.error('Error showing meme:', error);
            LoveIsTough.showNotification('Error loading meme', 'error');
        }
    }
    
    function closeMemeModal() {
        memeModal.classList.remove('active');
        document.body.style.overflow = 'auto';
        // Reset image source to clear memory
        memeImage.src = '';
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