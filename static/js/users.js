// Global variables
let currentUser = null;
let allUsers = [];
let filteredUsers = [];
let allDesignations = [];
let userRoles = ['admin', 'manager', 'sales', 'viewer'];

// Initialize users page
document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication
    currentUser = JSON.parse(localStorage.getItem('user'));
    console.log('👤 Current User from localStorage:', currentUser);
    
    if (!currentUser) {
        console.error('❌ No user found, redirecting to login');
        window.location.href = '/';
        return;
    }
    
    // Ensure is_admin property exists (fallback to role check)
    if (!currentUser.hasOwnProperty('is_admin')) {
        currentUser.is_admin = currentUser.role === 'admin';
        console.log('🔧 Added is_admin property:', currentUser.is_admin);
    }
    
    console.log('✅ User authenticated, is_admin:', currentUser.is_admin);
    
    // Load users data and designations
    await loadUsersData();
    await loadDesignations();
    
    // Initialize event listeners
    initializeEventListeners();
    
    // Initialize search
    initializeSearch();
});

// Simple wrapper function for refresh button
function loadUsers() {
    loadUsersData();
}

// Load users data
async function loadUsersData() {
    try {
        console.log('🔄 Loading users...');
        // Show loading state in table
        const tbody = document.getElementById('usersTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="13" style="text-align: center; padding: 40px;"><div style="color: #6b7280;"><i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 10px;"></i><p>Loading users...</p></div></td></tr>';
        }
        showLoading(true);
        
        const session_token = localStorage.getItem('session_token');
        console.log('📦 Session token:', session_token ? 'Present' : 'Missing');
        
        const roleFilter = document.getElementById('roleFilter')?.value || '';
        const statusFilter = document.getElementById('statusFilter')?.value || '';
        const searchQuery = document.getElementById('searchInput')?.value || '';
        
        console.log('📋 Filters:', { roleFilter, statusFilter, searchQuery });
        
        const response = await fetch('/api/users', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        console.log('📥 API Response Status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📦 API Response Data:', data);
        
        if (data.success) {
            // API returns users in `data` key; fallback to `users`
            allUsers = data.data || data.users || [];
            console.log('✅ Users loaded:', allUsers.length);
            filteredUsers = filterUsersData(allUsers, roleFilter, statusFilter, searchQuery);
            
            // Update UI
            updateUsersTable();
            updateUserStats();
        } else {
            throw new Error(data.detail || 'Failed to load users');
        }
    } catch (error) {
        console.error('❌ Error loading users:', error);
        showError('Failed to load users');
        
        // Show empty state
        document.getElementById('usersTableBody').innerHTML = `
            <tr>
                <td colspan="13" class="text-center">
                    <div class="empty-state">
                        <div class="empty-icon">😔</div>
                        <h4>Unable to load users</h4>
                        <p>Please check your connection and try again.</p>
                        <button class="btn primary" onclick="loadUsersData()">Retry</button>
                    </div>
                </td>
            </tr>
        `;
    } finally {
        showLoading(false);
    }
}

// Filter users data
function filterUsersData(users, roleFilter, statusFilter, searchQuery) {
    return users.filter(user => {
        // Filter by role
        if (roleFilter && user.role !== roleFilter) {
            return false;
        }
        
        // Filter by status
        if (statusFilter) {
            const isActive = user.is_active === 1 || user.is_active === true;
            if (statusFilter === 'active' && !isActive) return false;
            if (statusFilter === 'inactive' && isActive) return false;
        }
        
        // Filter by search query
        if (searchQuery) {
            const searchTerm = searchQuery.toLowerCase();
            const searchableText = `
                ${user.username || ''}
                ${user.full_name || ''}
                ${user.email || ''}
                ${user.role || ''}
            `.toLowerCase();
            
            if (!searchableText.includes(searchTerm)) {
                return false;
            }
        }
        
        return true;
    });
}

// Update users table
function updateUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    
    if (filteredUsers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="13" class="text-center">
                    <div class="empty-state">
                        <div class="empty-icon">👥</div>
                        <h4>No users found</h4>
                        <p>Try adjusting your filters or add a new user.</p>
                        <button class="btn primary" onclick="showAddUserModal()">
                            <i class="fas fa-user-plus"></i>
                            Add New User
                        </button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    
    filteredUsers.forEach((user, index) => {
        const isActive = user.is_active === 1 || user.is_active === true;
        const createdDate = formatDate(user.created_at);
        const dob = user.date_of_birth ? formatDate(user.date_of_birth) : '-';
        const designation = user.designation || '-';
        const mobile = user.mobile_no || '-';
        const createdBy = user.created_by_name || 'System';

        html += `
            <tr>
                <td>${index + 1}</td>
                <td>${renderUserPhoto(user)}</td>
                <td>${escapeHtml(user.username || '')}</td>
                <td>${escapeHtml(user.full_name || '')}</td>
                <td>${escapeHtml(user.email || '')}</td>
                <td>${escapeHtml(designation)}</td>
                <td>${escapeHtml(mobile)}</td>
                <td>${dob}</td>
                <td><span class="password-masked">••••••••</span></td>
                <td><span class="role-badge ${user.role}">${formatRoleName(user.role)}</span></td>
                <td><span class="status-badge ${isActive ? 'active' : 'inactive'}">${isActive ? 'Active' : 'Inactive'}</span></td>
                <td>${escapeHtml(createdBy)}</td>
                <td>${createdDate}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" title="View User" onclick="viewUser(${user.id})"><i class="fas fa-eye"></i></button>
                        ${user.id !== currentUser.user_id ? `<button class="btn-icon" title="Edit User" onclick="editUser(${user.id})"><i class="fas fa-edit"></i></button>` : ''}
                        ${(currentUser.is_admin === true || currentUser.permissions?.can_manage_users === true) && user.id !== currentUser.user_id ? `<button class="btn-icon danger" title="Delete User" onclick="deleteUser(${user.id})"><i class="fas fa-trash"></i></button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// Update user stats
function updateUserStats() {
    const totalEl = document.getElementById('users-count');
    const activeEl = document.getElementById('active-count');
    const inactiveEl = document.getElementById('inactive-count');

    const activeCount = allUsers.filter(u => u.is_active === 1 || u.is_active === true).length;
    const inactiveCount = allUsers.length - activeCount;

    if (totalEl) totalEl.textContent = allUsers.length.toString();
    if (activeEl) activeEl.textContent = activeCount.toString();
    if (inactiveEl) inactiveEl.textContent = inactiveCount.toString();
}

// Initialize event listeners
function initializeEventListeners() {
    // Filter change listeners
    const roleFilter = document.getElementById('roleFilter');
    const statusFilter = document.getElementById('statusFilter');
    if (roleFilter) roleFilter.addEventListener('change', filterUsers);
    if (statusFilter) statusFilter.addEventListener('change', filterUsers);
    
    // Export button
    const exportBtn = document.querySelector('.btn-secondary');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportUsers);
    }
    
    // Back button
    const backBtn = document.querySelector('.btn-back');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = '/dashboard';
        });
    }

    // Add designation form
    const addDesignationForm = document.getElementById('addDesignationForm');
    if (addDesignationForm) {
        addDesignationForm.addEventListener('submit', handleAddDesignationSubmit);
    }

    // Auto-fill full name from first/last
    const firstInput = document.getElementById('new_first_name');
    const lastInput = document.getElementById('new_last_name');
    if (firstInput) firstInput.addEventListener('input', updateFullNameFromParts);
    if (lastInput) lastInput.addEventListener('input', updateFullNameFromParts);

    // Add user form submit
    const addUserForm = document.getElementById('addUserForm');
    if (addUserForm) {
        addUserForm.addEventListener('submit', handleAddUserSubmit);
    }
}

