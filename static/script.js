// Global utility functions

// Show notification
function showNotification(type, message, duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add to DOM
    document.body.appendChild(notification);
    
    // Show with animation
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Remove after duration
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Format date and time
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Format currency
function formatCurrency(amount) {
    if (!amount) return '₹0';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Validate email
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Validate phone number (Indian format)
function isValidPhone(phone) {
    const re = /^[6-9]\d{9}$/;
    return re.test(phone.replace(/\D/g, ''));
}

// Debounce function for search inputs
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

// Throttle function for scroll events
function throttle(func, limit) {
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

// Load user from localStorage
function getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

// Check if user has permission
function hasPermission(permission) {
    const user = getCurrentUser();
    if (!user) return false;
    if (user.role === 'admin') return true;
    return user.permissions?.[permission] || false;
}

// API request wrapper
async function apiRequest(url, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include'
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    try {
        const response = await fetch(url, mergedOptions);
        
        if (response.status === 401) {
            // Unauthorized, redirect to login
            localStorage.clear();
            window.location.href = '/';
            return null;
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || 'Request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

// Export data to CSV
function exportToCSV(data, filename) {
    if (!data || data.length === 0) {
        showNotification('error', 'No data to export');
        return;
    }
    
    // Extract headers from first object
    const headers = Object.keys(data[0]);
    
    // Convert data to CSV format
    const csvContent = [
        headers.join(','),
        ...data.map(row => 
            headers.map(header => 
                `"${String(row[header] || '').replace(/"/g, '""')}"`
            ).join(',')
        )
    ].join('\n');
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('success', 'Export started');
}

// Generate PDF (placeholder - would need a PDF library like jsPDF)
function exportToPDF(data, filename, title) {
    showNotification('info', 'PDF export requires additional setup');
    // Implement PDF generation using jsPDF or similar library
}

// Modal management
class ModalManager {
    constructor() {
        this.modals = new Map();
        this.currentModal = null;
    }
    
    register(id, modalElement) {
        this.modals.set(id, modalElement);
        
        // Close modal when clicking outside
        modalElement.addEventListener('click', (e) => {
            if (e.target === modalElement) {
                this.close(id);
            }
        });
        
        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.currentModal === id) {
                this.close(id);
            }
        });
    }
    
    open(id) {
        if (this.currentModal) {
            this.close(this.currentModal);
        }
        
        const modal = this.modals.get(id);
        if (modal) {
            modal.style.display = 'flex';
            this.currentModal = id;
            document.body.style.overflow = 'hidden';
        }
    }
    
    close(id) {
        const modal = this.modals.get(id);
        if (modal) {
            modal.style.display = 'none';
            if (this.currentModal === id) {
                this.currentModal = null;
            }
            document.body.style.overflow = '';
        }
    }
}

// Create global modal manager instance
const modalManager = new ModalManager();

// Initialize tooltips
function initTooltips() {
    const tooltips = document.querySelectorAll('[data-tooltip]');
    tooltips.forEach(element => {
        element.addEventListener('mouseenter', () => {
            const tooltip = document.createElement('div');
            tooltip.className = 'custom-tooltip';
            tooltip.textContent = element.getAttribute('data-tooltip');
            document.body.appendChild(tooltip);
            
            const rect = element.getBoundingClientRect();
            tooltip.style.position = 'fixed';
            tooltip.style.top = `${rect.top - tooltip.offsetHeight - 5}px`;
            tooltip.style.left = `${rect.left + (rect.width - tooltip.offsetWidth) / 2}px`;
            
            element._tooltip = tooltip;
        });
        
        element.addEventListener('mouseleave', () => {
            if (element._tooltip) {
                element._tooltip.remove();
                delete element._tooltip;
            }
        });
    });
}

// Add notification CSS
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 24px;
        border-radius: 6px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        transform: translateX(100%);
        opacity: 0;
        transition: transform 0.3s ease, opacity 0.3s ease;
    }
    
    .notification.show {
        transform: translateX(0);
        opacity: 1;
    }
    
    .notification-success {
        background-color: #10b981;
    }
    
    .notification-error {
        background-color: #ef4444;
    }
    
    .notification-warning {
        background-color: #f59e0b;
    }
    
    .notification-info {
        background-color: #3b82f6;
    }
    
    .custom-tooltip {
        position: absolute;
        background: #374151;
        color: white;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 1000;
        white-space: nowrap;
        pointer-events: none;
    }
    
    .custom-tooltip::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border-width: 4px;
        border-style: solid;
        border-color: #374151 transparent transparent transparent;
    }
`;
document.head.appendChild(notificationStyles);

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initTooltips();
    
    // Auto-hide notifications after 5 seconds
    const notifications = document.querySelectorAll('.alert:not(.alert-permanent)');
    notifications.forEach(alert => {
        setTimeout(() => {
            alert.style.opacity = '0';
            setTimeout(() => alert.remove(), 300);
        }, 5000);
    });
    
    // Add active class to current nav link
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });
});

// Session management
function checkSession() {
    return apiRequest('/api/validate-session');
}

// Auto logout after inactivity
let inactivityTimer;
function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        showNotification('warning', 'Session expired due to inactivity');
        logout();
    }, 30 * 60 * 1000); // 30 minutes
}

// Set up inactivity timer
if (document.readyState !== 'loading') {
    setupInactivityTimer();
} else {
    document.addEventListener('DOMContentLoaded', setupInactivityTimer);
}

function setupInactivityTimer() {
    // Reset timer on user activity
    ['mousemove', 'keypress', 'scroll', 'click'].forEach(event => {
        document.addEventListener(event, resetInactivityTimer);
    });
    
    resetInactivityTimer();
}

// Logout function
async function logout() {
    try {
        await apiRequest('/api/logout', { method: 'POST' });
        localStorage.clear();
        window.location.href = '/';
    } catch (error) {
        console.error('Logout error:', error);
        localStorage.clear();
        window.location.href = '/';
    }
}

// Add logout to window object for global access
window.logout = logout;
window.showNotification = showNotification;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.formatCurrency = formatCurrency;
window.hasPermission = hasPermission;
window.escapeHtml = escapeHtml;
window.apiRequest = apiRequest;
window.modalManager = modalManager;