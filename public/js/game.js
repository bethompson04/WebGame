// Get socket and URL parameters from the parent window
/* global socket, urlParams */  // Declare globals to avoid redeclaration errors

// DOM Elements
const gameCanvas = document.getElementById('gameCanvas');
const instructions = document.getElementById('instructions');
const gameStatus = document.getElementById('gameStatus');

// Debug logging function (already defined in game.html)
function debugLog(message) {
    console.log(message);
    const debugInfo = document.getElementById('debugInfo');
    if (debugInfo) {
        debugInfo.textContent = message;
    }
}

debugLog('Game.js loaded, initializing game components...');

// Constants
const GRID_SIZE = 16;
const CELL_SIZE = 32;
const GRID_LINE_WIDTH = 1;
const GRID_LINE_COLOR = 0x999999;
const COLORS = {
    1: 0x0000FF,   // blue
    2: 0x008000,   // green
    3: 0xFF0000,   // red
    4: 0x000080,   // navy
    5: 0x800000,   // maroon
    6: 0x008080,   // teal
    7: 0x000000,   // black
    8: 0x808080    // gray
};

// Add sprite loading at the top with other constants
const SPRITE_URLS = {
    cursor: '/images/cursor.png',
    flag: '/images/flag.png'
};

// Add sprite textures variable
let spriteTextures = {
    flag: null
};

// Game state
let gameBoard = null;
let board = null;
let revealed = new Set();
let flagged = new Set();
let gameStarted = false;
let currentGameId = null;
let cells = null;
let app = null;
let cursors = new Map(); // Store other players' cursors
let playerName = urlParams.get('playerName') || 'Anonymous';
let players = new Map(); // Store player names and info

// Add flag ownership tracking
let flagOwners = new Map(); // Maps cell index to player ID who placed the flag

// Create player list display
const playersListElement = document.createElement('div');
playersListElement.style.position = 'fixed';
playersListElement.style.right = '20px';
playersListElement.style.top = '20px';
playersListElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
playersListElement.style.color = 'white';
playersListElement.style.padding = '15px';
playersListElement.style.borderRadius = '8px';
playersListElement.style.fontFamily = 'Arial, sans-serif';
playersListElement.style.zIndex = '1000';
document.body.appendChild(playersListElement);

// Function to update players list display
function updatePlayersList() {
    debugLog('Updating players list. Current players: ' + JSON.stringify(Array.from(players.entries())));
    
    const playersArray = Array.from(players.entries()).map(([id, data]) => {
        debugLog(`Processing player ${id}: ${JSON.stringify(data)}`);
        return `
            <div style="display: flex; align-items: center; margin: 5px 0;">
                <div style="width: 10px; height: 10px; background: #${data.cursorColor || 'FFFFFF'}; margin-right: 10px; border: 1px solid white;"></div>
                <span>${data.name || 'Anonymous'}</span>
                ${id === socket.id ? ' (You)' : ''}
            </div>
        `;
    }).join('');
    
    playersListElement.innerHTML = `
        <h3 style="margin: 0 0 10px 0;">Players in Game:</h3>
        ${playersArray || '<div>No players yet</div>'}
    `;
}

// Initialize PIXI.JS application and containers
let cursorContainer;

// Initialize PIXI.JS
function initializePixiJS() {
    debugLog('Initializing PIXI.JS...');
    
    // Create PIXI application
    app = new PIXI.Application({
        width: GRID_SIZE * CELL_SIZE,
        height: GRID_SIZE * CELL_SIZE,
        backgroundColor: 0x34495e,
        resolution: window.devicePixelRatio || 1,
    });

    // Add the canvas to the page
    const gameCanvas = document.getElementById('gameCanvas');
    gameCanvas.appendChild(app.view);

    // Prevent context menu on right click
    app.view.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
    });

    // Create main containers
    gameBoard = new PIXI.Container();
    cursorContainer = new PIXI.Container();
    
    // Set container properties
    gameBoard.sortableChildren = true;
    cursorContainer.sortableChildren = true;
    
    // Add containers to stage
    app.stage.addChild(gameBoard);
    app.stage.addChild(cursorContainer);
    
    // Load flag texture
    PIXI.Assets.load('images/flag.png').then(texture => {
        spriteTextures.flag = texture;
        debugLog('Flag texture loaded');
        initializeGame();
    }).catch(error => {
        debugLog('Error loading flag texture: ' + error);
        // Continue initialization even if texture fails to load
        initializeGame();
    });
}

