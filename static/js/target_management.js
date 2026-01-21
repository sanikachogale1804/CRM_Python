/**
 * Target Management JavaScript
 * Handle target creation, tracking, and performance monitoring
 */

// Global variables
let currentView = 'grid';
let currentEditTarget = null;
let allTargets = [];
let allUsers = [];
let customPeriods = [];
let leadSettingsCache = {};

const TARGET_TAB_OPTIONS = [
    { key: 'sources', label: 'Lead Sources' },
    { key: 'statuses', label: 'Lead Statuses' },
    { key: 'types', label: 'Sales Types' },
    { key: 'systems', label: 'Systems' },
    { key: 'project_amc', label: 'Project / AMC' },
    { key: 'communication_method', label: 'Method of Communication' }
];

function getUserDisplayName(user) {
    if (!user) return 'Unassigned';
    return user.full_name || user.name || user.username || 'Unassigned';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Target Management page initializing...');
    
    // Load custom periods
    loadCustomPeriods();
    
    // Load data immediately without checking auth
    // (auth is already handled by backend route)
    await loadUsers();
    await loadLeadSettings();
    await loadTargets();
    
    // Setup form
    setupForm();
    setupCustomPeriodForm();
    populateTargetTabDropdown();
    
    console.log('Target Management page initialized successfully');
});

/**
 * Check authentication
 */
async function checkAuthentication() {
    try {
        const response = await fetch('/api/user', {
            credentials: 'include',
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
            }
            throw new Error('Auth check failed');
        }
        
        const data = await response.json();
        console.log('User authenticated:', data);
        return data;
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/login';
    }
}

/**
 * Load all users
 */
async function loadUsers() {
    try {
        const response = await fetch('/api/users', {
            credentials: 'include'
        });
        if (response.ok) {
            const data = await response.json();
            allUsers = data.users || [];
            populateUserSelects();
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

/**
 * Load lead settings (for Target Name dropdown options)
 */
async function loadLeadSettings() {
    try {
        if (window.LeadSettingsManager) {
            const settings = await window.LeadSettingsManager.loadSettings();
            leadSettingsCache = {
                sources: window.LeadSettingsManager.getActiveSettings('sources'),
                statuses: window.LeadSettingsManager.getActiveSettings('statuses'),
                types: window.LeadSettingsManager.getActiveSettings('types'),
                systems: window.LeadSettingsManager.getActiveSettings('systems'),
                project_amc: window.LeadSettingsManager.getActiveSettings('project_amc'),
                communication_method: window.LeadSettingsManager.getActiveSettings('communication_method'),
                industries: (settings?.industries || window.LeadSettingsManager.getActiveSettings('industries') || []).map(ind => ({
                    ...ind,
                    subIndustries: ind.subIndustries || []
                }))
            };
        } else {
            // Fallback to localStorage
            const keys = ['sources','statuses','types','systems','project_amc','communication_method','industries'];
            keys.forEach(k => {
                leadSettingsCache[k] = JSON.parse(localStorage.getItem(`lead_settings_${k}`) || '[]');
            });
        }

        // Additional fallback: fetch directly from API if cache is empty
        const totalItems = Object.values(leadSettingsCache).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0);
        if (totalItems === 0) {
            const resp = await fetch('/api/settings/lead-settings', { credentials: 'include' });
            if (resp.ok) {
                const data = await resp.json();
                if (data.settings) {
                    const s = data.settings;
                    leadSettingsCache = {
                        sources: s.sources || [],
                        statuses: s.statuses || [],
                        types: s.types || [],
                        systems: s.systems || [],
                        project_amc: s.project_amc || [],
                        communication_method: s.communication_method || [],
                        industries: (s.industries || []).map(ind => ({
                            ...ind,
                            subIndustries: ind.subIndustries || []
                        }))
                    };
                }
            }
        }
    } catch (err) {
        console.warn('Lead settings load failed, using localStorage fallback', err);
        const keys = ['sources','statuses','types','systems','project_amc','communication_method','industries'];
        keys.forEach(k => {
            leadSettingsCache[k] = JSON.parse(localStorage.getItem(`lead_settings_${k}`) || '[]');
        });
    }
}

function populateTargetTabDropdown() {
    const tabSelect = document.getElementById('target-tab');
    if (!tabSelect) return;
    const current = tabSelect.value;
    tabSelect.innerHTML = '<option value="">Select Tab</option>';
    TARGET_TAB_OPTIONS.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.key;
        option.textContent = opt.label;
        tabSelect.appendChild(option);
    });
    tabSelect.value = current;
}

