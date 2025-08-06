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
    
    // Function to get all meme files from the images/memes folder
    function loadMemeFiles() {
        // Return the actual meme filenames from your images/memes folder
        return [
            'af1c6f1315931c961a6b9e4d0ceee31e.jpg',
            '65dfa93311472d6f559f12c64f19e7f5.jpg',
            'e3270d62bd1c6d93f12c76d58f878075.jpg',
            'images (2).jpg',
            '86211349.jpg',
            'Benefits-Of-Dating-Me.jpg',
            'relationship-memes-14-20250415.jpg',
            'Best-Memes-About-Online-Dating-That-You-Will-Relate-To-50356-8.jpg',
            'dating-memes-monfeat-20241028.jpg',
            '5d17bb0c650914c64f13015971411202.jpg',
            '3077e0847b2752520f93b3fb8510df63.jpg',
            'eec2dcddacd0ad8b21452cc8e0368aca.jpg',
            'images.png',
            '17380193636570e68b758a8aefd3d9cce5f9af93b7682.webp',
            'Screenshot_20240216-092152_Instagram.jpg',
            '9e812177-0409-4ac9-9986-588076a996d1.jpg',
            'Screenshot_20240226-072054_Instagram.jpg',
            '9e7a2bef-3757-4447-97f0-00f5d02b8283.jpg',
            '0ecf0742-2916-47f9-9948-764b0bb5f1c3.jpg',
            'tumblr_nnruoaLQXC1tbzbhio1_1280.jpg',
            '398c0124-815d-4fae-a37b-cf4daea839de.png',
            '107802339_10220003525750309_5490957170942123902_n.jpg',
            '0da1a35f-ff54-4d7d-a4af-7e4b4340cbc8.jpg',
            'a278770c-2476-4247-8dad-c25ada6f8f87.jpg',
            'Tumblr_l_456145562164014.jpg',
            '3a83d612-8380-4876-9f4c-6dcc3dae5e28.jpg',
            'tumblr_osuldkFkUD1vkzuj9o1_1280.jpg',
            'Screenshot_20250410-193009.png',
            'Screenshot_20250504-171433.png',
            'Screenshot_20250505-223419.png',
            'Screenshot_20250505-224424.png',
            'Screenshot_20250505-224508.png',
            'Screenshot_20250509-173543.png',
            'Screenshot_20250513-092954.png',
            'Screenshot_20250513-161119.png',
            'Screenshot_20250516-124925.png',
            'Screenshot_20250519-233137.png',
            'Screenshot_20250522-173202.png',
            'Screenshot_20250522-215838.png',
            'Screenshot_20250527-203553.png',
            'Screenshot_20250527-203637.png',
            'Screenshot_20250527-205713~2.jpg',
            'Screenshot_20250716-074200~2.jpg',
            'man-do-thing-like-yea-one-large-pizza-delivery-please.jpg',
            '2bc96ad132d6e2d6fe72f77db5b6c5ad.jpg',
            '2a6839827410543ec3b3ba0262c277d9.jpg',
            'aca90bd49ff0c9fd97059365d9f86840.jpg',
            '9e97303407a58aa30549ffaaa3ad6843.jpg',
            'd454b752ec89ccccfec2b224bd410813.jpg',
            '635c385057f532a19be5009ca2ef9540.jpg',
            'relationship-memes-29-9-23-2024.jpg',
            'memes-love-dontgetserious-i-promise-you-this.jpg',
            'titanic-fail-meme-bird-celine-dion.jpg',
            'images (1).jpg',
            'animal-not-relationship-but-having-relationship-problems-omarsel-van-oo.jpg',
            'funny-relationship-memes-62bd66344a277__700.jpg',
            'LTR2.jpg',
            '6_105.webp',
            '2e9555c8ffcb6826fd8012df1dda1764.jpg',
            'images.jpg',
            'dating-funny-memes-romantic-day-at-the-beach.png',
            'download.jpg',
            '79dcd1c529d98620f57dbf3e50a61683.jpg',
            'better-half-v0-cncopitshlaf1.webp',
            'she-is-the-keeper-v0-agy0091g13cf1.webp',
            '9bae33dtvqff1.webp',
            'still-love-me-dummy-and-all-v0-_G5IrknzVI8h3i_T-XPoBj-oq3NOMRa5YfbVH2Cd98w.webp',
            'just-another-situationship-v0-I6MtLpREBVv80YMIGgXdhJEcy0Qxch0_CPM-7HxIjro.webp',
            'all-i-got-is-love-for-you-v0-OUBsIms3eI3Ip0PM6Z9C7gknInaBStntz62c9qGRbVA.webp',
            'grown-up-love-goals-v0-djs8j5y6gkdf1.webp',
            'bend-over-t-rex-v0-vij3uy7jr5gf1.webp',
            'mutual-weirdness-v0-tlt8ujbl3def1.webp',
            'gomez-morticia-v0-1td77oh6mref1.webp',
            'love-language-unhinged-compliments-v0-pbc87epajcgf1.webp',
            'batman-goals-v0-xfhxrm72offf1.webp',
            'thats-my-love-language-right-there-i-want-all-the-food-plus-v0-fttnorv4kgff1.webp',
            'love-that-reassures-v0-6n0kkiezekgf1.webp',
            '9vmhyz3g7uef1.webp',
            'im-just-a-bit-tired-v0-n0ogp5rom8hf1.webp',
            'both-is-better-v0-zchhpnclz6hf1.webp',
            'not-clingy-at-all-v0-ts1hepyzf1df1.webp',
            'predator-and-prey-v0-g4o92fsmd9ff1.webp',
            'this-is-me-and-weve-been-together-31-yrs-v0-rny9x6lmkbgf1.webp',
            'forget-what-v0-voiv1fi8lfdf1.webp',
            'is-this-true-girls-v0-q3xbffgho5df1.webp',
            'real-ones-know-this-feeling-v0-dxetwylni1cf1.webp'
        ];
    }
    
    let memeFiles = [];
    
    // Initialize meme files
    memeFiles = loadMemeFiles();
    console.log(`Loaded ${memeFiles.length} meme files`);
    
    // Enable the meme button
    memeButton.style.opacity = '1';
    memeButton.style.pointerEvents = 'auto';
    
    function getRandomMeme() {
        if (memeFiles.length === 0) {
            throw new Error('No meme files available');
        }
        const randomIndex = Math.floor(Math.random() * memeFiles.length);
        return `images/memes/${memeFiles[randomIndex]}`;
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