// Initialize the game
function initializeGame() {
    debugLog('Initializing game...');
    
    if (!gameBoard) {
        debugLog('Error: gameBoard not initialized');
        return;
    }

    // Initialize grid
    cells = new Array(GRID_SIZE);
    for (let y = 0; y < GRID_SIZE; y++) {
        cells[y] = new Array(GRID_SIZE);
        for (let x = 0; x < GRID_SIZE; x++) {
            const cell = createCell(x, y);
            cells[y][x] = cell;
            gameBoard.addChild(cell);
        }
    }

    // Center the game board
    gameBoard.x = (app.screen.width - GRID_SIZE * CELL_SIZE) / 2;
    gameBoard.y = (app.screen.height - GRID_SIZE * CELL_SIZE) / 2;
    
    // Initialize cursor tracking
    initializeCursor();
    
    // Show game board and instructions
    document.getElementById('gameCanvas').style.display = 'block';
    document.getElementById('instructions').style.display = 'block';
    
    gameStarted = true;
    debugLog('Game initialization complete');
}

// Start initialization when the script loads
initializePixiJS();

// Update the DOM cursor element to also use cache busting
const timestamp = Date.now();
const cursor = document.createElement('div');
cursor.style.cssText = `
    position: fixed;
    width: 32px;
    height: 32px;
    pointer-events: none;
    z-index: 10000;
    display: none;
    background-image: url('${SPRITE_URLS.cursor}?t=${timestamp}');
    background-size: contain;
    background-repeat: no-repeat;
    background-position: top left;
`;

document.body.appendChild(cursor);

// Initialize cursor behavior
function initializeCursor() {
    const cursorColor = urlParams.get('cursorColor') || 'FFFFFF';
    debugLog(`Setting cursor color to #${cursorColor}`);
    
    // Convert hex color to RGB for the CSS filter
    const r = parseInt(cursorColor.substr(0, 2), 16);
    const g = parseInt(cursorColor.substr(2, 2), 16);
    const b = parseInt(cursorColor.substr(4, 2), 16);
    
    // Apply color using CSS filter instead of background-color
    cursor.style.filter = `brightness(0) saturate(100%) invert(${r / 255}) sepia(${g / 255}) saturate(${b / 255})`;
    
    app.view.addEventListener('mouseenter', () => {
        app.view.style.cursor = 'none';
        cursor.style.display = 'block';
    });
    
    app.view.addEventListener('mouseleave', () => {
        app.view.style.cursor = 'auto';
        cursor.style.display = 'none';
    });
}

// Helper function to calculate hue rotation from hex color
function getHueRotation(hexColor) {
    // Convert hex to RGB
    const r = parseInt(hexColor.substr(0, 2), 16) / 255;
    const g = parseInt(hexColor.substr(2, 2), 16) / 255;
    const b = parseInt(hexColor.substr(4, 2), 16) / 255;
    
    // Calculate hue
    let max = Math.max(r, g, b);
    let min = Math.min(r, g, b);
    let h = 0;
    
    if (max === min) {
        h = 0;
    } else if (max === r) {
        h = 60 * ((g - b) / (max - min));
    } else if (max === g) {
        h = 60 * (2 + (b - r) / (max - min));
    } else {
        h = 60 * (4 + (r - g) / (max - min));
    }
    
    if (h < 0) h += 360;
    return h;
}