function populateTargetNameDropdown(tabKey, preselect = '') {
    const nameSelect = document.getElementById('target-name');
    if (!nameSelect) return;
    nameSelect.innerHTML = '';
    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = tabKey ? 'Select Option' : 'Select a tab first';
    nameSelect.appendChild(ph);
    if (!tabKey) {
        nameSelect.disabled = true;
        nameSelect.value = '';
        return;
    }
    let items = (leadSettingsCache[tabKey] || []).filter(i => i.active !== false);

    // Special case: industries -> flatten to use industry names
    if (tabKey === 'industries') {
        items = items.map(i => ({ name: i.name, active: i.active !== false }));
    }

    // If empty, try to re-load settings once (handles 403/empty cache)
    if (items.length === 0) {
        try {
            // attempt reload from localStorage directly
            const raw = localStorage.getItem(`lead_settings_${tabKey}`);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    items = parsed.filter(i => i.active !== false);
                }
            }
        } catch (err) {
            console.warn('Fallback load for tab failed', err);
        }
    }
    items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.name;
        opt.textContent = item.name;
        nameSelect.appendChild(opt);
    });
    nameSelect.disabled = items.length === 0;
    if (items.length === 0) {
        const noOpt = document.createElement('option');
        noOpt.value = '';
        noOpt.textContent = 'No options configured';
        noOpt.disabled = true;
        nameSelect.appendChild(noOpt);
        return;
    }
    if (preselect && Array.from(nameSelect.options).some(o => o.value === preselect)) {
        nameSelect.value = preselect;
    } else {
        nameSelect.value = '';
    }
}

/**
 * Populate user dropdowns
 */
function populateUserSelects() {
    const userSelects = ['filter-user', 'target-user'];
    userSelects.forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Select User</option>';
            allUsers.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = getUserDisplayName(user);
                select.appendChild(option);
            });
            select.value = currentValue;
        }
    });
}

/**
 * Load targets from localStorage
 */
async function loadTargets() {
    try {
        // Try to load from API first
        const response = await fetch('/api/targets', {
            credentials: 'include',
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.targets && data.targets.length > 0) {
                // Normalize field names from snake_case to camelCase
                allTargets = data.targets.map(t => ({
                    id: t.id,
                    name: t.name,
                    contextTab: t.context_tab || t.contextTab || null,
                    type: t.type,
                    targetValue: t.target_value || t.targetValue,
                    currentValue: t.current_value || t.currentValue || 0,
                    assignedTo: t.assigned_to || t.assignedTo,
                    period: t.period,
                    description: t.description || '',
                    active: t.is_active || t.active,
                    createdAt: t.created_at || t.createdAt,
                    updatedAt: t.updated_at || t.updatedAt
                }));
                
                // Validate IDs - ensure they are proper database IDs (not timestamps)
                allTargets = allTargets.filter(t => {
                    const isValidId = t.id && t.id < 1000000000; // Database IDs are small integers
                    if (!isValidId) {
                        console.warn(`Filtering out target with invalid ID: ${t.id}`);
                    }
                    return isValidId;
                });
                
                // Also save to localStorage for offline access
                localStorage.setItem('targets', JSON.stringify(allTargets));
                renderTargets();
                updateSummaryCards();
                return;
            }
        }
    } catch (error) {
        console.warn('Failed to load targets from API, using localStorage:', error);
    }
    
    // Fallback to localStorage ONLY if API completely fails
    const saved = localStorage.getItem('targets');
    if (saved) {
        try {
            allTargets = JSON.parse(saved);
            // Filter out invalid timestamp-based IDs from localStorage
            allTargets = allTargets.filter(t => t.id && t.id < 1000000000);
        } catch (e) {
            allTargets = [];
        }
    } else {
        allTargets = [];
    }
    renderTargets();
    updateSummaryCards();
}

function saveTargets() {
    localStorage.setItem('targets', JSON.stringify(allTargets));
}

/**
 * Get default targets
 */
