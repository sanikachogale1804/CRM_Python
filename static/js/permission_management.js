/* Permission Management - User Grid + Modal */

(function () {
  let allUsers = [];
  let permissionsTree = [];
  let currentUserId = null;
  let selectedPermissions = new Set();

  const usersContainer = document.getElementById('usersContainer');
  const permissionModal = document.getElementById('permissionModal');
  const treeContainer = document.getElementById('treeContainer');
  const expandAllBtn = document.getElementById('expandAllBtn');
  const collapseAllBtn = document.getElementById('collapseAllBtn');
  const saveBtn = document.getElementById('saveBtn');

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    loadUsers();
    loadPermissionsTree();
    wireModalEvents();
  }

  function wireModalEvents() {
    if (expandAllBtn) expandAllBtn.addEventListener('click', expandAll);
    if (collapseAllBtn) collapseAllBtn.addEventListener('click', collapseAll);
    if (saveBtn) saveBtn.addEventListener('click', savePermissions);
  }

  async function loadUsers() {
    try {
      const res = await fetch('/api/users', { credentials: 'include' });
      const data = await res.json();
      allUsers = data.data || data.users || [];
      renderUsersGrid();
    } catch (err) {
      console.error('Failed to load users', err);
      usersContainer.innerHTML = '<p style="color: red;">Failed to load users</p>';
    }
  }

  async function loadPermissionsTree() {
    try {
      const res = await fetch('/api/permissions/tree', { credentials: 'include' });
      const data = await res.json();
      permissionsTree = data.data || data.tree || [];
    } catch (err) {
      console.error('Failed to load permissions tree', err);
    }
  }

  function renderUsersGrid() {
    if (!allUsers.length) {
      usersContainer.innerHTML = '<p>No users found</p>';
      return;
    }

    const html = allUsers.map(user => {
      const initials = user.full_name
        ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
        : 'U';
      const permCount = user.permission_count || 0;
      const photoUrl = getPhotoUrl(user.photo);

      return `
        <div class="user-card">
          <div class="user-header">
            ${photoUrl
              ? `<img src="${photoUrl}" alt="${escapeHtml(user.full_name)}" class="user-photo">`
              : `<div class="user-photo-fallback">${initials}</div>`}
          </div>
          <div class="user-info">
            <h3>${escapeHtml(user.full_name || user.username)}</h3>
            <p>${escapeHtml(user.email || 'No email')}</p>
          </div>
          <div class="user-meta">
            <div class="meta-row">
              <span class="label">Role:</span>
              <span class="value">${escapeHtml(user.role || 'User')}</span>
            </div>
            <div class="meta-row">
              <span class="label">Status:</span>
              <span class="value status ${user.is_active ? 'active' : 'inactive'}">
                <i class="fas fa-${user.is_active ? 'check-circle' : 'times-circle'}"></i>
                ${user.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div class="meta-row">
              <span class="label">Permissions:</span>
              <span class="value">${permCount}</span>
            </div>
          </div>
          <button class="btn primary" onclick="window.openPermissionModal(${user.id})">
            <i class="fas fa-lock"></i>
            <span>Manage Permissions</span>
          </button>
        </div>
      `;
    }).join('');

    usersContainer.innerHTML = html;
  }

  window.openPermissionModal = async function (userId) {
    currentUserId = userId;
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    document.getElementById('modalUserName').textContent =
      escapeHtml(user.full_name || user.username);

    await loadUserPermissions();
    renderTree();

    permissionModal.classList.add('show');
  };

  window.closePermissionModal = function () {
    permissionModal.classList.remove('show');
    currentUserId = null;
    selectedPermissions.clear();
  };

  async function loadUserPermissions() {
    selectedPermissions.clear();
    if (!currentUserId) return;

    try {
      const res = await fetch(`/api/users/${currentUserId}/permissions`, {
        credentials: 'include'
      });
      const data = await res.json();
      const perms = data.permissions || [];
      perms.forEach(p => selectedPermissions.add(p.id));
    } catch (err) {
      console.error('Failed to load user permissions', err);
    }
  }

  function renderTree() {
    treeContainer.innerHTML = '';
    const fragment = document.createDocumentFragment();

    permissionsTree.forEach(group => {
      const groupEl = createGroupElement(group);
      fragment.appendChild(groupEl);
    });

    treeContainer.appendChild(fragment);
  }

  function createGroupElement(group) {
    const groupEl = document.createElement('div');
    groupEl.className = 'perm-group';

    const header = document.createElement('div');
    header.className = 'perm-header';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'toggle';
    toggleBtn.innerHTML = '<i class="fas fa-chevron-down"></i>';
    toggleBtn.addEventListener('click', () => {
      const isCollapsed = groupEl.classList.toggle('collapsed');
      toggleBtn.innerHTML = isCollapsed
        ? '<i class="fas fa-chevron-right"></i>'
        : '<i class="fas fa-chevron-down"></i>';
    });

    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = group.permission_name || group.permission_key || group.id;

    const actions = document.createElement('div');
    actions.className = 'group-actions';

    const checkAll = document.createElement('button');
    checkAll.className = 'btn ghost small';
    checkAll.innerHTML = '<i class="fas fa-check-square"></i><span>Check All</span>';
    checkAll.addEventListener('click', () => setGroupChecks(group, true));

    const uncheckAll = document.createElement('button');
    uncheckAll.className = 'btn ghost small';
    uncheckAll.innerHTML = '<i class="fas fa-square"></i><span>Uncheck All</span>';
    uncheckAll.addEventListener('click', () => setGroupChecks(group, false));

    actions.appendChild(checkAll);
    actions.appendChild(uncheckAll);

    header.appendChild(toggleBtn);
    header.appendChild(title);
    header.appendChild(actions);

    const body = document.createElement('div');
    body.className = 'perm-body';

    // Render this node's checkbox
    body.appendChild(createPermCheckbox(group));

    // Render children
    if (Array.isArray(group.children) && group.children.length) {
      const childrenWrap = document.createElement('div');
      childrenWrap.className = 'children';
      group.children.forEach(child => {
        childrenWrap.appendChild(createGroupElement(child));
      });
      body.appendChild(childrenWrap);
    }

    groupEl.appendChild(header);
    groupEl.appendChild(body);

    return groupEl;
  }

  function createPermCheckbox(perm) {
    const id = perm.id;
    const label = perm.permission_name || perm.permission_key || `Permission ${id}`;
    const checked = selectedPermissions.has(id);

    const item = document.createElement('label');
    item.className = 'perm-item';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'perm-checkbox';
    input.dataset.id = String(id);
    input.checked = checked;
    input.addEventListener('change', () => {
      if (input.checked) selectedPermissions.add(id);
      else selectedPermissions.delete(id);
    });

    const span = document.createElement('span');
    span.textContent = label;

    item.appendChild(input);
    item.appendChild(span);
    return item;
  }

  function setGroupChecks(group, checked) {
    const ids = collectGroupIds(group);
    ids.forEach(id => {
      const input = treeContainer.querySelector(`input.perm-checkbox[data-id="${id}"]`);
      if (input) {
        input.checked = checked;
      }
      if (checked) selectedPermissions.add(id);
      else selectedPermissions.delete(id);
    });
  }

  function collectGroupIds(group) {
    const ids = [group.id];
    if (Array.isArray(group.children)) {
      group.children.forEach(child => ids.push(...collectGroupIds(child)));
    }
    return ids;
  }

  function expandAll() {
    treeContainer.querySelectorAll('.perm-group').forEach(el =>
      el.classList.remove('collapsed')
    );
  }

  function collapseAll() {
    treeContainer.querySelectorAll('.perm-group').forEach(el =>
      el.classList.add('collapsed')
    );
  }

  async function savePermissions() {
    if (!currentUserId) return;

    try {
      const res = await fetch(`/api/users/${currentUserId}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ permission_ids: Array.from(selectedPermissions) })
      });

      const data = await res.json();
      if (data.success) {
        toast('Permissions saved successfully');
        const user = allUsers.find(u => u.id === currentUserId);
        if (user) {
          user.permission_count = selectedPermissions.size;
          renderUsersGrid();
        }
        closePermissionModal();
      } else {
        alert('Failed to save permissions');
      }
    } catch (err) {
      console.error('Failed to save permissions', err);
      alert('Error while saving');
    }
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getPhotoUrl(photoPath) {
    if (!photoPath) return null;

    // Handle various path formats
    let cleanPath = photoPath.trim();

    // Windows paths
    if (cleanPath.includes('\\')) {
      cleanPath = cleanPath.split('\\').pop();
    }

    // Already a web path
    if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
      return cleanPath;
    }

    // Already starts with /static
    if (cleanPath.startsWith('/static')) {
      return cleanPath;
    }

    // Common upload directory patterns
    if (cleanPath.startsWith('uploads/')) {
      return `/static/${cleanPath}`;
    }

    // File name only
    if (!cleanPath.includes('/')) {
      return `/static/uploads/users/${cleanPath}`;
    }

    // Default: prepend /static
    return `/static/${cleanPath}`;
  }

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => {
      t.classList.remove('show');
      t.remove();
    }, 2500);
  }
})();

