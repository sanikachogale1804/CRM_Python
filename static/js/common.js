// Track input, select, textarea changes
document.addEventListener('change', function(e) {
    const target = e.target;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) {
        let value = target.value;
        let type = target.type || '';
        let checked = undefined;
        if (type === 'checkbox' || type === 'radio') {
            checked = target.checked;
        }
        logUserActivity('field_change', {
            tag: target.tagName,
            id: target.id,
            class: target.className,
            name: target.name,
            type,
            value,
            checked
        });
    }
}, true);

// Track table cell edits (contenteditable)
document.addEventListener('input', function(e) {
    const target = e.target;
    if (target.isContentEditable) {
        logUserActivity('table_edit', {
            tag: target.tagName,
            id: target.id,
            class: target.className,
            value: target.innerText
        });
    }
}, true);

// Track modal open/close
document.addEventListener('click', function(e) {
    const target = e.target;
    if (target.classList && (target.classList.contains('sa-details-btn') || target.classList.contains('sa-modal-close'))) {
        logUserActivity('modal_toggle', {
            action: target.classList.contains('sa-modal-close') ? 'close' : 'open',
            modal: target.closest('.sa-modal') ? target.closest('.sa-modal').id : undefined
        });
    }
}, true);
// ==================== USER ACTIVITY TRACKING ====================
/**
 * Send user activity log to backend
 * @param {string} action - Action type (e.g., 'page_visit', 'click', 'form_submit')
 * @param {object} details - Additional details about the event
 */
function logUserActivity(action, details = {}) {
    try {
        let resource = '-';
        let description = '';
        if (action === 'page_visit') {
            resource = window.location.pathname;
            description = `Visited page: ${document.title} (${window.location.pathname})`;
        } else if (action === 'click') {
            resource = details.tag + (details.id ? `#${details.id}` : '') + (details.class ? `.${details.class}` : '');
            description = `Clicked on ${details.tag}${details.id ? `#${details.id}` : ''}${details.class ? `.${details.class}` : ''}${details.text ? ` [${details.text}]` : ''}`;
        } else if (action === 'form_submit') {
            resource = details.id || details.action || window.location.pathname;
            description = `Submitted form${details.id ? `#${details.id}` : ''} (${details.action || window.location.pathname})`;
        } else if (action === 'field_change') {
            resource = details.name || details.id || details.class || '-';
            description = `Changed field ${resource} to value: ${details.value}`;
        } else if (action === 'table_edit') {
            resource = details.id || details.class || '-';
            description = `Edited table cell: ${resource}, new value: ${details.value}`;
        } else if (action === 'modal_toggle') {
            resource = details.modal || '-';
            description = `Modal ${details.action}: ${resource}`;
        } else {
            resource = details.id || details.name || details.tag || window.location.pathname;
            description = `${action} event on ${resource}`;
        }
        fetch('/api/audit-log', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action,
                details,
                resource,
                description,
                path: window.location.pathname,
                timestamp: new Date().toISOString(),
            })
        });
    } catch (e) {
        // Ignore logging errors
    }
}

// Track page visits
document.addEventListener('DOMContentLoaded', function() {
    logUserActivity('page_visit', {
        title: document.title,
        referrer: document.referrer
    });
});

// Track all button clicks
document.addEventListener('click', function(e) {
    let target = e.target;
    // Find closest button or link
    while (target && !(target.tagName === 'BUTTON' || target.tagName === 'A')) {
        target = target.parentElement;
    }
    if (target) {
        logUserActivity('click', {
            tag: target.tagName,
            text: (target.innerText || '').trim().slice(0, 100),
            id: target.id,
            class: target.className,
            href: target.href || undefined
        });
    }
}, true);

// Track all form submissions
document.addEventListener('submit', function(e) {
    const form = e.target;
    logUserActivity('form_submit', {
        id: form.id,
        class: form.className,
        action: form.action,
        method: form.method
    });
}, true);
/**
 * Common Utilities for Lead Management System
 * Shared functions across all pages
 */