// Initialize search
function initializeSearch() {
    const searchInput = document.getElementById('searchInput');
    let searchTimeout;
    
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            filterUsers();
        }, 500);
    });
}

// Filter users
function filterUsers() {
    const roleFilter = document.getElementById('roleFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const searchQuery = document.getElementById('searchInput').value;
    
    filteredUsers = filterUsersData(allUsers, roleFilter, statusFilter, searchQuery);
    updateUsersTable();
}

// Search users
function searchUsers() {
    filterUsers();
}

// Show add user modal
function showAddUserModal() {
    console.log('🔐 Checking permissions for Add User...');
    console.log('  currentUser:', currentUser);
    
    // Check if user is admin or has permission
    const isAdmin = currentUser?.is_admin === true;
    const hasPermission = currentUser?.permissions?.can_manage_users === true;
    
    console.log('  isAdmin:', isAdmin, '| hasPermission:', hasPermission);
    
    if (!isAdmin && !hasPermission) {
        console.warn('⛔ User lacks permission to manage users');
        showError('You do not have permission to manage users');
        return;
    }
    
    console.log('✅ Permission granted, opening modal');
    document.getElementById('addUserModal').style.display = 'flex';
    
    // Reset form
    document.getElementById('addUserForm').reset();
    document.getElementById('role').value = '';
    updatePermissions();
}

function closeAddUserModal() {
    closeModal('addUserModal');
}

// Update permissions based on role
function updatePermissions() {
    const roleSelect = document.getElementById('new_role');
    const role = roleSelect ? roleSelect.value : '';
    
    // Default permissions for each role
    const defaultPermissions = {
        admin: {
            perm_view_leads: true,
            perm_create_leads: true,
            perm_edit_leads: true,
            perm_delete_leads: true,
            perm_view_users: true,
            perm_manage_users: true,
            perm_view_reports: true,
            perm_export_data: true
        },
        manager: {
            perm_view_leads: true,
            perm_create_leads: true,
            perm_edit_leads: true,
            perm_delete_leads: false,
            perm_view_users: true,
            perm_manage_users: false,
            perm_view_reports: true,
            perm_export_data: true
        },
        sales: {
            perm_view_leads: true,
            perm_create_leads: true,
            perm_edit_leads: true,
            perm_delete_leads: false,
            perm_view_users: false,
            perm_manage_users: false,
            perm_view_reports: true,
            perm_export_data: true
        },
        viewer: {
            perm_view_leads: true,
            perm_create_leads: false,
            perm_edit_leads: false,
            perm_delete_leads: false,
            perm_view_users: false,
            perm_manage_users: false,
            perm_view_reports: true,
            perm_export_data: false
        }
    };
    
    if (role && defaultPermissions[role]) {
        const permissions = defaultPermissions[role];
        
        // Update checkboxes
        Object.keys(permissions).forEach(permission => {
            const checkbox = document.getElementById(permission);
            if (checkbox) {
                checkbox.checked = permissions[permission];
                
                // Disable checkboxes for viewer role
                if (role === 'viewer') {
                    checkbox.disabled = true;
                } else {
                    checkbox.disabled = false;
                }
            }
        });
    } else {
        // Reset all checkboxes to default (mostly true except user/ delete)
        const checkboxes = document.querySelectorAll('#permissionsGrid input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
            checkbox.disabled = false;
        });
        document.getElementById('perm_view_leads').checked = true;
        document.getElementById('perm_create_leads').checked = true;
        document.getElementById('perm_edit_leads').checked = true;
        document.getElementById('perm_view_reports').checked = true;
        document.getElementById('perm_export_data').checked = true;
    }
}

