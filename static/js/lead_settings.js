/**
 * Lead Settings JavaScript
 * Manage Lead Sources, Statuses, Types, Industries, Systems, and Preferences
 */

// Global variables
let currentTab = 'sources';
let currentEditItem = null;
let currentEditType = null;
let currentEditIndustry = null;
let currentEditSubIndustry = null;

// Default data for each category
const defaultData = {
    sources: [
        { id: 1, name: 'Website', color: '#667eea', description: 'Leads from company website', active: true },
        { id: 2, name: 'Referral', color: '#43e97b', description: 'Referred by existing customers', active: true },
        { id: 3, name: 'Social Media', color: '#4facfe', description: 'Facebook, LinkedIn, Twitter, etc.', active: true },
        { id: 4, name: 'Email Campaign', color: '#f093fb', description: 'Email marketing campaigns', active: true },
        { id: 5, name: 'Cold Call', color: '#fa709a', description: 'Outbound cold calling', active: true },
        { id: 6, name: 'Trade Show', color: '#ff9a56', description: 'Exhibitions and trade shows', active: true }
    ],
    statuses: [
        { id: 1, name: 'New', color: '#667eea', description: 'Newly created lead', active: true },
        { id: 2, name: 'Contacted', color: '#4facfe', description: 'Initial contact made', active: true },
        { id: 3, name: 'Qualified', color: '#43e97b', description: 'Lead qualified for sales', active: true },
        { id: 4, name: 'Proposal Sent', color: '#f093fb', description: 'Proposal sent to customer', active: true },
        { id: 5, name: 'Negotiation', color: '#ff9a56', description: 'In negotiation stage', active: true },
        { id: 6, name: 'Converted', color: '#38f9d7', description: 'Successfully converted', active: true },
        { id: 7, name: 'Lost', color: '#dc3545', description: 'Lead lost', active: true }
    ],
    types: [
        { id: 1, name: 'Inside Sales', color: '#667eea', description: 'Remote sales process', active: true },
        { id: 2, name: 'Field Sales', color: '#43e97b', description: 'On-site sales visits', active: true }
    ],
    industries: [
        { id: 1, name: 'IT Services', color: '#667eea', description: 'Information technology services', active: true, subIndustries: [] },
        { id: 2, name: 'Manufacturing', color: '#43e97b', description: 'Manufacturing sector', active: true, subIndustries: [] },
        { id: 3, name: 'Healthcare', color: '#4facfe', description: 'Healthcare and medical', active: true, subIndustries: [] },
        { id: 4, name: 'Education', color: '#f093fb', description: 'Educational institutions', active: true, subIndustries: [] },
        { id: 5, name: 'Finance', color: '#fa709a', description: 'Financial services', active: true, subIndustries: [] },
        { id: 6, name: 'Retail', color: '#ff9a56', description: 'Retail and e-commerce', active: true, subIndustries: [] },
        { id: 7, name: 'Real Estate', color: '#30cfd0', description: 'Real estate and property', active: true, subIndustries: [] },
        { id: 8, name: 'Construction', color: '#38f9d7', description: 'Construction industry', active: true, subIndustries: [] }
    ],
    systems: [
        { id: 1, name: 'ERP', color: '#667eea', description: 'Enterprise Resource Planning', active: true },
        { id: 2, name: 'CRM', color: '#43e97b', description: 'Customer Relationship Management', active: true },
        { id: 3, name: 'HRMS', color: '#4facfe', description: 'Human Resource Management System', active: true },
        { id: 4, name: 'Accounting', color: '#f093fb', description: 'Accounting software', active: true },
        { id: 5, name: 'Inventory', color: '#fa709a', description: 'Inventory management', active: true }
    ],
    project_amc: [
        { id: 1, name: 'Project', color: '#667eea', description: 'One-time implementation project', active: true },
        { id: 2, name: 'AMC', color: '#43e97b', description: 'Annual Maintenance Contract', active: true },
        { id: 3, name: 'Both', color: '#4facfe', description: 'Project with AMC', active: true }
    ],
    prospect: [
        { id: 1, name: 'Hot', color: '#dc3545', description: 'High priority prospects with immediate potential', active: true },
        { id: 2, name: 'Warm', color: '#ffc107', description: 'Moderate interest prospects', active: true },
        { id: 3, name: 'Cold', color: '#6c757d', description: 'Low engagement prospects', active: true }
    ],
    purpose_of_meeting: [
        { id: 1, name: 'Product Demo', color: '#667eea', description: 'Demonstrate product features', active: true },
        { id: 2, name: 'Requirement Gathering', color: '#43e97b', description: 'Understand client requirements', active: true },
        { id: 3, name: 'Proposal Discussion', color: '#4facfe', description: 'Discuss proposal details', active: true },
        { id: 4, name: 'Negotiation', color: '#f093fb', description: 'Price and terms negotiation', active: true },
        { id: 5, name: 'Follow-up', color: '#fa709a', description: 'Follow-up on previous discussion', active: true }
    ],
    communication_method: [
        { id: 1, name: 'Email', color: '#667eea', description: 'Email communication', active: true },
        { id: 2, name: 'Phone', color: '#43e97b', description: 'Telephone calls', active: true },
        { id: 3, name: 'SMS', color: '#4facfe', description: 'Short message service', active: true },
        { id: 4, name: 'WhatsApp', color: '#f093fb', description: 'WhatsApp messaging', active: true },
        { id: 5, name: 'Video Call', color: '#fa709a', description: 'Video conferencing', active: true },
        { id: 6, name: 'In-Person', color: '#ff9a56', description: 'Face to face meeting', active: true }
    ]
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Lead Settings page initializing...');
    
    // Check authentication
    checkAuthentication();
    
    // Load saved data or use defaults
    loadAllSettings();
    
    // Load preferences into form fields
    loadPreferencesIntoForm();
    
    // Ensure all industries have subIndustries array
    ensureIndustriesInitialized();
    
    // Setup tab navigation
    setupTabNavigation();
    
    // Render initial tab
    renderCurrentTab();
    
    // Add event listeners to buttons
    const saveBtn = document.getElementById('saveBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    
    if (saveBtn) {
        saveBtn.addEventListener('click', function(e) {
            console.log('Save button clicked via event listener');
            e.preventDefault();
            e.stopPropagation();
            saveItem();
            return false;
        });
    } else {
        console.error('Save button not found!');
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function(e) {
            console.log('Cancel button clicked via event listener');
            e.preventDefault();
            e.stopPropagation();
            closeModal();
            return false;
        });
    }
    
    console.log('Lead Settings page initialized successfully');
});