// ==================== PERMISSION MANAGER ====================
const PermissionManager = {
    permissions: [],
    isAdmin: false,
    initialized: false,
    
    /**
     * Initialize permission manager from session storage
     */
    init() {
        if (this.initialized) return;
        
        try {
            // Try to get permissions from sessionStorage
            const rawData = sessionStorage.getItem('userPermissions');
            console.log('📦 Raw sessionStorage.userPermissions:', rawData);
            
            const data = JSON.parse(rawData || '{}');
            this.permissions = data.permission_keys || [];
            this.isAdmin = data.is_admin || false;
            
            // Fallback: check localStorage for user role
            if (!this.isAdmin && localStorage.getItem('user')) {
                try {
                    const user = JSON.parse(localStorage.getItem('user'));
                    if (user.role === 'admin') {
                        this.isAdmin = true;
                        console.log('✅ Admin status inferred from localStorage');
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            }
            
            this.initialized = true;
            console.log('✅ PermissionManager initialized:', {
                totalPermissions: this.permissions.length,
                isAdmin: this.isAdmin,
                firstPermissions: this.permissions.slice(0, 5)
            });
        } catch (error) {
            console.error('Failed to initialize PermissionManager:', error);
            this.permissions = [];
            this.isAdmin = false;
        }
    },
    
    /**
     * Check if user has exact permission
     */
    has(permissionKey) {
        if (!permissionKey) return true; // No permission required
        
        // If admin flag is explicitly set or inferred, grant all permissions
        if (this.isAdmin) {
            console.log(`✅ Admin user - granting permission: ${permissionKey}`);
            return true;
        }
        
        return this.permissions.includes(permissionKey);
    },
    
    /**
     * Check if user has permission or any parent permission
     * Example: "leads.action.add" -> checks "leads.action.add", "leads.action", "leads"
     */
    hasAny(permissionKey) {
        if (!permissionKey) return true;
        if (this.isAdmin) return true;
        
        const parts = permissionKey.split('.');
        for (let i = parts.length; i > 0; i--) {
            const check = parts.slice(0, i).join('.');
            if (this.permissions.includes(check)) return true;
        }
        return false;
    },
    
    /**
     * Check multiple permissions (OR logic)
     */
    hasAnyOf(permissionKeys) {
        if (this.isAdmin) return true;
        if (!Array.isArray(permissionKeys)) return false;
        return permissionKeys.some(key => this.has(key));
    },
    
    /**
     * Check multiple permissions (AND logic)
     */
    hasAllOf(permissionKeys) {
        if (this.isAdmin) return true;
        if (!Array.isArray(permissionKeys)) return false;
        return permissionKeys.every(key => this.has(key));
    },
    
    /**
     * Apply UI guards to page elements
     */
    applyGuards() {
        if (!this.initialized) this.init();
        
        console.log('🔐 Applying permission guards...', {
            initialized: this.initialized,
            isAdmin: this.isAdmin,
            totalPermissions: this.permissions.length
        });
        
        // ⚠️ ADMIN BYPASS: Skip all permission checks for admin users
        if (this.isAdmin) {
            console.log('✅ Admin user detected - skipping all permission guards');
            return;
        }
        
        let hiddenCount = 0;
        let disabledCount = 0;
        
        // Page-level permission check
        const pagePermission = document.body.dataset.permission;
        console.log('📄 Page-level permission check:', pagePermission);
        if (pagePermission && !this.has(pagePermission)) {
            document.body.innerHTML = `
                <div style="display: flex; justify-content: center; align-items: center; height: 100vh; flex-direction: column;">
                    <h1 style="color: #e74c3c;">⛔ Access Denied</h1>
                    <p>You don't have permission to access this page.</p>
                    <button onclick="history.back()" style="padding: 10px 20px; margin-top: 20px; cursor: pointer;">Go Back</button>
                </div>
            `;
            return;
        }
        
        // Element-level permissions
        document.querySelectorAll('[data-permission]').forEach(el => {
            const perm = el.dataset.permission;
            const hasPermission = this.has(perm);
            if (!hasPermission) {
                console.log(`❌ Missing permission: ${perm}`);
                const action = el.dataset.permissionAction;
                
                if (action === 'disable') {
                    // Disable but keep visible
                    el.disabled = true;
                    el.style.opacity = '0.5';
                    el.style.cursor = 'not-allowed';
                    el.title = 'No permission';
                    disabledCount++;
                } else {
                    // Completely hide element
                    el.remove();
                    hiddenCount++;
                }
            }
        });
        
        // Field-level permissions (view + edit)
        document.querySelectorAll('[data-field-permission]').forEach(field => {
            const viewPerm = field.dataset.fieldPermissionView;
            const editPerm = field.dataset.fieldPermissionEdit;
            
            if (viewPerm && !this.has(viewPerm)) {
                // Can't view - remove entire form group
                const formGroup = field.closest('.form-group') || field.closest('tr') || field.parentElement;
                formGroup?.remove();
                hiddenCount++;
            } else if (editPerm && !this.has(editPerm)) {
                // Can view but can't edit - make read-only
                field.disabled = true;
                field.readOnly = true;
                field.style.opacity = '0.7';
                field.style.cursor = 'not-allowed';
                disabledCount++;
            }
        });
        
        console.log(`🔐 Permission guards applied: ${hiddenCount} hidden, ${disabledCount} disabled`);
    },
    
    /**
     * Store permissions after login
     */
    store(permissionKeys, isAdmin = false) {
        this.permissions = permissionKeys || [];
        this.isAdmin = isAdmin;
        this.initialized = true;
        
        sessionStorage.setItem('userPermissions', JSON.stringify({
            permission_keys: this.permissions,
            is_admin: this.isAdmin
        }));
    },
    
    /**
     * Clear permissions on logout
     */
    clear() {
        this.permissions = [];
        this.isAdmin = false;
        this.initialized = false;
        sessionStorage.removeItem('userPermissions');
    }
};

// Make globally available
window.PermissionManager = PermissionManager;
console.log('✅ PermissionManager loaded and available on window object');

// Lightweight fallbacks so shared pages do not break if dedicated implementations are missing
if (typeof window.ApiService === 'undefined') {
    class ApiService {
        constructor(baseUrl = '') {
            this.baseUrl = baseUrl;
        }

        async request(path, options = {}) {
            const { method = 'GET', headers = {}, body } = options;
            const init = {
                method,
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                }
            };

            if (body !== undefined) {
                init.body = typeof body === 'string' ? body : JSON.stringify(body);
            }

            const response = await fetch(`${this.baseUrl}${path}`, init);
            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (error) {
                return { success: response.ok, data: text, error: error?.message };
            }
        }
    }

    window.ApiService = ApiService;
}

// Simple localStorage wrapper (avoids native StorageManager constructor errors)
if (typeof window.StorageManager === 'undefined' || window.StorageManager?.name === 'StorageManager') {
    class LocalStorageManager {
        get(key) {
            const value = localStorage.getItem(key);
            try {
                return value ? JSON.parse(value) : null;
            } catch (error) {
                return value;
            }
        }

        set(key, value) {
            localStorage.setItem(key, JSON.stringify(value));
        }

        remove(key) {
            localStorage.removeItem(key);
        }
    }

    window.StorageManager = LocalStorageManager;
}

// Lead Settings Utilities
const LeadSettingsManager = {
    settingsCache: {},
    cacheLoaded: false,
    
    /**
     * Load settings from database or localStorage
     */
    loadSettings: async function() {
        if (this.cacheLoaded) {
            return this.settingsCache;
        }
        
        try {
            // Try to load from database
            const response = await fetch('/api/settings/lead-settings', {
                credentials: 'include',
                method: 'GET'
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.settings) {
                    this.settingsCache = data.settings;
                    // Also update localStorage for offline access
                    for (const [key, value] of Object.entries(data.settings)) {
                        localStorage.setItem(`lead_settings_${key}`, JSON.stringify(value));
                    }
                    this.cacheLoaded = true;
                    return data.settings;
                }
            }
        } catch (error) {
            console.warn('Failed to load from database, using localStorage', error);
        }
        
        // Fallback to localStorage
        this.cacheLoaded = true;
        return this.settingsCache;
    },
    
    /**
     * Get lead settings from cache
     */
    getSettings: function(type) {
        const data = this.settingsCache[type] || localStorage.getItem(`lead_settings_${type}`);
        return data ? (typeof data === 'string' ? JSON.parse(data) : data) : [];
    },
    
    /**
     * Get active items only
     */
    getActiveSettings: function(type) {
        return this.getSettings(type).filter(item => item.active);
    },
    
    /**
     * Populate dropdown with settings
     */
    populateDropdown: function(selectElement, type, options = {}) {
        if (!selectElement) return;
        
        const items = this.getActiveSettings(type);
        const currentValue = selectElement.value;
        
        // Clear existing options except placeholder
        selectElement.innerHTML = '';
        
        // Add placeholder
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = options.placeholder || `Select ${type}`;
        selectElement.appendChild(placeholder);
        
        // Add items
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item.name;
            option.textContent = item.name;
            if (options.showColor && item.color) {
                option.style.color = item.color;
            }
            selectElement.appendChild(option);
        });
        
        // Restore previous value if it exists
        if (currentValue && items.find(i => i.name === currentValue)) {
            selectElement.value = currentValue;
        }
    },
    
    /**
     * Initialize all dropdowns on a page
     */
    initializeAllDropdowns: function() {
        // Lead Sources
        const sourceSelects = document.querySelectorAll('[data-setting="sources"]');
        sourceSelects.forEach(select => {
            this.populateDropdown(select, 'sources', { placeholder: 'Select Source' });
        });
        
        // Lead Statuses
        const statusSelects = document.querySelectorAll('[data-setting="statuses"]');
        statusSelects.forEach(select => {
            this.populateDropdown(select, 'statuses', { placeholder: 'Select Status' });
        });
        
        // Sales Types
        const typeSelects = document.querySelectorAll('[data-setting="types"]');
        typeSelects.forEach(select => {
            this.populateDropdown(select, 'types', { placeholder: 'Select Sales Type' });
        });
        
        // Industries
        const industrySelects = document.querySelectorAll('[data-setting="industries"]');
        industrySelects.forEach(select => {
            this.populateDropdown(select, 'industries', { placeholder: 'Select Industry Type' });
        });
        
        // Systems
        const systemSelects = document.querySelectorAll('[data-setting="systems"]');
        systemSelects.forEach(select => {
            this.populateDropdown(select, 'systems', { placeholder: 'Select System' });
        });
        
        // Project/AMC
        const projectAMCSelects = document.querySelectorAll('[data-setting="project_amc"]');
        projectAMCSelects.forEach(select => {
            this.populateDropdown(select, 'project_amc', { placeholder: 'Select Project/AMC' });
        });
        
        // Method of Communication
        const communicationSelects = document.querySelectorAll('[data-setting="communication_method"]');
        communicationSelects.forEach(select => {
            this.populateDropdown(select, 'communication_method', { placeholder: 'Select Method' });
        });
    },
    
    /**
     * Get preferences
     */
    getPreferences: function() {
        const data = localStorage.getItem('lead_preferences');
        return data ? JSON.parse(data) : {};
    }
};

