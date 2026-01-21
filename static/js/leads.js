// Leads Management JavaScript
// leads.js mein yeh code add karein starting mein
const currentUser = {
    user_id: {{ user.user_id|default(0) }},
    username: "{{ user.username|default('') }}",
    full_name: "{{ user.full_name|default('') }}",
    email: "{{ user.email|default('') }}",
    role: "{{ user.role|default('') }}",
    permissions: {
        can_view_leads: {{ user.permissions.can_view_leads|default(false)|lower }},
        can_create_leads: {{ user.permissions.can_create_leads|default(false)|lower }},
        can_edit_leads: {{ user.permissions.can_edit_leads|default(false)|lower }},
        can_delete_leads: {{ user.permissions.can_delete_leads|default(false)|lower }},
        can_view_users: {{ user.permissions.can_view_users|default(false)|lower }},
        can_manage_users: {{ user.permissions.can_manage_users|default(false)|lower }},
        can_view_reports: {{ user.permissions.can_view_reports|default(false)|lower }},
        can_export_data: {{ user.permissions.can_export_data|default(false)|lower }}
    }
};

// Session validation on page load
async function validateSessionOnLoad() {
    try {
        const response = await fetch('/api/validate-session', {
            credentials: 'include' // Important: include cookies
        });
        
        if (!response.ok) {
            // Session invalid, redirect to login
            window.location.href = '/login';
            return false;
        }
        
        const data = await response.json();
        if (data.success) {
            return true;
        } else {
            window.location.href = '/login';
            return false;
        }
    } catch (error) {
        console.error('Session validation error:', error);
        window.location.href = '/login';
        return false;
    }
}

// Update your DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', async function() {
    // First validate session
    const isValidSession = await validateSessionOnLoad();
    if (!isValidSession) return;
    
    // Load Lead Settings from database
    if (window.LeadSettingsManager) {
        await LeadSettingsManager.loadSettings();
    }
    
    // Then initialize the page
    initializeLeadsPage();
    loadLeads();
    setCurrentDate();
    setupEventListeners();
});
// Global variables
let currentPage = 1;
let totalPages = 1;
let pageSize = 20;
let currentFilters = {};
let selectedLeadId = null;
let currentLeadData = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeLeadsPage();
    loadLeads();
    setCurrentDate();
    setupEventListeners();
});

// Initialize leads page
function initializeLeadsPage() {
    // Initialize all dropdowns from Lead Settings
    if (window.LeadSettingsManager) {
        window.LeadSettingsManager.initializeAllDropdowns();
    }
    
    // Set today's date as max for date filters
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date-to').max = today;
    document.getElementById('date-from').max = today;
    
    // Set default date range (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    document.getElementById('date-from').value = thirtyDaysAgo.toISOString().split('T')[0];
    document.getElementById('date-to').value = today;
    
    // Initialize filters
    currentFilters = {
        status: '',
        source: '',
        dateFrom: document.getElementById('date-from').value,
        dateTo: document.getElementById('date-to').value,
        search: ''
    };
}

// Set current date in header
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

// Setup event listeners
function setupEventListeners() {
    // Search on Enter key
    document.getElementById('search-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchLeads();
        }
    });
    
    // Close modals on ESC key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
    
    // Close modal when clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal(this.id);
            }
        });
    });
    
    // Close action menu when clicking outside
    document.getElementById('action-menu').addEventListener('click', function(e) {
        if (e.target === this) {
            closeActionMenu();
        }
    });
}