/**
 * Check authentication
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
        
        return true;
    } catch (error) {
        console.error('Authentication error:', error);
        window.location.href = '/login';
        return false;
    }
}

/**
 * Load all settings from database or use defaults
 */
async function loadAllSettings() {
    console.log('Loading settings from database...');
    
    try {
        // Try to load from database first
        const response = await fetch('/api/settings/lead-settings', {
            credentials: 'include',
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.settings && Object.keys(data.settings).length > 0) {
                // Settings exist in database
                for (const key in data.settings) {
                    let settingsData = data.settings[key];
                    
                    // Ensure industries have subIndustries array
                    if (key === 'industries' && Array.isArray(settingsData)) {
                        settingsData = settingsData.map(industry => ({
                            ...industry,
                            subIndustries: industry.subIndustries || []
                        }));
                    }
                    
                    // Cache all settings including status_percentages and preferences
                    localStorage.setItem(`lead_settings_${key}`, JSON.stringify(settingsData));
                }
                console.log('✅ All settings loaded from database:', data.settings);
                return;
            }
        }
    } catch (error) {
        console.warn('Failed to load from database, using localStorage:', error);
    }
    
    // Fallback: Use localStorage or defaults
    for (const key in defaultData) {
        const saved = localStorage.getItem(`lead_settings_${key}`);
        if (!saved) {
            localStorage.setItem(`lead_settings_${key}`, JSON.stringify(defaultData[key]));
        } else if (key === 'industries') {
            // Ensure existing industries have subIndustries array
            let industries = JSON.parse(saved);
            industries = industries.map(industry => ({
                ...industry,
                subIndustries: industry.subIndustries || []
            }));
            localStorage.setItem(`lead_settings_${key}`, JSON.stringify(industries));
        }
    }
}

/**
 * Load preferences from database directly into form fields
 */
async function loadPreferencesIntoForm() {
    try {
        const response = await fetch('/api/settings/lead-settings', {
            credentials: 'include',
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const prefs = data.settings?.preferences || {};
            
            // Map preferences to form fields
            const fieldMap = {
                'leadIdPrefix': 'leadIdPrefix',
                'leadIdStart': 'leadIdStart',
                'followUpDays': 'followUpDays',
                'agingAlertDays': 'agingAlertDays',
                'emailNotifications': 'emailNotifications',
                'dailyDigest': 'dailyDigest',
                'defaultPageSize': 'defaultPageSize',
                'autoLeadPercentage': 'autoLeadPercentage'
            };
            
            for (const [prefKey, fieldId] of Object.entries(fieldMap)) {
                const element = document.getElementById(fieldId);
                if (element) {
                    if (element.type === 'checkbox') {
                        element.checked = prefs[prefKey] !== false;
                    } else if (element.tagName === 'SELECT') {
                        element.value = String(prefs[prefKey] || '20');
                    } else {
                        element.value = prefs[prefKey] || '';
                    }
                }
            }
            
            console.log('✅ Preferences loaded from database:', prefs);
            return;
        }
    } catch (error) {
        console.warn('Failed to load preferences from database:', error);
    }
    
    // Fallback: Load from localStorage if database fetch fails
    try {
        const prefsJson = localStorage.getItem('lead_preferences');
        const prefs = prefsJson ? JSON.parse(prefsJson) : {};
        
        const fieldMap = {
            'leadIdPrefix': 'leadIdPrefix',
            'leadIdStart': 'leadIdStart',
            'followUpDays': 'followUpDays',
            'agingAlertDays': 'agingAlertDays',
            'emailNotifications': 'emailNotifications',
            'dailyDigest': 'dailyDigest',
            'defaultPageSize': 'defaultPageSize',
            'autoLeadPercentage': 'autoLeadPercentage'
        };
        
        for (const [prefKey, fieldId] of Object.entries(fieldMap)) {
            const element = document.getElementById(fieldId);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = prefs[prefKey] !== false;
                } else if (element.tagName === 'SELECT') {
                    element.value = String(prefs[prefKey] || '20');
                } else {
                    element.value = prefs[prefKey] || '';
                }
            }
        }
        
        console.log('✅ Preferences loaded from localStorage:', prefs);
    } catch (error) {
        console.error('Error loading preferences:', error);
    }
}