// Make it globally available
window.LeadSettingsManager = LeadSettingsManager;

/**
 * Dashboard JavaScript - Using Common.js Utilities
 */

// Chart instances
let statusChart = null;
let trendChart = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    const isDashboardPage = document.querySelector('.kpi-grid') || document.getElementById('statusChart');
    if (isDashboardPage && typeof initializeDashboard === 'function') {
        initializeDashboard();
    }
});

/**
 * Initialize dashboard with common utilities
 */
async function initializeDashboard() {
    try {
        // Show loading state
        showLoading(true);
        
        // Check authentication using common.js utilities
        if (typeof checkAuth === 'function') {
            const isAuthenticated = await checkAuth();
            if (!isAuthenticated) return;
        }
        
        // Load dashboard data
        await loadDashboardData();
        
        // Setup event listeners
        setupEventListeners();
        
        // Initialize auto-refresh
        startAutoRefresh();
        
        // Performance monitoring
        window.perfMonitor = new PerformanceMonitor();
        
    } catch (error) {
        console.error('Dashboard initialization error:', error);
        window.notificationManager.show('error', 'Failed to initialize dashboard');
    } finally {
        showLoading(false);
    }
}

/**
 * Setup dashboard event listeners
 */
function setupEventListeners() {
    // Responsive sidebar handling
    window.addEventListener('resize', debounce(handleResponsiveLayout, 300));
    
    // Theme toggle (if implemented)
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    // Chart data export
    const exportBtn = document.getElementById('exportData');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportDashboardData);
    }
    
    // Real-time updates via WebSocket (if available)
    setupWebSocket();
    
    // Handle offline/online for dashboard
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOfflineStatus);
}

