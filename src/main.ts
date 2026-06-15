interface Task {
  id: number;
  text: string;
  size: number; // percentage of day
  completed: boolean;
  completedAt?: number; // timestamp for animation
}

class StandupOverlay {
  private tasks: Task[] = [];
  private nextId = 1;
  private webcamStream: MediaStream | null = null;
  private overlayEnabled = true;
  private animationFrame: number | null = null;

  // DOM elements
  private taskInput: HTMLInputElement;
  private taskSize: HTMLInputElement;
  private addTaskBtn: HTMLButtonElement;
  private tasksList: HTMLElement;
  private totalProgress: HTMLElement;
  private startCameraBtn: HTMLButtonElement;
  private toggleOverlayBtn: HTMLButtonElement;
  private webcam: HTMLVideoElement;
  private overlay: HTMLCanvasElement;
  private placeholder: HTMLElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    // Initialize DOM elements
    this.taskInput = document.getElementById('taskInput') as HTMLInputElement;
    this.taskSize = document.getElementById('taskSize') as HTMLInputElement;
    this.addTaskBtn = document.getElementById('addTaskBtn') as HTMLButtonElement;
    this.tasksList = document.getElementById('tasksList') as HTMLElement;
    this.totalProgress = document.getElementById('totalProgress') as HTMLElement;
    this.startCameraBtn = document.getElementById('startCameraBtn') as HTMLButtonElement;
    this.toggleOverlayBtn = document.getElementById('toggleOverlayBtn') as HTMLButtonElement;
    this.webcam = document.getElementById('webcam') as HTMLVideoElement;
    this.overlay = document.getElementById('overlay') as HTMLCanvasElement;
    this.placeholder = document.getElementById('cameraPlaceholder') as HTMLElement;
    this.ctx = this.overlay.getContext('2d')!;

