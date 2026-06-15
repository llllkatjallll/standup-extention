// Injected script that intercepts getUserMedia and adds overlay
(function() {
  'use strict';

  console.log('Standup Overlay: Injected script loaded');

  let tasks = [];
  let overlayEnabled = true;
  let leftStackX = 25; // Default left stack position (percentage)
  let rightStackX = 75; // Default right stack position (percentage)
  let minBlockHeight = 50;
  let maxBlockHeight = 250;
  let mirrorHorizontally = true; // Default to mirrored
  let presentationStep = 1; // Start at step 1: Yesterday's Tasks
  
  // Matter.js variables (Matter is loaded globally by content.js)
  let engine = null;
  let world = null;
  let bubbleBodies = new Map(); // Map task.id to Matter.js body  
  let doneBubbleBodies = new Map(); // Map for DONE stack bodies
  let isSettled = false;
  let settleTimer = 0;
  let lastTasksJson = ''; // Track when tasks change
  let lastFrameTime = 0; // For FPS throttling

  // Listen for task updates
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    if (event.data.type === 'STANDUP_INIT' || event.data.type === 'STANDUP_UPDATE_TASKS') {
      const hadTasks = tasks.length > 0;
      const oldStep = presentationStep;
      
      tasks = event.data.tasks || [];
      overlayEnabled = event.data.overlayEnabled !== false;
      leftStackX = event.data.leftStackX !== undefined ? event.data.leftStackX : 25;
      rightStackX = event.data.rightStackX !== undefined ? event.data.rightStackX : 75;
      minBlockHeight = event.data.minBlockHeight !== undefined ? event.data.minBlockHeight : 50;
      maxBlockHeight = event.data.maxBlockHeight !== undefined ? event.data.maxBlockHeight : 250;
      mirrorHorizontally = event.data.mirrorHorizontally !== undefined ? event.data.mirrorHorizontally : true;
      presentationStep = event.data.presentationStep !== undefined ? event.data.presentationStep : 0;
      console.log('Standup Overlay: Tasks updated', tasks.length, 'Step:', presentationStep);
      
      // Reset physics when step changes
      if (oldStep !== presentationStep) {
        console.log('Standup Overlay: Step changed from', oldStep, 'to', presentationStep);
        
        // Only clear bodies when changing TO step 0 or FROM step 0
        // Keep bodies when going from step 1 -> 2 or 2 -> 1
        if (oldStep === 0 || presentationStep === 0) {
          console.log('Standup Overlay: Clearing all bodies');
          bubbleBodies.forEach(body => window.Matter.World.remove(world, body));
          bubbleBodies.clear();
          doneBubbleBodies.forEach(body => window.Matter.World.remove(world, body));
          doneBubbleBodies.clear();
        } else {
          console.log('Standup Overlay: Keeping TO-DO bodies, only managing DONE bodies');
          // When going from 1->2 or 2->1, clear DONE bodies
          doneBubbleBodies.forEach(body => window.Matter.World.remove(world, body));
          doneBubbleBodies.clear();
          
          // Wake up remaining TO-DO bodies so they fall into gaps left by removed DONE bodies
          bubbleBodies.forEach(body => {
            window.Matter.Sleeping.set(body, false);
          });
        }
      }
      
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
      // Load Google Sans font for canvas rendering
      if (!document.fonts.check('16px "Google Sans"')) {
        try {
          const fontUrl = chrome.runtime.getURL('GoogleSans-Medium.ttf');
          const font = new FontFace('Google Sans', `url(${fontUrl})`);
          await font.load();
          document.fonts.add(font);
          console.log('Standup Overlay: Google Sans font loaded');
        } catch (fontError) {
          console.warn('Standup Overlay: Could not load Google Sans font, using fallback', fontError);
        }
      }
      
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
          gravity: { x: 0, y: 0.5 }, // Enable gravity for falling blocks
          enableSleeping: true, // Allow bodies to sleep when idle
          positionIterations: 6, // Reduce from default 6
          velocityIterations: 4, // Reduce from default 4
          constraintIterations: 2 // Reduce from default 2
        });
        world = engine.world;
        world.bounds = { min: { x: -Infinity, y: -Infinity }, max: { x: Infinity, y: Infinity } };
        console.log('Standup Overlay: Matter.js engine initialized with gravity + performance optimizations');
      }
      
      // Fallback if Matter.js not loaded
      if (!window.Matter) {
        console.error('Standup Overlay: Matter.js not loaded, cannot initialize physics');
        return stream; // Return original stream
      }

      // Create ground and walls to contain blocks
      let ground = null;
      let leftWall = null;
      let rightWall = null;
      let topWall = null;
      
      function createGround(width, height) {
        // Remove old bodies
        if (ground) window.Matter.World.remove(world, ground);
        if (leftWall) window.Matter.World.remove(world, leftWall);
        if (rightWall) window.Matter.World.remove(world, rightWall);
        if (topWall) window.Matter.World.remove(world, topWall);
        
        const wallThickness = 50;
        
        // Ground at bottom (raised to make room for labels)
        ground = window.Matter.Bodies.rectangle(
          width / 2,
          height - 80,  // Raised to make room for labels at bottom
          width,
          40,
          { isStatic: true, label: 'ground' }
        );
        
        // Left wall
        leftWall = window.Matter.Bodies.rectangle(
          -wallThickness / 2,
          height / 2,
          wallThickness,
          height * 2,
          { isStatic: true, label: 'leftWall' }
        );
        
        // Right wall
        rightWall = window.Matter.Bodies.rectangle(
          width + wallThickness / 2,
          height / 2,
          wallThickness,
          height * 2,
          { isStatic: true, label: 'rightWall' }
        );
        
        // Top wall (invisible ceiling)
        topWall = window.Matter.Bodies.rectangle(
          width / 2,
          -wallThickness / 2,
          width,
          wallThickness,
          { isStatic: true, label: 'topWall' }
        );
        
        window.Matter.World.add(world, [ground, leftWall, rightWall, topWall]);
      }

      // Color palette
      const colors = [
        '#667eea', '#764ba2', '#f093fb', '#4facfe',
        '#43e97b', '#fa709a', '#fee140', '#30cfd0',
        '#a8edea', '#fed6e3', '#c471f5', '#12c2e9'
      ];

      // Initialize/update block bodies
      function initBlockBodies(width, height) {
        console.log('Standup Overlay: initBlockBodies - Step:', presentationStep);
        
        const colors = [
          '#667eea', '#764ba2', '#f093fb', '#4facfe',
          '#43e97b', '#fa709a', '#fee140', '#30cfd0',
          '#a8edea', '#fed6e3', '#c471f5', '#12c2e9'
        ];
        
        // Function to get consistent color for a task based on its ID
        const getTaskColor = (task) => {
          // Backlog tasks get gray background
          if (task.status === 'backlog') {
            return '#999999';
          }
          return colors[task.id % colors.length];
        };
        
        // Create ground if needed
        if (!ground) {
          createGround(width, height);
        }
        
        const blockWidth = 250;
        const minHeight = minBlockHeight;
        const maxHeight = maxBlockHeight;
        
        // Determine which tasks to show based on presentation step
        let visibleTasks = [];
        let doneTasksForRightStack = [];
        
        if (presentationStep === 0) {
          // Step 0: Show all tasks in center
          visibleTasks = tasks;
        } else if (presentationStep === 1) {
          // Step 1: Show "todo", "done", and "partlydone" tasks in left stack
          visibleTasks = tasks.filter(t => t.status === 'todo' || t.status === 'done' || t.status === 'partlydone');
        } else if (presentationStep === 2) {
          // Step 2: "todo" and "partlydone" on left, "done" and "partlydone" on right
          visibleTasks = tasks.filter(t => t.status === 'todo' || t.status === 'partlydone');
          doneTasksForRightStack = tasks.filter(t => t.status === 'done' || t.status === 'partlydone');
        } else if (presentationStep === 3) {
          // Step 3: "todo", "partlydone", "nexttodo" on left, "backlog" on right
          visibleTasks = tasks.filter(t => t.status === 'todo' || t.status === 'partlydone' || t.status === 'nexttodo');
          doneTasksForRightStack = tasks.filter(t => t.status === 'backlog');
        }
        
        // Determine stack positions
        const isTwoStacks = (presentationStep === 2 || presentationStep === 3) && doneTasksForRightStack.length > 0;
        // In steps 1, 2, and 3, use configurable positions. In step 0, use center
        const todoStackX = presentationStep >= 1 ? (width * leftStackX / 100) : width / 2;
        const doneStackX = width * rightStackX / 100;
        
        // Create/update TO-DO stack (left/center)
        visibleTasks.forEach((task, index) => {
          const blockHeight = minHeight + (task.size / 100) * (maxHeight - minHeight);
          const taskColor = getTaskColor(task); // Use consistent color based on task ID
          
          if (!bubbleBodies.has(task.id)) {
            // Create new block
            const spawnX = todoStackX + (Math.random() * 60 - 30);
            const spawnY = -blockHeight - 50 - (index * 20);
            
            const body = window.Matter.Bodies.rectangle(
              spawnX,
              spawnY,
              blockWidth,
              blockHeight,
              {
                restitution: 0.2,
                friction: 0.9,
                frictionAir: 0.01,
                density: 0.001,
                chamfer: { radius: 15 },
                inertia: Infinity
              }
            );
            
            body.taskId = task.id;
            body.displayWidth = blockWidth;
            body.displayHeight = blockHeight;
            body.color = taskColor;
            
            window.Matter.World.add(world, body);
            bubbleBodies.set(task.id, body);
          } else {
            // Update existing body
            const body = bubbleBodies.get(task.id);
            body.displayHeight = blockHeight;
            body.displayWidth = blockWidth;
            body.color = taskColor;
            
            // Update height if changed
            const currentHeight = body.bounds.max.y - body.bounds.min.y;
            if (Math.abs(currentHeight - blockHeight) > 10) {
              const scaleY = blockHeight / currentHeight;
              window.Matter.Body.scale(body, 1, scaleY);
            }
          }
        });
        
        // Remove TO-DO bodies that are no longer visible
        const visibleTaskIds = new Set(visibleTasks.map(t => t.id));
        for (let [id, body] of bubbleBodies.entries()) {
          if (!visibleTaskIds.has(id)) {
            window.Matter.World.remove(world, body);
            bubbleBodies.delete(id);
          }
        }
        
        // Create/update DONE stack (right side, only in Step 2)
        doneTasksForRightStack.forEach((task, index) => {
          const blockHeight = minHeight + (task.size / 100) * (maxHeight - minHeight);
          const taskColor = getTaskColor(task); // Keep same color as in TO-DO stack
          
          if (!doneBubbleBodies.has(task.id)) {
            // Create DONE block
            const spawnX = doneStackX + (Math.random() * 60 - 30);
            const spawnY = -blockHeight - 50 - (index * 20);
            
            const body = window.Matter.Bodies.rectangle(
              spawnX,
              spawnY,
              blockWidth,
              blockHeight,
              {
                restitution: 0.2,
                friction: 0.9,
                frictionAir: 0.01,
                density: 0.001,
                chamfer: { radius: 15 },
                inertia: Infinity
              }
            );
            
            body.taskId = task.id;
            body.displayWidth = blockWidth;
            body.displayHeight = blockHeight;
            body.color = taskColor; // Use same color as task had before
            
            window.Matter.World.add(world, body);
            doneBubbleBodies.set(task.id, body);
          } else {
            // Update existing DONE body
            const body = doneBubbleBodies.get(task.id);
            body.displayHeight = blockHeight;
            body.displayWidth = blockWidth;
            body.color = taskColor; // Keep consistent color
            
            const currentHeight = body.bounds.max.y - body.bounds.min.y;
            if (Math.abs(currentHeight - blockHeight) > 10) {
              const scaleY = blockHeight / currentHeight;
              window.Matter.Body.scale(body, 1, scaleY);
            }
          }
        });
        
        // Remove DONE bodies that are no longer needed
        const doneTaskIds = new Set(doneTasksForRightStack.map(t => t.id));
        for (let [id, body] of doneBubbleBodies.entries()) {
          if (!doneTaskIds.has(id)) {
            window.Matter.World.remove(world, body);
            doneBubbleBodies.delete(id);
          }
        }
      }

      // Physics update with Matter.js (optimized for performance)
      function updatePhysics(width, height) {
        if (isSettled || !engine) return false;
        
        let maxVelocity = 0;
        
        // Track velocity for settle detection (both TO-DO and DONE stacks)
        const allBodies = [...bubbleBodies.values(), ...doneBubbleBodies.values()];
        allBodies.forEach((body) => {
          const velocity = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2);
          maxVelocity = Math.max(maxVelocity, velocity);
          
          // Keep blocks within horizontal bounds
          const halfWidth = body.displayWidth / 2;
          const halfHeight = body.displayHeight / 2;
          const margin = 10;
          
          // Left boundary
          if (body.position.x - halfWidth < margin) {
            window.Matter.Body.setPosition(body, { x: margin + halfWidth, y: body.position.y });
            window.Matter.Body.setVelocity(body, { x: Math.abs(body.velocity.x) * 0.3, y: body.velocity.y });
          }
          
          // Right boundary
          if (body.position.x + halfWidth > width - margin) {
            window.Matter.Body.setPosition(body, { x: width - margin - halfWidth, y: body.position.y });
            window.Matter.Body.setVelocity(body, { x: -Math.abs(body.velocity.x) * 0.3, y: body.velocity.y });
          }
          
          // Top boundary (prevent blocks from going off-screen at top)
          if (body.position.y - halfHeight < margin) {
            window.Matter.Body.setPosition(body, { x: body.position.x, y: margin + halfHeight });
            window.Matter.Body.setVelocity(body, { x: body.velocity.x, y: Math.abs(body.velocity.y) * 0.5 });
          }
          
          // Bottom boundary (above the ground and labels)
          const maxY = height - 100; // Keep above labels (80 for ground + 20 margin)
          if (body.position.y + halfHeight > maxY) {
            window.Matter.Body.setPosition(body, { x: body.position.x, y: maxY - halfHeight });
            window.Matter.Body.setVelocity(body, { x: body.velocity.x, y: -Math.abs(body.velocity.y) * 0.3 });
          }
        });
        
        // Update Matter.js engine at reduced rate (20 FPS to match rendering)
        window.Matter.Engine.update(engine, 50); // Match our throttled FPS
        
        // Check if settled
        if (maxVelocity < 0.15) {
          settleTimer++;
          if (settleTimer > 30) { // 1.5 seconds at 20fps
            isSettled = true;
            console.log('Standup Overlay: Blocks settled');
            // Put all bodies to sleep for maximum performance
            bubbleBodies.forEach((body) => {
              window.Matter.Sleeping.set(body, true);
            });
            doneBubbleBodies.forEach((body) => {
              window.Matter.Sleeping.set(body, true);
            });
          }
        } else {
          settleTimer = 0;
        }
        
        return maxVelocity > 0.001;
      }

      // Function to draw overlay (throttled to 20 FPS to reduce VideoFrame warnings)
      function drawOverlay(timestamp) {
        // Throttle to 20 FPS (50ms per frame) to reduce memory pressure
        if (timestamp - lastFrameTime < 50) {
          requestAnimationFrame(drawOverlay);
          return;
        }
        lastFrameTime = timestamp;
        
        // Draw video frame
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        } catch (e) {
          // Video might not be ready yet
          requestAnimationFrame(drawOverlay);
          return;
        }

      if (overlayEnabled && tasks.length > 0) {
        // Only initialize blocks when tasks actually change (include presentationStep, statuses, and settings in comparison)
        const currentTasksJson = JSON.stringify({ 
          tasks: tasks.map(t => ({ id: t.id, size: t.size, status: t.status })),
          step: presentationStep,
          leftStackX: leftStackX,
          rightStackX: rightStackX,
          minBlockHeight: minBlockHeight,
          maxBlockHeight: maxBlockHeight
        });
        if (currentTasksJson !== lastTasksJson) {
          initBlockBodies(canvas.width, canvas.height);
          lastTasksJson = currentTasksJson;
        }
        
        // Run physics simulation only if not settled
        if (!isSettled) {
          updatePhysics(canvas.width, canvas.height);
        }
        
        // Save context and optionally apply horizontal flip for overlay
        ctx.save();
        if (mirrorHorizontally) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        
        // Draw labels for steps 1, 2, and 3 (at bottom with white background)
        if (presentationStep >= 1 && presentationStep <= 3) {
          ctx.save();
          ctx.shadowColor = 'transparent';
          ctx.font = 'bold 24px "Google Sans", Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          const leftX = canvas.width * leftStackX / 100;
          const rightX = canvas.width * rightStackX / 100;
          const labelY = canvas.height - 40; // Position near bottom
          
          // Helper function to draw label with background
          const drawLabel = (text, x) => {
            const padding = 20;
            const textMetrics = ctx.measureText(text);
            const textWidth = textMetrics.width;
            const boxWidth = textWidth + padding * 2;
            const boxHeight = 36;
            const radius = 18; // Rounded corners
            
            // Draw white background with rounded corners
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.moveTo(x - boxWidth/2 + radius, labelY - boxHeight/2);
            ctx.lineTo(x + boxWidth/2 - radius, labelY - boxHeight/2);
            ctx.quadraticCurveTo(x + boxWidth/2, labelY - boxHeight/2, x + boxWidth/2, labelY - boxHeight/2 + radius);
            ctx.lineTo(x + boxWidth/2, labelY + boxHeight/2 - radius);
            ctx.quadraticCurveTo(x + boxWidth/2, labelY + boxHeight/2, x + boxWidth/2 - radius, labelY + boxHeight/2);
            ctx.lineTo(x - boxWidth/2 + radius, labelY + boxHeight/2);
            ctx.quadraticCurveTo(x - boxWidth/2, labelY + boxHeight/2, x - boxWidth/2, labelY + boxHeight/2 - radius);
            ctx.lineTo(x - boxWidth/2, labelY - boxHeight/2 + radius);
            ctx.quadraticCurveTo(x - boxWidth/2, labelY - boxHeight/2, x - boxWidth/2 + radius, labelY - boxHeight/2);
            ctx.closePath();
            ctx.fill();
            
            // Draw black text
            ctx.fillStyle = 'black';
            ctx.fillText(text, x, labelY);
          };
          
          // Step-specific labels
          if (presentationStep === 1) {
            // Step 1: TO-DO YESTERDAY (left only)
            drawLabel('TO-DO YESTERDAY', leftX);
          } else if (presentationStep === 2) {
            // Step 2: TO-DO YESTERDAY (left), DONE YESTERDAY (right)
            drawLabel('TO-DO YESTERDAY', leftX);
            drawLabel('DONE YESTERDAY', rightX);
          } else if (presentationStep === 3) {
            // Step 3: TO-DO TODAY (left), BACKLOG (right)
            drawLabel('TO-DO TODAY', leftX);
            drawLabel('BACKLOG', rightX);
          }
          
          ctx.restore();
        }
        
        // Draw each block from Matter.js bodies (TO-DO stack)
        tasks.forEach(task => {
          const body = bubbleBodies.get(task.id);
          if (body) {
            // Progress mode: none for steps 1 and 3, 'todo' for step 2
            const progressMode = presentationStep === 2 ? 'todo' : 'none';
            drawBlock(ctx, task, body.position.x, body.position.y, body.displayWidth, body.displayHeight, body.angle, body.color, progressMode);
          }
        });
        
        // Draw right stack blocks (step 2: DONE, step 3: BACKLOG)
        if (presentationStep === 2 || presentationStep === 3) {
          doneBubbleBodies.forEach((body, taskId) => {
            const task = tasks.find(t => t.id === taskId);
            if (task) {
              // Progress mode: 'done' for step 2, 'none' for step 3
              const progressMode = presentationStep === 2 ? 'done' : 'none';
              drawBlock(ctx, task, body.position.x, body.position.y, body.displayWidth, body.displayHeight, body.angle, body.color, progressMode);
            }
          });
        }
        
        // Total in corner - calculate based on presentation step
        let total = 0;
        if (presentationStep === 1) {
          // Step 1: Count left stack (todo, done, partlydone)
          total = tasks
            .filter(t => t.status === 'todo' || t.status === 'done' || t.status === 'partlydone')
            .reduce((sum, t) => sum + t.size, 0);
        } else if (presentationStep === 2) {
          // Step 2: Count right stack (done, partlydone)
          total = tasks
            .filter(t => t.status === 'done' || t.status === 'partlydone')
            .reduce((sum, t) => sum + t.size, 0);
        } else if (presentationStep === 3) {
          // Step 3: Count left stack (todo, partlydone, nexttodo)
          total = tasks
            .filter(t => t.status === 'todo' || t.status === 'partlydone' || t.status === 'nexttodo')
            .reduce((sum, t) => sum + t.size, 0);
        } else {
          // Step 0 or other: Count all tasks
          total = tasks.reduce((sum, t) => sum + t.size, 0);
        }
        
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

    // Helper function to draw a single block
    // progressMode: 'none' = full color, 'todo' = show remaining work, 'done' = show completed work
    function drawBlock(ctx, task, x, y, width, height, angle, color, progressMode = 'none') {
      ctx.save();
      
      // Translate and rotate for block
      ctx.translate(x, y);
      ctx.rotate(angle);
      
      // Simplified shadow for better performance
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 3;
      
      // Draw rounded rectangle (background for progress bar if partlydone)
      // Radius is 50% of height for pill-shaped blocks
      const radius = height / 2;
      
      // If task is partlydone AND progressMode is not 'none', draw progress bar
      if (task.status === 'partlydone' && task.percentComplete !== undefined && progressMode !== 'none') {
        ctx.beginPath();
        ctx.moveTo(-width / 2 + radius, -height / 2);
        ctx.lineTo(width / 2 - radius, -height / 2);
        ctx.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + radius);
        ctx.lineTo(width / 2, height / 2 - radius);
        ctx.quadraticCurveTo(width / 2, height / 2, width / 2 - radius, height / 2);
        ctx.lineTo(-width / 2 + radius, height / 2);
        ctx.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - radius);
        ctx.lineTo(-width / 2, -height / 2 + radius);
        ctx.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + radius, -height / 2);
        ctx.closePath();
        ctx.fillStyle = '#999999'; // Gray background
        ctx.fill();
        
        // Calculate progress width based on mode
        // 'todo' mode: show remaining work (100 - percentComplete)
        // 'done' mode: show completed work (percentComplete)
        const progressPercent = progressMode === 'todo' ? (100 - task.percentComplete) : task.percentComplete;
        const progressWidth = (width * progressPercent) / 100;
        
        ctx.save();
        // Clip to the left portion
        ctx.beginPath();
        ctx.rect(-width / 2, -height / 2, progressWidth, height);
        ctx.clip();
        
        // Draw colored portion with rounded corners
        ctx.beginPath();
        ctx.moveTo(-width / 2 + radius, -height / 2);
        ctx.lineTo(width / 2 - radius, -height / 2);
        ctx.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + radius);
        ctx.lineTo(width / 2, height / 2 - radius);
        ctx.quadraticCurveTo(width / 2, height / 2, width / 2 - radius, height / 2);
        ctx.lineTo(-width / 2 + radius, height / 2);
        ctx.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - radius);
        ctx.lineTo(-width / 2, -height / 2 + radius);
        ctx.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + radius, -height / 2);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        
        ctx.restore();
      } else {
        // Normal block (not partlydone) - draw full colored block
        ctx.beginPath();
        ctx.moveTo(-width / 2 + radius, -height / 2);
        ctx.lineTo(width / 2 - radius, -height / 2);
        ctx.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + radius);
        ctx.lineTo(width / 2, height / 2 - radius);
        ctx.quadraticCurveTo(width / 2, height / 2, width / 2 - radius, height / 2);
        ctx.lineTo(-width / 2 + radius, height / 2);
        ctx.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - radius);
        ctx.lineTo(-width / 2, -height / 2 + radius);
        ctx.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + radius, -height / 2);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      }
      
      // Border (draw after fill for all blocks)
      ctx.beginPath();
      ctx.moveTo(-width / 2 + radius, -height / 2);
      ctx.lineTo(width / 2 - radius, -height / 2);
      ctx.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + radius);
      ctx.lineTo(width / 2, height / 2 - radius);
      ctx.quadraticCurveTo(width / 2, height / 2, width / 2 - radius, height / 2);
      ctx.lineTo(-width / 2 + radius, height / 2);
      ctx.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - radius);
      ctx.lineTo(-width / 2, -height / 2 + radius);
      ctx.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + radius, -height / 2);
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      ctx.shadowColor = 'transparent'; // Turn off shadow for text
      
      // Draw text - use black for better readability
      ctx.fillStyle = 'black';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Task name
      const fontSize = Math.min(25, height / 3);
      ctx.font = `bold ${fontSize}px "Google Sans", Arial, sans-serif`;
      
      // Word wrap for longer text
      const words = task.text.split(' ');
      const maxWidth = width * 0.9;
      let lines = [];
      let currentLine = words[0] || '';
      
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
      const lineHeight = fontSize * 1.3;
      const totalTextHeight = lines.length * lineHeight;
      const startY = -totalTextHeight / 2 + lineHeight / 2;
      
      lines.forEach((line, i) => {
        ctx.fillText(line, 0, startY + i * lineHeight);
      });
      
      // Percentage below
 /*      ctx.font = `bold ${fontSize - 2}px Arial`;
      ctx.fillText(`${task.size}%`, 0, height / 2 - fontSize); */
      
      // Draw checkmark if completed
      if (task.completed) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-20, 0);
        ctx.lineTo(-10, 10);
        ctx.lineTo(20, -15);
        ctx.stroke();
      }
      
      ctx.restore();
    }

    // Start drawing
    drawOverlay();

    // Create new stream from canvas (20 FPS to reduce VideoFrame garbage collection warnings)
    const modifiedStream = canvas.captureStream(20);

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
