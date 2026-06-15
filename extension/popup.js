// Task management for popup
class TaskManager {
  constructor() {
    this.tasks = [];
    this.nextId = 1;
    this.presentationStep = 0; // 0=editing, 1=yesterday, 2=progress, 3=today, 4=blockers
    this.init();
  }

  async init() {
    await this.loadTasks();
    this.setupEventListeners();
    this.setupTabs();
    this.setupSettings();
    this.render();
  }

  setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        
        // Update active tab button
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update active tab content
        tabContents.forEach(content => {
          if (content.id === `${tabName}-tab`) {
            content.classList.add('active');
          } else {
            content.classList.remove('active');
          }
        });
      });
    });
  }

  setupSettings() {
    const safeZoneSlider = document.getElementById('safeZoneSize');
    const safeZoneValue = document.getElementById('safeZoneSizeValue');
    const offsetXSlider = document.getElementById('safeZoneOffsetX');
    const offsetXValue = document.getElementById('safeZoneOffsetXValue');
    const offsetYSlider = document.getElementById('safeZoneOffsetY');
    const offsetYValue = document.getElementById('safeZoneOffsetYValue');
    const minSizeSlider = document.getElementById('minBubbleSize');
    const minSizeValue = document.getElementById('minBubbleSizeValue');
    const maxSizeSlider = document.getElementById('maxBubbleSize');
    const maxSizeValue = document.getElementById('maxBubbleSizeValue');
    const previewCircle = document.getElementById('previewCircle');

    // Load saved values
    chrome.storage.local.get(['safeZoneSize', 'safeZoneOffsetX', 'safeZoneOffsetY', 'minBubbleSize', 'maxBubbleSize'], (data) => {
      const size = data.safeZoneSize !== undefined ? data.safeZoneSize : 200;
      const offsetX = data.safeZoneOffsetX !== undefined ? data.safeZoneOffsetX : 0;
      const offsetY = data.safeZoneOffsetY !== undefined ? data.safeZoneOffsetY : 0;
      
      safeZoneSlider.value = size;
      safeZoneValue.textContent = `${size}px`;
      offsetXSlider.value = offsetX;
      offsetXValue.textContent = `${offsetX}px`;
      offsetYSlider.value = offsetY;
      offsetYValue.textContent = `${offsetY}px`;
      
      const minSize = data.minBubbleSize !== undefined ? data.minBubbleSize : 40;
      const maxSize = data.maxBubbleSize !== undefined ? data.maxBubbleSize : 200;
      minSizeSlider.value = minSize;
      minSizeValue.textContent = `${minSize}px`;
      maxSizeSlider.value = maxSize;
      maxSizeValue.textContent = `${maxSize}px`;
      
      this.updatePreview(size, offsetX, offsetY);
    });

    safeZoneSlider.addEventListener('input', (e) => {
      const size = parseInt(e.target.value);
      safeZoneValue.textContent = `${size}px`;
      this.updatePreview(size, parseInt(offsetXSlider.value), parseInt(offsetYSlider.value));
    });

    safeZoneSlider.addEventListener('change', (e) => {
      const size = parseInt(e.target.value);
      this.saveSettings({ safeZoneSize: size });
      this.notifyContentScript();
    });

    offsetXSlider.addEventListener('input', (e) => {
      const offsetX = parseInt(e.target.value);
      offsetXValue.textContent = `${offsetX}px`;
      this.updatePreview(parseInt(safeZoneSlider.value), offsetX, parseInt(offsetYSlider.value));
    });

    offsetXSlider.addEventListener('change', (e) => {
      const offsetX = parseInt(e.target.value);
      this.saveSettings({ safeZoneOffsetX: offsetX });
      this.notifyContentScript();
    });

    offsetYSlider.addEventListener('input', (e) => {
      const offsetY = parseInt(e.target.value);
      offsetYValue.textContent = `${offsetY}px`;
      this.updatePreview(parseInt(safeZoneSlider.value), parseInt(offsetXSlider.value), offsetY);
    });

    offsetYSlider.addEventListener('change', (e) => {
      const offsetY = parseInt(e.target.value);
      this.saveSettings({ safeZoneOffsetY: offsetY });
      this.notifyContentScript();
    });

    minSizeSlider.addEventListener('input', (e) => {
      const minSize = parseInt(e.target.value);
      minSizeValue.textContent = `${minSize}px`;
      // Ensure min doesn't exceed max
      if (minSize >= parseInt(maxSizeSlider.value)) {
        maxSizeSlider.value = minSize + 20;
        maxSizeValue.textContent = `${minSize + 20}px`;
      }
    });

    minSizeSlider.addEventListener('change', (e) => {
      const minSize = parseInt(e.target.value);
      this.saveSettings({ minBubbleSize: minSize });
      this.notifyContentScript();
    });

    maxSizeSlider.addEventListener('input', (e) => {
      const maxSize = parseInt(e.target.value);
      maxSizeValue.textContent = `${maxSize}px`;
      // Ensure max doesn't go below min
      if (maxSize <= parseInt(minSizeSlider.value)) {
        minSizeSlider.value = maxSize - 20;
        minSizeValue.textContent = `${maxSize - 20}px`;
      }
    });

    maxSizeSlider.addEventListener('change', (e) => {
      const maxSize = parseInt(e.target.value);
      this.saveSettings({ maxBubbleSize: maxSize });
      this.notifyContentScript();
    });
  }

  updatePreview(size, offsetX, offsetY) {
    const previewCircle = document.getElementById('previewCircle');
    // Scale to preview (150px SVG = ~700px video, so radius scaled down)
    const previewRadius = (size / 700) * 70;
    const previewOffsetX = (offsetX / 700) * 70;
    const previewOffsetY = (offsetY / 700) * 70;
    
    previewCircle.setAttribute('r', Math.max(5, Math.min(70, previewRadius)));
    previewCircle.setAttribute('cx', 75 + previewOffsetX);
    previewCircle.setAttribute('cy', 75 + previewOffsetY);
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
    
    const labels = [
      'Editing Tasks',
      'Yesterday\'s Tasks',
      'Show Progress',
      'Today\'s Plan',
      'Blockers'
    ];
    document.getElementById('currentStepLabel').textContent = labels[step] || 'Unknown';
    
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
    
    tasksList.innerHTML = this.tasks.map(task => {
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
          <div class="task-actions">
            <button class="delete-btn" data-action="delete" data-id="${task.id}">🗑️</button>
          </div>
        </div>
        <div class="task-size">
          <div class="size-bar">
            <div class="size-fill" style="width: ${Math.min(task.size, 100)}%; background: ${currentStatusInfo.color}"></div>
          </div>
          <span class="size-label">${task.size}%</span>
        </div>
        <div class="task-status-control">
          <label>Status:</label>
          <select class="status-select" data-id="${task.id}">
            ${statusOptions.map(opt => `
              <option value="${opt.value}" ${currentStatus === opt.value ? 'selected' : ''}>
                ${opt.label}
              </option>
            `).join('')}
          </select>
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
    const total = this.tasks.reduce((sum, task) => sum + task.size, 0);
    const totalEl = document.getElementById('totalProgress');
    totalEl.textContent = `${total}%`;
    totalEl.style.color = total > 100 ? '#dc3545' : '#28a745';
  }

  async saveTasks() {
    await chrome.storage.local.set({ tasks: this.tasks, nextId: this.nextId });
  }

  async loadTasks() {
    const data = await chrome.storage.local.get(['tasks', 'nextId', 'overlayEnabled', 'safeZoneSize', 'safeZoneOffsetX', 'safeZoneOffsetY', 'minBubbleSize', 'maxBubbleSize']);
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
      const data = await chrome.storage.local.get(['tasks', 'overlayEnabled', 'safeZoneSize', 'safeZoneOffsetX', 'safeZoneOffsetY', 'minBubbleSize', 'maxBubbleSize']);
      chrome.tabs.sendMessage(tab.id, { 
        type: 'UPDATE_TASKS', 
        tasks: data.tasks || [],
        overlayEnabled: data.overlayEnabled !== false,
        safeZoneSize: data.safeZoneSize !== undefined ? data.safeZoneSize : 200,
        safeZoneOffsetX: data.safeZoneOffsetX !== undefined ? data.safeZoneOffsetX : 0,
        safeZoneOffsetY: data.safeZoneOffsetY !== undefined ? data.safeZoneOffsetY : 0,
        minBubbleSize: data.minBubbleSize !== undefined ? data.minBubbleSize : 40,
        maxBubbleSize: data.maxBubbleSize !== undefined ? data.maxBubbleSize : 200,
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