/**
 * Load dashboard data from API using ApiService
 */
async function loadDashboardData() {
    window.perfMonitor?.start('dashboard_load');
    
    try {
        const apiService = window.apiService || new ApiService();
        const response = await apiService.request('/api/dashboard/stats');
        
        if (response.success) {
            updateDashboard(response.stats);
            createCharts(response.stats);
            updateEmptyState(response.stats.recent_leads);
            
            // Cache the data
            const storage = new StorageManager();
            storage.set('dashboard_cache', {
                data: response.stats,
                timestamp: Date.now()
            });
            
            window.perfMonitor?.end('dashboard_load');
            
        } else {
            throw new Error(response.message || 'Failed to load dashboard data');
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
        
        // Try to load from cache
        const storage = new StorageManager();
        const cachedData = storage.get('dashboard_cache');
        
        if (cachedData && cachedData.timestamp > Date.now() - 5 * 60 * 1000) {
            window.notificationManager.show('warning', 'Showing cached data');
            updateDashboard(cachedData.data);
            createCharts(cachedData.data);
            updateEmptyState(cachedData.data.recent_leads);
        } else {
            window.notificationManager.show('error', 'Failed to load dashboard data. Please check your connection.');
            updateEmptyState([]);
        }
        
        window.perfMonitor?.end('dashboard_load');
        throw error;
    }
}

/**
 * Update dashboard UI with stats
 */
function updateDashboard(stats) {
    // Update stats cards with animations
    animateCounter('totalLeads', stats.total_leads || 0);
    animateCounter('newLeads', stats.leads_by_status?.find(s => s.lead_status === 'New')?.count || 0);
    
    // Calculate win rate
    const wonLeads = stats.leads_by_status?.find(s => s.lead_status === 'Won')?.count || 0;
    const totalActiveLeads = stats.total_leads - (stats.leads_by_status?.find(s => s.lead_status === 'Lost')?.count || 0);
    const winRate = totalActiveLeads > 0 ? Math.round((wonLeads / totalActiveLeads) * 100) : 0;
    animateCounter('winRate', winRate, '%');
    
    // Update total value
    if (stats.total_value) {
        document.getElementById('totalValue').textContent = FormUtils.formatCurrency(stats.total_value);
    }
    
    // Update recent leads table
    updateRecentLeadsTable(stats.recent_leads || []);
    
    // Update trends indicators
    updateTrendIndicators(stats);
}

/**
 * Animate counter from 0 to target value
 */
function animateCounter(elementId, targetValue, suffix = '') {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const currentValue = parseFloat(element.textContent.replace(/[^0-9.-]+/g, "")) || 0;
    const duration = 1000; // 1 second
    const steps = 60; // 60fps
    const stepValue = (targetValue - currentValue) / steps;
    let currentStep = 0;
    
    function updateCounter() {
        currentStep++;
        const newValue = currentValue + (stepValue * currentStep);
        
        if (suffix === '%') {
            element.textContent = Math.round(newValue) + suffix;
        } else if (suffix) {
            element.textContent = newValue.toLocaleString() + suffix;
        } else {
            element.textContent = newValue.toLocaleString();
        }
        
        if (currentStep < steps) {
            requestAnimationFrame(updateCounter);
        } else {
            // Ensure final value is exact
            if (suffix === '%') {
                element.textContent = Math.round(targetValue) + suffix;
            } else if (suffix) {
                element.textContent = targetValue.toLocaleString() + suffix;
            } else {
                element.textContent = targetValue.toLocaleString();
            }
        }
    }
    
    requestAnimationFrame(updateCounter);
}

/**
 * Update recent leads table with animations
 */
function updateRecentLeadsTable(leads) {
    const tableBody = document.querySelector('#recentLeadsTable tbody');
    const emptyState = document.getElementById('emptyState');
    
    if (!leads || leads.length === 0) {
        tableBody.innerHTML = '';
        emptyState?.classList.add('active');
        return;
    }
    
    emptyState?.classList.remove('active');
    
    // Clear table with fade out effect
    tableBody.style.opacity = '0';
    setTimeout(() => {
        tableBody.innerHTML = leads.map((lead, index) => `
            <tr style="animation-delay: ${index * 50}ms">
                <td>
                    <a href="/lead-detail/${lead.lead_id}" class="lead-link">
                        <span class="lead-id">${lead.lead_id || 'N/A'}</span>
                    </a>
                </td>
                <td>
                    <div class="company-info">
                        <strong>${escapeHtml(lead.company_name || 'N/A')}</strong>
                        ${lead.company_industry ? `<small>${escapeHtml(lead.company_industry)}</small>` : ''}
                    </div>
                </td>
                <td>
                    <div class="contact-info">
                        <strong>${escapeHtml(lead.customer_name || 'N/A')}</strong>
                        ${lead.customer_email ? `<small>${escapeHtml(lead.customer_email)}</small>` : ''}
                        ${lead.customer_phone ? `<small>${FormUtils.validatePhone(lead.customer_phone) ? lead.customer_phone : ''}</small>` : ''}
                    </div>
                </td>
                <td>
                    <span class="status-badge status-${getStatusClass(lead.lead_status)}">
                        ${lead.lead_status || 'New'}
                    </span>
                </td>
                <td>
                    <div class="date-info">
                        ${FormUtils.formatDateTimeAgo(lead.updated_at || lead.created_at)}
                        <small>${lead.updated_at ? 'Updated' : 'Created'}</small>
                    </div>
                </td>
            </tr>
        `).join('');
        
        // Add animation class
        const rows = tableBody.querySelectorAll('tr');
        rows.forEach(row => {
            row.classList.add('fade-in');
        });
        
        // Fade in table
        setTimeout(() => {
            tableBody.style.opacity = '1';
            tableBody.style.transition = 'opacity 300ms ease';
        }, 100);
    }, 300);
}

/**
 * Update trend indicators
 */
function updateTrendIndicators(stats) {
    // You can add trend analysis here
    const trendCards = document.querySelectorAll('.stat-card');
    
    trendCards.forEach(card => {
        const trendElement = card.querySelector('.stat-trend');
        if (trendElement) {
            // Add trend animation
            trendElement.classList.add('trend-pulse');
            setTimeout(() => {
                trendElement.classList.remove('trend-pulse');
            }, 1000);
        }
    });
}

/**
 * Create charts with responsive sizing
 */
function createCharts(stats) {
    // Destroy existing charts
    if (statusChart) statusChart.destroy();
    if (trendChart) trendChart.destroy();
    
    // Create status chart
    createStatusChart(stats.leads_by_status || []);
    
    // Create trend chart
    createTrendChart(stats.monthly_trend || generateMonthlyTrend());
    
    // Handle chart responsiveness
    setupChartResponsiveness();
}

/**
 * Create status distribution chart
 */
function createStatusChart(statusData) {
    const ctx = document.getElementById('statusChart');
    if (!ctx) return;
    
    // Process data for chart
    const chartData = processChartData(statusData);
    
    statusChart = new Chart(ctx, {
        type: 'doughnut',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: Device.isMobile() ? 'bottom' : 'right',
                    labels: {
                        padding: Device.isMobile() ? 10 : 20,
                        usePointStyle: true,
                        font: {
                            size: Device.isMobile() ? 11 : 12
                        }
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
            cutout: Device.isMobile() ? '60%' : '70%'
        }
    });
}

/**
 * Process chart data with fallbacks
 */
function processChartData(statusData) {
    const defaultStatuses = [
        { lead_status: 'New', count: 0 },
        { lead_status: 'Contacted', count: 0 },
        { lead_status: 'Qualified', count: 0 },
        { lead_status: 'Won', count: 0 },
        { lead_status: 'Lost', count: 0 }
    ];
    
    const data = statusData.length > 0 ? statusData : defaultStatuses;
    
    return {
        labels: data.map(item => item.lead_status),
        datasets: [{
            data: data.map(item => item.count),
            backgroundColor: [
                '#3b82f6', // New - Blue
                '#f59e0b', // Contacted - Yellow
                '#10b981', // Qualified - Green
                '#8b5cf6', // Proposal Sent - Purple
                '#ef4444', // Negotiation - Red
                '#047857', // Won - Dark Green
                '#6b7280'  // Lost - Gray
            ],
            borderWidth: 0,
            borderColor: 'transparent'
        }]
    };
}

/**
 * Create monthly trend chart
 */
function createTrendChart(trendData) {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;
    
    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: trendData.map(item => item.month),
            datasets: [{
                label: 'Leads',
                data: trendData.map(item => item.count),
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#2563eb',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: Device.isMobile() ? 4 : 6,
                pointHoverRadius: Device.isMobile() ? 6 : 8
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
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        drawBorder: false,
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        stepSize: 10
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'nearest'
            }
        }
    });
}