function getDefaultTargets() {
    return [
        {
            id: 1,
            name: 'Q1 2025 Revenue Target',
            type: 'revenue',
            targetValue: 500000,
            currentValue: 375000,
            assignedTo: 1,
            period: '2025-Q1',
            description: 'Target revenue for Q1 2025',
            active: true,
            createdAt: new Date().toISOString()
        },
        {
            id: 2,
            name: 'Q1 2025 Deals Target - John',
            type: 'deals',
            targetValue: 20,
            currentValue: 15,
            assignedTo: 2,
            period: '2025-Q1',
            description: 'Number of deals to close in Q1',
            active: true,
            createdAt: new Date().toISOString()
        },
        {
            id: 3,
            name: 'Conversion Rate Q1 2025',
            type: 'conversion',
            targetValue: 25,
            currentValue: 22,
            assignedTo: 3,
            period: '2025-Q1',
            description: 'Target conversion rate percentage',
            active: true,
            createdAt: new Date().toISOString()
        }
    ];
}

/**
 * Render targets based on current view
 */
function renderTargets() {
    const filteredTargets = applyFilters();
    
    if (filteredTargets.length === 0) {
        document.getElementById('targets-grid').style.display = 'none';
        document.getElementById('targets-list').style.display = 'none';
        document.getElementById('no-targets').style.display = 'block';
        return;
    }
    
    document.getElementById('no-targets').style.display = 'none';
    
    if (currentView === 'grid') {
        document.getElementById('targets-grid').style.display = 'grid';
        document.getElementById('targets-list').style.display = 'none';
        renderGridView(filteredTargets);
    } else {
        document.getElementById('targets-grid').style.display = 'none';
        document.getElementById('targets-list').style.display = 'flex';
        renderListView(filteredTargets);
    }
}

/**
 * Render grid view
 */
function renderGridView(targets) {
    const grid = document.getElementById('targets-grid');
    grid.innerHTML = targets.map(target => createTargetCard(target)).join('');
}

/**
 * Render list view
 */
function renderListView(targets) {
    const list = document.getElementById('targets-list');
    list.innerHTML = targets.map(target => createTargetListItem(target)).join('');
}

/**
 * Create target card HTML
 */
function createTargetCard(target) {
    const percentage = Math.min((target.currentValue / target.targetValue) * 100, 100);
    const status = getTargetStatus(target);
    const user = allUsers.find(u => u.id === target.assignedTo);
    const userName = getUserDisplayName(user);
    
    return `
        <div class="target-card" onclick="openDetailsModal(${target.id})">
            <div class="target-card-header">
                <h3>
                    <i class="fas fa-bullseye"></i>
                    ${target.name}
                </h3>
                <span class="target-type-badge">${getTargetTypeLabel(target.type)}</span>
            </div>
            <div class="target-card-body">
                <div class="target-status status-${status}">
                    ${getStatusLabel(status)}
                </div>
                
                <div class="target-info">
                    <span class="info-label">Assigned To</span>
                    <span class="info-value">${userName}</span>
                </div>
                
                <div class="target-info">
                    <span class="info-label">Period</span>
                    <span class="info-value">${target.period}</span>
                </div>
                
                <div class="target-progress">
                    <span class="info-label">Progress</span>
                    <div class="progress-bar">
                        <div class="progress-fill ${getProgressClass(percentage)}" style="width: ${percentage}%"></div>
                    </div>
                    <div class="progress-percentage">
                        ${target.currentValue.toLocaleString()} / ${target.targetValue.toLocaleString()} ${getTargetUnit(target.type)} (${percentage.toFixed(1)}%)
                    </div>
                </div>
            </div>
            <div class="target-card-footer">
                <button onclick="refreshTargetProgress(event, ${target.id})" title="Recalculate from lead history">
                    <i class="fas fa-sync-alt"></i> Refresh
                </button>
                <button onclick="editTarget(event, ${target.id})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button onclick="deleteTarget(event, ${target.id})">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `;
}

/**
 * Create target list item HTML
 */