/**
 * Ensure all industries have subIndustries array initialized
 */
function ensureIndustriesInitialized() {
    const industries = JSON.parse(localStorage.getItem('lead_settings_industries') || '[]');
    const updated = industries.map(industry => ({
        ...industry,
        subIndustries: industry.subIndustries || []
    }));
    localStorage.setItem('lead_settings_industries', JSON.stringify(updated));
    console.log('Industries initialized with subIndustries arrays');
}

/**
 * Setup tab navigation
 */
function setupTabNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Show selected tab content
            const tabId = this.getAttribute('data-tab');
            currentTab = tabId;
            document.getElementById(tabId).classList.add('active');
            
            // Render content for current tab
            renderCurrentTab();
        });
    });
}

/**
 * Render current tab content
 */
function renderCurrentTab() {
    switch (currentTab) {
        case 'sources':
            renderItems('sources', 'sourcesList');
            break;
        case 'statuses':
            renderItems('statuses', 'statusesList');
            break;
        case 'types':
            renderItems('types', 'typesList');
            break;
        case 'industries':
            renderItems('industries', 'industriesList');
            break;
        case 'systems':
            renderItems('systems', 'systemsList');
            break;
        case 'project_amc':
            renderItems('project_amc', 'project_amcList');
            break;
        case 'prospect':
            renderItems('prospect', 'prospectList');
            break;
        case 'purpose_of_meeting':
            renderItems('purpose_of_meeting', 'purpose_of_meetingList');
            break;
        case 'communication_method':
            renderItems('communication_method', 'communication_methodList');
            break;
        case 'preferences':
            loadPreferences();
            break;
    }
}

/**
 * Render items list
 */