// Load leads from API
async function loadLeads() {
    try {
        showLoading(true);
        
        // Build query parameters
        const params = new URLSearchParams({
            page: currentPage,
            limit: pageSize
        });
        
        if (currentFilters.status) {
            params.append('status', currentFilters.status);
        }
        if (currentFilters.owner) {
            params.append('owner', currentFilters.owner);
        }
        if (currentFilters.search) {
            params.append('search', currentFilters.search);
        }
        // Note: Date filtering would need API support
        // For now, we'll just use status, owner, and search
        const response = await fetch(`/api/leads?${params.toString()}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            renderLeadsTable(data.data);
            updatePagination(data.pagination);
            updateStats(data.data);
        } else {
            throw new Error(data.detail || 'Failed to load leads');
        }
    } catch (error) {
        console.error('Error loading leads:', error);
        showNotification('Failed to load leads', 'error');
        renderEmptyTable('Failed to load leads. Please try again.');
    } finally {
        showLoading(false);
    }
}

// Render leads table
function renderLeadsTable(leads) {
    const tbody = document.getElementById('leads-table-body');
    
    if (!leads || leads.length === 0) {
        renderEmptyTable('No leads found');
        return;
    }
    
    tbody.innerHTML = leads.map(lead => `
        <tr data-lead-id="${lead.lead_id}">
            <td>
                <strong>${escapeHtml(lead.lead_id)}</strong>
            </td>
            <td>
                <div class="company-info">
                    <strong>${escapeHtml(lead.company_name)}</strong>
                    ${lead.industry_type ? `<br><small>${escapeHtml(lead.industry_type)}</small>` : ''}
                </div>
            </td>
            <td>
                <div class="contact-info">
                    <strong>${escapeHtml(lead.customer_name)}</strong>
                    ${lead.designation_customer ? `<br><small>${escapeHtml(lead.designation_customer)}</small>` : ''}
                </div>
            </td>
            <td>
                <a href="mailto:${escapeHtml(lead.email_id)}" class="email-link">
                    ${escapeHtml(lead.email_id)}
                </a>
            </td>
            <td>
                <a href="tel:${escapeHtml(lead.contact_no)}" class="phone-link">
                    ${escapeHtml(formatPhoneNumber(lead.contact_no))}
                </a>
            </td>
            <td>
                <span class="status-badge status-${getStatusClass(lead.lead_status)}">
                    ${escapeHtml(lead.lead_status || 'New')}
                </span>
            </td>
            <td>
                <span class="source-badge">
                    ${escapeHtml(lead.lead_source || 'N/A')}
                </span>
            </td>
            <td>
                ${formatDate(lead.created_at)}
            </td>
            <td>
                ${formatDate(lead.updated_at)}
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn view" onclick="viewLeadDetail('${lead.lead_id}')" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${currentUserPermissions.can_edit_leads ? `
                    <button class="action-btn edit" onclick="editLeadDetail('${lead.lead_id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    ` : ''}
                    <button class="action-btn more" onclick="openActionMenu(event, '${lead.lead_id}', ${JSON.stringify(lead).replace(/"/g, '&quot;')})" title="More Actions">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Render empty table state
function renderEmptyTable(message) {
    const tbody = document.getElementById('leads-table-body');
    tbody.innerHTML = `
        <tr>
            <td colspan="10" class="empty-state">
                <div class="empty-state-content">
                    <i class="fas fa-inbox"></i>
                    <h4>${message}</h4>
                    ${currentFilters.search || currentFilters.status ? `
                        <p>Try changing your filters or search criteria</p>
                        <button class="btn btn-primary" onclick="clearFilters()">
                            Clear Filters
                        </button>
                    ` : currentUserPermissions.can_create_leads ? `
                        <p>Get started by adding your first lead</p>
                        <a href="/add-lead" class="btn btn-primary">
                            <i class="fas fa-plus"></i> Add First Lead
                        </a>
                    ` : `
                        <p>No leads have been added yet</p>
                    `}
                </div>
            </td>
        </tr>
    `;
}

