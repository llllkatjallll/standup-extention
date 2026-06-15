// Content script injected into meeting pages
console.log('Standup Overlay: Content script loaded');

// Inject Matter.js library first
const matterScript = document.createElement('script');
matterScript.src = chrome.runtime.getURL('matter.min.js');
matterScript.onload = function() {
  console.log('Standup Overlay: Matter.js loaded');
  this.remove();
  
  // Now inject the main script that will intercept getUserMedia
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
};
matterScript.onerror = function() {
  console.error('Standup Overlay: Failed to load Matter.js');
  this.remove();
};
(document.head || document.documentElement).appendChild(matterScript);

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
      safeZoneOffsetY: message.safeZoneOffsetY,
      minBubbleSize: message.minBubbleSize,
      maxBubbleSize: message.maxBubbleSize,
      presentationStep: message.presentationStep
    }, '*');
  }
});

// Load tasks on page load and send to injected script
// Wait a bit to ensure injected script is ready
setTimeout(() => {
  chrome.storage.local.get(['tasks', 'overlayEnabled', 'safeZoneSize', 'safeZoneOffsetX', 'safeZoneOffsetY', 'minBubbleSize', 'maxBubbleSize'], (data) => {
    console.log('Standup Overlay: Sending initial tasks to page', data.tasks?.length || 0);
    window.postMessage({
      type: 'STANDUP_INIT',
      tasks: data.tasks || [],
      overlayEnabled: data.overlayEnabled !== false,
      safeZoneSize: data.safeZoneSize !== undefined ? data.safeZoneSize : 200,
      safeZoneOffsetX: data.safeZoneOffsetX !== undefined ? data.safeZoneOffsetX : 0,
      safeZoneOffsetY: data.safeZoneOffsetY !== undefined ? data.safeZoneOffsetY : 0,
      minBubbleSize: data.minBubbleSize !== undefined ? data.minBubbleSize : 40,
      maxBubbleSize: data.maxBubbleSize !== undefined ? data.maxBubbleSize : 200
    }, '*');
  });
}, 100);

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    chrome.storage.local.get(['tasks', 'overlayEnabled', 'safeZoneSize', 'safeZoneOffsetX', 'safeZoneOffsetY', 'minBubbleSize', 'maxBubbleSize'], (data) => {
      window.postMessage({
        type: 'STANDUP_UPDATE_TASKS',
        tasks: data.tasks || [],
        overlayEnabled: data.overlayEnabled !== false,
        safeZoneSize: data.safeZoneSize !== undefined ? data.safeZoneSize : 200,
        safeZoneOffsetX: data.safeZoneOffsetX !== undefined ? data.safeZoneOffsetX : 0,
        safeZoneOffsetY: data.safeZoneOffsetY !== undefined ? data.safeZoneOffsetY : 0,
        minBubbleSize: data.minBubbleSize !== undefined ? data.minBubbleSize : 40,
        maxBubbleSize: data.maxBubbleSize !== undefined ? data.maxBubbleSize : 200
      }, '*');
    });
  }
});