// Create user
async function createUser() {
    const form = document.getElementById('addUserForm');
    
    // Validate form
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    // Get form data
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    // Validate password
    if (data.password !== data.confirm_password) {
        showError('Passwords do not match');
        return;
    }
    
    if (data.password.length < 8) {
        showError('Password must be at least 8 characters long');
        return;
    }
    
    // Get permissions
    const permissions = {};
    const checkboxes = document.querySelectorAll('#permissionsSection input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        permissions[checkbox.name] = checkbox.checked;
    });
    
    // Prepare user data
    const userData = {
        username: data.username,
        password: data.password,
        full_name: data.full_name,
        email: data.email,
        role: data.role,
        permissions: permissions
    };
    
    try {
        showLoading(true);
        
        const token = localStorage.getItem('token');
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('User created successfully');
            closeModal('addUserModal');
            
            // Refresh users data
            await loadUsersData();
        } else {
            throw new Error(result.detail || 'Failed to create user');
        }
    } catch (error) {
        console.error('Error creating user:', error);
        showError(`Failed to create user: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

// View user
async function viewUser(userId) {
    try {
        const user = allUsers.find(u => u.id == userId);
        if (!user) {
            showError('User not found');
            return;
        }

        const permissions = JSON.parse(user.permissions || '{}');
        const isActive = user.is_active === 1 || user.is_active === true;
        const createdDate = formatDate(user.created_at);
        const dob = user.date_of_birth ? formatDate(user.date_of_birth) : 'N/A';
        const designation = user.designation || 'N/A';
        const mobile = user.mobile_no || 'N/A';
        const photo = renderUserPhoto(user);

        const html = `
            <div class="user-detail-wrapper">
                <div class="user-detail-header">
                    <div class="user-photo-large">${photo}</div>
                    <div class="user-ident">
                        <h3>${escapeHtml(user.full_name || '')}</h3>
                        <p class="muted">@${escapeHtml(user.username || '')} • ${escapeHtml(user.email || '')}</p>
                        <div class="chips">
                            <span class="role-badge ${user.role}">${formatRoleName(user.role)}</span>
                            <span class="status-badge ${isActive ? 'active' : 'inactive'}">${isActive ? 'Active' : 'Inactive'}</span>
                        </div>
                    </div>
                </div>

                <div class="user-detail-grid">
                    <div class="detail-card">
                        <h4>Profile</h4>
                        <div class="detail-row"><label>Designation</label><span>${escapeHtml(designation)}</span></div>
                        <div class="detail-row"><label>Mobile</label><span>${escapeHtml(mobile)}</span></div>
                        <div class="detail-row"><label>DOB</label><span>${dob}</span></div>
                    </div>
                    <div class="detail-card">
                        <h4>System</h4>
                        <div class="detail-row"><label>Created By</label><span>${escapeHtml(user.created_by_name || 'System')}</span></div>
                        <div class="detail-row"><label>Created At</label><span>${createdDate}</span></div>
                    </div>
                </div>

                <div class="permissions-section">
                    <h4>Permissions</h4>
                    <div class="permissions-grid">
                        ${Object.entries(permissions).map(([perm, value]) => `
                            <div class="permission-item">
                                <span class="permission-check ${value ? 'granted' : 'denied'}">${value ? '✓' : '✗'}</span>
                                <span class="permission-name">${formatPermissionName(perm)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="modal-actions">
                    <button class="btn ghost" onclick="closeModal('viewUserModal')">Close</button>
                    ${user.id !== currentUser.user_id ? `<button class="btn primary" onclick="editUser(${user.id})"><i class="fas fa-edit"></i> Edit User</button>` : ''}
                </div>
            </div>
        `;

        document.getElementById('viewUserContent').innerHTML = html;
        document.getElementById('viewUserModal').style.display = 'flex';
    } catch (error) {
        console.error('Error loading user details:', error);
        showError('Failed to load user details');
    }
}

// Edit user
async function editUser(userId) {
    try {
        const user = allUsers.find(u => u.id == userId);
        if (!user) {
            showError('User not found');
            return;
        }
        if (user.id === currentUser.user_id) {
            showError('You cannot edit your own account from here');
            return;
        }

        document.getElementById('edit_user_id').value = user.id;
        document.getElementById('edit_username').value = user.username || '';
        document.getElementById('edit_password').value = '';
        document.getElementById('edit_first_name').value = user.first_name || '';
        document.getElementById('edit_last_name').value = user.last_name || '';
        document.getElementById('edit_full_name').value = user.full_name || '';
        document.getElementById('edit_email').value = user.email || '';
        document.getElementById('edit_designation').value = user.designation || '';
        document.getElementById('edit_mobile_no').value = user.mobile_no || '';
        document.getElementById('edit_date_of_birth').value = user.date_of_birth || '';
        document.getElementById('edit_role').value = user.role || '';

        document.getElementById('editUserModal').style.display = 'flex';
    } catch (error) {
        console.error('Error loading user for editing:', error);
        showError('Failed to load user for editing');
    }
}

// Update edit permissions
function updateEditPermissions() {
    const role = document.getElementById('editRole').value;
    
    // Default permissions for each role
    const defaultPermissions = {
        admin: {
            can_view_leads: true,
            can_create_leads: true,
            can_edit_leads: true,
            can_delete_leads: true,
            can_view_users: true,
            can_manage_users: true,
            can_view_reports: true,
            can_export_data: true
        },
        manager: {
            can_view_leads: true,
            can_create_leads: true,
            can_edit_leads: true,
            can_delete_leads: false,
            can_view_users: true,
            can_manage_users: false,
            can_view_reports: true,
            can_export_data: true
        },
        sales: {
            can_view_leads: true,
            can_create_leads: true,
            can_edit_leads: true,
            can_delete_leads: false,
            can_view_users: false,
            can_manage_users: false,
            can_view_reports: true,
            can_export_data: true
        },
        viewer: {
            can_view_leads: true,
            can_create_leads: false,
            can_edit_leads: false,
            can_delete_leads: false,
            can_view_users: false,
            can_manage_users: false,
            can_view_reports: true,
            can_export_data: false
        }
    };
    
    if (role && defaultPermissions[role]) {
        const permissions = defaultPermissions[role];
        
        // Update checkboxes
        Object.keys(permissions).forEach(permission => {
            const checkbox = document.getElementById(`edit_${permission}`);
            if (checkbox) {
                checkbox.checked = permissions[permission];
                
                // Disable checkboxes for viewer role
                if (role === 'viewer') {
                    checkbox.disabled = true;
                } else {
                    checkbox.disabled = false;
                }
            }
        });
    }
}

// Update user
async function updateUser(userId) {
    const form = document.getElementById('editUserForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const updateData = {
        first_name: document.getElementById('edit_first_name').value,
        last_name: document.getElementById('edit_last_name').value,
        full_name: document.getElementById('edit_full_name').value,
        email: document.getElementById('edit_email').value,
        designation: document.getElementById('edit_designation').value || null,
        mobile_no: document.getElementById('edit_mobile_no').value || null,
        date_of_birth: document.getElementById('edit_date_of_birth').value || null,
        role: document.getElementById('edit_role').value
    };
    const pwd = document.getElementById('edit_password').value;
    if (pwd) updateData.password = pwd;
    
    try {
        showLoading(true);
        
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Basic ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('User updated successfully');
            closeModal('editUserModal');
            
            // Refresh users data
            await loadUsersData();
        } else {
            throw new Error(result.detail || 'Failed to update user');
        }
    } catch (error) {
        console.error('Error updating user:', error);
        showError(`Failed to update user: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

// Delete user
async function deleteUser(userId) {
    const user = allUsers.find(u => u.id == userId);
    if (!user) return;
    
    if (user.id === currentUser.user_id) {
        showError('You cannot delete your own account');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete user "${user.full_name}"? This action cannot be undone.`)) {
        return;
    }
    
    try {
        showLoading(true);
        
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Basic ${token}`
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('User deleted successfully');
            
            // Refresh users data
            await loadUsersData();
            
            // Close modals if open
            closeModal('viewUserModal');
            closeModal('editUserModal');
        } else {
            throw new Error(result.detail || 'Failed to delete user');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showError(`Failed to delete user: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

// Export users
function exportUsers() {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams();
    
    // Add current filters to export
    const roleFilter = document.getElementById('roleFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const searchQuery = document.getElementById('searchInput').value;
    
    if (roleFilter) params.append('role', roleFilter);
    if (statusFilter) params.append('status', statusFilter);
    if (searchQuery) params.append('search', searchQuery);
    
    // Trigger download
    window.open(`/api/export/users?${params.toString()}`, '_blank');
}

// Handle add user form submit
async function handleAddUserSubmit(e) {
    e.preventDefault();

    const submitBtn = e.submitter || e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : null;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
    }

    try {
        const permissions = {
            can_view_leads: document.getElementById('perm_view_leads')?.checked || false,
            can_create_leads: document.getElementById('perm_create_leads')?.checked || false,
            can_edit_leads: document.getElementById('perm_edit_leads')?.checked || false,
            can_delete_leads: document.getElementById('perm_delete_leads')?.checked || false,
            can_view_users: document.getElementById('perm_view_users')?.checked || false,
            can_manage_users: document.getElementById('perm_manage_users')?.checked || false,
            can_view_reports: document.getElementById('perm_view_reports')?.checked || false,
            can_export_data: document.getElementById('perm_export_data')?.checked || false
        };

        // Upload photo first if provided
        let photoPath = null;
        const photoInput = document.getElementById('new_photo');
        if (photoInput && photoInput.files && photoInput.files[0]) {
            const fd = new FormData();
            fd.append('file', photoInput.files[0]);
            const uploadResp = await fetch('/api/upload/photo', { method: 'POST', body: fd });
            const uploadData = await uploadResp.json();
            if (uploadResp.ok && uploadData.success) {
                photoPath = uploadData.path;
            } else {
                throw new Error(uploadData.detail || 'Photo upload failed');
            }
        }

        const userData = {
            username: document.getElementById('new_username')?.value || '',
            password: document.getElementById('new_password')?.value || '',
            first_name: document.getElementById('new_first_name')?.value || '',
            last_name: document.getElementById('new_last_name')?.value || '',
            full_name: document.getElementById('new_full_name')?.value || '',
            email: document.getElementById('new_email')?.value || '',
            designation: document.getElementById('new_designation')?.value || null,
            mobile_no: document.getElementById('new_mobile_no')?.value || null,
            date_of_birth: document.getElementById('new_date_of_birth')?.value || null,
            photo: photoPath,
            role: document.getElementById('new_role')?.value || '',
            permissions: permissions
        };

        const response = await fetch('/api/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });

        const data = await response.json();
        if (data.success) {
            showSuccess('User created successfully');
            closeAddUserModal();
            await loadUsersData();
        } else {
            throw new Error(data.detail || 'Failed to create user');
        }
    } catch (error) {
        console.error('Error creating user:', error);
        showError(error.message || 'Failed to create user');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText || 'Create User';
        }
    }
}

// Auto-compose full name for add user form
function updateFullNameFromParts() {
    const first = (document.getElementById('new_first_name')?.value || '').trim();
    const last = (document.getElementById('new_last_name')?.value || '').trim();
    const target = document.getElementById('new_full_name');
    if (!target) return;

    const combined = [first, last].filter(Boolean).join(' ');
    target.value = combined;
}

// Load designations for dropdowns
async function loadDesignations() {
    try {
        const response = await fetch('/api/designations', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.success) {
            allDesignations = data.designations || [];
            populateDesignationSelects();
        }
    } catch (error) {
        console.error('Error loading designations:', error);
    }
}

function populateDesignationSelects() {
    const options = ['<option value="">Select designation</option>']
        .concat(allDesignations.map(des => `<option value="${des.name}">${des.name}</option>`))
        .join('');

    const newSelect = document.getElementById('new_designation');
    const editSelect = document.getElementById('edit_designation');

    if (newSelect) newSelect.innerHTML = options;
    if (editSelect) editSelect.innerHTML = options;
}

function openAddDesignationModal() {
    const form = document.getElementById('addDesignationForm');
    if (form) form.reset();
    const modal = document.getElementById('addDesignationModal');
    if (modal) modal.style.display = 'flex';
}

function closeAddDesignationModal() {
    closeModal('addDesignationModal');
}

async function handleAddDesignationSubmit(e) {
    e.preventDefault();
    const submitBtn = e.submitter || e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : null;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
    }

    try {
        const name = document.getElementById('designation_name').value;
        const response = await fetch('/api/designations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name })
        });

        const data = await response.json();
        if (data.success) {
            showSuccess('Designation added successfully');
            await loadDesignations();
            closeAddDesignationModal();
        } else {
            throw new Error(data.detail || 'Failed to add designation');
        }
    } catch (error) {
        console.error('Error adding designation:', error);
        showError(error.message || 'Failed to add designation');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText || 'Add Designation';
        }
    }
}