function renderItems(type, listId) {
    const data = JSON.parse(localStorage.getItem(`lead_settings_${type}`) || '[]');
    const listElement = document.getElementById(listId);
    
    if (data.length === 0) {
        listElement.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <h3>No items yet</h3>
                <p>Add your first item to get started</p>
            </div>
        `;
        return;
    }
    
    // Special rendering for industries with sub-industry support
    if (type === 'industries') {
        listElement.innerHTML = data.map(item => {
            const subIndustries = item.subIndustries || [];
            return `
                <div class="item-card">
                    <div class="item-card-header">
                        <div class="item-name">
                            <div class="item-color" style="background-color: ${item.color}"></div>
                            ${escapeHtml(item.name)}
                        </div>
                        <div class="item-actions">
                            <button class="icon-btn add-sub" onclick="addSubIndustry(${item.id})" title="Add Sub-industry">
                                <i class="fas fa-plus"></i>
                            </button>
                            <button class="icon-btn" onclick="editItem('${type}', ${item.id})" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="icon-btn delete" onclick="deleteItem('${type}', ${item.id})" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    ${item.description ? `<p class="item-description">${escapeHtml(item.description)}</p>` : ''}
                    ${subIndustries.length > 0 ? `
                        <div class="sub-items">
                            <div class="sub-items-label">Sub-industries:</div>
                            ${subIndustries.map(sub => `
                                <div class="sub-item-badge">
                                    ${escapeHtml(sub.name)}
                                    <button class="sub-item-delete" onclick="deleteSubIndustry(${item.id}, ${sub.id})" title="Delete">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    <div class="item-meta">
                        <span class="badge ${item.active ? 'badge-active' : 'badge-inactive'}">
                            ${item.active ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        // Standard rendering for other types
        listElement.innerHTML = data.map(item => `
            <div class="item-card">
                <div class="item-card-header">
                    <div class="item-name">
                        <div class="item-color" style="background-color: ${item.color}"></div>
                        ${escapeHtml(item.name)}
                    </div>
                    <div class="item-actions">
                        <button class="icon-btn" onclick="editItem('${type}', ${item.id})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="icon-btn delete" onclick="deleteItem('${type}', ${item.id})" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                ${item.description ? `<p class="item-description">${escapeHtml(item.description)}</p>` : ''}
                <div class="item-meta">
                    <span class="badge ${item.active ? 'badge-active' : 'badge-inactive'}">
                        ${item.active ? 'Active' : 'Inactive'}
                    </span>
                </div>
            </div>
        `).join('');
    }
}

/**
 * Add new item
 */
function addNewSource() { addNewItem('sources'); }
function addNewStatus() { addNewItem('statuses'); }
function addNewType() { addNewItem('types'); }
function addNewIndustry() { addNewItem('industries'); }
function addNewSystem() { addNewItem('systems'); }
function addNewProjectAMC() { addNewItem('project_amc'); }
function addNewProspect() { addNewItem('prospect'); }
function addNewPurposeOfMeeting() { addNewItem('purpose_of_meeting'); }
function addNewCommunicationMethod() { addNewItem('communication_method'); }

function addNewItem(type) {
    currentEditType = type;
    currentEditItem = null;
    
    document.getElementById('modalTitle').textContent = `Add ${type.charAt(0).toUpperCase() + type.slice(1, -1)}`;
    document.getElementById('itemName').value = '';
    document.getElementById('itemColor').value = '#0d6efd';
    document.getElementById('itemDescription').value = '';
    document.getElementById('itemActive').checked = true;
    
    document.getElementById('editModal').style.display = 'flex';
}

/**
 * Edit item
 */
function editItem(type, id) {
    const data = JSON.parse(localStorage.getItem(`lead_settings_${type}`) || '[]');
    const item = data.find(i => i.id === id);
    
    if (!item) return;
    
    currentEditType = type;
    currentEditItem = item;
    
    document.getElementById('modalTitle').textContent = `Edit ${type.charAt(0).toUpperCase() + type.slice(1, -1)}`;
    document.getElementById('itemName').value = item.name;
    document.getElementById('itemColor').value = item.color;
    document.getElementById('itemDescription').value = item.description || '';
    document.getElementById('itemActive').checked = item.active;
    
    document.getElementById('editModal').style.display = 'flex';
}

/**
 * Save item
 */
async function saveItem() {
    console.log('=== saveItem() called ===');
    console.log('isAddingSubIndustry:', window.isAddingSubIndustry);
    console.log('currentEditType:', currentEditType);
    
    // Immediately log that function was called
    console.warn('SAVE BUTTON WAS CLICKED!');
    
    const nameInput = document.getElementById('itemName');
    if (!nameInput) {
        console.error('itemName input not found in DOM!');
        alert('Form error: itemName not found');
        return;
    }
    
    const name = nameInput.value.trim();
    
    if (!name) {
        showNotification('Name is required', 'error');
        console.error('Name is empty');
        return;
    }
    
    console.log('Name:', name);
    
    const color = document.getElementById('itemColor').value;
    const description = document.getElementById('itemDescription').value.trim();
    const active = document.getElementById('itemActive').checked;
    
    console.log('Color:', color, 'Description:', description, 'Active:', active);
    
    // Handle sub-industry saving
    if (window.isAddingSubIndustry) {
        console.log('--- Handling Sub-Industry Save ---');
        console.log('currentEditIndustry:', currentEditIndustry);
        
        const data = JSON.parse(localStorage.getItem('lead_settings_industries') || '[]');
        console.log('All industries from localStorage:', data);
        
        // Find the industry in the data array (not just use currentEditIndustry reference)
        const industryIndex = data.findIndex(i => i.id === currentEditIndustry.id);
        console.log('Industry index found:', industryIndex);
        
        if (industryIndex === -1) {
            showNotification('Industry not found', 'error');
            console.error('Industry not found in data array');
            return;
        }
        
        const industry = data[industryIndex];
        console.log('Found industry:', industry);
        
        if (!industry.subIndustries) {
            industry.subIndustries = [];
            console.log('Created subIndustries array');
        }
        
        console.log('Current sub-industries:', industry.subIndustries);
        console.log('isEditingSubIndustry:', window.isEditingSubIndustry);
        
        if (window.isEditingSubIndustry) {
            // Update existing sub-industry
            const subIndex = industry.subIndustries.findIndex(s => s.id === currentEditSubIndustry.id);
            console.log('Updating sub-industry at index:', subIndex);
            if (subIndex !== -1) {
                industry.subIndustries[subIndex] = {
                    ...industry.subIndustries[subIndex],
                    name,
                    description,
                    active
                };
                console.log('Updated sub-industry:', industry.subIndustries[subIndex]);
            }
        } else {
            // Add new sub-industry
            const newId = industry.subIndustries.length > 0 
                ? Math.max(...industry.subIndustries.map(s => s.id)) + 1 
                : 1;
            const newSubIndustry = {
                id: newId,
                name,
                description,
                active,
                color: '#667eea'
            };
            console.log('Adding new sub-industry:', newSubIndustry);
            industry.subIndustries.push(newSubIndustry);
            console.log('Sub-industry added. Array now:', industry.subIndustries);
        }
        
        console.log('Updated industry object:', industry);
        console.log('All industries before save:', data);
        
        // Save to localStorage
        localStorage.setItem('lead_settings_industries', JSON.stringify(data));
        console.log('Saved to localStorage');
        console.log('Verify in localStorage:', JSON.parse(localStorage.getItem('lead_settings_industries')));
        
        // Save to database
        try {
            const response = await fetch('/api/settings/lead-settings', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    type: 'industries',
                    data: data
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to save to database');
            }
            console.log('Sub-industry saved to database successfully');
        } catch (error) {
            console.warn('Failed to save to database:', error);
        }
        
        window.isAddingSubIndustry = false;
        window.isEditingSubIndustry = false;
        console.log('Closing modal and re-rendering...');
        closeModal();
        renderCurrentTab();
        showNotification('Sub-industry saved successfully', 'success');
        console.log('=== Sub-industry save complete ===');
        return;
    }
    
    console.log('--- Handling Regular Item Save ---');
    // Handle regular item saving
    const data = JSON.parse(localStorage.getItem(`lead_settings_${currentEditType}`) || '[]');
    
    if (currentEditItem) {
        // Update existing item
        const index = data.findIndex(i => i.id === currentEditItem.id);
        if (index !== -1) {
            data[index] = {
                ...data[index],
                name,
                color,
                description,
                active
            };
        }
    } else {
        // Add new item
        const newId = data.length > 0 ? Math.max(...data.map(i => i.id)) + 1 : 1;
        data.push({
            id: newId,
            name,
            color,
            description,
            active
        });
    }
    
    // Save to localStorage first
    localStorage.setItem(`lead_settings_${currentEditType}`, JSON.stringify(data));
    
    // Then save to database
    try {
        const response = await fetch('/api/settings/lead-settings', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                type: currentEditType,
                data: data
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to save to database');
        }
        
        console.log(`${currentEditType} saved to database successfully`);
    } catch (error) {
        console.warn('Failed to save to database:', error);
    }
    
    closeModal();
    renderCurrentTab();
    showNotification('Item saved successfully', 'success');
}

/**
 * Delete item
 */
async function deleteItem(type, id) {
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    const data = JSON.parse(localStorage.getItem(`lead_settings_${type}`) || '[]');
    const filtered = data.filter(i => i.id !== id);
    
    // Save to localStorage first
    localStorage.setItem(`lead_settings_${type}`, JSON.stringify(filtered));
    
    // Then save to database
    try {
        const response = await fetch('/api/settings/lead-settings', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                type: type,
                data: filtered
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to save to database');
        }
        
        console.log(`${type} updated in database successfully`);
    } catch (error) {
        console.warn('Failed to save to database:', error);
    }
    
    renderCurrentTab();
    showNotification('Item deleted successfully', 'success');
}

/**
 * Close modal
 */
function closeModal() {
    document.getElementById('editModal').style.display = 'none';
    
    // Reset all modal content
    document.getElementById('modalTitle').textContent = 'Add Item';
    document.getElementById('itemName').value = '';
    document.getElementById('itemColor').value = '#0d6efd';
    document.getElementById('itemDescription').value = '';
    document.getElementById('itemActive').checked = true;
    
    // Show color picker again
    const colorGroup = document.getElementById('colorGroup');
    if (colorGroup) colorGroup.style.display = 'block';
    const subNotice = document.getElementById('subIndustryNotice');
    if (subNotice) subNotice.style.display = 'none';
    const parentLabel = document.getElementById('parentIndustryLabel');
    if (parentLabel) parentLabel.textContent = 'Parent Industry: -';
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) saveBtn.textContent = 'Save';
    
    // Reset sub-industry flags
    window.isAddingSubIndustry = false;
    window.isEditingSubIndustry = false;
    
    currentEditItem = null;
    currentEditType = null;
    currentEditIndustry = null;
    currentEditSubIndustry = null;
}

/**
 * Load preferences
 */
function loadPreferences() {
    const preferences = JSON.parse(localStorage.getItem('lead_preferences') || '{}');
    
    document.getElementById('leadIdPrefix').value = preferences.leadIdPrefix || 'CS';
    document.getElementById('leadIdStart').value = preferences.leadIdStart || 1000000001;
    document.getElementById('followUpDays').value = preferences.followUpDays || 7;
    document.getElementById('agingAlertDays').value = preferences.agingAlertDays || 30;
    document.getElementById('emailNotifications').checked = preferences.emailNotifications !== false;
    document.getElementById('dailyDigest').checked = preferences.dailyDigest !== false;
    document.getElementById('defaultPageSize').value = preferences.defaultPageSize || 20;
    document.getElementById('autoLeadPercentage').checked = preferences.autoLeadPercentage !== false;
    
    // Load and display saved percentage mappings
    loadSavedPercentages();
}

/**
 * Save all settings
 */
async function saveAllSettings() {
    try {
        console.log('Saving all settings to database...');
        
        // Prepare settings data
        const settingsToSave = {};
        for (const key in defaultData) {
            const saved = localStorage.getItem(`lead_settings_${key}`);
            if (saved) {
                settingsToSave[key] = JSON.parse(saved);
            }
        }
        
        // Prepare preferences payload - get from form fields directly
        const preferences = {
            leadIdPrefix: (document.getElementById('leadIdPrefix')?.value || 'CS').trim(),
            leadIdStart: parseInt(document.getElementById('leadIdStart')?.value || '1000000001'),
            followUpDays: parseInt(document.getElementById('followUpDays')?.value || '7'),
            agingAlertDays: parseInt(document.getElementById('agingAlertDays')?.value || '30'),
            emailNotifications: document.getElementById('emailNotifications')?.checked !== false,
            dailyDigest: document.getElementById('dailyDigest')?.checked !== false,
            defaultPageSize: parseInt(document.getElementById('defaultPageSize')?.value || '20'),
            autoLeadPercentage: document.getElementById('autoLeadPercentage')?.checked !== false
        };

        console.log('Preferences to save:', preferences);

        // Save each setting type to database (including preferences)
        const savePromises = [];
        
        // Save all other settings
        for (const [type, data] of Object.entries(settingsToSave)) {
            console.log(`Saving ${type}...`);
            savePromises.push(
                fetch('/api/settings/lead-settings', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ type, data })
                }).then(r => {
                    if (!r.ok) throw new Error(`Failed to save ${type}`);
                    return r.json();
                })
            );
        }

        // Save preferences via the same endpoint
        console.log('Saving preferences...');
        savePromises.push(
            fetch('/api/settings/lead-settings', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ type: 'preferences', data: preferences })
            }).then(r => {
                if (!r.ok) throw new Error('Failed to save preferences');
                return r.json();
            })
        );

        // Wait for all saves to complete
        const results = await Promise.all(savePromises);
        
        console.log('All save results:', results);

        // Cache preferences locally for offline use
        localStorage.setItem('lead_preferences', JSON.stringify(preferences));
        
        console.log('✅ All settings saved successfully to database');
        showNotification('All settings saved successfully!', 'success');
    } catch (error) {
        console.error('Error saving settings:', error);
        showNotification('Error saving settings: ' + error.message, 'error');
    }
}

