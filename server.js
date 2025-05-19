// Import required modules
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Set server port, use environment variable if available
const PORT = process.env.PORT || 3000;

// Game configuration and state
const games = new Map();  // Stores all active games
const GRID_SIZE = 16;     // Size of the game board (16x16)
const MINES_COUNT = 40;   // Number of mines on the board

// Player state
const players = new Map(); // Store player information

// Helper function to reveal adjacent cells
function revealAdjacentCells(game, x, y, revealedCells = new Set()) {
    console.log(`\n[FLOOD FILL] Starting at (${x},${y})`);
    
    // If out of bounds, stop
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) {
        console.log(`[FLOOD FILL] (${x},${y}) is out of bounds, stopping`);
        return revealedCells;
    }

    const index = y * GRID_SIZE + x;
    console.log(`[FLOOD FILL] Checking cell (${x},${y}) with value ${game.board[index]}`);
    
    // If already in our revealed set or flagged, stop
    if (revealedCells.has(index)) {
        console.log(`[FLOOD FILL] Cell (${x},${y}) already in revealed set, stopping`);
        return revealedCells;
    }
    if (game.flagged.has(index)) {
        console.log(`[FLOOD FILL] Cell (${x},${y}) is flagged, stopping`);
        return revealedCells;
    }

    // Add current cell to revealed set
    revealedCells.add(index);
    console.log(`[FLOOD FILL] Added cell (${x},${y}) to revealed set. Current size: ${revealedCells.size}`);
    
    // If it's a mine, stop here
    if (game.board[index] === -1) {
        console.log(`[FLOOD FILL] Hit mine at (${x},${y}), stopping`);
        return revealedCells;
    }

    // If it's an empty cell (0), check all adjacent cells
    if (game.board[index] === 0) {
        console.log(`[FLOOD FILL] Empty cell at (${x},${y}), checking adjacent cells`);
        // Define adjacent cell offsets
        const directions = [
            [-1, -1], [0, -1], [1, -1],  // Top row
            [-1,  0],          [1,  0],  // Middle row
            [-1,  1], [0,  1], [1,  1]   // Bottom row
        ];

        // Check all 8 adjacent cells
        for (const [dx, dy] of directions) {
            const newX = x + dx;
            const newY = y + dy;
            console.log(`[FLOOD FILL] Checking adjacent cell (${newX},${newY})`);
            revealAdjacentCells(game, newX, newY, revealedCells);
        }
    } else {
        console.log(`[FLOOD FILL] Cell (${x},${y}) has value ${game.board[index]}, not expanding`);
    }
    
    return revealedCells;
}

// Serve static files from the public directory
app.use(express.static('public'));

