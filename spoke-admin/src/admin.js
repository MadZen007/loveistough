// Admin Feature JavaScript
class AdminManager {
    constructor() {
        this.stats = null;
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadStats();
    }
    
    bindEvents() {
        // Database setup button
        const setupDbBtn = document.getElementById('setupDbBtn');
        if (setupDbBtn) {
            setupDbBtn.addEventListener('click', () => this.setupDatabase());
        }
        
        // User management button
        const manageUsersBtn = document.getElementById('manageUsersBtn');
        if (manageUsersBtn) {
            manageUsersBtn.addEventListener('click', () => this.manageUsers());
        }
        
        // Content management button
        const manageContentBtn = document.getElementById('manageContentBtn');
        if (manageContentBtn) {
            manageContentBtn.addEventListener('click', () => this.manageContent());
        }
    }
    
    async loadStats() {
        try {
            const response = await LoveIsTough.apiCall('', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'get-stats'
                })
            });
            
            if (response.success) {
                this.stats = response.data.stats;
                this.renderStats();
            } else {
                throw new Error(response.error?.message || 'Failed to load statistics');
            }
        } catch (error) {
            console.error('Error loading stats:', error);
            LoveIsTough.showNotification('Failed to load statistics. Please try again.', 'error');
            this.showStatsError();
        }
    }
    
    renderStats() {
        const statsGrid = document.getElementById('statsGrid');
        if (!statsGrid || !this.stats) return;
        
        statsGrid.innerHTML = `
            <div class="stat-item">
                <span class="stat-number">${this.stats.total_users || 0}</span>
                <span class="stat-label">Total Users</span>
            </div>
            <div class="stat-item">
                <span class="stat-number">${this.stats.published_articles || 0}</span>
                <span class="stat-label">Published Articles</span>
            </div>
            <div class="stat-item">
                <span class="stat-number">${this.stats.approved_advice || 0}</span>
                <span class="stat-label">Approved Advice</span>
            </div>
            <div class="stat-item">
                <span class="stat-number">${this.stats.community_posts || 0}</span>
                <span class="stat-label">Community Posts</span>
            </div>
            <div class="stat-item">
                <span class="stat-number">${this.stats.total_comments || 0}</span>
                <span class="stat-label">Total Comments</span>
            </div>
        `;
    }
    
    showStatsError() {
        const statsGrid = document.getElementById('statsGrid');
        if (!statsGrid) return;
        
        statsGrid.innerHTML = `
            <div class="stat-item">
                <span class="stat-number">--</span>
                <span class="stat-label">Stats Unavailable</span>
            </div>
        `;
    }
    
    async setupDatabase() {
        const setupDbBtn = document.getElementById('setupDbBtn');
        if (!setupDbBtn) return;
        
        // Disable button and show loading
        setupDbBtn.disabled = true;
        setupDbBtn.textContent = 'Setting up...';
        
        try {
            const response = await LoveIsTough.apiCall('', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'setup-database'
                })
            });
            
            if (response.success) {
                LoveIsTough.showNotification('Database setup completed successfully!', 'success');
                // Reload stats after setup
                this.loadStats();
            } else {
                throw new Error(response.error?.message || 'Database setup failed');
            }
        } catch (error) {
            console.error('Error setting up database:', error);
            LoveIsTough.showNotification('Database setup failed. Please try again.', 'error');
        } finally {
            // Re-enable button
            setupDbBtn.disabled = false;
            setupDbBtn.textContent = 'Setup Database';
        }
    }
    
    manageUsers() {
        // This would open a user management interface
        LoveIsTough.showNotification('User management feature coming soon!', 'info');
    }
    
    manageContent() {
        // This would open a content management interface
        LoveIsTough.showNotification('Content management feature coming soon!', 'info');
    }
}

// Initialize admin manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    new AdminManager();
}); 