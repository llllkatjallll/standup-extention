# 📋 Standup Overlay

A web application that displays your daily standup talking points as an overlay on your webcam feed. Perfect for keeping team members engaged during daily standup meetings!

## ✨ Features

- **Task Management**: Add, complete, and delete tasks with ease
- **Size Allocation**: Assign a percentage of your day to each task (0-100%)
- **Visual Progress**: See completion status with engaging animations
- **Overload Detection**: Total percentage shown in red when exceeding 100%
- **Webcam Overlay**: Real-time overlay rendering on your webcam feed
- **Virtual Webcam Ready**: Use with OBS or similar tools to create a virtual webcam

## 🚀 Quick Start

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

This will start the development server at `http://localhost:3000` and open it in your browser.

### Build for Production

```bash
npm run build
```

## 📖 How to Use

### 1. Add Tasks

- Type your task in the input field
- Set the percentage of your day it represents (default: 10%)
- Click "Add Task" or press Enter

### 2. Manage Tasks

- **Complete**: Click the ✓ button to mark a task as done (animated celebration!)
- **Uncomplete**: Click the ↩️ button to mark it incomplete again
- **Delete**: Click the 🗑️ button to remove a task

### 3. Start Camera

- Click "Start Camera" to access your webcam
- Grant camera permissions when prompted
- The overlay will appear on your video feed

### 4. Use as Virtual Webcam

#### Option A: OBS Studio (Recommended)

1. Open OBS Studio
2. Add a "Browser Source"
3. Set URL to: `http://localhost:3000`
4. Set dimensions to match your desired output (e.g., 1920x1080)
5. Click in the preview to ensure the page loads
6. Add to your scene
7. Start "Virtual Camera" in OBS
8. Select "OBS Virtual Camera" in Google Meet/Zoom/Teams

#### Option B: Window Capture

1. Keep the browser window visible
2. Use your meeting software's "Share Screen" or "Share Window" feature
3. Select the browser window

## 💡 Tips

- **Overloaded?**: If your total exceeds 100%, it signals you have too much on your plate
- **Engagement**: Mark tasks as done during the meeting for a visual celebration
- **Persistence**: Your tasks are saved in browser localStorage
- **Toggle Overlay**: Use the "Toggle Overlay" button to hide/show tasks temporarily

## 🛠️ Technology Stack

- **Vite**: Fast development server and build tool
- **TypeScript**: Type-safe code
- **Canvas API**: Overlay rendering
- **WebRTC**: Webcam access
- **LocalStorage**: Task persistence

## 🎨 Customization

You can customize the appearance by editing:

- `src/style.css` - Colors, spacing, and layout
- `src/main.ts` - Overlay design in the `drawTaskOverlay()` method

### Overlay Customization Examples

Change colors:
```typescript
// In drawTaskOverlay(), modify these lines:
this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // Background opacity
this.ctx.strokeStyle = 'rgba(102, 126, 234, 0.8)'; // Border color
```

Adjust positioning:
```typescript
const padding = 40; // Distance from edges
const taskHeight = 60; // Height of each task
const gap = 15; // Space between tasks
```

## 📝 Keyboard Shortcuts

- **Enter** in task input: Add new task
- **Tab**: Navigate between fields

## 🔒 Privacy

- All data is stored locally in your browser
- No data is sent to any server
- Webcam access is only used locally in your browser

## 🐛 Troubleshooting

### Camera not working?

- Ensure you've granted camera permissions
- Check if another application is using the camera
- Try refreshing the page
- Check browser console for errors

### Overlay not showing in OBS?

- Make sure the browser source is set to the correct URL
- Click in the browser source preview to activate it
- Check that the source dimensions are reasonable (1280x720 or 1920x1080)
- Ensure "Shutdown source when not visible" is unchecked

### Tasks not persisting?

- Check that localStorage is enabled in your browser
- Ensure you're using the same browser and URL

## 🤝 Contributing

Feel free to customize this tool for your team's needs!

## 📄 License

MIT - Use freely for personal or commercial projects

---

Made with ❤️ for better standup meetings