/**
 * Utility: Escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Add sub-industry to an industry
 */
function addSubIndustry(industryId) {
    console.log('addSubIndustry called with industryId:', industryId);
    
    const data = JSON.parse(localStorage.getItem('lead_settings_industries') || '[]');
    console.log('Industries data:', data);
    
    const industry = data.find(i => i.id === industryId);
    console.log('Found industry:', industry);
    
    if (!industry) {
        showNotification('Industry not found', 'error');
        return;
    }
    
    // Initialize sub-industries array if not exists
    if (!industry.subIndustries) {
        industry.subIndustries = [];
    }
    
    // Set edit context for sub-industry
    currentEditType = 'industries';
    currentEditIndustry = industry;
    currentEditSubIndustry = null;
    
    console.log('Setting modal content...');
    
    // Show modal for sub-industry
    const modalTitle = document.getElementById('modalTitle');
    const itemName = document.getElementById('itemName');
    const itemColor = document.getElementById('itemColor');
    const itemDescription = document.getElementById('itemDescription');
    const itemActive = document.getElementById('itemActive');
    const editModal = document.getElementById('editModal');
    const subNotice = document.getElementById('subIndustryNotice');
    const parentLabel = document.getElementById('parentIndustryLabel');
    const colorGroup = document.getElementById('colorGroup');
    
    if (!modalTitle || !itemName || !itemColor || !itemDescription || !itemActive || !editModal) {
        console.error('Modal elements not found!');
        showNotification('Error opening modal', 'error');
        return;
    }
    
    modalTitle.textContent = `Add Sub-industry`;
    itemName.placeholder = 'Enter sub-industry name';
    itemName.value = '';
    itemColor.value = '#667eea';
    itemDescription.value = '';
    itemActive.checked = true;
    
    // Show context notice and parent label
    if (subNotice) subNotice.style.display = 'block';
    if (parentLabel) parentLabel.textContent = `Parent Industry: ${industry.name}`;
    
    // Hide color picker for sub-industries
    if (colorGroup) colorGroup.style.display = 'none';
    
    // Set save button text
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) saveBtn.textContent = 'Add Sub-Industry';
    
    // Store flag to know we're adding a sub-industry
    window.isAddingSubIndustry = true;
    
    console.log('Showing modal');
    editModal.style.display = 'flex';
    console.log('Modal should be visible now');
}