function createTargetListItem(target) {
    const percentage = Math.min((target.currentValue / target.targetValue) * 100, 100);
    const status = getTargetStatus(target);
    const user = allUsers.find(u => u.id === target.assignedTo);
    const userName = getUserDisplayName(user);
    
    return `
        <div class="target-list-item" onclick="openDetailsModal(${target.id})">
            <div class="list-item-icon">
                <i class="fas fa-bullseye"></i>
            </div>
            <div class="list-item-content">
                <div class="list-item-name">${target.name}</div>
                <div class="list-item-meta">
                    <span><strong>${getTargetTypeLabel(target.type)}</strong></span>
                    <span>Assigned to: ${userName}</span>
                    <span>Period: ${target.period}</span>
                    <span class="status-${status}"><strong>${getStatusLabel(status)}</strong></span>
                </div>
            </div>
            <div class="list-item-progress">
                <div class="small-progress-bar">
                    <div class="small-progress-fill" style="width: ${percentage}%"></div>
                </div>
                <div class="list-item-percentage">${percentage.toFixed(1)}%</div>
            </div>
            <div class="list-item-actions">
                <button onclick="editTarget(event, ${target.id})">Edit</button>
                <button onclick="deleteTarget(event, ${target.id})">Delete</button>
            </div>
        </div>
    `;
}

/**
 * Get target status
 */
function getTargetStatus(target) {
    const percentage = (target.currentValue / target.targetValue) * 100;
    if (percentage >= 100) return 'exceeded';
    if (percentage >= 75) return 'active';
    if (percentage >= 50) return 'at-risk';
    return 'at-risk';
}

/**
 * Get status label
 */
function getStatusLabel(status) {
    const labels = {
        'active': '✓ On Track',
        'completed': '✓ Completed',
        'at-risk': '⚠ At Risk',
        'exceeded': '🏆 Exceeded'
    };
    return labels[status] || status;
}

/**
 * Get progress class
 */
function getProgressClass(percentage) {
    if (percentage >= 100) return '';
    if (percentage >= 75) return '';
    if (percentage >= 50) return 'warning';
    return 'danger';
}

/**
 * Get target type label
 */
function getTargetTypeLabel(type) {
    const labels = {
        'revenue': 'Revenue',
        'units': 'Units',
        'conversion': 'Conversion',
        'deals': 'Deals'
    };
    return labels[type] || type;
}

/**
 * Get target unit
 */
function getTargetUnit(type) {
    const units = {
        'revenue': '₹',
        'units': 'Units',
        'conversion': '%',
        'deals': 'Deals'
    };
    return units[type] || '';
}

/**
 * Update target unit display
 */
function updateTargetUnit() {
    const type = document.getElementById('target-type').value;
    document.getElementById('target-unit-display').textContent = getTargetUnit(type);
}

/**
 * Update summary cards
 */
function updateSummaryCards() {
    const activeTargets = allTargets.filter(t => t.active);
    let onTrack = 0, atRisk = 0, exceeded = 0;
    
    activeTargets.forEach(target => {
        const percentage = (target.currentValue / target.targetValue) * 100;
        if (percentage >= 100) exceeded++;
        else if (percentage >= 75) onTrack++;
        else atRisk++;
    });
    
    document.getElementById('total-targets').textContent = activeTargets.length;
    document.getElementById('on-track-count').textContent = onTrack;
    document.getElementById('at-risk-count').textContent = atRisk;
    document.getElementById('exceeded-count').textContent = exceeded;
}

/**
 * Apply filters
 */
function applyFilters() {
    const typeFilter = document.getElementById('filter-type').value;
    const userFilter = document.getElementById('filter-user').value;
    const periodFilter = document.getElementById('filter-period').value;
    const statusFilter = document.getElementById('filter-status').value;
    
    let filtered = allTargets;
    
    if (typeFilter) filtered = filtered.filter(t => t.type === typeFilter);
    if (userFilter) filtered = filtered.filter(t => t.assignedTo == userFilter);
    if (periodFilter) filtered = filtered.filter(t => t.period === periodFilter);
    
    if (statusFilter) {
        filtered = filtered.filter(t => {
            const status = getTargetStatus(t);
            return status === statusFilter;
        });
    }
    
    filtered = filtered.filter(t => t.active);
    return filtered;
}

/**
 * Switch view
 */
function switchView(view) {
    currentView = view;
    
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    if (view === 'grid') {
        document.querySelector('[onclick="switchView(\'grid\')"]').classList.add('active');
    } else {
        document.querySelector('[onclick="switchView(\'list\')"]').classList.add('active');
    }
    
    renderTargets();
}

