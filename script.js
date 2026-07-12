/**
 * Three Shapes Challenge - Main Logic (script.js)
 * Coordinates UI, game loops, Web Audio API synthesizer, Canvas particles, and AI solver.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Game States
  let state = {
    gameMode: 'vs_ai',     // 'vs_ai' or 'pvp'
    difficulty: 'easy',     // 'easy' or 'hard'
    currentPlayer: 'player1', // 'player1', 'player2', 'ai'
    heaps: [1, 4, 6],       // heap sizes for [triangles, circles, squares]
    activeRow: null,        // lock row choice once a shape is clicked in a turn
    turnRemovedShapes: [],  // tracks elements removed in current turn for Undo { id, row, el }
    isPlaying: false,
    soundEnabled: true,
    theme: 'dark',
    turnsCount: 0
  };

  // SVG HTML templates for rendering shapes
  const svgTemplates = {
    triangle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><polygon points="60,10 110,105 10,105" fill="var(--color-triangle)"/></svg>`,
    circle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="48" fill="var(--color-circle)"/></svg>`,
    square: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect x="12" y="12" width="96" height="96" fill="var(--color-square)"/></svg>`
  };

  // Instantiate AI Solver
  const aiEngine = new window.ShapeGameAI();

  // Audio Context (Lazy Initialized)
  let audioCtx = null;

  // Canvas Particles State
  const canvas = document.getElementById('particle-canvas');
  const ctx = canvas.getContext('2d');
  let particles = [];
  let ambientParticles = [];

  // DOM Elements
  const screens = {
    lobby: document.getElementById('lobby-screen'),
    game: document.getElementById('game-screen'),
    gameover: document.getElementById('gameover-screen')
  };

  const menuButtons = {
    start: document.getElementById('start-game-btn'),
    retry: document.getElementById('retry-game-btn'),
    backToMenu: document.getElementById('back-to-menu-btn'),
    quit: document.getElementById('quit-game-btn'),
    toggleSound: document.getElementById('toggle-sound'),
    toggleTheme: document.getElementById('toggle-theme')
  };

  const lobbyStats = {
    aiWins: document.getElementById('ai-wins-count'),
    pvpMatches: document.getElementById('pvp-matches-count')
  };

  const gameControls = {
    undo: document.getElementById('undo-btn'),
    pass: document.getElementById('pass-btn'),
    turnBar: document.getElementById('turn-bar'),
    turnText: document.getElementById('current-turn-text')
  };

  const gameoverStats = {
    emoji: document.getElementById('gameover-emoji'),
    title: document.getElementById('gameover-title'),
    winner: document.getElementById('final-winner'),
    mode: document.getElementById('final-mode'),
    turns: document.getElementById('final-turns'),
    remaining: document.getElementById('final-remaining')
  };

  const rowContainers = [
    document.getElementById('container-triangles'),
    document.getElementById('container-circles'),
    document.getElementById('container-squares')
  ];

  const rowElements = [
    document.getElementById('row-triangles'),
    document.getElementById('row-circles'),
    document.getElementById('row-squares')
  ];

  /* ==========================================================================
     AUDIO SYNTHESIS SYSTEM (Web Audio API)
     ========================================================================== */
  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  function playSynthSound(type) {
    if (!state.soundEnabled) return;
    initAudio();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    
    switch (type) {
      case 'click': {
        // Tiny click sound (sine pitch pop)
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);
        
        gainNode.gain.setValueAtTime(0.04, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.06);
        break;
      }
      case 'match': {
        // End of turn chime
        const notes = [523.25, 659.25]; // C5 -> E5
        notes.forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.06);
          
          gainNode.gain.setValueAtTime(0.08, now + idx * 0.06);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.2);
          
          osc.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          osc.start(now + idx * 0.06);
          osc.stop(now + idx * 0.06 + 0.25);
        });
        break;
      }
      case 'error': {
        // Distorted error sound
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.linearRampToValueAtTime(60, now + 0.2);
        
        gainNode.gain.setValueAtTime(0.12, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
        break;
      }
      case 'win': {
        // Triumphant arpeggio
        const chord = [261.63, 329.63, 392.00, 523.25, 1046.50];
        chord.forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.07);
          
          gainNode.gain.setValueAtTime(0.08, now + idx * 0.07);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.4);
          
          osc.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          osc.start(now + idx * 0.07);
          osc.stop(now + idx * 0.07 + 0.5);
        });
        break;
      }
      case 'lose': {
        // Sad sliding down thud
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.linearRampToValueAtTime(50, now + 0.5);
        
        gainNode.gain.setValueAtTime(0.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.6);
        break;
      }
    }
  }

  /* ==========================================================================
     PARTICLE EFFECTS SYSTEM
     ========================================================================== */
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Particle Class
  class Particle {
    constructor(x, y, color, isExplosion = false) {
      this.x = x;
      this.y = y;
      this.color = color;
      this.isExplosion = isExplosion;
      
      if (isExplosion) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 1.5;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.size = Math.random() * 5 + 3;
        this.alpha = 1;
        this.decay = Math.random() * 0.025 + 0.015;
      } else {
        // Ambient background floating star
        this.vx = (Math.random() - 0.5) * 0.25;
        this.vy = -Math.random() * 0.35 - 0.08;
        this.size = Math.random() * 2.5 + 0.8;
        this.alpha = Math.random() * 0.5 + 0.1;
        this.decay = 0;
      }
      
      this.gravity = isExplosion ? 0.08 : 0;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.vy += this.gravity;
      
      if (this.isExplosion) {
        this.alpha -= this.decay;
      } else {
        // Wrap around ambient stars
        if (this.y < -10) this.y = canvas.height + 10;
        if (this.x < -10) this.x = canvas.width + 10;
        if (this.x > canvas.width + 10) this.x = -10;
      }
    }

    draw() {
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.alpha);
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.shadowBlur = this.isExplosion ? 8 : 2;
      ctx.shadowColor = this.color;
      ctx.fill();
      ctx.restore();
    }
  }

  // Create ambient particles
  function createAmbientParticles() {
    ambientParticles = [];
    const count = 35;
    const colors = ['#00e676', '#00f0ff', '#ffea00', '#8a2be2'];
    for (let i = 0; i < count; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const color = colors[Math.floor(Math.random() * colors.length)];
      ambientParticles.push(new Particle(x, y, color, false));
    }
  }

  function triggerMatchExplosion(x, y, color) {
    for (let i = 0; i < 15; i++) {
      particles.push(new Particle(x, y, color, true));
    }
  }

  function triggerScreenExplosion() {
    const colors = ['#00e676', '#00f0ff', '#ffea00', '#8a2be2'];
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height * 0.45;
      const color = colors[Math.floor(Math.random() * colors.length)];
      particles.push(new Particle(x, y, color, true));
    }
  }

  // Particles Loop
  function updateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw & update ambient stars
    ambientParticles.forEach(p => {
      p.update();
      p.draw();
    });

    // Draw & update explosion particles
    particles = particles.filter(p => p.alpha > 0);
    particles.forEach(p => {
      p.update();
      p.draw();
    });

    requestAnimationFrame(updateParticles);
  }

  createAmbientParticles();
  updateParticles();


  /* ==========================================================================
     LOBBY & STORAGE
     ========================================================================== */
  function loadStats() {
    const aiWins = localStorage.getItem('shapegame_ai_wins') || '0';
    const pvpMatches = localStorage.getItem('shapegame_pvp_matches') || '0';
    
    lobbyStats.aiWins.textContent = aiWins;
    lobbyStats.pvpMatches.textContent = pvpMatches;
  }

  function recordWin(winner) {
    if (state.gameMode === 'vs_ai') {
      if (winner === 'player1') {
        const currentWins = parseInt(localStorage.getItem('shapegame_ai_wins') || '0', 10);
        localStorage.setItem('shapegame_ai_wins', (currentWins + 1).toString());
      }
    } else {
      const currentMatches = parseInt(localStorage.getItem('shapegame_pvp_matches') || '0', 10);
      localStorage.setItem('shapegame_pvp_matches', (currentMatches + 1).toString());
    }
    loadStats();
  }

  loadStats();

  // Mode Cards Selection
  document.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', () => {
      playSynthSound('click');
      document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      state.gameMode = card.getAttribute('data-mode');
      
      // Hide difficulty option if PvP is selected
      const diffGroup = document.getElementById('difficulty-group');
      if (state.gameMode === 'pvp') {
        diffGroup.style.display = 'none';
      } else {
        diffGroup.style.display = 'block';
      }
    });
  });

  // Difficulty Selection
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      playSynthSound('click');
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.difficulty = btn.getAttribute('data-diff');
    });
  });

  // Sound Toggle
  menuButtons.toggleSound.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    menuButtons.toggleSound.textContent = state.soundEnabled ? '🔊' : '🔇';
    if (state.soundEnabled) {
      initAudio();
      playSynthSound('click');
    }
  });

  // Theme Toggle
  menuButtons.toggleTheme.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    menuButtons.toggleTheme.textContent = state.theme === 'dark' ? '🌙' : '☀️';
    playSynthSound('click');
  });


  /* ==========================================================================
     GAME LIFECYCLE
     ========================================================================== */
  menuButtons.start.addEventListener('click', startGame);
  menuButtons.retry.addEventListener('click', startGame);
  menuButtons.backToMenu.addEventListener('click', showLobby);
  menuButtons.quit.addEventListener('click', showLobby);
  
  gameControls.undo.addEventListener('click', undoLastRemoval);
  gameControls.pass.addEventListener('click', passTurn);

  function changeScreen(screenName) {
    playSynthSound('click');
    for (const key in screens) {
      screens[key].classList.remove('active');
    }
    screens[screenName].classList.add('active');
  }

  function showLobby() {
    state.isPlaying = false;
    changeScreen('lobby');
    loadStats();
  }

  function startGame() {
    changeScreen('game');
    
    // Set initial shapes state
    state.heaps = [1, 4, 6];
    state.activeRow = null;
    state.turnRemovedShapes = [];
    state.turnsCount = 0;
    state.isPlaying = true;
    
    // Determine starting player randomly
    if (state.gameMode === 'vs_ai') {
      state.currentPlayer = Math.random() < 0.5 ? 'player1' : 'ai';
    } else {
      state.currentPlayer = Math.random() < 0.5 ? 'player1' : 'player2';
    }

    renderShapes();
    updateTurnBar();

    if (state.currentPlayer === 'ai') {
      runAITurn();
    }
  }

  function updateTurnBar() {
    const turnBar = gameControls.turnBar;
    
    // Clear previous classes
    turnBar.className = 'turn-indicator-bar';

    if (state.currentPlayer === 'player1') {
      turnBar.classList.add('player1-turn');
      gameControls.turnText.textContent = state.gameMode === 'vs_ai' ? 'دورك الآن! 👤' : 'دور اللاعب الأول! 👤';
    } else if (state.currentPlayer === 'player2') {
      turnBar.classList.add('player2-turn');
      gameControls.turnText.textContent = 'دور اللاعب الثاني! 👥';
    } else if (state.currentPlayer === 'ai') {
      turnBar.classList.add('ai-turn');
      gameControls.turnText.textContent = 'دور الروبوت يفكّر... 🤖';
    }
  }

  /* ==========================================================================
     BOARD RENDERING & SHAPE INTERACTION
     ========================================================================== */
  
  function renderShapes() {
    const shapeTypes = ['triangle', 'circle', 'square'];
    
    for (let r = 0; r < 3; r++) {
      const container = rowContainers[r];
      const count = state.heaps[r];
      container.innerHTML = '';
      
      // Render count shapes
      for (let i = 0; i < count; i++) {
        const shapeEl = document.createElement('div');
        shapeEl.className = 'nim-shape';
        shapeEl.setAttribute('data-type', shapeTypes[r]);
        shapeEl.setAttribute('data-row', r);
        shapeEl.setAttribute('id', `shape-${r}-${i}`);
        shapeEl.innerHTML = svgTemplates[shapeTypes[r]];
        
        // Add click listener
        shapeEl.addEventListener('click', () => {
          handleShapeClick(r, `shape-${r}-${i}`, shapeEl);
        });
        
        container.appendChild(shapeEl);
      }
      
      // Update faded styling on rows
      const rowEl = rowElements[r];
      rowEl.classList.remove('faded', 'active-row');
      
      if (state.activeRow !== null) {
        if (state.activeRow === r) {
          rowEl.classList.add('active-row');
        } else {
          rowEl.classList.add('faded');
        }
      }
    }
    
    updateButtons();
  }

  function updateButtons() {
    const hasRemoved = state.turnRemovedShapes.length > 0;
    const isPlayerTurn = state.currentPlayer !== 'ai';
    
    if (hasRemoved && isPlayerTurn) {
      gameControls.undo.classList.remove('disabled');
      gameControls.undo.removeAttribute('disabled');
      gameControls.pass.classList.remove('disabled');
      gameControls.pass.removeAttribute('disabled');
    } else {
      gameControls.undo.classList.add('disabled');
      gameControls.undo.setAttribute('disabled', 'true');
      gameControls.pass.classList.add('disabled');
      gameControls.pass.setAttribute('disabled', 'true');
    }
  }

  function handleShapeClick(row, id, element) {
    if (!state.isPlaying || state.currentPlayer === 'ai') return;
    
    // Check if player clicked a shape in a locked/inactive row
    if (state.activeRow !== null && state.activeRow !== row) {
      playSynthSound('error');
      // Briefly flash the clicked row red or shake it
      rowElements[row].classList.add('wrong-flash');
      setTimeout(() => rowElements[row].classList.remove('wrong-flash'), 400);
      return;
    }
    
    // Set active row
    if (state.activeRow === null) {
      state.activeRow = row;
      // Fade other rows
      for (let r = 0; r < 3; r++) {
        if (r !== row) {
          rowElements[r].classList.add('faded');
        } else {
          rowElements[r].classList.add('active-row');
        }
      }
    }
    
    // Perform removal animation
    element.classList.add('removed');
    playSynthSound('click');
    
    // Spark particles on shape
    const rect = element.getBoundingClientRect();
    const colors = { triangle: '#00e676', circle: '#00f0ff', square: '#ffea00' };
    const shapeType = element.getAttribute('data-type');
    triggerMatchExplosion(rect.left + rect.width / 2, rect.top + rect.height / 2, colors[shapeType]);
    
    // Update state heaps
    state.heaps[row]--;
    
    // Record for undo
    state.turnRemovedShapes.push({ id, row, el: element });
    updateButtons();
  }

  function undoLastRemoval() {
    if (state.turnRemovedShapes.length === 0 || state.currentPlayer === 'ai') return;
    
    const last = state.turnRemovedShapes.pop();
    
    // Revert state heap
    state.heaps[last.row]++;
    
    // Restore element visibility
    last.el.classList.remove('removed');
    playSynthSound('click');
    
    // Reset active row if all shapes removed in this turn are restored
    if (state.turnRemovedShapes.length === 0) {
      state.activeRow = null;
      for (let r = 0; r < 3; r++) {
        rowElements[r].classList.remove('faded', 'active-row');
      }
    }
    
    updateButtons();
  }

  function passTurn() {
    if (state.turnRemovedShapes.length === 0) return;
    
    playSynthSound('match');
    
    // Check win condition
    const totalRemaining = state.heaps[0] + state.heaps[1] + state.heaps[2];
    
    if (totalRemaining === 1) {
      // The current player leaves exactly 1 shape. They win immediately!
      endGame(state.currentPlayer);
      return;
    } else if (totalRemaining === 0) {
      // The current player cleared the board, taking the last shape. They lose, meaning the OTHER player wins!
      const otherPlayer = (state.currentPlayer === 'player1') 
        ? (state.gameMode === 'vs_ai' ? 'ai' : 'player2') 
        : 'player1';
      endGame(otherPlayer);
      return;
    }
    
    // Switch turn
    state.turnsCount++;
    state.activeRow = null;
    state.turnRemovedShapes = [];
    
    if (state.gameMode === 'vs_ai') {
      state.currentPlayer = state.currentPlayer === 'player1' ? 'ai' : 'player1';
    } else {
      state.currentPlayer = state.currentPlayer === 'player1' ? 'player2' : 'player1';
    }
    
    renderShapes();
    updateTurnBar();
    
    if (state.currentPlayer === 'ai') {
      runAITurn();
    }
  }

  /* ==========================================================================
     AI OPPONENT IMPLEMENTATION
     ========================================================================== */
  function runAITurn() {
    // Disable inputs
    gameControls.undo.classList.add('disabled');
    gameControls.undo.setAttribute('disabled', 'true');
    gameControls.pass.classList.add('disabled');
    gameControls.pass.setAttribute('disabled', 'true');
    
    // Calculate AI move
    const aiMove = aiEngine.getNimMove(state.heaps, state.difficulty);
    
    if (!aiMove) {
      // Fallback in case of error
      passTurn();
      return;
    }
    
    // Simulating AI thinking delay
    const delay = Math.floor(Math.random() * 800) + 1200; // 1.2s - 2.0s thinking
    
    setTimeout(() => {
      if (!state.isPlaying) return;
      
      const { heapIndex, amountToRemove } = aiMove;
      
      // Fade out other rows visually
      for (let r = 0; r < 3; r++) {
        if (r !== heapIndex) {
          rowElements[r].classList.add('faded');
        } else {
          rowElements[r].classList.add('active-row');
        }
      }
      
      // Select the shape elements in the target row that are not yet marked as removed
      const rowContainer = rowContainers[heapIndex];
      const shapeElements = Array.from(rowContainer.querySelectorAll('.nim-shape:not(.removed)'));
      
      // Animate removing shapes one-by-one
      let removedCount = 0;
      
      function removeNext() {
        if (removedCount >= amountToRemove) {
          // Finished removing all shapes
          setTimeout(() => {
            // Update the state heaps
            state.heaps[heapIndex] -= amountToRemove;
            
            // Check win condition
            const totalRemaining = state.heaps[0] + state.heaps[1] + state.heaps[2];
            
            if (totalRemaining === 1) {
              endGame('ai');
            } else if (totalRemaining === 0) {
              endGame('player1'); // AI cleared the board, so human player wins
            } else {
              // Pass turn back to human player
              state.turnsCount++;
              state.activeRow = null;
              state.turnRemovedShapes = [];
              state.currentPlayer = 'player1';
              
              renderShapes();
              updateTurnBar();
            }
          }, 400);
          return;
        }
        
        const el = shapeElements[removedCount];
        if (el) {
          el.classList.add('removed');
          playSynthSound('click');
          
          const rect = el.getBoundingClientRect();
          const colors = { triangle: '#00e676', circle: '#00f0ff', square: '#ffea00' };
          const shapeType = el.getAttribute('data-type');
          triggerMatchExplosion(rect.left + rect.width / 2, rect.top + rect.height / 2, colors[shapeType]);
        }
        
        removedCount++;
        setTimeout(removeNext, 350); // delay between shape removals
      }
      
      removeNext();
      
    }, delay);
  }

  /* ==========================================================================
     GAME OVER & WINNER DECLARATION
     ========================================================================== */
  function endGame(winner) {
    state.isPlaying = false;
    
    // Save to local storage stats
    recordWin(winner);
    
    // Fill GameOver Screen details
    const totalRemaining = state.heaps[0] + state.heaps[1] + state.heaps[2];
    gameoverStats.turns.textContent = state.turnsCount + 1;
    gameoverStats.remaining.textContent = totalRemaining;
    
    if (state.gameMode === 'vs_ai') {
      gameoverStats.mode.textContent = 'لعب ضد الروبوت ' + (state.difficulty === 'easy' ? '(سهل)' : '(صعب)');
      if (winner === 'player1') {
        playSynthSound('win');
        triggerScreenExplosion();
        gameoverStats.emoji.textContent = '🎉';
        gameoverStats.title.textContent = 'لقد انتصرت على الروبوت! 🏆';
        gameoverStats.title.style.color = 'var(--color-success)';
        gameoverStats.winner.textContent = 'أنت (اللاعب)';
      } else {
        playSynthSound('lose');
        gameoverStats.emoji.textContent = '🤖';
        gameoverStats.title.textContent = 'تفوّق عليك الروبوت! 💔';
        gameoverStats.title.style.color = 'var(--color-error)';
        gameoverStats.winner.textContent = 'الروبوت الذكي';
      }
    } else {
      playSynthSound('win');
      triggerScreenExplosion();
      gameoverStats.emoji.textContent = '🏆';
      gameoverStats.mode.textContent = 'لعب ثنائي محلي';
      if (winner === 'player1') {
        gameoverStats.title.textContent = 'فاز اللاعب الأول! 🎉';
        gameoverStats.title.style.color = 'var(--color-success)';
        gameoverStats.winner.textContent = 'اللاعب الأول';
      } else {
        gameoverStats.title.textContent = 'فاز اللاعب الثاني! 🎉';
        gameoverStats.title.style.color = 'var(--color-success)';
        gameoverStats.winner.textContent = 'اللاعب الثاني';
      }
    }
    
    changeScreen('gameover');
  }

});