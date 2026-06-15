# 📋 Standup Overlay Browser Extension

A Chrome/Edge browser extension that displays your standup tasks as **stacking blocks** overlaid on your webcam in video meetings - **no OBS required!**

> 🎯 **TL;DR**: Install extension → Add tasks → Join meeting → Turn on camera → Present with 3 structured steps

## ✨ Features

### Core Functionality
- **Direct webcam injection** - Works in Google Meet, Zoom, Teams, and Webex
- **Physics-based stacking** - Tasks appear as colorful pill-shaped blocks that stack and settle using Matter.js physics
- **4-step presentation mode** - Guide your daily standup with structured steps:
  - **Step 1: Yesterday's Tasks** - Show what you worked on
  - **Step 2: Show Progress** - Split into TO-DO and DONE stacks
  - **Step 3: Today's Plan** - Display today's tasks and backlog
- **5-state task system**:
  - 🗒️ **To-Do** - Not started yet
  - ⏭️ **Next To-Do** - Planned for today
  - ✅ **Done** - Completed
  - ⏸️ **Partly Done** - In progress with completion percentage
  - 📦 **Backlog** - Low priority items
- **Zero setup** - Just install and use in your meetings

### Visual Design
- **Pill-shaped blocks** - Modern, rounded block design (250px wide, height based on task size)
- **Consistent task colors** - Each task gets a unique color that stays consistent across steps
- **Google Sans font** - Professional, clean typography
- **Progress bars** - Partly done tasks show visual progress indicators
- **Smart positioning** - Configurable left/right stack positions
- **Horizontal mirror toggle** - Flip overlay to match your preference

### Task Management
- **Status-based filtering** - Single-select pills for All, To-Do, Next, Done, Backlog, Partly
- **Dynamic sizing** - Task size (%) determines block height (30-400px range)
- **Real-time updates** - Modify tasks during your meeting
- **Step-aware totals** - Percentage counts only relevant stack for each step
- **Overload detection** - Visual indicator when total exceeds 100%

## 🚀 Installation

### Method 1: Load Unpacked Extension (Development)

1. **Open Extension Management**
   - Chrome/Edge: Navigate to `chrome://extensions/` or `edge://extensions/`
   - Enable "Developer mode" (toggle in top-right)

2. **Load the Extension**
   - Click "Load unpacked"
   - Select the `extension` folder in this project
   - The extension icon should appear in your toolbar

3. **Generate Icons** (First time only)
   - Open `extension/icons/generate-icons.html` in your browser
   - Right-click each canvas and "Save image as..."
   - Save as `icon16.png`, `icon48.png`, and `icon128.png` in the `extension/icons/` folder
   - Reload the extension

### Method 2: Build and Package (Production)

```bash
# From project root
cd extension
# Zip the folder
# Then upload to Chrome Web Store
```

## 📖 How to Use

### 1. Set Up Your Tasks

1. Click the extension icon in your browser toolbar
2. Add your standup tasks:
   - Type task name
   - Set size percentage (default: 10%)
   - Click `+` to add
3. Organize tasks by status:
   - **To-Do**: Yesterday's incomplete work
   - **Done**: Yesterday's completed work
   - **Next To-Do**: Today's planned tasks
   - **Partly Done**: Tasks in progress (set completion %)
   - **Backlog**: Low-priority items

### 2. Join Your Meeting

1. Go to your video conferencing platform:
   - Google Meet: `meet.google.com`
   - Zoom: `zoom.us` (web version)
   - Microsoft Teams: `teams.microsoft.com` (web version)
   - Webex: `webex.com`

2. **Turn on your camera**
3. Your tasks will automatically appear as stacking blocks!

### 3. Present Your Standup (4-Step Mode)

The extension guides you through your daily standup:

**Step 1: Yesterday's Tasks** (Default)
- Shows all tasks you worked on yesterday
- Displays: To-Do + Done + Partly Done
- Single stack on left side
- Label: "TO-DO YESTERDAY"
- **Total**: Counts only left stack tasks

**Step 2: Show Progress**
- Splits into two stacks to show progress
- Left stack: Remaining work (To-Do + Partly Done showing remaining %)
- Right stack: Completed work (Done + Partly Done showing completed %)
- Labels: "TO-DO YESTERDAY" (left) and "DONE YESTERDAY" (right)
- **Total**: Counts only right stack (completed work)

