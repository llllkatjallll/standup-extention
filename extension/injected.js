// Injected script that intercepts getUserMedia and adds overlay
(function() {
  'use strict';

  console.log('Standup Overlay: Injected script loaded');

  let tasks = [];
  let overlayEnabled = true;

  // Listen for task updates
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    if (event.data.type === 'STANDUP_INIT' || event.data.type === 'STANDUP_UPDATE_TASKS') {
      tasks = event.data.tasks || [];
      overlayEnabled = event.data.overlayEnabled !== false;
      console.log('Standup Overlay: Tasks updated', tasks.length);
    }
  });

  // Save original getUserMedia
  const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

  // Override getUserMedia
  navigator.mediaDevices.getUserMedia = async function(constraints) {
    console.log('Standup Overlay: getUserMedia called', constraints);
    
    // Get original stream
    const stream = await originalGetUserMedia(constraints);
    
    // Only process if video is requested
    if (!constraints.video) {
      console.log('Standup Overlay: No video requested, returning original stream');
      return stream;
    }

    // If no tasks and overlay disabled, return original
    if (!overlayEnabled && tasks.length === 0) {
      console.log('Standup Overlay: No overlay needed, returning original stream');
      return stream;
    }

    console.log('Standup Overlay: Adding overlay to video stream');

    try {
      // Create video element to read the original stream
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;

      // Create canvas for overlay
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Wait for video to have dimensions with timeout
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Video load timeout')), 5000);
        
        video.onloadedmetadata = () => {
          clearTimeout(timeout);
          canvas.width = video.videoWidth || 1280;
          canvas.height = video.videoHeight || 720;
          console.log('Standup Overlay: Video dimensions:', canvas.width, 'x', canvas.height);
          resolve();
        };
        
        video.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Video failed to load'));
        };
      });

      // Ensure video is playing
      try {
        await video.play();
      } catch (e) {
        console.error('Standup Overlay: Video play failed', e);
      }

      // Function to draw overlay
      function drawOverlay() {
        // Draw video frame
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        } catch (e) {
          // Video might not be ready yet
          requestAnimationFrame(drawOverlay);
          return;
        }

      if (overlayEnabled && tasks.length > 0) {
        // Save context and apply horizontal flip for overlay
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        
        // Draw tasks overlay
        const padding = 30;
        const taskHeight = 50;
        const gap = 12;

        // Calculate background height
        const bgHeight = tasks.length * (taskHeight + gap) + padding * 2;
        
        // Semi-transparent background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(padding, padding, canvas.width - padding * 2, bgHeight);

        // Border
        ctx.strokeStyle = 'rgba(102, 126, 234, 0.9)';
        ctx.lineWidth = 3;
        ctx.strokeRect(padding, padding, canvas.width - padding * 2, bgHeight);

        // Draw tasks
        let yOffset = padding + 20;

        tasks.forEach((task, index) => {
          const x = padding + 15;
          const y = yOffset + index * (taskHeight + gap);

          // Completion animation
          let scale = 1;
          if (task.completed && task.completedAt) {
            const elapsed = Date.now() - task.completedAt;
            if (elapsed < 500) {
              scale = 1 + Math.sin((elapsed / 500) * Math.PI) * 0.2;
            }
          }

          ctx.save();
          ctx.translate(x, y);
          ctx.scale(scale, scale);

          // Checkbox
          const checkSize = 20;
          ctx.fillStyle = task.completed ? '#28a745' : 'rgba(255, 255, 255, 0.25)';
          ctx.fillRect(0, 0, checkSize, checkSize);
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.strokeRect(0, 0, checkSize, checkSize);

          if (task.completed) {
            // Checkmark
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(5, 10);
            ctx.lineTo(8, 14);
            ctx.lineTo(15, 6);
            ctx.stroke();
          }

          // Task text
          ctx.fillStyle = 'white';
          ctx.font = 'bold 16px Arial, sans-serif';
          const textX = checkSize + 12;
          ctx.fillText(task.text, textX, 15);

          if (task.completed) {
            // Strikethrough
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            const textWidth = ctx.measureText(task.text).width;
            ctx.beginPath();
            ctx.moveTo(textX, 8);
            ctx.lineTo(textX + textWidth, 8);
            ctx.stroke();
          }

          // Progress bar
          const barY = 25;
          const barWidth = 250;
          const barHeight = 10;

          // Background
          ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.fillRect(textX, barY, barWidth, barHeight);

          // Fill
          const fillWidth = (barWidth * task.size) / 100;
          const gradient = ctx.createLinearGradient(textX, 0, textX + fillWidth, 0);
          if (task.completed) {
            gradient.addColorStop(0, '#28a745');
            gradient.addColorStop(1, '#20c997');
          } else {
            gradient.addColorStop(0, '#667eea');
            gradient.addColorStop(1, '#764ba2');
          }
          ctx.fillStyle = gradient;
          ctx.fillRect(textX, barY, fillWidth, barHeight);

          // Percentage
          ctx.fillStyle = 'white';
          ctx.font = 'bold 14px Arial';
          ctx.fillText(`${task.size}%`, textX + barWidth + 10, barY + 8);

          ctx.restore();
        });

        // Total percentage
        const totalY = yOffset + tasks.length * (taskHeight + gap) + 10;
        const total = tasks.reduce((sum, t) => sum + t.size, 0);
        ctx.fillStyle = total > 100 ? '#dc3545' : '#28a745';
        ctx.font = 'bold 20px Arial';
        const totalText = `Total: ${total}%`;
        const totalWidth = ctx.measureText(totalText).width;
        ctx.fillText(totalText, canvas.width - padding - 15 - totalWidth, totalY);
        
        // Restore context after mirroring
        ctx.restore();
      }

      requestAnimationFrame(drawOverlay);
    }

    // Start drawing
    drawOverlay();

    // Create new stream from canvas
    const modifiedStream = canvas.captureStream(30); // 30 fps

    // Copy audio tracks from original stream if present
    stream.getAudioTracks().forEach(track => {
      modifiedStream.addTrack(track);
    });

    // Return modified stream
    console.log('Standup Overlay: Returning modified stream with overlay');
    return modifiedStream;
      
    } catch (error) {
      console.error('Standup Overlay: Error processing stream, returning original', error);
      return stream;
    }
  };

  console.log('Standup Overlay: getUserMedia override complete');
})();