/**
 * Setup chart responsiveness
 */
function setupChartResponsiveness() {
    const resizeHandler = debounce(() => {
        if (statusChart) {
            statusChart.resize();
        }
        if (trendChart) {
            trendChart.resize();
        }
    }, 250);
    
    window.addEventListener('resize', resizeHandler);
}

/**
 * Generate monthly trend data
 */
function generateMonthlyTrend() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = new Date().getMonth();
    
    return months.slice(0, currentMonth + 1).map((month, index) => ({
        month,
        count: Math.floor(Math.random() * 50) + 20 + (index * 5)
    }));
}

/**
 * Update empty state visibility
 */
function updateEmptyState(leads) {
    const emptyState = document.getElementById('emptyState');
    if (emptyState) {
        if (!leads || leads.length === 0) {
            emptyState.classList.add('active');
        } else {
            emptyState.classList.remove('active');
        }
    }
}

/**
 * Show/hide loading state
 */
function showLoading(show) {
    const mainContent = document.querySelector('.main-content');
    if (show) {
        mainContent.classList.add('loading');
    } else {
        mainContent.classList.remove('loading');
    }
}

/**
 * Handle responsive layout changes
 */
function handleResponsiveLayout() {
    // Close sidebar on mobile when switching to desktop
    if (Device.isDesktop()) {
        const sidebar = document.querySelector('.sidebar');
        sidebar?.classList.remove('active');
    }
    
    // Adjust chart layouts
    if (statusChart) {
        statusChart.resize();
    }
    if (trendChart) {
        trendChart.resize();
    }
}