// Update pagination controls
function updatePagination(pagination) {
    totalPages = pagination.pages || 1;
    
    // Update showing info
    const showingFrom = ((currentPage - 1) * pageSize) + 1;
    const showingTo = Math.min(currentPage * pageSize, pagination.total);
    
    document.getElementById('showing-from').textContent = showingFrom;
    document.getElementById('showing-to').textContent = showingTo;
    document.getElementById('total-leads').textContent = pagination.total;
    
    // Update pagination buttons
    document.getElementById('first-page').disabled = currentPage === 1;
    document.getElementById('prev-page').disabled = currentPage === 1;
    document.getElementById('next-page').disabled = currentPage === totalPages;
    document.getElementById('last-page').disabled = currentPage === totalPages;
    
    // Generate page numbers
    const pageNumbersContainer = document.getElementById('page-numbers');
    pageNumbersContainer.innerHTML = '';
    
    // Show up to 5 page numbers
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);
    
    if (currentPage <= 3) {
        endPage = Math.min(5, totalPages);
    }
    
    if (currentPage >= totalPages - 2) {
        startPage = Math.max(1, totalPages - 4);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-number ${i === currentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.onclick = () => goToPage(i);
        pageNumbersContainer.appendChild(pageBtn);
    }
}

// Update stats summary
function updateStats(leads) {
    if (!leads || leads.length === 0) {
        document.getElementById('total-leads-count').textContent = '0';
        document.getElementById('new-leads-count').textContent = '0';
        document.getElementById('contacted-leads-count').textContent = '0';
        document.getElementById('converted-leads-count').textContent = '0';
        return;
    }
    
    // Count leads by status
    let total = leads.length;
    let newCount = 0;
    let contactedCount = 0;
    let convertedCount = 0;
    
    leads.forEach(lead => {
        switch (lead.lead_status) {
            case 'New':
                newCount++;
                break;
            case 'Contacted':
            case 'Proposal Sent':
            case 'Negotiation':
                contactedCount++;
                break;
            case 'Converted':
                convertedCount++;
                break;
        }
    });
    
    document.getElementById('total-leads-count').textContent = total;
    document.getElementById('new-leads-count').textContent = newCount;
    document.getElementById('contacted-leads-count').textContent = contactedCount;
    document.getElementById('converted-leads-count').textContent = convertedCount;
}

