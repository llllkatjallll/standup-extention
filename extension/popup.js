// Task management for popup
class TaskManager {
  constructor() {
    this.tasks = [];
    this.nextId = 1;
    this.presentationStep = 1; // Start at step 1 (Yesterday's Tasks)
    this.activeFilter = 'all'; // Single filter: 'all' or specific status
    this.init();
  }

  async init() {
    await this.loadTasks();
    this.setupEventListeners();
    this.setupFilterPills();
    this.setupSettingsToggle();
    this.setupSettings();
    this.render();
  }

  setupFilterPills() {
    const filterPills = document.querySelectorAll('.filter-pill');
    
    filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const status = pill.dataset.status;
        
        // Don't allow clicking disabled pills
        if (pill.classList.contains('disabled')) return;
        
        // Set this as the active filter (single select)
        this.activeFilter = status;
        
        // Update UI
        filterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        
        this.render();
      });
    });
  }

  setupSettingsToggle() {
    const openSettingsBtn = document.getElementById('openSettingsBtn');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const tasksSection = document.getElementById('tasks-section');
    const settingsSection = document.getElementById('settings-section');

    openSettingsBtn.addEventListener('click', () => {
      tasksSection.classList.remove('active');
      settingsSection.classList.add('active');
    });

    closeSettingsBtn.addEventListener('click', () => {
      settingsSection.classList.remove('active');
      tasksSection.classList.add('active');
    });
  }

  setupSettings() {
    const leftStackXSlider = document.getElementById('leftStackX');
    const leftStackXValue = document.getElementById('leftStackXValue');
    const rightStackXSlider = document.getElementById('rightStackX');
    const rightStackXValue = document.getElementById('rightStackXValue');
    const minHeightSlider = document.getElementById('minBlockHeight');
    const minHeightValue = document.getElementById('minBlockHeightValue');
    const maxHeightSlider = document.getElementById('maxBlockHeight');
    const maxHeightValue = document.getElementById('maxBlockHeightValue');

    // Mirror toggle
    const mirrorToggle = document.getElementById('mirrorHorizontally');

    // Load saved values
    chrome.storage.local.get(['leftStackX', 'rightStackX', 'minBlockHeight', 'maxBlockHeight', 'mirrorHorizontally'], (data) => {
      const leftX = data.leftStackX !== undefined ? data.leftStackX : 25;
      const rightX = data.rightStackX !== undefined ? data.rightStackX : 75;
      const minHeight = data.minBlockHeight !== undefined ? data.minBlockHeight : 50;
      const maxHeight = data.maxBlockHeight !== undefined ? data.maxBlockHeight : 250;
      const mirror = data.mirrorHorizontally !== undefined ? data.mirrorHorizontally : true;
      
      leftStackXSlider.value = leftX;
      leftStackXValue.textContent = `${leftX}%`;
      rightStackXSlider.value = rightX;
      rightStackXValue.textContent = `${rightX}%`;
      minHeightSlider.value = minHeight;
      minHeightValue.textContent = `${minHeight}px`;
      maxHeightSlider.value = maxHeight;
      maxHeightValue.textContent = `${maxHeight}px`;
      mirrorToggle.checked = mirror;
    });

    // Left Stack X
    leftStackXSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      leftStackXValue.textContent = `${value}%`;
    });

    leftStackXSlider.addEventListener('change', (e) => {
      const value = parseInt(e.target.value);
      this.saveSettings({ leftStackX: value });
      this.notifyContentScript();
    });

    // Right Stack X
    rightStackXSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      rightStackXValue.textContent = `${value}%`;
    });

    rightStackXSlider.addEventListener('change', (e) => {
      const value = parseInt(e.target.value);
      this.saveSettings({ rightStackX: value });
      this.notifyContentScript();
    });

    // Min Block Height
    minHeightSlider.addEventListener('input', (e) => {
      const minHeight = parseInt(e.target.value);
      minHeightValue.textContent = `${minHeight}px`;
      // Ensure min doesn't exceed max
      if (minHeight >= parseInt(maxHeightSlider.value)) {
        maxHeightSlider.value = minHeight + 50;
        maxHeightValue.textContent = `${minHeight + 50}px`;
      }
    });

    minHeightSlider.addEventListener('change', (e) => {
      const minHeight = parseInt(e.target.value);
      this.saveSettings({ minBlockHeight: minHeight });
      this.notifyContentScript();
    });

    // Max Block Height
    maxHeightSlider.addEventListener('input', (e) => {
      const maxHeight = parseInt(e.target.value);
      maxHeightValue.textContent = `${maxHeight}px`;
      // Ensure max doesn't go below min
      if (maxHeight <= parseInt(minHeightSlider.value)) {
        minHeightSlider.value = maxHeight - 50;
        minHeightValue.textContent = `${maxHeight - 50}px`;
      }
    });

    maxHeightSlider.addEventListener('change', (e) => {
      const maxHeight = parseInt(e.target.value);
      this.saveSettings({ maxBlockHeight: maxHeight });
      this.notifyContentScript();
    });

    // Mirror Horizontally toggle
    mirrorToggle.addEventListener('change', (e) => {
      this.saveSettings({ mirrorHorizontally: e.target.checked });
      this.notifyContentScript();
    });
  }

  setupEventListeners() {
    document.getElementById('addTaskBtn').addEventListener('click', () => this.addTask());
    document.getElementById('taskInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addTask();
    });
    document.getElementById('overlayEnabled').addEventListener('change', (e) => {
      this.saveSettings({ overlayEnabled: e.target.checked });
      this.notifyContentScript();
    });
    
    // Presentation step buttons
    document.querySelectorAll('.step-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('disabled')) return;
        
        const step = parseInt(btn.dataset.step);
        this.setPresentationStep(step);
      });
    });
  }

  async addTask() {
    const input = document.getElementById('taskInput');
    const sizeInput = document.getElementById('taskSize');
    const text = input.value.trim();
    const size = parseInt(sizeInput.value) || 10;

    if (!text) return;

    const task = {
      id: this.nextId++,
      text,
      size: Math.max(1, Math.min(100, size)),
      status: 'todo', // default status
      percentComplete: 0 // for partlydone tasks
    };

    this.tasks.push(task);
    input.value = '';
    await this.saveTasks();
    this.render();
    this.notifyContentScript();
  }

  async deleteTask(id) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    await this.saveTasks();
    this.render();
    this.notifyContentScript();
  }

  setPresentationStep(step) {
    this.presentationStep = step;
    
    // Update UI
    document.querySelectorAll('.step-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.step) === step);
    });
    
    this.render();
    this.notifyContentScript();
  }

  async setTaskStatus(taskId, status) {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = status;
      // Initialize percentComplete if switching to partlydone
      if (status === 'partlydone' && task.percentComplete === undefined) {
        task.percentComplete = 0;
      }
      await this.saveTasks();
      this.render();
      this.notifyContentScript();
    }
  }

  async setTaskPercentComplete(taskId, percent) {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      task.percentComplete = Math.max(0, Math.min(100, percent));
      await this.saveTasks();
      this.render();
      this.notifyContentScript();
    }
  }

  render() {
    const tasksList = document.getElementById('tasksList');
    
    // Calculate counts for each status
    const statusCounts = {
      all: this.tasks.length,
      todo: this.tasks.filter(t => t.status === 'todo').length,
      nexttodo: this.tasks.filter(t => t.status === 'nexttodo').length,
      done: this.tasks.filter(t => t.status === 'done').length,
      backlog: this.tasks.filter(t => t.status === 'backlog').length,
      partlydone: this.tasks.filter(t => t.status === 'partlydone').length
    };
    
    // Update pill counts and disabled states
    Object.keys(statusCounts).forEach(status => {
      const countEl = document.getElementById(`count-${status}`);
      const pillEl = document.querySelector(`.filter-pill[data-status="${status}"]`);
      
      if (countEl) {
        countEl.textContent = statusCounts[status];
      }
      
      // Disable pills with 0 tasks (except 'all')
      if (pillEl && status !== 'all') {
        if (statusCounts[status] === 0) {
          pillEl.classList.add('disabled');
          // If this was the active filter and now has 0 tasks, switch to 'all'
          if (this.activeFilter === status) {
            this.activeFilter = 'all';
            pillEl.classList.remove('active');
            document.querySelector('.filter-pill[data-status="all"]').classList.add('active');
          }
        } else {
          pillEl.classList.remove('disabled');
        }
      }
    });
    
    // Filter tasks based on active filter
    const filteredTasks = this.activeFilter === 'all' 
      ? this.tasks 
      : this.tasks.filter(task => task.status === this.activeFilter);
    
    if (filteredTasks.length === 0) {
      tasksList.innerHTML = '<div class="empty-state">No tasks yet. Add one above!</div>';
      this.updateStats();
      return;
    }
    
    tasksList.innerHTML = filteredTasks.map(task => {
      const statusOptions = [
        { value: 'todo', label: '📋 To-Do', color: '#667eea' },
        { value: 'nexttodo', label: '⏭️ Next To-Do', color: '#4facfe' },
        { value: 'done', label: '✅ Done', color: '#28a745' },
        { value: 'backlog', label: '📦 Backlog', color: '#999' },
        { value: 'partlydone', label: '⏸️ Partly Done', color: '#ffa500' }
      ];
      
      const currentStatus = task.status || 'todo';
      const currentStatusInfo = statusOptions.find(s => s.value === currentStatus);
      
      return `
      <div class="task-item" data-id="${task.id}" style="border-left: 4px solid ${currentStatusInfo.color}">
        <div class="task-header">
          <span class="task-text">${this.escapeHtml(task.text)}</span>
        </div>
        <div class="task-status-control">
          <select class="status-select" data-id="${task.id}">
            ${statusOptions.map(opt => `
              <option value="${opt.value}" ${currentStatus === opt.value ? 'selected' : ''}>
                ${opt.label}
              </option>
            `).join('')}
          </select>
          <span class="task-size">${task.size}%</span>
          <button class="delete-btn" data-action="delete" data-id="${task.id}">🗑️</button>
        </div>
        ${currentStatus === 'partlydone' ? `
        <div class="task-percent-control">
          <label>Progress:</label>
          <input type="number" class="percent-input" data-id="${task.id}" 
                 value="${task.percentComplete || 0}" min="0" max="100" step="5" />
          <span>% complete</span>
        </div>
        ` : ''}
      </div>
    `;
    }).join('');

    // Add click handlers
    tasksList.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const id = parseInt(btn.dataset.id);
        
        if (action === 'delete') this.deleteTask(id);
      });
    });
    
    // Status dropdown change handlers
    tasksList.querySelectorAll('.status-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const id = parseInt(select.dataset.id);
        const status = select.value;
        this.setTaskStatus(id, status);
      });
    });
    
    // Percent complete input handlers
    tasksList.querySelectorAll('.percent-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const id = parseInt(input.dataset.id);
        const percent = parseInt(input.value);
        this.setTaskPercentComplete(id, percent);
      });
    });

    // Click task (removed toggle behavior, now only status dropdown controls status)
    tasksList.querySelectorAll('.task-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Only if not clicking on interactive elements
        if (!e.target.closest('.status-select') && !e.target.closest('[data-action]')) {
          // Could add other click behaviors here if needed
        }
      });
    });

    this.updateStats();
  }

  updateStats() {
    // Calculate total based on presentation step
    let total = 0;
    if (this.presentationStep === 1) {
      // Step 1: Count left stack (todo, done, partlydone)
      total = this.tasks
        .filter(t => t.status === 'todo' || t.status === 'done' || t.status === 'partlydone')
        .reduce((sum, task) => sum + task.size, 0);
    } else if (this.presentationStep === 2) {
      // Step 2: Count right stack (done, partlydone)
      total = this.tasks
        .filter(t => t.status === 'done' || t.status === 'partlydone')
        .reduce((sum, task) => sum + task.size, 0);
    } else if (this.presentationStep === 3) {
      // Step 3: Count left stack (todo, partlydone, nexttodo)
      total = this.tasks
        .filter(t => t.status === 'todo' || t.status === 'partlydone' || t.status === 'nexttodo')
        .reduce((sum, task) => sum + task.size, 0);
    } else {
      // Step 0 or other: Count all tasks
      total = this.tasks.reduce((sum, task) => sum + task.size, 0);
    }
    
    const totalEl = document.getElementById('totalProgress');
    totalEl.textContent = `${total}%`;
    totalEl.style.color = total > 100 ? '#dc3545' : '#28a745';
  }

  async saveTasks() {
    await chrome.storage.local.set({ tasks: this.tasks, nextId: this.nextId });
  }

  async loadTasks() {
    const data = await chrome.storage.local.get(['tasks', 'nextId', 'overlayEnabled', 'leftStackX', 'rightStackX', 'minBlockHeight', 'maxBlockHeight']);
    this.tasks = data.tasks || [];
    // Ensure all partlydone tasks have percentComplete property
    this.tasks.forEach(task => {
      if (task.status === 'partlydone' && task.percentComplete === undefined) {
        task.percentComplete = 0;
      }
    });
    this.nextId = data.nextId || 1;
    document.getElementById('overlayEnabled').checked = data.overlayEnabled !== false;
  }

  async saveSettings(settings) {
    await chrome.storage.local.set(settings);
  }

  async notifyContentScript() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      const data = await chrome.storage.local.get(['tasks', 'overlayEnabled', 'leftStackX', 'rightStackX', 'minBlockHeight', 'maxBlockHeight', 'mirrorHorizontally']);
      chrome.tabs.sendMessage(tab.id, { 
        type: 'UPDATE_TASKS', 
        tasks: data.tasks || [],
        overlayEnabled: data.overlayEnabled !== false,
        leftStackX: data.leftStackX !== undefined ? data.leftStackX : 25,
        rightStackX: data.rightStackX !== undefined ? data.rightStackX : 75,
        minBlockHeight: data.minBlockHeight !== undefined ? data.minBlockHeight : 50,
        maxBlockHeight: data.maxBlockHeight !== undefined ? data.maxBlockHeight : 250,
        mirrorHorizontally: data.mirrorHorizontally !== undefined ? data.mirrorHorizontally : true,
        presentationStep: this.presentationStep
      }).catch(() => {
        // Tab might not have content script injected
      });
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize
new TaskManager();