    this.initializeEventListeners();
    this.loadTasks();
    this.renderTasksList();
    this.updateStats();
  }

  private initializeEventListeners(): void {
    this.addTaskBtn.addEventListener('click', () => this.addTask());
    this.taskInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addTask();
    });
    this.startCameraBtn.addEventListener('click', () => this.startCamera());
    this.toggleOverlayBtn.addEventListener('click', () => this.toggleOverlay());
  }

  private addTask(): void {
    const text = this.taskInput.value.trim();
    const size = parseInt(this.taskSize.value) || 10;

    if (!text) return;

    const task: Task = {
      id: this.nextId++,
      text,
      size: Math.max(1, Math.min(100, size)),
      completed: false
    };

    this.tasks.push(task);
    this.taskInput.value = '';
    this.saveTasks();
    this.renderTasksList();
    this.updateStats();
  }

  private toggleTask(id: number): void {
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      task.completed = !task.completed;
      if (task.completed) {
        task.completedAt = Date.now();
      } else {
        delete task.completedAt;
      }
      this.saveTasks();
      this.renderTasksList();
      this.updateStats();
    }
  }

  private deleteTask(id: number): void {
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.saveTasks();
    this.renderTasksList();
    this.updateStats();
  }

  private renderTasksList(): void {
    this.tasksList.innerHTML = this.tasks.map(task => `
      <div class="task-item ${task.completed ? 'completed' : ''}" data-id="${task.id}">
        <div class="task-header">
          <span class="task-text">${this.escapeHtml(task.text)}</span>
          <div class="task-actions">
            <button class="complete-btn" onclick="app.toggleTask(${task.id})">
              ${task.completed ? '↩️' : '✓'}
            </button>
            <button class="delete-btn" onclick="app.deleteTask(${task.id})">🗑️</button>
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
  }

  private updateStats(): void {
    const total = this.tasks.reduce((sum, task) => sum + task.size, 0);
    this.totalProgress.textContent = `${total}%`;
    this.totalProgress.style.color = total > 100 ? '#dc3545' : '#667eea';
  }

  private async startCamera(): Promise<void> {
    try {
      this.webcamStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      this.webcam.srcObject = this.webcamStream;
      this.webcam.classList.add('active');
      this.placeholder.classList.add('hidden');
      this.startCameraBtn.disabled = true;
      this.toggleOverlayBtn.disabled = false;

      // Wait for video to load
      await this.webcam.play();

      // Set canvas size to match video
      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());

      // Start rendering overlay
      this.renderOverlay();

    } catch (error) {
      console.error('Error accessing webcam:', error);
      alert('Could not access webcam. Please ensure you have granted camera permissions.');
    }
  }

  private resizeCanvas(): void {
    this.overlay.width = this.webcam.videoWidth || this.webcam.clientWidth;
    this.overlay.height = this.webcam.videoHeight || this.webcam.clientHeight;
  }

  private toggleOverlay(): void {
    this.overlayEnabled = !this.overlayEnabled;
    this.toggleOverlayBtn.textContent = this.overlayEnabled ? '👁️ Toggle Overlay' : '👁️‍🗨️ Overlay Hidden';
  }

  private renderOverlay(): void {
    if (!this.webcamStream) return;

    const animate = () => {
      this.ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);

      if (this.overlayEnabled) {
        this.drawTaskOverlay();
      }

      this.animationFrame = requestAnimationFrame(animate);
    };

    animate();
  }

  private drawTaskOverlay(): void {
    const width = this.overlay.width;
    const height = this.overlay.height;
    const padding = 40;
    const taskHeight = 60;
    const gap = 15;

    // Draw semi-transparent background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    const bgHeight = this.tasks.length * (taskHeight + gap) + padding * 2;
    this.ctx.fillRect(padding, padding, width - padding * 2, bgHeight);

    // Draw border
    this.ctx.strokeStyle = 'rgba(102, 126, 234, 0.8)';
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(padding, padding, width - padding * 2, bgHeight);

    // Draw tasks
    let yOffset = padding + 25;

    this.tasks.forEach((task, index) => {
      const x = padding + 20;
      const y = yOffset + index * (taskHeight + gap);

      // Completion animation
      let scale = 1;
      if (task.completed && task.completedAt) {
        const elapsed = Date.now() - task.completedAt;
        if (elapsed < 500) {
          scale = 1 + Math.sin((elapsed / 500) * Math.PI) * 0.3;
        }
      }

      this.ctx.save();
      this.ctx.translate(x, y);
      this.ctx.scale(scale, scale);

      // Checkbox
      const checkSize = 24;
      this.ctx.fillStyle = task.completed ? '#28a745' : 'rgba(255, 255, 255, 0.2)';
      this.ctx.fillRect(0, 0, checkSize, checkSize);
      this.ctx.strokeStyle = 'white';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(0, 0, checkSize, checkSize);

      if (task.completed) {
        // Draw checkmark
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(6, 12);
        this.ctx.lineTo(10, 17);
        this.ctx.lineTo(18, 7);
        this.ctx.stroke();
      }

      // Task text
      this.ctx.fillStyle = 'white';
      this.ctx.font = 'bold 18px Arial';
      const textX = checkSize + 15;
      this.ctx.fillText(task.text, textX, 18);

      if (task.completed) {
        // Strikethrough
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 2;
        const textWidth = this.ctx.measureText(task.text).width;
        this.ctx.beginPath();
        this.ctx.moveTo(textX, 10);
        this.ctx.lineTo(textX + textWidth, 10);
        this.ctx.stroke();
      }

      // Progress bar
      const barY = 30;
      const barWidth = 300;
      const barHeight = 12;

      // Background
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      this.ctx.fillRect(textX, barY, barWidth, barHeight);

      // Fill
      const fillWidth = (barWidth * task.size) / 100;
      const gradient = this.ctx.createLinearGradient(textX, 0, textX + fillWidth, 0);
      if (task.completed) {
        gradient.addColorStop(0, '#28a745');
        gradient.addColorStop(1, '#20c997');
      } else {
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
      }
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(textX, barY, fillWidth, barHeight);

      // Percentage label
      this.ctx.fillStyle = 'white';
      this.ctx.font = 'bold 16px Arial';
      this.ctx.fillText(`${task.size}%`, textX + barWidth + 10, barY + 10);

      this.ctx.restore();
    });

    // Draw total percentage at bottom
    const totalY = yOffset + this.tasks.length * (taskHeight + gap) + 10;
    const total = this.tasks.reduce((sum, t) => sum + t.size, 0);
    this.ctx.fillStyle = total > 100 ? '#dc3545' : '#28a745';
    this.ctx.font = 'bold 24px Arial';
    const totalText = `Total: ${total}%`;
    const totalWidth = this.ctx.measureText(totalText).width;
    this.ctx.fillText(totalText, width - padding - 20 - totalWidth, totalY);
  }

  private saveTasks(): void {
    localStorage.setItem('standup-tasks', JSON.stringify(this.tasks));
  }

  private loadTasks(): void {
    const saved = localStorage.getItem('standup-tasks');
    if (saved) {
      try {
        this.tasks = JSON.parse(saved);
        this.nextId = Math.max(...this.tasks.map(t => t.id), 0) + 1;
      } catch (e) {
        console.error('Error loading tasks:', e);
      }
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Public methods for HTML onclick handlers
  public toggleTask(id: number): void {
    this.toggleTask(id);
  }

  public deleteTask(id: number): void {
    this.deleteTask(id);
  }
}

// Initialize app
const app = new StandupOverlay();

// Expose to window for HTML onclick handlers
(window as any).app = app;