// Route handler for the root path - serves the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.IO connection handler
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Handle player info
    socket.on('playerInfo', ({ name }) => {
        const player = players.get(socket.id) || {};
        player.name = name;
        players.set(socket.id, player);
    });
    
    // Handle game list request
    socket.on('getGameList', () => {
        const gameList = Array.from(games.entries()).map(([id, game]) => ({
            id,
            roomName: game.roomName,
            players: game.players.size
        })).filter(game => game.players.size < 4);
        
        socket.emit('gameList', gameList);
    });

    // Create or join a game
    socket.on('joinGame', (data) => {
        let gameId = null;
        let roomName = null;
        let cursorColor = 'FFFFFF'; // Default white
        
        // Parse the incoming data to determine if we're joining or creating
        if (typeof data === 'string') {
            gameId = data; // Joining existing game
            cursorColor = 'FFFFFF'; // Default color for joining players
        } else if (data && data.roomName) {
            gameId = Date.now().toString(); // Generate new game ID
            roomName = data.roomName;
            cursorColor = data.cursorColor || cursorColor;
        } else {
            gameId = Date.now().toString(); // Fallback for legacy format
        }
        
        // Store player information
        const playerInfo = players.get(socket.id) || {};
        playerInfo.cursorColor = cursorColor;
        playerInfo.x = 0;
        playerInfo.y = 0;
        players.set(socket.id, playerInfo);

        // Leave current game if in one
        let currentGameId = Array.from(socket.rooms)[1];
        if (currentGameId) {
            const currentGame = games.get(currentGameId);
            if (currentGame) {
                currentGame.players.delete(socket.id);
                socket.leave(currentGameId);
                if (currentGame.players.size === 0) {
                    games.delete(currentGameId);
                }
            }
        }
        
        socket.join(gameId);
        
        if (!games.has(gameId)) {
            console.log('Creating new game:', gameId, roomName);
            games.set(gameId, {
                roomName: roomName,
                players: new Set(),
                board: generateBoard(),
                revealed: new Set(),
                flagged: new Set()
            });
        }
        
        const game = games.get(gameId);
        
        // Check if game is full
        if (game.players.size >= 4) {
            socket.emit('error', 'Game is full');
            return;
        }
        
        game.players.add(socket.id);
        
        // Send initial game state with player names
        socket.emit('gameState', {
            gameId,
            roomName: game.roomName,
            board: game.board,
            revealed: Array.from(game.revealed),
            flagged: Array.from(game.flagged),
            players: Array.from(game.players).map(playerId => ({
                id: playerId,
                name: (players.get(playerId) || {}).name || 'Anonymous',
                cursorColor: (players.get(playerId) || {}).cursorColor || 'FFFFFF',
                x: (players.get(playerId) || {}).x || 0,
                y: (players.get(playerId) || {}).y || 0
            }))
        });
        
        // Broadcast updated player count and new player to all clients in the game
        io.to(gameId).emit('playerCount', game.players.size);
        io.to(gameId).emit('playerJoined', {
            id: socket.id,
            name: playerInfo.name || 'Anonymous',
            cursorColor: playerInfo.cursorColor,
            x: playerInfo.x,
            y: playerInfo.y
        });
        
        // Handle cursor movement
        socket.on('cursorMove', ({ x, y }) => {
            const player = players.get(socket.id);
            if (player) {
                player.x = x;
                player.y = y;
                socket.to(gameId).emit('playerMoved', {
                    id: socket.id,
                    x,
                    y
                });
            }
        });

        // Update the game list for all connected clients
        const gameList = Array.from(games.entries()).map(([id, game]) => ({
            id,
            roomName: game.roomName,
            players: game.players.size
        })).filter(game => game.players.size < 4);
        
        io.emit('gameList', gameList);
        
        console.log(`Player ${socket.id} joined game ${gameId}. Players in game: ${game.players.size}`);
    });
    
    // Handle cell reveal action
    socket.on('revealCell', ({ x, y }) => {
        console.log('\n[REVEAL] ====== Starting Cell Reveal ======');
        console.log(`[REVEAL] Received reveal request for cell (${x},${y})`);
        
        const gameId = Array.from(socket.rooms)[1];
        const game = games.get(gameId);
        
        if (!game) {
            console.log('[REVEAL] Error: Game not found');
            return;
        }
        
        const index = y * GRID_SIZE + x;
        const cellValue = game.board[index];
        console.log(`[REVEAL] Cell (${x},${y}) index: ${index}, value: ${cellValue}`);
        
        // Print surrounding cells for context
        console.log('[REVEAL] Surrounding cells:');
        for (let dy = -1; dy <= 1; dy++) {
            let row = '[REVEAL] ';
            for (let dx = -1; dx <= 1; dx++) {
                const newX = x + dx;
                const newY = y + dy;
                if (newX >= 0 && newX < GRID_SIZE && newY >= 0 && newY < GRID_SIZE) {
                    const newIndex = newY * GRID_SIZE + newX;
                    const val = game.board[newIndex];
                    row += (val === -1 ? 'M' : val) + ' ';
                } else {
                    row += 'X ';
                }
            }
            console.log(row);
        }
        
        // If already revealed or flagged, ignore
        if (game.revealed.has(index)) {
            console.log(`[REVEAL] Cell already revealed, ignoring`);
            return;
        }
        if (game.flagged.has(index)) {
            console.log(`[REVEAL] Cell is flagged, ignoring`);
            return;
        }

        // If it's a mine
        if (cellValue === -1) {
            console.log(`[REVEAL] Mine hit!`);
            game.revealed.add(index);
            io.to(gameId).emit('cellRevealed', { x, y, value: -1 });
            return;
        }

        // If it's an empty cell, start flood fill
        if (cellValue === 0) {
            console.log(`[REVEAL] Empty cell clicked, starting flood fill`);
            const revealedCells = revealAdjacentCells(game, x, y, new Set());
            console.log(`[REVEAL] Flood fill complete. Cells to reveal: ${revealedCells.size}`);
            
            // Update game's revealed set with all newly revealed cells
            for (const idx of revealedCells) {
                game.revealed.add(idx);
            }

            // Convert to array of cell data and reveal
            const cellsToReveal = Array.from(revealedCells).map(idx => {
                const cellY = Math.floor(idx / GRID_SIZE);
                const cellX = idx % GRID_SIZE;
                return {
                    x: cellX,
                    y: cellY,
                    value: game.board[idx]
                };
            });

            // Reveal all cells to clients
            console.log(`[REVEAL] Sending reveal events for ${cellsToReveal.length} cells`);
            cellsToReveal.forEach(cell => {
                console.log(`[REVEAL] Revealing cell (${cell.x},${cell.y}) with value ${cell.value}`);
                io.to(gameId).emit('cellRevealed', cell);
            });
        } else {
            // Just reveal this single numbered cell
            console.log(`[REVEAL] Revealing single numbered cell with value ${cellValue}`);
            game.revealed.add(index);
            io.to(gameId).emit('cellRevealed', { x, y, value: cellValue });
        }
        
        console.log('[REVEAL] ====== Cell Reveal Complete ======\n');
    });
    
    // Handle flag toggle action
    socket.on('toggleFlag', ({ x, y }) => {
        const gameId = Array.from(socket.rooms)[1];  // Get current game room
        const game = games.get(gameId);
        
        if (!game) {
            console.log('Game not found for flag:', gameId);
            return;
        }
        
        // Calculate cell index and toggle flag state
        const index = y * GRID_SIZE + x;
        const isFlagged = game.flagged.has(index);
        
        if (isFlagged) {
            game.flagged.delete(index);
        } else {
            game.flagged.add(index);
        }
        
        // Notify all players about the flag update
        io.to(gameId).emit('flagUpdated', { x, y, flagged: !isFlagged });
        console.log(`Flag toggled at (${x},${y}) in game ${gameId}`);
    });
    
    // Handle player disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Clean up player data
        players.delete(socket.id);
        
        for (const [gameId, game] of games.entries()) {
            if (game.players.has(socket.id)) {
                game.players.delete(socket.id);
                io.to(gameId).emit('playerCount', game.players.size);
                io.to(gameId).emit('playerLeft', socket.id);
                
                // Update the game list for all connected clients
                const gameList = Array.from(games.entries()).map(([id, game]) => ({
                    id,
                    roomName: game.roomName,
                    players: game.players.size
                })).filter(game => game.players.size < 4);
                
                io.emit('gameList', gameList);
                break;
            }
        }
    });
});

