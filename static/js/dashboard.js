// Dashboard JavaScript - Only Real Data from Database

document.addEventListener('DOMContentLoaded', async function() {
    // Load Lead Settings from database first
    if (window.LeadSettingsManager) {
        await LeadSettingsManager.loadSettings();
    }
    
    initializeDashboard();
    loadDashboardData();
    setCurrentDate();
});

// Initialize dashboard
function initializeDashboard() {
    // Add active state to current page
    const currentPath = window.location.pathname;
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        const link = item.querySelector('a');
        if (link.getAttribute('href') === currentPath) {
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        }
    });
}

// Set current date
function setCurrentDate() {
    const now = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    const dateString = now.toLocaleDateString('en-US', options);
    document.getElementById('current-date').textContent = dateString;
}

// Load dashboard data from API
async function loadDashboardData() {
    try {
        // Show loading state
        showLoading(true);
        
        const response = await fetch('/api/dashboard/stats');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            updateStats(data.stats);
            updateRecentLeads(data.stats.recent_leads);
            setupCharts(data.stats);
        } else {
            throw new Error(data.detail || 'Failed to load dashboard data');
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showNotification('Failed to load dashboard data', 'error');
        // Show empty states
        updateStats({ total_leads: 0, leads_by_status: [], recent_leads: [] });
    } finally {
        showLoading(false);
    }
}

// Update statistics cards with real data
function updateStats(stats) {
    // Update total leads
    document.getElementById('total-leads').textContent = stats.total_leads || 0;
    
    // Calculate converted leads (from status)
    let convertedCount = 0;
    let pendingCount = 0;
    
    if (stats.leads_by_status && stats.leads_by_status.length > 0) {
        stats.leads_by_status.forEach(status => {
            if (status.lead_status === 'Converted') {
                convertedCount = status.count;
            } else if (status.lead_status === 'Pending' || status.lead_status === 'New') {
                pendingCount += status.count;
            }
        });
    }
    
    document.getElementById('converted-leads').textContent = convertedCount;
    document.getElementById('pending-leads').textContent = pendingCount;
    
    // Hide trend indicators since we don't have comparison data
    document.querySelectorAll('.stat-trend').forEach(trend => {
        trend.style.display = 'none';
    });
    
    // Update upcoming follow-ups count
    const upcomingCount = stats.upcoming_followups || 0;
    document.querySelector('.upcoming-count').textContent = upcomingCount;
}

// Update recent leads list with real data
function updateRecentLeads(leads) {
    const leadsList = document.getElementById('recent-leads-list');
    
    if (!leads || leads.length === 0) {
        leadsList.innerHTML = `
            <div class="no-leads">
                <i class="fas fa-inbox"></i>
                <p>No recent leads found</p>
            </div>
        `;
        return;
    }
    
    leadsList.innerHTML = leads.map(lead => `
        <div class="lead-item">
            <div class="lead-info">
                <h4>${escapeHtml(lead.customer_name || 'N/A')}</h4>
                <p class="lead-company">${escapeHtml(lead.company_name || 'No Company')}</p>
            </div>
            <div class="lead-meta">
                <span class="lead-status status-${getStatusClass(lead.lead_status)}">
                    ${escapeHtml(lead.lead_status || 'New')}
                </span>
                <p class="lead-date">${formatDate(lead.updated_at || lead.created_at)}</p>
            </div>
        </div>
    `).join('');
}

// Setup charts with real data
function setupCharts(stats) {
    if (stats.leads_by_status && stats.leads_by_status.length > 0) {
        setupLeadStatusChart(stats.leads_by_status);
    } else {
        // Show empty chart state
        setupEmptyLeadStatusChart();
    }
    
    // We don't have conversion/performance data in current API
    // These charts will be empty or show "no data" message
    setupEmptyConversionChart();
    setupEmptyPerformanceChart();
}

// Lead Status Chart (Pie/Donut) with real data
let leadStatusChart = null;
function setupLeadStatusChart(statusData) {
    const ctx = document.getElementById('leadStatusChart').getContext('2d');
    
    if (leadStatusChart) {
        leadStatusChart.destroy();
    }
    
    const labels = statusData.map(item => item.lead_status);
    const counts = statusData.map(item => item.count);
    const colors = ['#667eea', '#4CAF50', '#FF9800', '#9C27B0', '#f44336', '#00bcd4', '#8bc34a'];
    
    leadStatusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: colors.slice(0, labels.length),
                borderColor: 'white',
                borderWidth: 2,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '65%'
        }
    });
}

