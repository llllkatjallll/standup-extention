// Task management for popup
class TaskManager {
  constructor() {
    this.tasks = [];
    this.nextId = 1;
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
      completed: false
    };

    this.tasks.push(task);
    input.value = '';
    await this.saveTasks();
    this.render();
    this.notifyContentScript();
  }

  async toggleTask(id) {
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      task.completed = !task.completed;
      task.completedAt = task.completed ? Date.now() : undefined;
      await this.saveTasks();
      this.render();
      this.notifyContentScript();
    }
  }

  async deleteTask(id) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    await this.saveTasks();
    this.render();
    this.notifyContentScript();
  }

  render() {
    const tasksList = document.getElementById('tasksList');
    tasksList.innerHTML = this.tasks.map(task => `
      <div class="task-item ${task.completed ? 'completed' : ''}" data-id="${task.id}">
        <div class="task-header">
          <span class="task-text">${this.escapeHtml(task.text)}</span>
          <div class="task-actions">
            <button class="complete-btn" data-action="toggle" data-id="${task.id}">
              ${task.completed ? '↩️' : '✓'}
            </button>
            <button class="delete-btn" data-action="delete" data-id="${task.id}">🗑️</button>
          </div>
        </div>
        <div class="task-size">
          <div class="size-bar">
            <div class="size-fill" style="width: ${Math.min(task.size, 100)}%"></div>
          </div>
          <span class="size-label">${task.size}%</span>
        </div>
      </div>
    `).join('');

    // Add click handlers
    tasksList.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const id = parseInt(btn.dataset.id);
        if (action === 'toggle') this.toggleTask(id);
        if (action === 'delete') this.deleteTask(id);
      });
    });

    // Click task to toggle
    tasksList.querySelectorAll('.task-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = parseInt(item.dataset.id);
        this.toggleTask(id);
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
        maxBubbleSize: data.maxBubbleSize !== undefined ? data.maxBubbleSize : 200
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
