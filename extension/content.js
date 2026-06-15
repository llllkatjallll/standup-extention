// Content script injected into meeting pages
console.log('Standup Overlay: Content script loaded');

// Inject the script that will intercept getUserMedia ASAP
const script = document.createElement('script');
script.src = chrome.runtime.getURL('injected.js');
script.onload = function() {
  console.log('Standup Overlay: Injected script loaded into page');
  this.remove();
};
script.onerror = function() {
  console.error('Standup Overlay: Failed to load injected script');
  this.remove();
};
(document.head || document.documentElement).appendChild(script);

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'UPDATE_TASKS') {
    // Forward to injected script via custom event
    window.postMessage({
      type: 'STANDUP_UPDATE_TASKS',
      tasks: message.tasks,
      overlayEnabled: message.overlayEnabled,
      safeZoneSize: message.safeZoneSize,
      safeZoneOffsetX: message.safeZoneOffsetX,
      safeZoneOffsetY: message.safeZoneOffsetY
    }, '*');
  }
});

// Load tasks on page load and send to injected script
// Wait a bit to ensure injected script is ready
setTimeout(() => {
  chrome.storage.local.get(['tasks', 'overlayEnabled', 'safeZoneSize', 'safeZoneOffsetX', 'safeZoneOffsetY'], (data) => {
    console.log('Standup Overlay: Sending initial tasks to page', data.tasks?.length || 0);
    window.postMessage({
      type: 'STANDUP_INIT',
      tasks: data.tasks || [],
      overlayEnabled: data.overlayEnabled !== false,
      safeZoneSize: data.safeZoneSize !== undefined ? data.safeZoneSize : 200,
      safeZoneOffsetX: data.safeZoneOffsetX !== undefined ? data.safeZoneOffsetX : 0,
      safeZoneOffsetY: data.safeZoneOffsetY !== undefined ? data.safeZoneOffsetY : 0
    }, '*');
  });
}, 100);

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    chrome.storage.local.get(['tasks', 'overlayEnabled', 'safeZoneSize', 'safeZoneOffsetX', 'safeZoneOffsetY'], (data) => {
      window.postMessage({
        type: 'STANDUP_UPDATE_TASKS',
        tasks: data.tasks || [],
        overlayEnabled: data.overlayEnabled !== false,
        safeZoneSize: data.safeZoneSize !== undefined ? data.safeZoneSize : 200,
        safeZoneOffsetX: data.safeZoneOffsetX !== undefined ? data.safeZoneOffsetX : 0,
        safeZoneOffsetY: data.safeZoneOffsetY !== undefined ? data.safeZoneOffsetY : 0
      }, '*');
    });
  }
});