/**
 * Setup form
 

/**
 * Load custom periods from localStorage
 */
function loadCustomPeriods() {
    const saved = localStorage.getItem('custom_periods');
    customPeriods = saved ? JSON.parse(saved) : [];
    updatePeriodDropdown();
}

/**
 * Save custom periods to localStorage
 */
function saveCustomPeriods() {
    localStorage.setItem('custom_periods', JSON.stringify(customPeriods));
}

/**
 * Update period dropdown with custom periods
 */
function updatePeriodDropdown() {
    const select = document.getElementById('target-period');
    if (!select) return;
    
    const currentValue = select.value;
    
    // Remove existing custom optgroup
    const existingOptgroup = select.querySelector('optgroup[label="Custom Periods"]');
    if (existingOptgroup) {
        existingOptgroup.remove();
    }
    
    // Add custom periods if any exist
    if (customPeriods.length > 0) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = 'Custom Periods';
        
        customPeriods.forEach(period => {
            const option = document.createElement('option');
            option.value = period.value;
            option.textContent = period.name;
            optgroup.appendChild(option);
        });
        
        select.appendChild(optgroup);
    }
    
    select.value = currentValue;
}

/**
 * Setup custom period form
 */
function setupCustomPeriodForm() {
    const form = document.getElementById('customPeriodForm');
    if (form) {
        form.addEventListener('submit', saveCustomPeriod);
    }
}

/**
 * Open custom period modal
 */
function openCustomPeriodModal() {
    document.getElementById('customPeriodForm').reset();
    document.getElementById('customPeriodModal').classList.add('show');
}

/**
 * Close custom period modal
 */
function closeCustomPeriodModal() {
    document.getElementById('customPeriodModal').classList.remove('show');
}

/**
 * Save custom period
 */
function saveCustomPeriod(e) {
    e.preventDefault();
    
    const name = document.getElementById('custom-period-name').value;
    const value = document.getElementById('custom-period-value').value;
    const desc = document.getElementById('custom-period-desc').value;
    
    // Check if value already exists
    if (customPeriods.some(p => p.value === value)) {
        alert('Period value already exists!');
        return;
    }
    
    const period = {
        id: Date.now(),
        name: name,
        value: value,
        description: desc,
        createdAt: new Date().toISOString()
    };
    
    customPeriods.push(period);
    saveCustomPeriods();
    updatePeriodDropdown();
    
    // Set the newly added period as selected
    document.getElementById('target-period').value = value;
    
    closeCustomPeriodModal();
    
    // Show success message
    alert(`Period "${name}" added successfully!`);
}

/**
 * Setup form
 */
function setupForm() {
    console.log('Setting up target form...');
    const form = document.getElementById('targetForm');
    if (!form) {
        console.error('targetForm element not found!');
        return;
    }
    form.addEventListener('submit', saveTarget);

    const tabSelect = document.getElementById('target-tab');
    const nameSelect = document.getElementById('target-name');
    if (tabSelect) {
        tabSelect.addEventListener('change', () => {
            populateTargetNameDropdown(tabSelect.value);
        });
    }
    // Trigger initial population if tab already selected (e.g., edit mode)
    if (tabSelect && tabSelect.value) {
        populateTargetNameDropdown(tabSelect.value);
    }
    if (nameSelect) {
        nameSelect.addEventListener('change', () => {
            // no-op: placeholder if future logic needed
        });
    }
    console.log('Target form setup complete');
}

/**
 * Open add target modal
 */
function openAddTargetModal() {
    console.log('openAddTargetModal called');
    try {
        currentEditTarget = null;
        const modal = document.getElementById('targetModal');
        const form = document.getElementById('targetForm');
        
        if (!modal) {
            console.error('targetModal element not found');
            return;
        }
        
        if (!form) {
            console.error('targetForm element not found');
            return;
        }
        
        document.getElementById('modal-title').textContent = 'Add New Target';
        form.reset();
        populateTargetTabDropdown();
        populateTargetNameDropdown('', '');
        modal.classList.add('show');
        updateTargetUnit();
        
        console.log('Modal opened successfully');
    } catch (error) {
        console.error('Error opening modal:', error);
        alert('Error opening target form: ' + error.message);
    }
}

