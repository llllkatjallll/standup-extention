// Injected script that intercepts getUserMedia and adds overlay
(function() {
  'use strict';

  console.log('Standup Overlay: Injected script loaded');

  let tasks = [];
  let overlayEnabled = true;
  let circlePositions = new Map(); // Store positions and velocities
  let safeZoneSize = 200; // Default safe zone radius
  let safeZoneOffsetX = 0;
  let safeZoneOffsetY = 0;
  let isSettled = false; // Track if physics has settled
  let settleTimer = 0;

  // Listen for task updates
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    if (event.data.type === 'STANDUP_INIT' || event.data.type === 'STANDUP_UPDATE_TASKS') {
      const hadTasks = tasks.length > 0;
      tasks = event.data.tasks || [];
      overlayEnabled = event.data.overlayEnabled !== false;
      safeZoneSize = event.data.safeZoneSize !== undefined ? event.data.safeZoneSize : 200;
      safeZoneOffsetX = event.data.safeZoneOffsetX !== undefined ? event.data.safeZoneOffsetX : 0;
      safeZoneOffsetY = event.data.safeZoneOffsetY !== undefined ? event.data.safeZoneOffsetY : 0;
      console.log('Standup Overlay: Tasks updated', tasks.length, 'Safe zone:', safeZoneSize, 'Offset:', safeZoneOffsetX, safeZoneOffsetY);
      
      // Reset settled state when tasks or settings change
      isSettled = false;
      settleTimer = 0;
    }
  });

  // Helper function to lighten colors
  function lightenColor(color, percent) {
    const num = parseInt(color.replace("#",""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R<255?R<1?0:R:255)*0x10000 + 
      (G<255?G<1?0:G:255)*0x100 + (B<255?B<1?0:B:255))
      .toString(16).slice(1);
  }

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

      // Simple physics simulation
      function initCirclePositions(width, height) {
        const baseSize = 40;
        const maxSize = 200;
        const colors = [
          '#667eea', '#764ba2', '#f093fb', '#4facfe',
          '#43e97b', '#fa709a', '#fee140', '#30cfd0',
          '#a8edea', '#fed6e3', '#c471f5', '#12c2e9'
        ];
        
        const centerX = width / 2 + safeZoneOffsetX;
        const centerY = height / 2 + safeZoneOffsetY;
        
        tasks.forEach((task, index) => {
          if (!circlePositions.has(task.id)) {
            const size = baseSize + (task.size / 100) * (maxSize - baseSize);
            const angle = (index / tasks.length) * Math.PI * 2;
            const radius = safeZoneSize / 2 + size / 2 + 20; // Position just outside safe zone
            
            circlePositions.set(task.id, {
              x: centerX + Math.cos(angle) * radius,
              y: centerY + Math.sin(angle) * radius,
              vx: 0,
              vy: 0,
              size: size,
              color: colors[index % colors.length]
            });
          } else {
            // Update size and color for existing circles
            const pos = circlePositions.get(task.id);
            pos.size = baseSize + (task.size / 100) * (maxSize - baseSize);
            pos.color = colors[index % colors.length];
          }
        });
        
        // Remove deleted tasks
        const taskIds = new Set(tasks.map(t => t.id));
        for (let id of circlePositions.keys()) {
          if (!taskIds.has(id)) {
            circlePositions.delete(id);
          }
        }
      }

      // Simple collision detection and resolution
      function updatePhysics(width, height) {
        if (isSettled) return false; // Don't update if already settled
        
        const padding = 50;
        const damping = 0.85;
        const repulsionForce = 0.5;
        const centerX = width / 2 + safeZoneOffsetX;
        const centerY = height / 2 + safeZoneOffsetY;
        
        let maxVelocity = 0;
        
        // Apply forces between overlapping circles
        const positions = Array.from(circlePositions.entries());
        
        for (let i = 0; i < positions.length; i++) {
          const [id1, pos1] = positions[i];
          
          // Repulsion from center safe zone
          const dxFromCenter = pos1.x - centerX;
          const dyFromCenter = pos1.y - centerY;
          const distFromCenter = Math.sqrt(dxFromCenter * dxFromCenter + dyFromCenter * dyFromCenter);
          const minDistFromCenter = safeZoneSize / 2 + pos1.size / 2 + 10;
          
          if (distFromCenter < minDistFromCenter && distFromCenter > 0) {
            // Too close to center, push away
            const overlap = minDistFromCenter - distFromCenter;
            const nx = dxFromCenter / distFromCenter;
            const ny = dyFromCenter / distFromCenter;
            const force = overlap * repulsionForce * 2; // Stronger force for safe zone
            
            pos1.vx += nx * force;
            pos1.vy += ny * force;
          }
          
          for (let j = i + 1; j < positions.length; j++) {
            const [id2, pos2] = positions[j];
            
            const dx = pos2.x - pos1.x;
            const dy = pos2.y - pos1.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = (pos1.size + pos2.size) / 2 + 15; // Add gap
            
            if (dist < minDist && dist > 0) {
              // Circles overlap, push apart
              const overlap = minDist - dist;
              const nx = dx / dist;
              const ny = dy / dist;
              
              const force = overlap * repulsionForce;
              
              pos1.vx -= nx * force;
              pos1.vy -= ny * force;
              pos2.vx += nx * force;
              pos2.vy += ny * force;
            }
          }
          
          // Keep circles on a ring around the safe zone
          const targetRadius = safeZoneSize / 2 + pos1.size / 2 + 20;
          const radiusError = distFromCenter - targetRadius;
          
          if (Math.abs(radiusError) > 5 && distFromCenter > 0) {
            // Pull toward target ring
            const nx = dxFromCenter / distFromCenter;
            const ny = dyFromCenter / distFromCenter;
            const force = radiusError * 0.05;
            
            pos1.vx -= nx * force;
            pos1.vy -= ny * force;
          }
        }
        
        // Update positions
        positions.forEach(([id, pos]) => {
          pos.x += pos.vx;
          pos.y += pos.vy;
          
          // Track max velocity
          const velocity = Math.sqrt(pos.vx * pos.vx + pos.vy * pos.vy);
          maxVelocity = Math.max(maxVelocity, velocity);
          
          // Keep in bounds
          const radius = pos.size / 2;
          if (pos.x - radius < padding) {
            pos.x = padding + radius;
            pos.vx *= -0.5;
          }
          if (pos.x + radius > width - padding) {
            pos.x = width - padding - radius;
            pos.vx *= -0.5;
          }
          if (pos.y - radius < padding) {
            pos.y = padding + radius;
            pos.vy *= -0.5;
          }
          if (pos.y + radius > height - padding) {
            pos.y = height - padding - radius;
            pos.vy *= -0.5;
          }
          
          // Apply damping
          pos.vx *= damping;
          pos.vy *= damping;
        });
        
        // Check if settled
        if (maxVelocity < 0.05) {
          settleTimer++;
          if (settleTimer > 60) { // Settled for 1 second (60 frames)
            isSettled = true;
            console.log('Standup Overlay: Physics settled');
            // Zero out all velocities
            positions.forEach(([id, pos]) => {
              pos.vx = 0;
              pos.vy = 0;
            });
          }
        } else {
          settleTimer = 0;
        }
        
        return maxVelocity > 0.001; // Return true if still moving
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
        // Initialize positions for new tasks
        initCirclePositions(canvas.width, canvas.height);
        
        // Run physics simulation only if not settled
        if (!isSettled) {
          updatePhysics(canvas.width, canvas.height);
        }
        
        // Save context and apply horizontal flip for overlay
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        
        // Draw each circle
        tasks.forEach(task => {
          const pos = circlePositions.get(task.id);
          if (pos) {
            drawCircle(ctx, task, pos.x, pos.y, pos.size, pos.color);
          }
        });
        
        // Total in corner
        const total = tasks.reduce((sum, t) => sum + t.size, 0);
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = total > 100 ? '#dc3545' : '#28a745';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`Total: ${total}%`, canvas.width - 40, canvas.height - 40);
        
        // Restore context after mirroring
        ctx.restore();
      }

      requestAnimationFrame(drawOverlay);
    }

    // Helper function to draw a single circle
    function drawCircle(ctx, task, x, y, size, color) {
      ctx.save();
      
      // Shadow for depth
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;
      
      // Completion animation
      let scale = 1;
      if (task.completed && task.completedAt) {
        const elapsed = Date.now() - task.completedAt;
        if (elapsed < 500) {
          scale = 1 + Math.sin((elapsed / 500) * Math.PI) * 0.3;
        }
      }
      
      // Draw circle
      ctx.beginPath();
      ctx.arc(x, y, (size / 2) * scale, 0, Math.PI * 2);
      
      // Fill with color or completed color
      if (task.completed) {
        ctx.fillStyle = '#28a745';
      } else {
        // Gradient for depth
        const gradient = ctx.createRadialGradient(
          x - size / 6, y - size / 6, size / 10,
          x, y, size / 2
        );
        gradient.addColorStop(0, lightenColor(color, 20));
        gradient.addColorStop(1, color);
        ctx.fillStyle = gradient;
      }
      ctx.fill();
      
      // Border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      ctx.shadowColor = 'transparent'; // Turn off shadow for text
      
      // Draw checkmark if completed
      if (task.completed) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = size / 15;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(x - size / 6, y);
        ctx.lineTo(x - size / 12, y + size / 6);
        ctx.lineTo(x + size / 4, y - size / 6);
        ctx.stroke();
      }
      
      // Draw text
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Task name
      const fontSize = Math.max(12, Math.min(18, size / 6));
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      
      // Word wrap for longer text
      const words = task.text.split(' ');
      const maxWidth = size * 0.8;
      let lines = [];
      let currentLine = words[0];
      
      for (let i = 1; i < words.length; i++) {
        const testLine = currentLine + ' ' + words[i];
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = words[i];
        } else {
          currentLine = testLine;
        }
      }
      lines.push(currentLine);
      
      // Draw lines
      const lineHeight = fontSize * 1.2;
      const textY = y - ((lines.length - 1) * lineHeight) / 2 - fontSize / 4;
      
      lines.forEach((line, i) => {
        ctx.fillText(line, x, textY + i * lineHeight);
      });
      
      // Percentage below
      ctx.font = `bold ${fontSize + 2}px Arial`;
      ctx.fillText(`${task.size}%`, x, y + size / 2 - fontSize - 5);
      
      ctx.restore();
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
