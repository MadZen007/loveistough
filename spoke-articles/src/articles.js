// Articles Feature JavaScript
class ArticlesManager {
    constructor() {
        this.currentPage = 0;
        this.currentCategory = 'all';
        this.articles = [];
        this.featuredArticle = null;
        this.isLoading = false;
        this.hasMoreArticles = true;
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadArticles();
        this.loadFeaturedArticle();
    }
    
    bindEvents() {
        // Category filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleCategoryFilter(e.target.dataset.category);
            });
        });
        
        // Load more button
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                this.loadMoreArticles();
            });
        }
    }
    
    async loadArticles() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading(true);
        
        try {
            const response = await LoveIsTough.apiCall('', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'get-articles',
                    category: this.currentCategory === 'all' ? null : this.currentCategory,
                    limit: 6,
                    offset: this.currentPage * 6
                })
            });
            
            if (response.success) {
                const newArticles = response.data.articles || [];
                this.articles = this.currentPage === 0 ? newArticles : [...this.articles, ...newArticles];
                this.hasMoreArticles = newArticles.length === 6;
                this.renderArticles();
            } else {
                throw new Error(response.error?.message || 'Failed to load articles');
            }
        } catch (error) {
            console.error('Error loading articles:', error);
            LoveIsTough.showNotification('Failed to load articles. Please try again.', 'error');
            this.showEmptyState();
        } finally {
            this.isLoading = false;
            this.showLoading(false);
        }
    }
    
    async loadFeaturedArticle() {
        try {
            const response = await LoveIsTough.apiCall('', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'get-articles',
                    limit: 1,
                    offset: 0
                })
            });
            
            if (response.success && response.data.articles.length > 0) {
                this.featuredArticle = response.data.articles[0];
                this.renderFeaturedArticle();
            }
        } catch (error) {
            console.error('Error loading featured article:', error);
        }
    }
    
    async loadMoreArticles() {
        this.currentPage++;
        await this.loadArticles();
    }
    
    handleCategoryFilter(category) {
        // Update active filter button
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-category="${category}"]`).classList.add('active');
        
        // Reset and reload articles
        this.currentCategory = category;
        this.currentPage = 0;
        this.articles = [];
        this.hasMoreArticles = true;
        this.loadArticles();
    }
    
    renderArticles() {
        const grid = document.getElementById('articlesGrid');
        if (!grid) return;
        
        if (this.articles.length === 0) {
            this.showEmptyState();
            return;
        }
        
        // Clear existing content
        grid.innerHTML = '';
        
        // Render articles
        this.articles.forEach(article => {
            const articleCard = this.createArticleCard(article);
            grid.appendChild(articleCard);
        });
        
        // Show/hide load more button
        const loadMoreContainer = document.querySelector('.load-more-container');
        if (loadMoreContainer) {
            loadMoreContainer.style.display = this.hasMoreArticles ? 'block' : 'none';
        }
    }
    
    createArticleCard(article) {
        const card = document.createElement('article');
        card.className = 'article-card fade-in';
        
        const imageUrl = article.featured_image || this.getDefaultImage(article.category);
        const excerpt = this.truncateText(article.content, 150);
        const date = new Date(article.created_at).toLocaleDateString();
        
        card.innerHTML = `
            <img src="${imageUrl}" alt="${article.title}" class="article-image">
            <div class="article-content">
                <span class="article-category">${article.category}</span>
                <h3 class="article-title">${article.title}</h3>
                <p class="article-excerpt">${excerpt}</p>
                <div class="article-meta">
                    <span class="article-author">By ${article.author_name || 'Anonymous'}</span>
                    <span class="article-date">${date}</span>
                </div>
                <a href="#" class="read-more-btn" data-article-id="${article.id}">Read More</a>
            </div>
        `;
        
        // Add click handler for read more
        const readMoreBtn = card.querySelector('.read-more-btn');
        readMoreBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.openArticleModal(article);
        });
        
        return card;
    }
    
    renderFeaturedArticle() {
        const container = document.getElementById('featuredArticle');
        if (!container || !this.featuredArticle) return;
        
        const article = this.featuredArticle;
        const imageUrl = article.featured_image || this.getDefaultImage(article.category);
        const excerpt = this.truncateText(article.content, 200);
        const date = new Date(article.created_at).toLocaleDateString();
        
        container.innerHTML = `
            <div class="featured-article-content">
                <img src="${imageUrl}" alt="${article.title}" class="featured-article-image">
                <div class="featured-article-text">
                    <span class="featured-article-category">${article.category}</span>
                    <h3 class="featured-article-title">${article.title}</h3>
                    <p class="featured-article-excerpt">${excerpt}</p>
                    <div class="featured-article-meta">
                        <span class="article-author">By ${article.author_name || 'Anonymous'}</span>
                        <span class="article-date">${date}</span>
                    </div>
                    <a href="#" class="featured-read-more" data-article-id="${article.id}">Read Full Article</a>
                </div>
            </div>
        `;
        
        // Add click handler for featured article
        const readMoreBtn = container.querySelector('.featured-read-more');
        readMoreBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.openArticleModal(article);
        });
    }
    
    openArticleModal(article) {
        const imageUrl = article.featured_image || this.getDefaultImage(article.category);
        const date = new Date(article.created_at).toLocaleDateString();
        
        const modalContent = `
            <div class="article-modal">
                <img src="${imageUrl}" alt="${article.title}" class="modal-article-image">
                <div class="modal-article-content">
                    <span class="article-category">${article.category}</span>
                    <h2 class="modal-article-title">${article.title}</h2>
                    <div class="modal-article-meta">
                        <span class="article-author">By ${article.author_name || 'Anonymous'}</span>
                        <span class="article-date">${date}</span>
                    </div>
                    <div class="modal-article-body">
                        ${this.formatArticleContent(article.content)}
                    </div>
                </div>
            </div>
        `;
        
        // Add modal styles
        const modalStyles = `
            <style>
                .article-modal {
                    max-width: 800px;
                    max-height: 80vh;
                    overflow-y: auto;
                }
                .modal-article-image {
                    width: 100%;
                    height: 300px;
                    object-fit: cover;
                    border-radius: 10px;
                    margin-bottom: 1rem;
                }
                .modal-article-content {
                    padding: 1rem 0;
                }
                .modal-article-title {
                    font-size: 2rem;
                    margin: 1rem 0;
                    color: var(--black);
                }
                .modal-article-meta {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 1rem;
                    color: var(--slate-gray);
                    font-size: 0.9rem;
                }
                .modal-article-body {
                    line-height: 1.8;
                    color: var(--black);
                    font-size: 1.1rem;
                }
                .modal-article-body p {
                    margin-bottom: 1rem;
                }
                .modal-article-body h3 {
                    margin: 1.5rem 0 1rem 0;
                    color: var(--slate-gray);
                }
            </style>
        `;
        
        openModal(modalContent + modalStyles);
    }
    
    showLoading(show) {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            spinner.classList.toggle('visible', show);
        }
    }
    
    showEmptyState() {
        const grid = document.getElementById('articlesGrid');
        if (!grid) return;
        
        grid.innerHTML = `
            <div class="empty-state">
                <h3>No Articles Found</h3>
                <p>We couldn't find any articles in this category. Check back soon for new content!</p>
            </div>
        `;
        
        // Hide load more button
        const loadMoreContainer = document.querySelector('.load-more-container');
        if (loadMoreContainer) {
            loadMoreContainer.style.display = 'none';
        }
    }
    
    getDefaultImage(category) {
        const defaultImages = {
            communication: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            trust: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            conflict: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            intimacy: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
        };
        
        return defaultImages[category] || defaultImages.communication;
    }
    
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength).trim() + '...';
    }
    
    formatArticleContent(content) {
        // Simple formatting - in a real app, you might use a markdown parser
        return content
            .split('\n\n')
            .map(paragraph => `<p>${paragraph}</p>`)
            .join('');
    }
}

// Initialize articles manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    new ArticlesManager();
}); 