// Empty Lead Status Chart
function setupEmptyLeadStatusChart() {
    const ctx = document.getElementById('leadStatusChart').getContext('2d');
    
    if (leadStatusChart) {
        leadStatusChart.destroy();
    }
    
    leadStatusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['No Data'],
            datasets: [{
                data: [1],
                backgroundColor: ['#e0e6ff'],
                borderColor: 'white',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: false
                }
            },
            cutout: '65%'
        }
    });
    
    // Add "No Data" text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#999';
    ctx.font = '14px Poppins';
    ctx.fillText('No lead data available', ctx.canvas.width / 2, ctx.canvas.height / 2);
}

// Empty Conversion Chart
function setupEmptyConversionChart() {
    const container = document.getElementById('conversionChart');
    container.innerHTML = `
        <div class="no-chart-data">
            <i class="fas fa-chart-line"></i>
            <p>Conversion data will appear here</p>
            <small>As more leads are tracked and converted</small>
        </div>
    `;
}

// Empty Performance Chart
function setupEmptyPerformanceChart() {
    const container = document.getElementById('performanceChart');
    container.innerHTML = `
        <div class="no-chart-data">
            <i class="fas fa-chart-bar"></i>
            <p>Performance data will appear here</p>
            <small>As monthly lead data accumulates</small>
        </div>
    `;
}

// Get status class for styling
function getStatusClass(status) {
    if (!status) return 'new';
    
    const statusMap = {
        'New': 'new',
        'new': 'new',
        'Contacted': 'contact',
        'contacted': 'contact',
        'Proposal Sent': 'proposal',
        'proposal_sent': 'proposal',
        'Proposal': 'proposal',
        'Converted': 'converted',
        'converted': 'converted',
        'Closed': 'converted',
        'Lost': 'lost',
        'lost': 'lost',
        'Pending': 'contact',
        'pending': 'contact'
    };
    return statusMap[status] || 'new';
}

// Format date safely
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return 'Invalid date';
        }
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    } catch (error) {
        return 'N/A';
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    
    return text.toString().replace(/[&<>"']/g, function(m) { 
        return map[m]; 
    });
}

// Toggle sidebar for mobile
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('active');
}

// Logout function
async function logout() {
    try {
        // Clear permissions
        if (window.PermissionManager) {
            window.PermissionManager.clear();
        }
        
        const response = await fetch('/api/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            window.location.href = '/login';
        } else {
            throw new Error(data.detail || 'Logout failed');
        }
    } catch (error) {
        console.error('Logout error:', error);
        showNotification('Logout failed. Please try again.', 'error');
    }
}

// Load stats based on period
async function loadStats() {
    const period = document.getElementById('status-period').value;
    try {
        showLoading(true);
        // Here you would call an API endpoint with period parameter
        // For now, reload the dashboard data
        await loadDashboardData();
        showNotification('Stats updated', 'success');
    } catch (error) {
        showNotification('Failed to update stats', 'error');
    } finally {
        showLoading(false);
    }
}

// Load conversion chart data (placeholder for future implementation)
async function loadConversionChart() {
    const period = document.getElementById('conversion-period').value;
    showNotification('Conversion chart data is not yet available', 'info');
}

// Export chart data (placeholder for future implementation)
function exportChart() {
    showNotification('Export feature is not yet implemented', 'info');
}

// Refresh all charts
function refreshCharts() {
    loadDashboardData();
}

// Generate report (placeholder for future implementation)
function generateReport() {
    showNotification('Report generation is not yet implemented', 'info');
}

// Open calendar (placeholder for future implementation)
function openCalendar() {
    showNotification('Calendar feature is not yet implemented', 'info');
}

// Show loading state
function showLoading(isLoading) {
    const loadingElement = document.getElementById('loading-overlay') || createLoadingOverlay();
    
    if (isLoading) {
        loadingElement.style.display = 'flex';
    } else {
        loadingElement.style.display = 'none';
    }
}