/**
 * Close target modal
 */
function closeTargetModal() {
    document.getElementById('targetModal').classList.remove('show');
    currentEditTarget = null;
}

/**
 * Save target
 */
function saveTarget(e) {
    e.preventDefault();
    console.log('saveTarget called');
    
    try {
        const name = document.getElementById('target-name').value;
        const contextTab = document.getElementById('target-tab').value;
        const type = document.getElementById('target-type').value;
        const value = document.getElementById('target-value').value;
        const user = document.getElementById('target-user').value;
        const period = document.getElementById('target-period').value;
        
        console.log('Form values:', { name, type, value, user, period });
        
        // Validate required fields
        if (!contextTab || !name || !type || !value || !user || !period) {
            alert('Please fill in all required fields');
            return;
        }
        
        // API format (snake_case)
        const apiTarget = {
            name: name,
            context_tab: contextTab,
            type: type,
            target_value: parseFloat(value),
            current_value: parseFloat(document.getElementById('target-current').value) || 0,
            assigned_to: parseInt(user),
            period: period,
            description: document.getElementById('target-description').value,
            is_active: document.getElementById('target-active').checked ? 1 : 0
        };
        
        // Local format (camelCase)
        const localTarget = {
            id: currentEditTarget ? currentEditTarget.id : Date.now(),
            name: name,
            contextTab: contextTab,
            type: type,
            targetValue: parseFloat(value),
            currentValue: parseFloat(document.getElementById('target-current').value) || 0,
            assignedTo: parseInt(user),
            period: period,
            description: document.getElementById('target-description').value,
            active: document.getElementById('target-active').checked,
            createdAt: currentEditTarget ? currentEditTarget.createdAt : new Date().toISOString()
        };
        
        console.log('Target object:', apiTarget);
        
        // Save to API
        if (currentEditTarget) {
            // Update existing
            fetch(`/api/targets/${currentEditTarget.id}`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(apiTarget)
            })
            .then(response => {
                if (response.ok) {
                    console.log('Target updated on server');
                    const index = allTargets.findIndex(t => t.id === currentEditTarget.id);
                    if (index !== -1) {
                        allTargets[index] = localTarget;
                    }
                    saveTargets();
                    closeTargetModal();
                    loadTargets();
                    console.log('Target updated successfully');
                    alert('Target updated successfully!');
                } else {
                    throw new Error('Failed to update target');
                }
            })
            .catch(error => {
                console.error('Error updating target:', error);
                // Fallback to localStorage
                const index = allTargets.findIndex(t => t.id === currentEditTarget.id);
                if (index !== -1) {
                    allTargets[index] = localTarget;
                }
                saveTargets();
                closeTargetModal();
                loadTargets();
                alert('Target updated (offline mode)');
            });
        } else {
            // Create new
            fetch('/api/targets', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(apiTarget)
            })
            .then(response => {
                if (response.ok) {
                    return response.json();
                } else {
                    throw new Error('Failed to create target');
                }
            })
            .then(data => {
                console.log('Target created on server with ID:', data.target_id);
                localTarget.id = data.target_id;
                allTargets.push(localTarget);
                saveTargets();
                closeTargetModal();
                loadTargets();
                console.log('Target saved successfully');
                alert('Target saved successfully!');
            })
            .catch(error => {
                console.error('Error saving target:', error);
                // Fallback to localStorage
                allTargets.push(localTarget);
                saveTargets();
                closeTargetModal();
                loadTargets();
                alert('Target saved (offline mode)');
            });
        }
    } catch (error) {
        console.error('Error saving target:', error);
        alert('Error saving target: ' + error.message);
    }
}

/**
 * Edit target
 */
function editTarget(e, id) {
    e.stopPropagation();
    
    const target = allTargets.find(t => t.id === id);
    if (!target) return;
    
    currentEditTarget = target;
    
    document.getElementById('modal-title').textContent = 'Edit Target';
    populateTargetTabDropdown();
    const tabSelect = document.getElementById('target-tab');
    const nameSelect = document.getElementById('target-name');
    if (tabSelect) tabSelect.value = target.contextTab || '';
    populateTargetNameDropdown(target.contextTab || '', target.name);
    if (nameSelect && target.name) nameSelect.value = target.name;
    document.getElementById('target-type').value = target.type;
    document.getElementById('target-value').value = target.targetValue;
    document.getElementById('target-current').value = target.currentValue;
    document.getElementById('target-user').value = target.assignedTo;
    document.getElementById('target-period').value = target.period;
    document.getElementById('target-description').value = target.description;
    document.getElementById('target-active').checked = target.active;
    
    updateTargetUnit();
    document.getElementById('targetModal').classList.add('show');
}