// Update mousemove handler
document.addEventListener('mousemove', updateCursorPosition);

// Socket event handlers
socket.on('connect', () => {
    console.log('Connected to server');
    gameStatus.textContent = 'Connected to server';
    
    // Add yourself to the players list immediately
    players.set(socket.id, {
        name: playerName,
        cursorColor: urlParams.get('cursorColor') || 'FFFFFF'
    });
    updatePlayersList();
    
    // Send player info to server
    socket.emit('playerInfo', { 
        name: playerName,
        cursorColor: urlParams.get('cursorColor') || 'FFFFFF'
    });
});

socket.on('error', (message) => {
    debugLog('Game error: ' + message);
    gameStatus.textContent = message;
    setTimeout(() => {
        window.location.href = '/games.html';
    }, 2000);
});

socket.on('gameState', ({ gameId, roomName, board: newBoard, revealed: revealedCells, flagged: flaggedCells, players: gamePlayers }) => {
    debugLog('Received game state');
    
    currentGameId = gameId;
    board = newBoard;
    
    // Initialize revealed and flagged sets
    revealed = new Set(revealedCells);
    flagged = new Set(flaggedCells);
    
    // Update status with room name if available
    const status = roomName ? `Game: ${roomName}` : `Game ID: ${currentGameId}`;
    document.getElementById('gameStatus').textContent = status;
    
    // Update the board display if it's initialized
    if (gameStarted && gameBoard) {
        debugLog('Updating board display...');
        updateBoard();
    }
});

// Add flood fill function
function floodFill(x, y) {
    debugLog(`Starting flood fill at (${x},${y})`);
    const directions = [
        [-1, -1], [0, -1], [1, -1],  // Top row
        [-1,  0],          [1,  0],  // Middle row
        [-1,  1], [0,  1], [1,  1]   // Bottom row
    ];

    // For each adjacent cell
    for (const [dx, dy] of directions) {
        const newX = x + dx;
        const newY = y + dy;
        
        // Skip if out of bounds
        if (newX < 0 || newX >= GRID_SIZE || newY < 0 || newY >= GRID_SIZE) {
            continue;
        }
        
        const index = newY * GRID_SIZE + newX;
        
        // Skip if already revealed or flagged
        if (revealed.has(index) || flagged.has(index)) {
            continue;
        }
        
        // Reveal this cell
        debugLog(`Flood fill revealing (${newX},${newY})`);
        socket.emit('revealCell', { x: newX, y: newY });
    }
}

socket.on('cellRevealed', ({ x, y, value }) => {
    debugLog(`Received reveal for cell (${x},${y}) with value ${value}`);
    const index = y * GRID_SIZE + x;
    revealed.add(index);
    board[index] = value; // Update local board state
    updateCell(x, y, value);
    
    // If this is an empty cell, flood fill to reveal adjacent cells
    if (value === 0) {
        debugLog(`Empty cell at (${x},${y}), starting flood fill`);
        floodFill(x, y);
    }
    
    // Handle mine explosion
    if (value === -1) {
        gameStatus.textContent = '💥 BOOM! A mine was hit! Redirecting to game list...';
        gameStarted = false;
        setTimeout(() => {
            window.location.href = 'games.html';
        }, 2000);
    }
});

socket.on('flagUpdated', ({ x, y, flagged: isFlagged, playerId }) => {
    debugLog(`Flag ${isFlagged ? 'placed' : 'removed'} at (${x},${y}) by player ${playerId}`);
    const index = y * GRID_SIZE + x;
    if (isFlagged) {
        flagged.add(index);
        flagOwners.set(index, playerId || socket.id); // Use socket.id as fallback
        debugLog(`Flag owner set: ${playerId} at ${x},${y}`);
    } else {
        flagged.delete(index);
        flagOwners.delete(index);
    }
    updateCell(x, y);
});

