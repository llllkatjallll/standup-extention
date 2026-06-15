# 📋 Standup Overlay Browser Extension

A Chrome/Edge browser extension that displays your standup tasks as an overlay directly on your webcam in video meetings - **no OBS required!**

## ✨ Features

- **Direct webcam injection** - Works in Google Meet, Zoom, Teams, and Webex
- **Task management** - Add, complete, and delete tasks with percentages
- **Real-time updates** - Modify tasks during your meeting
- **Engaging animations** - Completion animations when you check off tasks
- **Overload detection** - Visual indicator when total exceeds 100%
- **Zero setup** - Just install and use in your meetings

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
2. Add your standup tasks with percentages:
   - Type task name
   - Set percentage (how much of your day)
   - Click `+` to add

### 2. Join Your Meeting

1. Go to your video conferencing platform:
   - Google Meet: `meet.google.com`
   - Zoom: `zoom.us` (web version)
   - Microsoft Teams: `teams.microsoft.com` (web version)
   - Webex: `webex.com`

2. **Turn on your camera**
3. Your tasks will automatically appear as an overlay!

### 3. During Your Standup

- **Mark complete**: Click on tasks in the extension popup
- **Add more tasks**: Use the extension popup
- **Toggle overlay**: Uncheck "Show overlay in meetings" to hide
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

The extension uses a clever technique:

1. **Intercepts** `getUserMedia()` API calls from meeting platforms
2. **Captures** your real webcam stream
3. **Renders** your tasks as an overlay on each video frame using Canvas API
4. **Returns** the modified stream to the meeting platform

This happens entirely in your browser - no external servers or virtual camera drivers needed!

## 🎨 Customization

### Modify Overlay Appearance

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
5. ✅ Reload the meeting page after installing the extension
6. ✅ Check browser console (F12) for error messages

### Extension not appearing?

1. ✅ Verify the extension is enabled in `chrome://extensions/`
2. ✅ Make sure all icon files exist in the `icons` folder
3. ✅ Click "Reload" on the extension card

### Tasks not updating in meeting?

1. ✅ Try toggling the overlay off and on
2. ✅ Reload the meeting page
3. ✅ Check that chrome.storage permissions are granted

### Desktop app not working?

- Browser extensions **cannot** modify desktop applications
- Use the **web version** of your meeting platform instead
- For Google Meet: Use `meet.google.com` in browser
- For Zoom: Use `zoom.us/wc/join/...` web client

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

## 🎯 Tips for Best Results

1. **Test before meetings**: Open a Google Meet test call first
2. **Keep it simple**: 3-5 tasks work best visually
3. **Use clear text**: Short, readable task descriptions
4. **Realistic percentages**: They don't need to add to 100%
5. **Interactive**: Mark tasks done during standup for engagement

## 🛠️ Development

### Project Structure

```
extension/
├── manifest.json      # Extension configuration
├── popup.html         # Popup UI
├── popup.css          # Popup styles
├── popup.js           # Task management logic
├── content.js         # Injected into meeting pages
├── injected.js        # Intercepts getUserMedia
└── icons/            # Extension icons
```

### Debugging

1. Open meeting page
2. Press F12 to open DevTools
3. Check Console for "Standup Overlay" messages
4. Verify getUserMedia is being intercepted

### Testing

1. Go to [WebRTC Test Page](https://www.webrtc-experiment.com/getusermedia/)
2. Click "Get User Media"
3. Overlay should appear if tasks are added

## 🚧 Known Limitations

- **Desktop apps not supported** - Browser extensions can't modify native apps
- **Performance**: Uses Canvas rendering, may impact CPU on slower machines
- **Frame rate**: Locked to 30 FPS (can be adjusted in code)
- **Positioning**: Overlay position is fixed (can be customized)

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📄 License

MIT License - Use freely for personal or commercial projects

---

**No OBS, no virtual cameras, no extra software - just install and go!** 🎉