**Step 3: Today's Plan**
- Shows today's focus and backlog
- Left stack: Today's plan (To-Do + Partly Done + Next To-Do)
- Right stack: Backlog items (gray background)
- Labels: "TO-DO TODAY" (left) and "BACKLOG" (right)
- **Total**: Counts only left stack (today's tasks)

### 4. Manage During Meeting

- **Switch steps**: Click step buttons (1, 2, 3) in popup
- **Change status**: Use dropdown in task list
- **Filter view**: Click status pills to see specific tasks
- **Adjust settings**: Click ⚙️ icon for customization
- Changes update instantly on your video feed

## 🎯 Supported Platforms

| Platform | Support | Notes |
|----------|---------|-------|
| Google Meet | ✅ Full | Works perfectly |
| Zoom Web | ✅ Full | Must use web version |
| Microsoft Teams Web | ✅ Full | Must use web version |
| Webex | ✅ Full | Works in browser |
| Zoom Desktop App | ❌ No | Extension can't inject into desktop apps |
| Teams Desktop App | ❌ No | Extension can't inject into desktop apps |

**Note**: Desktop applications cannot be modified by browser extensions. Use the web versions of these platforms.

## 🔧 How It Works

The extension uses several advanced techniques:

1. **Stream Interception**: Intercepts `getUserMedia()` API calls from meeting platforms
2. **Canvas Overlay**: Renders task blocks on a 2D canvas with your webcam feed
3. **Physics Simulation**: Uses Matter.js (v0.19.0) for realistic block stacking and settling
4. **Stream Replacement**: Returns the modified canvas stream to the meeting platform
5. **Font Loading**: Loads Google Sans Medium font via FontFace API for professional typography
6. **Performance Optimization**: 
   - 20 FPS throttling to reduce memory pressure
   - Body sleeping when physics settles
   - Spatial partitioning for collision detection

This happens entirely in your browser - no external servers, virtual camera drivers, or OBS needed!

## ⚙️ Settings

Click the ⚙️ icon in the extension popup to customize:

### 📍 Stack Positions
- **Left Stack Position**: 10-40% (default: 25%)
- **Right Stack Position**: 60-90% (default: 75%)

### 📏 Task Block Heights
- **Minimum Block Height**: 30-100px (default: 50px)
- **Maximum Block Height**: 150-400px (default: 250px)

### 🔄 Display Options
- **Mirror overlay horizontally**: Toggle to flip the overlay (default: ON)
  - When enabled: overlay is mirrored (matches most webcam behaviors)
  - When disabled: overlay shows in original orientation

### Visual Indicators
- **Total Percentage**: Shows in corner during presentation
  - Green: ≤100% (manageable workload)
  - Red: >100% (overloaded)
- **Labels**: White background pills at bottom showing current step context

## 🎨 Customization

### Color System
- 12-color palette with consistent assignment based on task ID
- Backlog tasks always show gray background (#999999)
- Black text on all blocks for optimal readability

### Task Size to Height Mapping
```javascript
blockHeight = minHeight + (taskSize / 100) * (maxHeight - minHeight)
// Example with defaults:
// 10% task = 50 + (10/100) * (250-50) = 70px
// 50% task = 50 + (50/100) * (250-50) = 150px
// 100% task = 50 + (100/100) * (250-50) = 250px
```

### Physics Parameters
- Gravity: 0.5 (gentle falling)
- Restitution: 0.2 (low bounce)
- Friction: 0.9 (stable stacking)
- Inertia: Infinity (prevents rotation)
- Ground: 80px from bottom (room for labels)

Edit [injected.js](extension/injected.js):

```javascript
// Change overlay position
const padding = 30; // Distance from edges

// Change colors
ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'; // Background opacity
ctx.strokeStyle = 'rgba(102, 126, 234, 0.9)'; // Border color

// Change task spacing
const taskHeight = 50;
const gap = 12;
```

### Modify Popup UI

Edit [popup.css](extension/popup.css) to change colors, fonts, and layout.

## 🐛 Troubleshooting

### Overlay not showing?

1. ✅ Ensure you're using a **supported platform** (see table above)
2. ✅ Check that "Show overlay in meetings" is **enabled** in the popup
3. ✅ Make sure you've **turned on your camera** in the meeting
4. ✅ Verify you have **tasks added** in the extension
5. ✅ Verify you're on a presentation **step** (1, 2, or 3) - not step 0
6. ✅ Reload the meeting page after installing the extension
7. ✅ Check browser console (F12) for error messages

### Extension not appearing?

1. ✅ Verify the extension is **enabled** in `chrome://extensions/`
2. ✅ Make sure all icon files exist in the `icons/` folder
3. ✅ Click "Reload" button on the extension card
4. ✅ Check that manifest.json is valid
5. ✅ Verify GoogleSans-Medium.ttf and matter.min.js are present

### Tasks not updating in meeting?

1. ✅ Try toggling the overlay off and on
2. ✅ Switch to a different step and back
3. ✅ Reload the meeting page
4. ✅ Check that chrome.storage permissions are granted
5. ✅ Open DevTools console and look for "Tasks updated" messages

### Physics issues (blocks escaping or not settling)?

1. ✅ Wait 2-3 seconds for blocks to settle
2. ✅ Reduce number of tasks (5-8 works best)
3. ✅ Check that Matter.js loaded (console message)
4. ✅ Adjust stack positions in settings
5. ✅ Try toggling mirror setting

### Desktop app not working?

- Browser extensions **cannot** modify desktop applications
- Use the **web version** of your meeting platform instead:
  - Google Meet: `meet.google.com`
  - Zoom: `zoom.us/wc/join/...`
  - Teams: `teams.microsoft.com`
  - Webex: `webex.com`

### Performance issues?

1. ✅ Reduce max block height in settings
2. ✅ Use fewer tasks (5-8 optimal)
3. ✅ Disable mirror if not needed
4. ✅ Close other browser tabs
5. ✅ Check CPU usage in Task Manager
6. ✅ Wait for physics to settle (bodies sleep after settling)

### Font not loading?

- Extension falls back to Arial if Google Sans fails
- Check that `GoogleSans-Medium.ttf` exists in extension folder
- Verify `web_accessible_resources` in manifest.json includes font file
- Check console for font loading errors

## 🔒 Privacy & Permissions

### Permissions Used:
- **storage**: Save your tasks locally
- **activeTab**: Communicate with meeting pages
- **host_permissions**: Inject code into meeting platforms

### Privacy Guarantee:
- ✅ All processing happens **locally** in your browser
- ✅ **No data** is sent to external servers
- ✅ Tasks stored in **local browser storage** only
- ✅ Webcam stream **never leaves** your browser
- ✅ **No tracking** or analytics

## 🎯 Tips for Best Standup Presentations

### Task Organization
1. **Before the meeting**: Set up tasks with appropriate statuses
   - Mark yesterday's work as Done or Partly Done
   - Set today's tasks as Next To-Do
   - Move low-priority items to Backlog

2. **During presentation**:
   - **Step 1**: Start with "Here's what I worked on yesterday" (left stack)
   - **Step 2**: Click to show "Here's what I completed" (right stack)
   - **Step 3**: Click to show "Here's my plan for today" (left stack)

3. **Keep it visual**: 
   - 5-8 tasks work best for readability
   - Use clear, concise task names (2-4 words)
   - Size percentages help show relative effort

### Size Guidelines
- **10-20%**: Small tasks, bug fixes, quick updates
- **30-50%**: Medium features, investigations
- **60-100%**: Large features, complex problems

### Status Best Practices
- **To-Do**: Yesterday's incomplete work → shows progress today
- **Done**: Completed items → builds team confidence
- **Partly Done**: Ongoing work → shows honest progress
- **Next To-Do**: Today's focus → sets expectations
- **Backlog**: Known tech debt → transparency about future work

### Visual Tips
1. **Adjust positions**: Use settings to position stacks around your head
2. **Mirror toggle**: Match your natural webcam orientation
3. **Block heights**: Increase max height for better visibility in large meetings
4. **Test first**: Join a test meeting to check positioning

### Engagement Tricks
- Change task status **during** the standup for live updates
- Use progress percentages to show incremental work
- Gray backlog blocks show what you're **not** working on
- Total percentage helps justify saying "no" to new work

## 🛠️ Development

### Project Structure

```
extension/
├── manifest.json          # Extension configuration (Manifest V3)
├── popup.html             # Popup UI with step buttons and settings
├── popup.css              # Popup styles (Google Sans, filter pills)
├── popup.js               # Task management and presentation logic
├── content.js             # Bridge between popup and injected script
├── injected.js            # Main overlay logic with Matter.js physics
├── matter.min.js          # Matter.js v0.19.0 (bundled, 80KB)
├── GoogleSans-Medium.ttf  # Custom font for professional look
├── icons/                 # Extension icons (16, 48, 128px)
└── README.md              # This file
```

### Key Files Explained

**manifest.json**
- Defines content scripts for Meet/Zoom/Teams/Webex
- Sets permissions (storage, activeTab)
- Declares web_accessible_resources

**popup.js**
- TaskManager class handles state
- Presentation step management (1-3)
- Status-based filtering (5 states)
- Settings persistence via chrome.storage

**content.js**
- Loads Matter.js library first
- Then loads injected.js
- Forwards messages between popup and injected script

**injected.js**
- Intercepts navigator.mediaDevices.getUserMedia
- Creates Matter.js physics engine
- Renders blocks with Canvas API
- Applies horizontal flip (optional)
- Calculates step-based totals

### Technology Stack

- **Chrome Extension API**: Manifest V3, content scripts, storage
- **Matter.js**: 2D physics engine for stacking
- **Canvas API**: 2D rendering with hardware acceleration
- **WebRTC**: getUserMedia interception and stream manipulation
- **FontFace API**: Dynamic font loading
- **Chrome Storage API**: Task and settings persistence

### Debugging

1. Open meeting page (e.g., meet.google.com)
2. Press F12 to open DevTools
3. Check Console for messages:
   ```
   Standup Overlay: Content script loaded
   Standup Overlay: Matter.js loaded
   Standup Overlay: Injected script loaded
   Standup Overlay: getUserMedia called
   Standup Overlay: Tasks updated, Step: 1
   ```
4. Verify physics engine initialized
5. Check for any CSP or loading errors

### Testing Locally

1. **Test webcam injection**:
   - Go to [WebRTC Test](https://webrtc.github.io/samples/src/content/getusermedia/gum/)
   - Click "Open camera"
   - Overlay should appear with your tasks

2. **Test in Google Meet**:
   - Go to `meet.google.com/new`
   - Turn on camera before joining
   - Check overlay appears

3. **Test physics**:
   - Add 5-10 tasks
   - Switch between steps
   - Watch blocks fall and stack
   - Verify settling detection

### Performance Monitoring

The extension is optimized for minimal CPU/memory usage:
- 20 FPS rendering (50ms per frame)
- Physics bodies sleep when velocity < 0.15
- Boundary checks prevent off-screen calculations
- Font loaded once and cached
- Tasks only re-initialize when changed

Check performance:
1. DevTools → Performance tab
2. Record while in meeting
3. Look for "drawOverlay" in timeline
4. Should see ~50ms intervals (20 FPS)

## 🚧 Known Limitations

- **Desktop apps not supported** - Browser extensions can't modify native desktop applications (use web versions)
- **Initial physics settling** - Blocks take 1-2 seconds to settle after spawning
- **Frame rate** - Locked to 20 FPS for performance (reduces VideoFrame garbage collection warnings)
- **Block boundaries** - Physical walls + software checks prevent escaping, but very high velocities might cause issues
- **Font fallback** - If Google Sans fails to load, falls back to Arial
- **Step 0 hidden** - Editing mode (step 0) button is commented out to simplify UI
- **Single instance** - Only one getUserMedia stream is modified per page
- **Browser support** - Chrome/Edge only (Manifest V3)

## 🔮 Future Enhancements

Potential improvements for future versions:

- [ ] Export/import task lists
- [ ] Keyboard shortcuts for step navigation
- [ ] Custom color themes
- [ ] Animation when switching steps
- [ ] Task notes/details field
- [ ] Time tracking integration
- [ ] Team sync (share task lists)
- [ ] Voice control for step switching
- [ ] Background image/blur behind blocks
- [ ] Confetti animation for completed tasks
- [ ] Multiple task lists (different projects)
- [ ] Drag-and-drop task reordering

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

### Development Setup
1. Clone the repository
2. Make changes to extension files
3. Load unpacked extension in Chrome
4. Test in Google Meet or WebRTC test page
5. Submit pull request with description

## 📄 License

MIT License - Use freely for personal or commercial projects

---

**No OBS, no virtual cameras, no extra software - just install and present like a pro!** 🎉✨