socket.on('playerCount', (count) => {
    debugLog('Player count updated: ' + count);
    document.getElementById('playerCount').textContent = count;
});

socket.on('playerJoined', (player) => {
    debugLog(`Player joined: ${JSON.stringify(player)}`);
    
    if (player.id !== socket.id) {
        // Add to players list
        players.set(player.id, {
            name: player.name || 'Anonymous',
            cursorColor: player.cursorColor || 'FFFFFF'
        });
        updatePlayersList();
        
        // Create cursor
        const cursor = new PIXI.Graphics();
        cursor.lineStyle(2, 0x000000, 1);
        cursor.beginFill(parseInt(player.cursorColor || 'FFFFFF', 16), 0.8);
        cursor.drawCircle(0, 0, 5);
        cursor.endFill();
        cursor.zIndex = 1000;
        cursorContainer.addChild(cursor);
        cursors.set(player.id, cursor);
    }
});

socket.on('playerMoved', ({ id, x, y }) => {
    // Handle other players' cursor movement if needed
    // This could be implemented later if we want to show other players' cursors
});

socket.on('playerLeft', (playerId) => {
    debugLog(`Player left: ${playerId}`);
    const cursor = cursors.get(playerId);
    if (cursor) {
        cursorContainer.removeChild(cursor);
        cursors.delete(playerId);
    }
    players.delete(playerId);
    updatePlayersList();
});

socket.on('disconnect', () => {
    debugLog('Disconnected from server');
    gameStatus.textContent = 'Disconnected from server. Redirecting to game list...';
    gameStarted = false;
    
    // Remove all cursors
    cursors.forEach(cursor => {
        cursorContainer.removeChild(cursor);
    });
    cursors.clear();
    
    setTimeout(() => {
        window.location.href = '/games.html';
    }, 2000);
});

debugLog('Game initialization complete');

function updateBoard() {
    if (!cells) {
        debugLog('Warning: Trying to update board but cells are not initialized');
        return;
    }

    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const index = y * GRID_SIZE + x;
            updateCell(x, y, board[index]);
        }
    }
}

// Add helper function to convert hex color to RGB
function hexToRGB(hex) {
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    return [r, g, b];
}

// Add helper function to create color matrix for a given color
function createColorMatrix(hexColor) {
    const [r, g, b] = hexToRGB(hexColor);
    return [
        r, 0, 0, 0, 0,
        0, g, 0, 0, 0,
        0, 0, b, 0, 0,
        0, 0, 0, 1, 0
    ];
}