// Helper functions
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function getInitials(name) {
    return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

function formatRoleName(role) {
    const roleNames = {
        'admin': 'Administrator',
        'manager': 'Manager',
        'sales': 'Sales Executive',
        'viewer': 'Viewer'
    };
    return roleNames[role] || role;
}

function formatPermissionName(permission) {
    return permission
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}

function getPhotoUrl(photo) {
    if (!photo) return '';
    let p = String(photo).trim();
    // Normalize Windows paths
    p = p.replace(/\\/g, '/');
    // Absolute HTTP
    if (p.startsWith('http://') || p.startsWith('https://')) return p;
    // Already web-rooted
    if (p.startsWith('/')) return p;
    // If path contains static folder somewhere, serve from there
    const idx = p.toLowerCase().indexOf('static/');
    if (idx !== -1) {
        return '/' + p.slice(idx);
    }
    // Common upload dirs
    if (p.startsWith('uploads/') || p.startsWith('images/') || p.startsWith('user_photos/') || p.startsWith('users/')) {
        return `/static/${p}`;
    }
    // Default assume inside static root
    return `/static/${p}`;
}

function renderUserPhoto(user) {
    const url = getPhotoUrl(user.photo || '');
    const label = escapeHtml(user.full_name || user.username || 'User');
    if (url) {
        return `<a href="${escapeHtml(url)}" target="_blank" title="View photo"><img class="user-photo-thumb" src="${escapeHtml(url)}" alt="${label}"></a>`;
    }
    return `<div class="user-photo-fallback" title="No photo">${getInitials(user.full_name || user.username || 'U')}</div>`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showLoading(show) {
    const loading = document.getElementById('loading') || createLoadingElement();
    loading.style.display = show ? 'flex' : 'none';
}

function createLoadingElement() {
    const loading = document.createElement('div');
    loading.id = 'loading';
    loading.className = 'loading-overlay';
    loading.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner"></div>
            <p>Loading...</p>
        </div>
    `;
    document.body.appendChild(loading);
    return loading;
}

function showSuccess(message) {
    const toast = document.createElement('div');
    toast.className = 'toast success';
    toast.innerHTML = `
        <span class="toast-icon">✅</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 3000);
}

function showError(message) {
    const toast = document.createElement('div');
    toast.className = 'toast error';
    toast.innerHTML = `
        <span class="toast-icon">❌</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 5000);
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Specific helper for edit modal (used by template buttons)
function closeEditUserModal() {
    closeModal('editUserModal');
}

function logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/';
}

// Close modals when clicking outside
window.addEventListener('click', function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
});

// Add loading styles
const loadingStyles = document.createElement('style');
loadingStyles.textContent = `
    .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.9);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 9999;
    }
    
    .loading-spinner {
        text-align: center;
    }
    
    .spinner {
        width: 50px;
        height: 50px;
        border: 5px solid #f3f3f3;
        border-top: 5px solid #007bff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 15px;
    }
    
    .empty-state {
        text-align: center;
        padding: 40px 20px;
    }
    
    .empty-icon {
        font-size: 48px;
        margin-bottom: 15px;
        opacity: 0.5;
    }
    
    .empty-state h4 {
        margin-bottom: 10px;
        color: #4a5568;
    }
    
    .empty-state p {
        color: #718096;
        margin-bottom: 20px;
    }
    
    .permission-check {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        margin-right: 10px;
    }
    
    .permission-check.granted {
        background: #c6f6d5;
        color: #22543d;
    }
    
    .permission-check.denied {
        background: #fed7d7;
        color: #742a2a;
    }
    
    .toast {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 9999;
        animation: slideIn 0.3s ease;
        max-width: 350px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    }
    
    .toast.success {
        background: #38a169;
        color: white;
        border-left: 4px solid #2f855a;
    }
    
    .toast.error {
        background: #e53e3e;
        color: white;
        border-left: 4px solid #c53030;
    }
    
    .toast-icon {
        font-size: 20px;
    }
    
    .toast-message {
        flex: 1;
        font-size: 14px;
    }
    
    .toast-close {
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
    }
    
    .toast-close:hover {
        background: rgba(255,255,255,0.2);
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(loadingStyles);