/**
 * Delete target
 */
function deleteTarget(e, id) {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this target?')) return;
    
    // Delete from API
    fetch(`/api/targets/${id}`, {
        method: 'DELETE',
        credentials: 'include'
    })
    .then(response => {
        if (response.ok) {
            console.log('Target deleted from server');
            allTargets = allTargets.filter(t => t.id !== id);
            saveTargets();
            loadTargets();
            alert('Target deleted successfully!');
        } else {
            throw new Error('Failed to delete target');
        }
    })
    .catch(error => {
        console.error('Error deleting target:', error);
        // Fallback to localStorage
        allTargets = allTargets.filter(t => t.id !== id);
        saveTargets();
        loadTargets();
        alert('Target deleted (offline mode)');
    });
}

/**
 * Open details modal
 */
function openDetailsModal(id) {
    const target = allTargets.find(t => t.id === id);
    if (!target) return;
    
    const user = allUsers.find(u => u.id === target.assignedTo);
    const userName = getUserDisplayName(user);
    const percentage = Math.min((target.currentValue / target.targetValue) * 100, 100);
    const remaining = Math.max(target.targetValue - target.currentValue, 0);
    
    const detailsHTML = `
        <div class="target-details">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;">
                <div>
                    <h3>${target.name}</h3>
                    <p style="color: #6c757d; margin-top: 8px;">${target.description}</p>
                </div>
                <div style="text-align: right;">
                    <div class="target-type-badge" style="display: inline-block; padding: 8px 16px; font-size: 0.9rem;">
                        ${getTargetTypeLabel(target.type)}
                    </div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px;">
                <div style="background: #f8f9fa; padding: 16px; border-radius: 8px;">
                    <div style="color: #6c757d; font-size: 0.85rem; margin-bottom: 8px;">Target Value</div>
                    <div style="font-size: 1.5rem; font-weight: 700;">
                        ${target.targetValue.toLocaleString()} ${getTargetUnit(target.type)}
                    </div>
                </div>
                <div style="background: #f8f9fa; padding: 16px; border-radius: 8px;">
                    <div style="color: #6c757d; font-size: 0.85rem; margin-bottom: 8px;">Current Progress</div>
                    <div style="font-size: 1.5rem; font-weight: 700;">
                        ${target.currentValue.toLocaleString()} ${getTargetUnit(target.type)}
                    </div>
                </div>
                <div style="background: #f8f9fa; padding: 16px; border-radius: 8px;">
                    <div style="color: #6c757d; font-size: 0.85rem; margin-bottom: 8px;">Remaining</div>
                    <div style="font-size: 1.5rem; font-weight: 700;">
                        ${remaining.toLocaleString()} ${getTargetUnit(target.type)}
                    </div>
                </div>
                <div style="background: #f8f9fa; padding: 16px; border-radius: 8px;">
                    <div style="color: #6c757d; font-size: 0.85rem; margin-bottom: 8px;">Achievement</div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: ${percentage >= 100 ? '#198754' : '#ff9a56'};">
                        ${percentage.toFixed(1)}%
                    </div>
                </div>
            </div>
            
            <div style="background: white; border: 2px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <div style="margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-weight: 600;">Overall Progress</div>
                    <div style="font-weight: 700; color: ${percentage >= 100 ? '#198754' : '#ff9a56'};">${percentage.toFixed(1)}%</div>
                </div>
                <div class="progress-bar" style="height: 12px;">
                    <div class="progress-fill ${getProgressClass(percentage)}" style="width: ${percentage}%; height: 100%;"></div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
                <div>
                    <p style="color: #6c757d; font-size: 0.85rem; margin-bottom: 4px;">Assigned To</p>
                    <p style="font-size: 1.05rem; font-weight: 600; margin: 0;">${userName}</p>
                </div>
                <div>
                    <p style="color: #6c757d; font-size: 0.85rem; margin-bottom: 4px;">Period</p>
                    <p style="font-size: 1.05rem; font-weight: 600; margin: 0;">${target.period}</p>
                </div>
            </div>
            
            <div style="padding-top: 16px; border-top: 2px solid #e5e7eb; display: flex; gap: 12px;">
                <button class="btn btn-primary" onclick="editTarget({}, ${target.id}); closeDetailsModal();">
                    <i class="fas fa-edit"></i> Edit Target
                </button>
                <button class="btn btn-secondary" onclick="closeDetailsModal();">
                    Close
                </button>
            </div>
        </div>
    `;
    
    document.getElementById('details-title').textContent = target.name;
    document.getElementById('details-content').innerHTML = detailsHTML;
    document.getElementById('detailsModal').classList.add('show');
}