// Go to specific page
function goToPage(page) {
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    loadLeads();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Change page size
function changePageSize() {
    pageSize = parseInt(document.getElementById('page-size').value);
    currentPage = 1; // Reset to first page
    loadLeads();
}

// Apply filters
function applyFilters() {
    currentFilters = {
        status: document.getElementById('status-filter').value,
        source: document.getElementById('source-filter').value,
        owner: document.getElementById('owner-filter') ? document.getElementById('owner-filter').value : '',
        dateFrom: document.getElementById('date-from').value,
        dateTo: document.getElementById('date-to').value,
        search: document.getElementById('search-input').value.trim()
    };
    
    currentPage = 1; // Reset to first page
    loadLeads();
    
    showNotification('Filters applied', 'success');
}

// Search leads
function searchLeads() {
    const searchTerm = document.getElementById('search-input').value.trim();
    currentFilters.search = searchTerm;
    currentPage = 1;
    loadLeads();
}

// Clear all filters
function clearFilters() {
    document.getElementById('status-filter').value = '';
    document.getElementById('source-filter').value = '';
    if (document.getElementById('owner-filter')) {
        document.getElementById('owner-filter').value = '';
    }
    
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    document.getElementById('date-from').value = thirtyDaysAgo.toISOString().split('T')[0];
    document.getElementById('date-to').value = today;
    document.getElementById('search-input').value = '';
    
    currentFilters = {
        status: '',
        source: '',
        owner: '',
        dateFrom: document.getElementById('date-from').value,
        dateTo: document.getElementById('date-to').value,
        search: ''
    };
    
    currentPage = 1;
    loadLeads();
    
    showNotification('Filters cleared', 'success');
}

// Export leads
async function exportLeads() {
    try {
        showNotification('Preparing export...', 'info');
        
        // This would call an export API endpoint
        // For now, we'll simulate the process
        setTimeout(() => {
            showNotification('Export feature will be available soon', 'info');
        }, 1000);
        
    } catch (error) {
        console.error('Export error:', error);
        showNotification('Failed to export leads', 'error');
    }
}

// View lead detail
function viewLeadDetail(leadId) {
    window.location.href = `/lead-detail/${leadId}`;
}

// Edit lead detail
function editLeadDetail(leadId) {
    window.location.href = `/edit-lead/${leadId}`;
}

// Open action menu
function openActionMenu(event, leadId, leadData) {
    event.stopPropagation();
    selectedLeadId = leadId;
    currentLeadData = leadData ? JSON.parse(leadData) : null;
    
    // Position the menu near the clicked button
    const menu = document.getElementById('action-menu');
    const button = event.target.closest('button');
    const rect = button.getBoundingClientRect();
    
    menu.style.display = 'flex';
    
    // Adjust position if near screen edges
    let top = rect.bottom + 5;
    let left = rect.left;
    
    if (top + 300 > window.innerHeight) {
        top = rect.top - 300;
    }
    
    if (left + 300 > window.innerWidth) {
        left = window.innerWidth - 320;
    }
    
    menu.querySelector('.action-menu-content').style.top = `${top}px`;
    menu.querySelector('.action-menu-content').style.left = `${left}px`;
}

// Close action menu
function closeActionMenu() {
    document.getElementById('action-menu').style.display = 'none';
    selectedLeadId = null;
    currentLeadData = null;
}

// View lead from action menu
function viewLead() {
    if (selectedLeadId) {
        viewLeadDetail(selectedLeadId);
    }
    closeActionMenu();
}

// Edit lead from action menu
function editLead() {
    if (selectedLeadId) {
        editLeadDetail(selectedLeadId);
    }
    closeActionMenu();
}

// Delete lead confirmation
function deleteLead() {
    if (!selectedLeadId) return;
    
    if (!currentUserPermissions.can_delete_leads) {
        showNotification('You do not have permission to delete leads', 'error');
        closeActionMenu();
        return;
    }
    
    closeActionMenu();
    openModal('delete-modal');
}

// Confirm delete lead
async function confirmDeleteLead() {
    try {
        showLoading(true);
        
        const response = await fetch(`/api/leads/${selectedLeadId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Lead deleted successfully', 'success');
            closeModal('delete-modal');
            loadLeads(); // Refresh the table
        } else {
            throw new Error(data.detail || 'Failed to delete lead');
        }
    } catch (error) {
        console.error('Delete error:', error);
        showNotification('Failed to delete lead: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Add activity (placeholder)
function addActivity() {
    showNotification('Add activity feature will be available soon', 'info');
    closeActionMenu();
}

// Change status
function changeStatus() {
    if (!selectedLeadId || !currentLeadData) return;
    
    // Set current status in dropdown
    document.getElementById('new-status').value = currentLeadData.lead_status || 'New';
    document.getElementById('status-remarks').value = '';
    
    openModal('status-modal');
    closeActionMenu();
}

// Update lead status
async function updateLeadStatus() {
    try {
        const newStatus = document.getElementById('new-status').value;
        const remarks = document.getElementById('status-remarks').value.trim();
        
        if (!selectedLeadId) return;
        
        showLoading(true);
        
        const response = await fetch(`/api/leads/${selectedLeadId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                lead_status: newStatus,
                remarks: remarks || null
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Lead status updated successfully', 'success');
            closeModal('status-modal');
            loadLeads(); // Refresh the table
        } else {
            throw new Error(data.detail || 'Failed to update lead status');
        }
    } catch (error) {
        console.error('Status update error:', error);
        showNotification('Failed to update status: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Open modal
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// Close modal
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Close all modals
function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
    closeActionMenu();
    document.body.style.overflow = 'auto';
}

// Show loading state
function showLoading(isLoading) {
    const loadingOverlay = document.getElementById('loading-overlay') || createLoadingOverlay();
    
    if (isLoading) {
        loadingOverlay.style.display = 'flex';
    } else {
        loadingOverlay.style.display = 'none';
    }
}

// Create loading overlay
function createLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
        <div class="loading-spinner-large">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Loading...</p>
        </div>
    `;
    overlay.style.display = 'none';
    document.body.appendChild(overlay);
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

// Get notification icon
function getNotificationIcon(type) {
    const icons = {
        'success': 'check-circle',
        'error': 'exclamation-circle',
        'warning': 'exclamation-triangle',
        'info': 'info-circle'
    };
    return icons[type] || 'info-circle';
}

// Get status class for styling
function getStatusClass(status) {
    if (!status) return 'new';
    
    const statusMap = {
        'New': 'new',
        'new': 'new',
        'Contacted': 'contacted',
        'contacted': 'contacted',
        'Proposal Sent': 'proposal',
        'Proposal': 'proposal',
        'Negotiation': 'negotiation',
        'negotiation': 'negotiation',
        'Converted': 'converted',
        'converted': 'converted',
        'Closed': 'converted',
        'Lost': 'lost',
        'lost': 'lost'
    };
    return statusMap[status] || 'new';
}

// Format phone number
function formatPhoneNumber(phone) {
    if (!phone) return 'N/A';
    
    // Remove all non-digits
    const cleaned = phone.toString().replace(/\D/g, '');
    
    // Format for display
    if (cleaned.length === 10) {
        return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
    } else if (cleaned.length > 10) {
        return `+${cleaned.slice(0, cleaned.length - 10)} (${cleaned.slice(-10, -7)}) ${cleaned.slice(-7, -4)}-${cleaned.slice(-4)}`;
    }
    
    return phone;
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return 'Invalid date';
        }
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
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

// Add empty state styles
const emptyStateStyles = document.createElement('style');
emptyStateStyles.textContent = `
.empty-state {
    text-align: center;
    padding: 60px 20px !important;
}

.empty-state-content {
    max-width: 400px;
    margin: 0 auto;
}

.empty-state-content i {
    font-size: 3rem;
    color: #e0e6ff;
    margin-bottom: 20px;
}

.empty-state-content h4 {
    color: #666;
    margin-bottom: 10px;
    font-size: 1.2rem;
}

.empty-state-content p {
    color: #999;
    margin-bottom: 20px;
    font-size: 0.95rem;
}

.empty-state-content .btn {
    padding: 12px 24px;
    font-size: 1rem;
}

.source-badge {
    display: inline-block;
    padding: 4px 10px;
    background: #f0f7ff;
    color: #667eea;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 500;
}

.email-link {
    color: #667eea;
    text-decoration: none;
    transition: color 0.3s ease;
}

.email-link:hover {
    color: #4a5fc1;
    text-decoration: underline;
}

.phone-link {
    color: #495057;
    text-decoration: none;
    transition: color 0.3s ease;
}

.phone-link:hover {
    color: #667eea;
    text-decoration: underline;
}

.company-info small,
.contact-info small {
    color: #888;
    font-size: 0.8rem;
}

.company-info,
.contact-info {
    line-height: 1.4;
}
`;
document.head.appendChild(emptyStateStyles);

// Current user permissions (from template)
const currentUserPermissions = {
    can_view_leads: {{ user.permissions.can_view_leads|lower }},
    can_create_leads: {{ user.permissions.can_create_leads|lower }},
    can_edit_leads: {{ user.permissions.can_edit_leads|lower }},
    can_delete_leads: {{ user.permissions.can_delete_leads|lower }},
    can_view_users: {{ user.permissions.can_view_users|lower }},
    can_manage_users: {{ user.permissions.can_manage_users|lower }},
    can_view_reports: {{ user.permissions.can_view_reports|lower }},
    can_export_data: {{ user.permissions.can_export_data|lower }}
};