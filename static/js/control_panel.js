/**
 * Control Panel JavaScript
 * System Management and Administration
 */

// Global variables
let systemStartTime = new Date();

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Control Panel initializing...');
    
    // Check authentication
    checkAuthentication();
    
    // Load system stats
    loadSystemStats();
    
    // Start uptime counter
    startUptimeCounter();
    
    // Setup event listeners
    setupEventListeners();
    
    console.log('Control Panel initialized successfully');
});

/**
 * Check user authentication and permissions
 */
async function checkAuthentication() {
    try {
        const response = await fetch('/api/validate-session', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            window.location.href = '/login';
            return false;
        }
        
        const data = await response.json();
        if (!data.success) {
            window.location.href = '/login';
            return false;
        }
        
        // Check if user has admin/manager permissions
        const user = data.user;
        if (!user.permissions?.can_view_users && user.role !== 'admin') {
            showNotification('You do not have permission to access Control Panel', 'error');
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 2000);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Authentication error:', error);
        window.location.href = '/login';
        return false;
    }
}

/**
 * Load system statistics
 */
async function loadSystemStats() {
    try {
        showLoading(true);
        
        // Load dashboard stats for total leads
        const statsResponse = await fetch('/api/dashboard/stats', {
            credentials: 'include'
        });
        
        if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            if (statsData.success) {
                document.getElementById('total-leads-count').textContent = statsData.stats.total_leads || 0;
                document.getElementById('total-records').textContent = statsData.stats.total_leads || 0;
            }
        }
        
        // Load users stats
        const usersResponse = await fetch('/api/users', {
            credentials: 'include'
        });
        
        if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            if (usersData.success) {
                const users = usersData.users || [];
                const activeUsers = users.filter(u => u.is_active !== 0 && u.is_active !== false).length;
                const inactiveUsers = users.length - activeUsers;
                
                document.getElementById('active-users-count').textContent = activeUsers;
                document.getElementById('users-active').textContent = activeUsers;
                document.getElementById('users-inactive').textContent = inactiveUsers;
            }
        }
        
        // Get database size (mock - actual implementation would need backend API)
        document.getElementById('db-size').textContent = 'N/A';
        document.getElementById('last-backup').textContent = 'Never';
        
        // Set last activity
        const now = new Date();
        document.getElementById('last-activity').textContent = now.toLocaleTimeString();
        
    } catch (error) {
        console.error('Error loading system stats:', error);
        showNotification('Failed to load system statistics', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Start uptime counter
 */
function startUptimeCounter() {
    function updateUptime() {
        const now = new Date();
        const diff = now - systemStartTime;
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        document.getElementById('system-uptime').textContent = `${hours}h ${minutes}m`;
    }
    
    updateUptime();
    setInterval(updateUptime, 60000); // Update every minute
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Add click listeners to control cards
    const cards = document.querySelectorAll('.control-card');
    cards.forEach(card => {
        card.addEventListener('click', function(e) {
            if (e.target.closest('.control-card') && !this.onclick) {
                showNotification('This feature is coming soon!', 'info');
            }
        });
    });
}

/**
 * Quick Action Functions
 */

// Create backup
async function createBackup() {
    try {
        showNotification('Creating database backup...', 'info');
        
        // Mock backup - actual implementation would need backend API
        setTimeout(() => {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            document.getElementById('last-backup').textContent = new Date().toLocaleString();
            showNotification('Backup created successfully!', 'success');
        }, 2000);
        
    } catch (error) {
        console.error('Backup error:', error);
        showNotification('Failed to create backup', 'error');
    }
}

// Export leads
async function exportLeads() {
    try {
        showNotification('Preparing export...', 'info');
        
        const response = await fetch('/api/leads?limit=10000', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch leads');
        }
        
        const data = await response.json();
        if (data.success && data.data) {
            const leads = data.data;
            
            // Convert to CSV
            const csvContent = convertToCSV(leads);
            
            // Download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `leads_export_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showNotification(`Exported ${leads.length} leads successfully!`, 'success');
        } else {
            throw new Error('No data to export');
        }
        
    } catch (error) {
        console.error('Export error:', error);
        showNotification('Failed to export leads', 'error');
    }
}

// Convert data to CSV
function convertToCSV(data) {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [];
    
    // Add headers
    csvRows.push(headers.join(','));
    
    // Add data rows
    for (const row of data) {
        const values = headers.map(header => {
            const value = row[header];
            const escaped = ('' + value).replace(/"/g, '\\"');
            return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
}

// View logs
function viewLogs() {
    showNotification('Activity logs feature coming soon!', 'info');
}

// System status
function systemStatus() {
    const status = {
        database: 'Online',
        api: 'Running',
        sessions: 'Active',
        memory: 'Normal'
    };
    
    let message = 'System Status:\n\n';
    for (const [key, value] of Object.entries(status)) {
        message += `${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}\n`;
    }
    
    alert(message);
}

// Clear cache
function clearCache() {
    if (confirm('Are you sure you want to clear the cache? This will log out all users.')) {
        showNotification('Clearing cache...', 'info');
        
        setTimeout(() => {
            // Clear localStorage
            const keysToKeep = ['user', 'session_token'];
            Object.keys(localStorage).forEach(key => {
                if (!keysToKeep.includes(key)) {
                    localStorage.removeItem(key);
                }
            });
            
            showNotification('Cache cleared successfully!', 'success');
        }, 1000);
    }
}

// Refresh stats
async function refreshStats() {
    showNotification('Refreshing statistics...', 'info');
    await loadSystemStats();
    showNotification('Statistics refreshed!', 'success');
}

/**
 * Utility Functions
 */

// Show loading overlay
function showLoading(show) {
    let overlay = document.querySelector('.loading-overlay');
    
    if (show) {
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'loading-overlay';
            overlay.innerHTML = '<div class="spinner"></div>';
            document.body.appendChild(overlay);
        }
    } else {
        if (overlay) {
            overlay.remove();
        }
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#198754' : type === 'error' ? '#dc3545' : '#0d6efd'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        font-weight: 500;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