/**
 * Edit sub-industry
 */
function editSubIndustry(industryId, subIndustryId) {
    const data = JSON.parse(localStorage.getItem('lead_settings_industries') || '[]');
    const industry = data.find(i => i.id === industryId);
    
    if (!industry || !industry.subIndustries) {
        showNotification('Industry not found', 'error');
        return;
    }
    
    const subIndustry = industry.subIndustries.find(s => s.id === subIndustryId);
    
    if (!subIndustry) {
        showNotification('Sub-industry not found', 'error');
        return;
    }
    
    // Set edit context
    currentEditType = 'industries';
    currentEditIndustry = industry;
    currentEditSubIndustry = subIndustry;
    
    // Show modal
    document.getElementById('modalTitle').textContent = `Edit Sub-Industry`;
    document.getElementById('itemName').value = escapeHtml(subIndustry.name);
    document.getElementById('itemColor').value = subIndustry.color || '#667eea';
    document.getElementById('itemDescription').value = escapeHtml(subIndustry.description || '');
    document.getElementById('itemActive').checked = subIndustry.active !== false;
    
    // Show context notice and hide color picker
    const subNotice = document.getElementById('subIndustryNotice');
    const parentLabel = document.getElementById('parentIndustryLabel');
    const colorGroup = document.getElementById('colorGroup');
    if (subNotice) subNotice.style.display = 'block';
    if (parentLabel) parentLabel.textContent = `Parent Industry: ${industry.name}`;
    if (colorGroup) colorGroup.style.display = 'none';
    
    window.isAddingSubIndustry = true;
    window.isEditingSubIndustry = true;
    
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) saveBtn.textContent = 'Update Sub-Industry';
    document.getElementById('editModal').style.display = 'flex';
}