/**
 * Setup WebSocket for real-time updates
 */
function setupWebSocket() {
    if (window.WebSocket) {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/dashboard`;
            
            const ws = new WebSocket(wsUrl);
            
            ws.onopen = () => {
                console.log('WebSocket connected for real-time updates');
            };
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'dashboard_update') {
                    handleRealTimeUpdate(data.data);
                }
            };
            
            ws.onclose = () => {
                console.log('WebSocket disconnected');
                // Attempt reconnect after delay
                setTimeout(setupWebSocket, 5000);
            };
            
            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
            
            // Store WebSocket reference
            window.dashboardWs = ws;
            
        } catch (error) {
            console.error('WebSocket setup failed:', error);
        }
    }
}

/**
 * Handle real-time updates
 */
function handleRealTimeUpdate(data) {
    // Update stats with animation
    if (data.total_leads !== undefined) {
        animateCounter('totalLeads', data.total_leads);
    }
    
    if (data.new_leads !== undefined) {
        animateCounter('newLeads', data.new_leads);
    }
    
    // Show notification for important updates
    if (data.notification) {
        window.notificationManager.show('info', data.notification);
    }
}

/**
 * Handle online status
 */
function handleOnlineStatus() {
    window.notificationManager.show('success', 'Connection restored. Syncing data...');
    loadDashboardData();
}

/**
 * Handle offline status
 */
function handleOfflineStatus() {
    window.notificationManager.show('warning', 'You are offline. Some features may not work.');
}

/**
 * Refresh dashboard data
 */
async function refreshDashboard() {
    window.perfMonitor?.start('dashboard_refresh');
    
    try {
        await loadDashboardData();
        window.notificationManager.show('success', 'Dashboard refreshed successfully');
    } catch (error) {
        window.notificationManager.show('error', 'Failed to refresh dashboard');
    } finally {
        window.perfMonitor?.end('dashboard_refresh');
    }
}

/**
 * Export dashboard data
 */
async function exportDashboardData() {
    try {
        const apiService = window.apiService || new ApiService();
        const response = await apiService.request('/api/dashboard/export');
        
        if (response.success) {
            // Create and download file
            const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `dashboard-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            window.notificationManager.show('success', 'Data exported successfully');
        }
    } catch (error) {
        window.notificationManager.show('error', 'Failed to export data');
    }
}