// Create loading overlay if it doesn't exist
function createLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
        <div class="loading-spinner-large">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Loading dashboard data...</p>
        </div>
    `;
    overlay.style.display = 'none';
    document.body.appendChild(overlay);
    
    // Add styles
    const styles = document.createElement('style');
    styles.textContent = `
    .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    }
    
    .loading-spinner-large {
        text-align: center;
        padding: 30px;
        background: white;
        border-radius: 15px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    }
    
    .loading-spinner-large i {
        font-size: 3rem;
        color: #667eea;
        margin-bottom: 15px;
    }
    
    .loading-spinner-large p {
        color: #666;
        font-size: 1rem;
        margin: 0;
    }
    
    .no-chart-data {
        text-align: center;
        padding: 60px 20px;
        color: #999;
    }
    
    .no-chart-data i {
        font-size: 3rem;
        margin-bottom: 15px;
        color: #e0e6ff;
    }
    
    .no-chart-data p {
        font-size: 1rem;
        margin-bottom: 5px;
    }
    
    .no-chart-data small {
        font-size: 0.85rem;
    }
    
    .no-leads {
        text-align: center;
        padding: 40px 20px;
        color: #999;
    }
    
    .no-leads i {
        font-size: 2rem;
        margin-bottom: 10px;
        color: #e0e6ff;
    }
    `;
    document.head.appendChild(styles);
    
    return overlay;
}

// Show notification
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotification = document.querySelector('.notification-toast');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification-toast notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${escapeHtml(message)}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }
    }, 5000);
}

// Get notification icon based on type
function getNotificationIcon(type) {
    const icons = {
        'success': 'check-circle',
        'error': 'exclamation-circle',
        'warning': 'exclamation-triangle',
        'info': 'info-circle'
    };
    return icons[type] || 'info-circle';
}

// Add notification styles if not already present
if (!document.querySelector('#notification-styles')) {
    const notificationStyles = document.createElement('style');
    notificationStyles.id = 'notification-styles';
    notificationStyles.textContent = `
    .notification-toast {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border-radius: 10px;
        padding: 15px 20px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 15px;
        min-width: 300px;
        max-width: 400px;
        transform: translateX(400px);
        transition: transform 0.3s ease;
        z-index: 10000;
    }
    
    .notification-toast.show {
        transform: translateX(0);
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
    }
    
    .notification-success {
        border-left: 4px solid #4CAF50;
    }
    
    .notification-error {
        border-left: 4px solid #f44336;
    }
    
    .notification-warning {
        border-left: 4px solid #FF9800;
    }
    
    .notification-info {
        border-left: 4px solid #2196F3;
    }
    
    .notification-content i {
        font-size: 1.2rem;
    }
    
    .notification-success .notification-content i { color: #4CAF50; }
    .notification-error .notification-content i { color: #f44336; }
    .notification-warning .notification-content i { color: #FF9800; }
    .notification-info .notification-content i { color: #2196F3; }
    
    .notification-close {
        background: none;
        border: none;
        color: #999;
        cursor: pointer;
        padding: 5px;
        font-size: 0.9rem;
        transition: color 0.3s ease;
    }
    
    .notification-close:hover {
        color: #666;
    }
    `;
    document.head.appendChild(notificationStyles);
}

// Update API endpoint to get upcoming follow-ups
// Add this to your main.py in the /api/dashboard/stats endpoint:

// In the get_dashboard_stats function, add this calculation:
// upcoming_followups_query = f'''
// SELECT COUNT(*) as count 
// FROM leads 
// WHERE next_follow_up_date >= DATE('now') 
// AND next_follow_up_date <= DATE('now', '+7 days')
// {where_clause}
// '''
// cursor.execute(upcoming_followups_query, params)
// upcoming_result = cursor.fetchone()
// upcoming_followups = upcoming_result['count'] if upcoming_result else 0

// Then include it in the return:
// return {
//     "success": True,
//     "stats": {
//         "total_leads": total_leads,
//         "upcoming_followups": upcoming_followups,
//         "leads_by_status": [dict(s) for s in leads_by_status] if leads_by_status else [],
//         "recent_leads": [dict(l) for l in recent_leads] if recent_leads else []
//     }
// }