// Generate a new game board with mines and numbers
function generateBoard() {
    console.log('\n[BOARD] Generating new board...');
    
    // Create empty board filled with zeros
    const board = new Array(GRID_SIZE * GRID_SIZE).fill(0);
    let minesPlaced = 0;
    
    // Place mines randomly on the board
    while (minesPlaced < MINES_COUNT) {
        const pos = Math.floor(Math.random() * board.length);
        if (board[pos] !== -1) {  // -1 represents a mine
            board[pos] = -1;
            minesPlaced++;
            
            // Calculate and update numbers for adjacent cells
            const x = pos % GRID_SIZE;
            const y = Math.floor(pos / GRID_SIZE);
            
            // Check all 8 adjacent cells
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    
                    const newX = x + dx;
                    const newY = y + dy;
                    
                    // Ensure we're within board boundaries
                    if (newX >= 0 && newX < GRID_SIZE && newY >= 0 && newY < GRID_SIZE) {
                        const newPos = newY * GRID_SIZE + newX;
                        if (board[newPos] !== -1) {
                            board[newPos]++;  // Increment adjacent cell number
                        }
                    }
                }
            }
        }
    }
    
    // Debug: Print board state
    console.log('[BOARD] Generated board state:');
    for (let y = 0; y < GRID_SIZE; y++) {
        let row = '[BOARD] ';
        for (let x = 0; x < GRID_SIZE; x++) {
            const value = board[y * GRID_SIZE + x];
            row += (value === -1 ? 'M' : value) + ' ';
        }
        console.log(row);
    }
    
    return board;
}

// Start the server
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 