// Community Feature JavaScript
class CommunityManager {
    constructor() {
        this.currentPage = 0;
        this.currentCategory = 'all';
        this.currentSort = 'recent';
        this.communityPosts = [];
        this.isLoading = false;
        this.hasMorePosts = true;
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadCommunityPosts();
    }
    
    bindEvents() {
        // Hero buttons
        const createPostBtn = document.getElementById('createPostBtn');
        const browsePostsBtn = document.getElementById('browsePostsBtn');
        
        if (createPostBtn) {
            createPostBtn.addEventListener('click', () => this.openCreatePostModal());
        }
        
        if (browsePostsBtn) {
            browsePostsBtn.addEventListener('click', () => this.scrollToPosts());
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
        
        // Create post form
        const createPostForm = document.getElementById('createPostForm');
        if (createPostForm) {
            createPostForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSubmitPost();
            });
        }
    }
    
    async loadCommunityPosts() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading(true);
        
        try {
            const response = await LoveIsTough.apiCall('', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'get-community-posts',
                    category: this.currentCategory === 'all' ? null : this.currentCategory,
                    limit: 6,
                    offset: this.currentPage * 6
                })
            });
            
            if (response.success) {
                const newPosts = response.data.posts || [];
                this.communityPosts = this.currentPage === 0 ? newPosts : [...this.communityPosts, ...newPosts];
                this.hasMorePosts = newPosts.length === 6;
                this.renderCommunityPosts();
            } else {
                throw new Error(response.error?.message || 'Failed to load community posts');
            }
        } catch (error) {
            console.error('Error loading community posts:', error);
            LoveIsTough.showNotification('Failed to load community posts. Please try again.', 'error');
            this.showEmptyState();
        } finally {
            this.isLoading = false;
            this.showLoading(false);
        }
    }
    
    async loadMorePosts() {
        this.currentPage++;
        await this.loadCommunityPosts();
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
        this.communityPosts = [];
        this.hasMorePosts = true;
        this.loadCommunityPosts();
    }
    
    handleSortChange(sort) {
        this.currentSort = sort;
        this.currentPage = 0;
        this.communityPosts = [];
        this.hasMorePosts = true;
        this.loadCommunityPosts();
    }
    
    renderCommunityPosts() {
        const grid = document.getElementById('communityGrid');
        if (!grid) return;
        
        if (this.communityPosts.length === 0) {
            this.showEmptyState();
            return;
        }
        
        // Clear existing content
        grid.innerHTML = '';
        
        // Sort posts if needed
        let sortedPosts = [...this.communityPosts];
        if (this.currentSort === 'popular') {
            sortedPosts.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
        } else if (this.currentSort === 'likes') {
            sortedPosts.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
        } else {
            // Recent (default) - already sorted by creation date from API
        }
        
        // Render posts
        sortedPosts.forEach(post => {
            const postCard = this.createCommunityCard(post);
            grid.appendChild(postCard);
        });
        
        // Show/hide load more button
        const loadMoreContainer = document.querySelector('.load-more-container');
        if (loadMoreContainer) {
            loadMoreContainer.style.display = this.hasMorePosts ? 'block' : 'none';
        }
    }
    
    createCommunityCard(post) {
        const card = document.createElement('article');
        card.className = 'community-card fade-in';
        
        const content = this.truncateText(post.content, 200);
        const date = new Date(post.created_at).toLocaleDateString();
        const tags = post.tags ? post.tags.map(tag => `<span class="community-tag">${tag}</span>`).join('') : '';
        
        card.innerHTML = `
            <div class="community-header">
                <span class="community-category ${post.category}">${post.category}</span>
            </div>
            <h3 class="community-title">${post.title}</h3>
            <div class="community-content" data-post-id="${post.id}">
                ${content}
            </div>
            ${tags ? `<div class="community-tags">${tags}</div>` : ''}
            <div class="community-meta">
                <span class="community-author">By ${post.author_name || 'Anonymous'}</span>
                <span class="community-date">${date}</span>
            </div>
            <div class="community-stats">
                <div class="stat-item">
                    <span class="stat-icon" onclick="communityManager.toggleLike(${post.id})">❤️</span>
                    <span>${post.like_count || 0} likes</span>
                </div>
                <div class="stat-item">
                    <span class="stat-icon">👁️</span>
                    <span>${post.view_count || 0} views</span>
                </div>
            </div>
            <div class="community-actions">
                <button class="action-btn" onclick="communityManager.viewCommunityPost(${post.id})">View Details</button>
                <button class="action-btn secondary" onclick="communityManager.toggleContent(${post.id})">Read More</button>
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
    
    toggleLike(postId) {
        // This would handle liking/unliking posts
        LoveIsTough.showNotification('Like feature coming soon!', 'info');
    }
    
    viewCommunityPost(postId) {
        const post = this.communityPosts.find(p => p.id === postId);
        if (!post) return;
        
        this.openCommunityModal(post);
    }
    
    openCommunityModal(post) {
        const date = new Date(post.created_at).toLocaleDateString();
        const tags = post.tags ? post.tags.map(tag => `<span class="community-tag">${tag}</span>`).join('') : '';
        
        const modalContent = `
            <div class="community-modal">
                <div class="modal-community-header">
                    <span class="community-category ${post.category}">${post.category}</span>
                    <div class="modal-community-meta">
                        <span class="community-author">By ${post.author_name || 'Anonymous'}</span>
                        <span class="community-date">${date}</span>
                    </div>
                </div>
                <h2 class="modal-community-title">${post.title}</h2>
                <div class="modal-community-content">
                    ${this.formatCommunityContent(post.content)}
                </div>
                ${tags ? `<div class="modal-community-tags">${tags}</div>` : ''}
                <div class="modal-community-stats">
                    <div class="stat-item">
                        <span class="stat-icon">❤️</span>
                        <span>${post.like_count || 0} likes</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-icon">👁️</span>
                        <span>${post.view_count || 0} views</span>
                    </div>
                </div>
                <div class="modal-community-actions">
                    <button class="action-btn" onclick="communityManager.commentOnPost(${post.id})">Comment</button>
                    <button class="action-btn secondary" onclick="closeModal()">Close</button>
                </div>
            </div>
        `;
        
        // Add modal styles
        const modalStyles = `
            <style>
                .community-modal {
                    max-width: 800px;
                    max-height: 80vh;
                    overflow-y: auto;
                }
                .modal-community-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }
                .modal-community-title {
                    font-size: 2rem;
                    margin: 1rem 0;
                    color: var(--black);
                }
                .modal-community-content {
                    line-height: 1.8;
                    color: var(--black);
                    font-size: 1.1rem;
                    margin-bottom: 1.5rem;
                }
                .modal-community-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    margin-bottom: 1.5rem;
                }
                .modal-community-stats {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }
                .modal-community-actions {
                    display: flex;
                    gap: 1rem;
                    justify-content: flex-end;
                }
            </style>
        `;
        
        openModal(modalContent + modalStyles);
    }
    
    openCreatePostModal() {
        const modal = document.getElementById('createPostModal');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }
    
    closeCreatePostModal() {
        const modal = document.getElementById('createPostModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = 'auto';
            // Reset form
            const form = document.getElementById('createPostForm');
            if (form) {
                form.reset();
            }
        }
    }
    
    async handleSubmitPost() {
        const form = document.getElementById('createPostForm');
        if (!form) return;
        
        const formData = new FormData(form);
        const validation = LoveIsTough.validateForm(formData);
        
        if (!validation.isValid) {
            const errorMessage = Object.values(validation.errors)[0];
            LoveIsTough.showNotification(errorMessage, 'error');
            return;
        }
        
        const postData = {
            title: formData.get('title'),
            content: formData.get('content'),
            category: formData.get('category'),
            tags: formData.get('tags') ? formData.get('tags').split(',').map(tag => tag.trim()).filter(tag => tag) : []
        };
        
        try {
            showLoading();
            
            const response = await LoveIsTough.apiCall('', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${LoveIsTough.storage.get('token')}`
                },
                body: JSON.stringify({
                    action: 'create-community-post',
                    ...postData
                })
            });
            
            if (response.success) {
                LoveIsTough.showNotification('Your post has been created successfully!', 'success');
                this.closeCreatePostModal();
                // Reload posts to show the new one
                this.currentPage = 0;
                this.communityPosts = [];
                this.loadCommunityPosts();
            } else {
                throw new Error(response.error?.message || 'Failed to create post');
            }
        } catch (error) {
            console.error('Error creating post:', error);
            LoveIsTough.showNotification('Failed to create post. Please try again.', 'error');
        } finally {
            hideLoading();
        }
    }
    
    commentOnPost(postId) {
        // This would open a form to comment on a specific post
        LoveIsTough.showNotification('Comment feature coming soon!', 'info');
    }
    
    scrollToPosts() {
        const communitySection = document.querySelector('.community-section');
        if (communitySection) {
            communitySection.scrollIntoView({ behavior: 'smooth' });
        }
    }
    
    showLoading(show) {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            spinner.classList.toggle('visible', show);
        }
    }
    
    showEmptyState() {
        const grid = document.getElementById('communityGrid');
        if (!grid) return;
        
        grid.innerHTML = `
            <div class="empty-state">
                <h3>No Community Posts Found</h3>
                <p>We couldn't find any posts in this category. Be the first to create a post!</p>
                <button class="btn btn-primary" onclick="communityManager.openCreatePostModal()">Create Post</button>
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
    
    formatCommunityContent(content) {
        // Simple formatting - in a real app, you might use a markdown parser
        return content
            .split('\n\n')
            .map(paragraph => `<p>${paragraph}</p>`)
            .join('');
    }
}

// Global functions for modal
window.closeCreatePostModal = function() {
    if (window.communityManager) {
        communityManager.closeCreatePostModal();
    }
};

// Initialize community manager when DOM is loaded
let communityManager;
document.addEventListener('DOMContentLoaded', function() {
    communityManager = new CommunityManager();
}); 