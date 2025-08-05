// Advice Feature JavaScript
class AdviceManager {
    constructor() {
        this.currentPage = 0;
        this.currentCategory = 'all';
        this.currentSort = 'recent';
        this.advicePosts = [];
        this.isLoading = false;
        this.hasMorePosts = true;
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadAdvicePosts();
    }
    
    bindEvents() {
        // Hero buttons
        const askAdviceBtn = document.getElementById('askAdviceBtn');
        const browseAdviceBtn = document.getElementById('browseAdviceBtn');
        
        if (askAdviceBtn) {
            askAdviceBtn.addEventListener('click', () => this.openAskAdviceModal());
        }
        
        if (browseAdviceBtn) {
            browseAdviceBtn.addEventListener('click', () => this.scrollToAdvice());
        }
        
        // Category filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleCategoryFilter(e.target.dataset.category);
            });
        });
        
        // Sort select
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.handleSortChange(e.target.value);
            });
        }
        
        // Load more button
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                this.loadMorePosts();
            });
        }
        
        // Ask advice form
        const askAdviceForm = document.getElementById('askAdviceForm');
        if (askAdviceForm) {
            askAdviceForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSubmitAdvice();
            });
        }
    }
    
    async loadAdvicePosts() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading(true);
        
        try {
            const response = await LoveIsTough.apiCall('', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'get-advice',
                    category: this.currentCategory === 'all' ? null : this.currentCategory,
                    limit: 6,
                    offset: this.currentPage * 6
                })
            });
            
            if (response.success) {
                const newPosts = response.data.advice || [];
                this.advicePosts = this.currentPage === 0 ? newPosts : [...this.advicePosts, ...newPosts];
                this.hasMorePosts = newPosts.length === 6;
                this.renderAdvicePosts();
            } else {
                throw new Error(response.error?.message || 'Failed to load advice posts');
            }
        } catch (error) {
            console.error('Error loading advice posts:', error);
            LoveIsTough.showNotification('Failed to load advice posts. Please try again.', 'error');
            this.showEmptyState();
        } finally {
            this.isLoading = false;
            this.showLoading(false);
        }
    }
    
    async loadMorePosts() {
        this.currentPage++;
        await this.loadAdvicePosts();
    }
    
    handleCategoryFilter(category) {
        // Update active filter button
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-category="${category}"]`).classList.add('active');
        
        // Reset and reload posts
        this.currentCategory = category;
        this.currentPage = 0;
        this.advicePosts = [];
        this.hasMorePosts = true;
        this.loadAdvicePosts();
    }
    
    handleSortChange(sort) {
        this.currentSort = sort;
        this.currentPage = 0;
        this.advicePosts = [];
        this.hasMorePosts = true;
        this.loadAdvicePosts();
    }
    
    renderAdvicePosts() {
        const grid = document.getElementById('adviceGrid');
        if (!grid) return;
        
        if (this.advicePosts.length === 0) {
            this.showEmptyState();
            return;
        }
        
        // Clear existing content
        grid.innerHTML = '';
        
        // Sort posts if needed
        let sortedPosts = [...this.advicePosts];
        if (this.currentSort === 'popular') {
            sortedPosts.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
        } else if (this.currentSort === 'responses') {
            sortedPosts.sort((a, b) => (b.response_count || 0) - (a.response_count || 0));
        } else {
            // Recent (default) - already sorted by creation date from API
        }
        
        // Render posts
        sortedPosts.forEach(post => {
            const postCard = this.createAdviceCard(post);
            grid.appendChild(postCard);
        });
        
        // Show/hide load more button
        const loadMoreContainer = document.querySelector('.load-more-container');
        if (loadMoreContainer) {
            loadMoreContainer.style.display = this.hasMorePosts ? 'block' : 'none';
        }
    }
    
    createAdviceCard(post) {
        const card = document.createElement('article');
        card.className = 'advice-card fade-in';
        
        const content = this.truncateText(post.content, 200);
        const date = new Date(post.created_at).toLocaleDateString();
        const authorName = post.is_anonymous ? 'Anonymous' : (post.author_name || 'Anonymous');
        
        card.innerHTML = `
            <div class="advice-header">
                <span class="advice-category ${post.is_anonymous ? 'advice-anonymous' : ''}">${post.category}</span>
            </div>
            <h3 class="advice-title">${post.title}</h3>
            <div class="advice-content" data-post-id="${post.id}">
                ${content}
            </div>
            <div class="advice-meta">
                <span class="advice-author">By ${authorName}</span>
                <span class="advice-date">${date}</span>
            </div>
            <div class="advice-stats">
                <div class="stat-item">
                    <span class="stat-icon">👁️</span>
                    <span>${post.view_count || 0} views</span>
                </div>
                <div class="stat-item">
                    <span class="stat-icon">💬</span>
                    <span>${post.response_count || 0} responses</span>
                </div>
            </div>
            <div class="advice-actions">
                <button class="action-btn" onclick="adviceManager.viewAdvicePost(${post.id})">View Details</button>
                <button class="action-btn secondary" onclick="adviceManager.toggleContent(${post.id})">Read More</button>
            </div>
        `;
        
        return card;
    }
    
    toggleContent(postId) {
        const contentElement = document.querySelector(`[data-post-id="${postId}"]`);
        if (contentElement) {
            contentElement.classList.toggle('expanded');
            const button = contentElement.parentElement.querySelector('.action-btn.secondary');
            if (button) {
                button.textContent = contentElement.classList.contains('expanded') ? 'Read Less' : 'Read More';
            }
        }
    }
    
    viewAdvicePost(postId) {
        const post = this.advicePosts.find(p => p.id === postId);
        if (!post) return;
        
        this.openAdviceModal(post);
    }
    
    openAdviceModal(post) {
        const date = new Date(post.created_at).toLocaleDateString();
        const authorName = post.is_anonymous ? 'Anonymous' : (post.author_name || 'Anonymous');
        
        const modalContent = `
            <div class="advice-modal">
                <div class="modal-advice-header">
                    <span class="advice-category ${post.is_anonymous ? 'advice-anonymous' : ''}">${post.category}</span>
                    <div class="modal-advice-meta">
                        <span class="advice-author">By ${authorName}</span>
                        <span class="advice-date">${date}</span>
                    </div>
                </div>
                <h2 class="modal-advice-title">${post.title}</h2>
                <div class="modal-advice-content">
                    ${this.formatAdviceContent(post.content)}
                </div>
                <div class="modal-advice-stats">
                    <div class="stat-item">
                        <span class="stat-icon">👁️</span>
                        <span>${post.view_count || 0} views</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-icon">💬</span>
                        <span>${post.response_count || 0} responses</span>
                    </div>
                </div>
                <div class="modal-advice-actions">
                    <button class="action-btn" onclick="adviceManager.giveAdvice(${post.id})">Give Advice</button>
                    <button class="action-btn secondary" onclick="closeModal()">Close</button>
                </div>
            </div>
        `;
        
        // Add modal styles
        const modalStyles = `
            <style>
                .advice-modal {
                    max-width: 800px;
                    max-height: 80vh;
                    overflow-y: auto;
                }
                .modal-advice-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }
                .modal-advice-title {
                    font-size: 2rem;
                    margin: 1rem 0;
                    color: var(--black);
                }
                .modal-advice-content {
                    line-height: 1.8;
                    color: var(--black);
                    font-size: 1.1rem;
                    margin-bottom: 1.5rem;
                }
                .modal-advice-stats {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }
                .modal-advice-actions {
                    display: flex;
                    gap: 1rem;
                    justify-content: flex-end;
                }
            </style>
        `;
        
        openModal(modalContent + modalStyles);
    }
    
    openAskAdviceModal() {
        const modal = document.getElementById('askAdviceModal');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }
    
    closeAskAdviceModal() {
        const modal = document.getElementById('askAdviceModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = 'auto';
            // Reset form
            const form = document.getElementById('askAdviceForm');
            if (form) {
                form.reset();
            }
        }
    }
    
    async handleSubmitAdvice() {
        const form = document.getElementById('askAdviceForm');
        if (!form) return;
        
        const formData = new FormData(form);
        const validation = LoveIsTough.validateForm(formData);
        
        if (!validation.isValid) {
            const errorMessage = Object.values(validation.errors)[0];
            LoveIsTough.showNotification(errorMessage, 'error');
            return;
        }
        
        const adviceData = {
            title: formData.get('title'),
            content: formData.get('content'),
            category: formData.get('category'),
            isAnonymous: formData.get('isAnonymous') === 'on'
        };
        
        try {
            showLoading();
            
            const response = await LoveIsTough.apiCall('', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${LoveIsTough.storage.get('token')}`
                },
                body: JSON.stringify({
                    action: 'create-advice',
                    ...adviceData
                })
            });
            
            if (response.success) {
                LoveIsTough.showNotification('Your advice request has been submitted successfully!', 'success');
                this.closeAskAdviceModal();
                // Reload posts to show the new one
                this.currentPage = 0;
                this.advicePosts = [];
                this.loadAdvicePosts();
            } else {
                throw new Error(response.error?.message || 'Failed to submit advice request');
            }
        } catch (error) {
            console.error('Error submitting advice:', error);
            LoveIsTough.showNotification('Failed to submit advice request. Please try again.', 'error');
        } finally {
            hideLoading();
        }
    }
    
    giveAdvice(postId) {
        // This would open a form to give advice to a specific post
        LoveIsTough.showNotification('Advice feature coming soon!', 'info');
    }
    
    scrollToAdvice() {
        const adviceSection = document.querySelector('.advice-section');
        if (adviceSection) {
            adviceSection.scrollIntoView({ behavior: 'smooth' });
        }
    }
    
    showLoading(show) {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            spinner.classList.toggle('visible', show);
        }
    }
    
    showEmptyState() {
        const grid = document.getElementById('adviceGrid');
        if (!grid) return;
        
        grid.innerHTML = `
            <div class="empty-state">
                <h3>No Advice Posts Found</h3>
                <p>We couldn't find any advice posts in this category. Be the first to ask for advice!</p>
                <button class="btn btn-primary" onclick="adviceManager.openAskAdviceModal()">Ask for Advice</button>
            </div>
        `;
        
        // Hide load more button
        const loadMoreContainer = document.querySelector('.load-more-container');
        if (loadMoreContainer) {
            loadMoreContainer.style.display = 'none';
        }
    }
    
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength).trim() + '...';
    }
    
    formatAdviceContent(content) {
        // Simple formatting - in a real app, you might use a markdown parser
        return content
            .split('\n\n')
            .map(paragraph => `<p>${paragraph}</p>`)
            .join('');
    }
}

// Global functions for modal
window.closeAskAdviceModal = function() {
    if (window.adviceManager) {
        adviceManager.closeAskAdviceModal();
    }
};

// Initialize advice manager when DOM is loaded
let adviceManager;
document.addEventListener('DOMContentLoaded', function() {
    adviceManager = new AdviceManager();
}); 