/**
 * Delete sub-industry
 */
function deleteSubIndustry(industryId, subIndustryId) {
    // Normalize types to numbers to avoid strict equality mismatch
    const indId = Number(industryId);
    const subId = Number(subIndustryId);

    if (!confirm('Are you sure you want to delete this sub-industry?')) {
        return;
    }

    const data = JSON.parse(localStorage.getItem('lead_settings_industries') || '[]');
    const industry = data.find(i => Number(i.id) === indId);

    if (!industry || !Array.isArray(industry.subIndustries)) {
        showNotification('Industry not found', 'error');
        return;
    }

    const index = industry.subIndustries.findIndex(s => Number(s.id) === subId);
    if (index === -1) {
        showNotification('Sub-industry not found', 'error');
        return;
    }

    industry.subIndustries.splice(index, 1);
    localStorage.setItem('lead_settings_industries', JSON.stringify(data));

    // Persist to database
    fetch('/api/settings/lead-settings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ type: 'industries', data })
    }).catch(() => {});

    // Refresh UI
    renderItems('industries', 'industriesList');
    showNotification('Sub-industry deleted successfully', 'success');
}

/** * Show notification
 */
function showNotification(message, type = 'info') {
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

// TEST FUNCTION - For debugging
window.testAddSubIndustry = function() {
    const data = JSON.parse(localStorage.getItem('lead_settings_industries'));
    const industry = data[0];
    
    if (!industry.subIndustries) {
        industry.subIndustries = [];
    }
    
    industry.subIndustries.push({
        id: 1,
        name: 'Test: Software Development',
        description: 'Testing sub-industry',
        active: true,
        color: '#667eea'
    });
    
    localStorage.setItem('lead_settings_industries', JSON.stringify(data));
    
    fetch('/api/settings/lead-settings', {
        method: 'POST',
        credentials: 'include',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({type: 'industries', data: data})
    }).then(() => {
        console.log('Test sub-industry added!');
        renderCurrentTab();
    });
};

/**
 * Status Percentage Configuration
 */
let currentStatusPercentages = {};

function openPercentageModal() {
    const modal = document.getElementById('percentageModal');
    if (modal) {
        modal.style.display = 'flex';
        loadStatusesForPercentage();
        loadSavedPercentages();
    }
}

function closePercentageModal() {
    const modal = document.getElementById('percentageModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function loadStatusesForPercentage() {
    const select = document.getElementById('percentageStatus');
    if (!select) return;
    
    select.innerHTML = '<option value="">Loading statuses...</option>';
    
    // Fetch statuses from API
    fetch('/api/settings/lead-settings', {
        method: 'GET',
        credentials: 'include',
        headers: {'Accept': 'application/json'}
    })
    .then(r => r.ok ? r.json() : {})
    .then(data => {
        let statuses = [];
        
        // Try to get from API response
        if (data.settings && data.settings.statuses) {
            statuses = data.settings.statuses;
        }
        
        // Fallback to localStorage
        if (!statuses || statuses.length === 0) {
            const saved = localStorage.getItem('lead_settings_statuses');
            if (saved) {
                statuses = JSON.parse(saved);
            }
        }
        
        // Fallback to LeadSettingsManager
        if (!statuses || statuses.length === 0) {
            statuses = LeadSettingsManager.get('statuses') || [];
        }
        
        select.innerHTML = '<option value="">-- Select Status --</option>';
        
        if (Array.isArray(statuses) && statuses.length > 0) {
            statuses.forEach(status => {
                if (status && status.name) {
                    const option = document.createElement('option');
                    option.value = status.name;
                    option.textContent = status.name;
                    select.appendChild(option);
                }
            });
        } else {
            select.innerHTML = '<option value="">-- No statuses found --</option>';
        }
        
        console.log('Loaded statuses:', statuses);
    })
    .catch(err => {
        console.error('Error loading statuses:', err);
        select.innerHTML = '<option value="">-- Error loading statuses --</option>';
    });
}

function loadSavedPercentages() {
    // Always fetch from database first to ensure latest data
    fetch('/api/settings/lead-settings', {
        method: 'GET',
        credentials: 'include',
        headers: {'Accept': 'application/json'}
    }).then(r => r.ok ? r.json() : {})
    .then(data => {
        if (data.settings && data.settings.status_percentages) {
            currentStatusPercentages = data.settings.status_percentages;
            console.log('✅ Status percentages loaded from database:', currentStatusPercentages);
        } else {
            // Fallback to localStorage
            const saved = localStorage.getItem('lead_status_percentages');
            if (saved) {
                currentStatusPercentages = JSON.parse(saved);
                console.log('Status percentages loaded from localStorage:', currentStatusPercentages);
            } else {
                currentStatusPercentages = {};
                console.log('No status percentages found');
            }
        }
        // Cache to localStorage for offline use
        localStorage.setItem('lead_status_percentages', JSON.stringify(currentStatusPercentages));
        displayPercentageMappings();
    }).catch(err => {
        console.error('Error loading percentages:', err);
        // Fallback to localStorage on error
        const saved = localStorage.getItem('lead_status_percentages');
        currentStatusPercentages = saved ? JSON.parse(saved) : {};
        displayPercentageMappings();
    });
}

function displayPercentageMappings() {
    const container = document.getElementById('percentagesListContent');
    const displayContainer = document.getElementById('percentageMappingsDisplay');
    
    if (!container || !displayContainer) return;
    
    if (Object.keys(currentStatusPercentages).length === 0) {
        container.innerHTML = '<em style="color: #6c757d;">No mappings configured yet</em>';
        displayContainer.innerHTML = '<em style="color: #6c757d;">No percentage mappings configured</em>';
    } else {
        let html = '';
        for (const [status, percent] of Object.entries(currentStatusPercentages)) {
            html += `<div style="padding: 8px; background: white; border-radius: 3px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
                <span><strong>${status}</strong>: ${percent}%</span>
                <button type="button" class="btn-sm btn-danger" onclick="deletePercentageMapping('${status}')" style="padding: 4px 8px; font-size: 0.85em;">Delete</button>
            </div>`;
        }
        container.innerHTML = html;
        displayContainer.innerHTML = html;
    }
}

function addPercentageMapping() {
    const status = document.getElementById('percentageStatus').value;
    const value = document.getElementById('percentageValue').value;
    
    if (!status) {
        alert('Please select a status');
        return;
    }
    if (!value || parseInt(value) < 0 || parseInt(value) > 100) {
        alert('Please enter a valid percentage (0-100)');
        return;
    }
    
    currentStatusPercentages[status] = parseInt(value);
    
    // Clear form
    document.getElementById('percentageStatus').value = '';
    document.getElementById('percentageValue').value = '';
    
    // Update display
    displayPercentageMappings();
    
    console.log('Percentage mapping added:', currentStatusPercentages);
}

function deletePercentageMapping(status) {
    if (confirm(`Delete mapping for "${status}"?`)) {
        delete currentStatusPercentages[status];
        displayPercentageMappings();
    }
}

function saveAllPercentages() {
    if (Object.keys(currentStatusPercentages).length === 0) {
        alert('Please add at least one status-percentage mapping');
        return;
    }
    
    console.log('Saving status percentages:', currentStatusPercentages);
    
    // Save to localStorage
    localStorage.setItem('lead_status_percentages', JSON.stringify(currentStatusPercentages));
    
    // Save to server
    fetch('/api/settings/lead-settings', {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            type: 'status_percentages',
            data: currentStatusPercentages
        })
    }).then(r => {
        if (!r.ok) throw new Error(`Failed to save: ${r.status}`);
        return r.json();
    }).then(data => {
        console.log('✅ Percentage mappings saved successfully:', data);
        alert('Status percentage configuration saved successfully!');
        closePercentageModal();
        displayPercentageMappings();
    }).catch(err => {
        console.error('Error saving percentages:', err);
        alert('Error saving percentage mappings: ' + err.message);
    });
}