/**
 * Close details modal
 */
function closeDetailsModal() {
    document.getElementById('detailsModal').classList.remove('show');
}

/**
 * Save targets to localStorage
 */
function saveTargets() {
    localStorage.setItem('targets', JSON.stringify(allTargets));
}

/**
 * Refresh target progress - Calculate from lead history
 */
async function refreshTargetProgress(e, targetId) {
    if (e) e.stopPropagation();
    
    try {
        const btn = e.target.closest('button');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calculating...';
        btn.disabled = true;
        
        const response = await fetch(`/api/targets/${targetId}/calculate-progress`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                // Update local target data
                const targetIndex = allTargets.findIndex(t => t.id === targetId);
                if (targetIndex !== -1) {
                    allTargets[targetIndex].currentValue = data.current_value;
                    saveTargets();
                }
                
                // Reload targets to show updated values
                await loadTargets();
                
                // Show success message
                alert(`✅ Progress updated!\n\nCurrent: ${data.current_value.toLocaleString()}\nTarget: ${data.target_value.toLocaleString()}\nAchievement: ${data.percentage.toFixed(1)}%\n\nPeriod: ${data.period}\nDate Range: ${data.date_range.start} to ${data.date_range.end}`);
            } else {
                alert('Failed to calculate progress: ' + (data.message || 'Unknown error'));
            }
        } else {
            const errorData = await response.json().catch(() => ({}));
            alert('Error calculating progress: ' + (errorData.detail || response.statusText));
        }
        
        btn.innerHTML = originalHTML;
        btn.disabled = false;
        
    } catch (error) {
        console.error('Error refreshing target progress:', error);
        alert('Error calculating progress: ' + error.message);
        if (e && e.target) {
            const btn = e.target.closest('button');
            if (btn) {
                btn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
                btn.disabled = false;
            }
        }
    }
}

/**
 * Calculate all targets progress
 */
async function calculateAllProgress() {
    if (!confirm('Calculate progress for all active targets from lead history?\n\nThis will update all target values based on actual work done.')) {
        return;
    }
    
    try {
        // Show loading indicator
        const originalText = event.target.innerHTML;
        event.target.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calculating...';
        event.target.disabled = true;
        
        const response = await fetch('/api/targets/calculate-all', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                // Reload all targets
                await loadTargets();
                
                const successCount = data.results.filter(r => r.success !== false).length;
                const failCount = data.results.length - successCount;
                
                alert(`✅ Progress Calculated!\n\n${successCount} targets updated successfully${failCount > 0 ? `\n${failCount} targets failed` : ''}\n\nAll targets refreshed from lead history.`);
            } else {
                alert('Failed to calculate targets: ' + (data.message || 'Unknown error'));
            }
        } else {
            const errorData = await response.json().catch(() => ({}));
            alert('Error calculating targets: ' + (errorData.detail || response.statusText));
        }
        
        event.target.innerHTML = originalText;
        event.target.disabled = false;
        
    } catch (error) {
        console.error('Error calculating all targets:', error);
        alert('Error calculating targets: ' + error.message);
        if (event && event.target) {
            event.target.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh All';
            event.target.disabled = false;
        }
    }
}

/**
 * Close modal when clicking outside
 */
document.addEventListener('click', function(e) {
    const targetModal = document.getElementById('targetModal');
    const detailsModal = document.getElementById('detailsModal');
    
    if (e.target === targetModal) {
        closeTargetModal();
    }
    
    if (e.target === detailsModal) {
        closeDetailsModal();
    }
});