// Update createCell function to use ColorMatrixFilter
function createCell(x, y) {
    const cell = new PIXI.Container();
    cell.x = x * CELL_SIZE;
    cell.y = y * CELL_SIZE;

    // Background
    const background = new PIXI.Graphics();
    background.lineStyle(GRID_LINE_WIDTH, GRID_LINE_COLOR);
    background.beginFill(0xCCCCCC);
    background.drawRect(0, 0, CELL_SIZE, CELL_SIZE);
    background.endFill();
    
    // Add 3D effect
    background.lineStyle(1, 0xFFFFFF, 0.5);
    background.moveTo(1, CELL_SIZE - 1);
    background.lineTo(1, 1);
    background.lineTo(CELL_SIZE - 1, 1);
    background.lineStyle(1, 0x999999, 0.5);
    background.moveTo(CELL_SIZE - 1, 1);
    background.lineTo(CELL_SIZE - 1, CELL_SIZE - 1);
    background.lineTo(1, CELL_SIZE - 1);
    
    cell.addChild(background);

    // Text (for numbers)
    const text = new PIXI.Text('', {
        fontFamily: 'Arial',
        fontSize: 18,
        fill: 0x000000,
        align: 'center',
        fontWeight: 'bold'
    });
    text.anchor.set(0.5);
    text.x = CELL_SIZE / 2;
    text.y = CELL_SIZE / 2;
    text.visible = false;
    cell.addChild(text);

    // Flag sprite
    const flag = new PIXI.Sprite(spriteTextures.flag);
    flag.anchor.set(0.5);
    flag.x = CELL_SIZE / 2;
    flag.y = CELL_SIZE / 2;
    flag.width = CELL_SIZE * 0.8;
    flag.height = CELL_SIZE * 0.8;
    flag.visible = false;
    flag.colorMatrix = new PIXI.ColorMatrixFilter();
    flag.filters = [flag.colorMatrix];
    cell.addChild(flag);

    // Make cell interactive
    cell.eventMode = 'static';
    cell.cursor = 'pointer';
    
    cell.on('mouseover', () => {
        if (!revealed.has(y * GRID_SIZE + x) && !flagged.has(y * GRID_SIZE + x)) {
            background.tint = 0xDDDDDD;
        }
    });
    
    cell.on('mouseout', () => {
        if (!revealed.has(y * GRID_SIZE + x) && !flagged.has(y * GRID_SIZE + x)) {
            background.tint = 0xFFFFFF;
        }
    });

    cell.on('rightclick', (event) => {
        if (gameStarted && !revealed.has(y * GRID_SIZE + x)) {
            event.stopPropagation();
            socket.emit('toggleFlag', { x, y, playerId: socket.id });
        }
    });

    cell.on('click', () => {
        if (gameStarted && !flagged.has(y * GRID_SIZE + x) && !revealed.has(y * GRID_SIZE + x)) {
            debugLog(`Sending reveal request for cell (${x},${y})`);
            socket.emit('revealCell', { x, y });
        }
    });

    return cell;
}

// Update updateCell function to use ColorMatrixFilter
function updateCell(x, y, value) {
    if (!cells || !cells[y] || !cells[y][x]) {
        debugLog(`Warning: Trying to update cell at ${x},${y} but cells are not initialized`);
        return;
    }

    const cell = cells[y][x];
    const index = y * GRID_SIZE + x;
    const background = cell.getChildAt(0);
    const text = cell.getChildAt(1);
    const flag = cell.getChildAt(2);

    if (flagged.has(index)) {
        const playerId = flagOwners.get(index);
        if (playerId && players.has(playerId)) {
            const playerColor = players.get(playerId).cursorColor || 'FFFFFF';
            // Apply color matrix instead of tint
            flag.colorMatrix.matrix = createColorMatrix(playerColor);
            debugLog(`Flag color matrix set for player ${playerId} with color ${playerColor}`);
        }
        flag.visible = true;
        text.visible = false;
        background.tint = 0xFFFFFF;
    } else if (revealed.has(index)) {
        flag.visible = false;
        text.visible = false;
        background.tint = 0xFFFFFF;
        background.clear();
        background.beginFill(0xEEEEEE);
        background.lineStyle(GRID_LINE_WIDTH, GRID_LINE_COLOR);
        background.drawRect(0, 0, CELL_SIZE, CELL_SIZE);
        background.endFill();
        
        if (value === -1) {
            text.text = '💣';
            text.visible = true;
            background.tint = 0xFF0000;
        } else if (value > 0) {
            text.text = value.toString();
            text.style.fill = COLORS[value];
            text.visible = true;
        }
    } else {
        flag.visible = false;
        text.visible = false;
        background.tint = 0xFFFFFF;
    }
}

// Track mouse position globally
let lastMouseX = 0;
let lastMouseY = 0;
document.addEventListener('mousemove', (event) => {
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
    updateCursorPosition(event);
});

// Function to update cursor position
function updateCursorPosition(event) {
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
    
    // Only send position if over the game canvas
    const bounds = app.view.getBoundingClientRect();
    if (event.clientX >= bounds.left && 
        event.clientX <= bounds.right && 
        event.clientY >= bounds.top && 
        event.clientY <= bounds.bottom) {
        // Send the exact cursor position for accurate clicking
        socket.emit('cursorMove', {
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top
        });
    }
} 