// Injected script that intercepts getUserMedia and adds overlay
(function() {
  'use strict';

  console.log('Standup Overlay: Injected script loaded');

  let tasks = [];
  let overlayEnabled = true;
  let safeZoneSize = 200; // Default safe zone radius
  let safeZoneOffsetX = 0;
  let safeZoneOffsetY = 0;
  let minBubbleSize = 40;
  let maxBubbleSize = 200;
  
  // Matter.js variables (Matter is loaded globally by content.js)
  let engine = null;
  let world = null;
  let bubbleBodies = new Map(); // Map task.id to Matter.js body
  let isSettled = false;
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
      minBubbleSize = event.data.minBubbleSize !== undefined ? event.data.minBubbleSize : 40;
      maxBubbleSize = event.data.maxBubbleSize !== undefined ? event.data.maxBubbleSize : 200;
      console.log('Standup Overlay: Tasks updated', tasks.length, 'Sizes:', minBubbleSize, '-', maxBubbleSize);
      
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

      // Initialize Matter.js engine (Matter.js is already loaded by content.js)
      if (!engine && window.Matter) {
        engine = window.Matter.Engine.create({
          gravity: { x: 0, y: 0 } // No gravity, we'll use custom forces
        });
        world = engine.world;
        console.log('Standup Overlay: Matter.js engine initialized');
      }
      
      // Fallback if Matter.js not loaded
      if (!window.Matter) {
        console.error('Standup Overlay: Matter.js not loaded, cannot initialize physics');
        return stream; // Return original stream
      }

      // Color palette
      const colors = [
        '#667eea', '#764ba2', '#f093fb', '#4facfe',
        '#43e97b', '#fa709a', '#fee140', '#30cfd0',
        '#a8edea', '#fed6e3', '#c471f5', '#12c2e9'
      ];

      // Initialize/update bubble bodies
      function initCirclePositions(width, height) {
        const colors = [
          '#667eea', '#764ba2', '#f093fb', '#4facfe',
          '#43e97b', '#fa709a', '#fee140', '#30cfd0',
          '#a8edea', '#fed6e3', '#c471f5', '#12c2e9'
        ];
        
        const centerX = width / 2 + safeZoneOffsetX;
        const centerY = height / 2 + safeZoneOffsetY;
        
        tasks.forEach((task, index) => {
          const size = minBubbleSize + (task.size / 100) * (maxBubbleSize - minBubbleSize);
          const targetAngle = (index / tasks.length) * Math.PI * 2;
          
          if (!bubbleBodies.has(task.id)) {
            // Create new body
            const angle = targetAngle;
            const radius = safeZoneSize / 2 + size / 2 + 20;
            
            const body = window.Matter.Bodies.circle(
              centerX + Math.cos(angle) * radius,
              centerY + Math.sin(angle) * radius,
              size / 2,
              {
                restitution: 0.3,
                friction: 0.3,
                frictionAir: 0.05,
                density: 0.001
              }
            );
            
            // Store custom properties
            body.taskId = task.id;
            body.targetAngle = targetAngle;
            body.displaySize = size;
            body.color = colors[index % colors.length];
            
            window.Matter.World.add(world, body);
            bubbleBodies.set(task.id, body);
          } else {
            // Update existing body
            const body = bubbleBodies.get(task.id);
            body.displaySize = size;
            body.color = colors[index % colors.length];
            body.targetAngle = targetAngle;
            
            // Update circle radius if size changed significantly
            const currentRadius = body.circleRadius;
            const newRadius = size / 2;
            if (Math.abs(currentRadius - newRadius) > 5) {
              window.Matter.Body.scale(body, newRadius / currentRadius, newRadius / currentRadius);
            }
          }
        });
        
        // Remove deleted tasks
        const taskIds = new Set(tasks.map(t => t.id));
        for (let [id, body] of bubbleBodies.entries()) {
          if (!taskIds.has(id)) {
            window.Matter.World.remove(world, body);
            bubbleBodies.delete(id);
          }
        }
      }

      // Physics update with Matter.js
      function updatePhysics(width, height) {
        if (isSettled || !engine) return false;
        
        const centerX = width / 2 + safeZoneOffsetX;
        const centerY = height / 2 + safeZoneOffsetY;
        const padding = 50;
        
        let maxVelocity = 0;
        
        // Apply custom forces to each body
        bubbleBodies.forEach((body) => {
          const dx = body.position.x - centerX;
          const dy = body.position.y - centerY;
          const distFromCenter = Math.sqrt(dx * dx + dy * dy);
          
          // 1. Safe zone repulsion
          const minDistFromCenter = safeZoneSize / 2 + body.circleRadius + 10;
          if (distFromCenter < minDistFromCenter && distFromCenter > 0) {
            const overlap = minDistFromCenter - distFromCenter;
            const forceMag = overlap * 0.002; // Reduced force for Matter.js
            window.Matter.Body.applyForce(body, body.position, {
              x: (dx / distFromCenter) * forceMag,
              y: (dy / distFromCenter) * forceMag
            });
          }
          
          // 2. Ring constraint - keep on circle
          const targetRadius = safeZoneSize / 2 + body.circleRadius + 20;
          const radiusError = distFromCenter - targetRadius;
          if (Math.abs(radiusError) > 5 && distFromCenter > 0) {
            const forceMag = radiusError * -0.0005;
            window.Matter.Body.applyForce(body, body.position, {
              x: (dx / distFromCenter) * forceMag,
              y: (dy / distFromCenter) * forceMag
            });
          }
          
          // 3. Angular positioning - distribute evenly (STRONG force)
          if (body.targetAngle !== undefined && distFromCenter > 10) {
            const currentAngle = Math.atan2(dy, dx);
            let angleDiff = body.targetAngle - currentAngle;
            
            // Normalize angle
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            
            if (Math.abs(angleDiff) > 0.01) {
              const tangentX = -Math.sin(currentAngle);
              const tangentY = Math.cos(currentAngle);
              const forceMag = angleDiff * 0.003; // 10x stronger for even distribution
              
              window.Matter.Body.applyForce(body, body.position, {
                x: tangentX * forceMag,
                y: tangentY * forceMag
              });
            }
          }
          
          // 4. Bubble-to-bubble repulsion to prevent clustering
          bubbleBodies.forEach((otherBody) => {
            if (body !== otherBody) {
              const dx2 = otherBody.position.x - body.position.x;
              const dy2 = otherBody.position.y - body.position.y;
              const dist = Math.sqrt(dx2 * dx2 + dy2 * dy2);
              const minDist = body.circleRadius + otherBody.circleRadius + 15;
              
              if (dist < minDist * 1.5 && dist > 0) {
                // Push bubbles apart along the circle
                const overlap = minDist * 1.5 - dist;
                const forceMag = overlap * 0.0002;
                window.Matter.Body.applyForce(body, body.position, {
                  x: -(dx2 / dist) * forceMag,
                  y: -(dy2 / dist) * forceMag
                });
              }
            }
          });
          
          // 5. Boundary constraints
          const radius = body.circleRadius;
          if (body.position.x - radius < padding) {
            window.Matter.Body.setPosition(body, { x: padding + radius, y: body.position.y });
            window.Matter.Body.setVelocity(body, { x: Math.abs(body.velocity.x) * 0.5, y: body.velocity.y });
          }
          if (body.position.x + radius > width - padding) {
            window.Matter.Body.setPosition(body, { x: width - padding - radius, y: body.position.y });
            window.Matter.Body.setVelocity(body, { x: -Math.abs(body.velocity.x) * 0.5, y: body.velocity.y });
          }
          if (body.position.y - radius < padding) {
            window.Matter.Body.setPosition(body, { x: body.position.x, y: padding + radius });
            window.Matter.Body.setVelocity(body, { x: body.velocity.x, y: Math.abs(body.velocity.y) * 0.5 });
          }
          if (body.position.y + radius > height - padding) {
            window.Matter.Body.setPosition(body, { x: body.position.x, y: height - padding - radius });
            window.Matter.Body.setVelocity(body, { x: body.velocity.x, y: -Math.abs(body.velocity.y) * 0.5 });
          }
          
          // Track velocity
          const velocity = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2);
          maxVelocity = Math.max(maxVelocity, velocity);
        });
        
        // Update Matter.js engine
        window.Matter.Engine.update(engine, 1000 / 60); // 60 FPS
        
        // Check if settled
        if (maxVelocity < 0.1) {
          settleTimer++;
          if (settleTimer > 60) {
            isSettled = true;
            console.log('Standup Overlay: Physics settled');
            // Stop all bodies
            bubbleBodies.forEach((body) => {
              window.Matter.Body.setVelocity(body, { x: 0, y: 0 });
              window.Matter.Body.setAngularVelocity(body, 0);
            });
          }
        } else {
          settleTimer = 0;
        }
        
        return maxVelocity > 0.001;
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
        
        // Draw each circle from Matter.js bodies
        tasks.forEach(task => {
          const body = bubbleBodies.get(task.id);
          if (body) {
            drawCircle(ctx, task, body.position.x, body.position.y, body.displaySize, body.color);
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