/**
 * Toggle theme (light/dark)
 */
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    html.setAttribute('data-theme', newTheme);
    
    // Save preference
    const storage = new StorageManager();
    storage.set('theme', newTheme);
    
    // Update charts for new theme
    if (statusChart || trendChart) {
        setTimeout(() => {
            if (statusChart) statusChart.update();
            if (trendChart) trendChart.update();
        }, 100);
    }
}

/**
 * Get CSS class for status
 */
function getStatusClass(status) {
    if (!status) return 'new';
    
    const statusMap = {
        'new': 'new',
        'contacted': 'contacted',
        'qualified': 'qualified',
        'won': 'won',
        'lost': 'lost',
        'proposal_sent': 'qualified',
        'negotiation': 'contacted'
    };
    
    return statusMap[status.toLowerCase()] || 'new';
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Debounce function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Auto-refresh functionality
let autoRefreshInterval = null;

function startAutoRefresh() {
    stopAutoRefresh();
    autoRefreshInterval = setInterval(() => {
        if (!document.hidden) {
            refreshDashboard();
        }
    }, 5 * 60 * 1000); // 5 minutes
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

// Make functions globally available
window.toggleSidebar = function() {
    const sidebar = document.querySelector('.sidebar');
    sidebar?.classList.toggle('active');
    
    // Close sidebar when clicking outside on mobile
    if (sidebar?.classList.contains('active') && Device.isMobile()) {
        const closeOnClickOutside = (event) => {
            if (!sidebar.contains(event.target) && 
                !document.querySelector('.menu-toggle').contains(event.target)) {
                sidebar.classList.remove('active');
                document.removeEventListener('click', closeOnClickOutside);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeOnClickOutside);
        }, 100);
    }
};

window.refreshDashboard = refreshDashboard;

// Handle logout button click
window.handleLogout = async function() {
    try {
        const response = await fetch('/api/logout', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        // Redirect to login regardless of response
        window.location.href = '/login';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/login';
    }
};

// Initialize theme from storage
document.addEventListener('DOMContentLoaded', () => {
    const storage = new StorageManager();
    const savedTheme = storage.get('theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    }
});