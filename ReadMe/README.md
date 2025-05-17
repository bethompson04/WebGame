# Multiplayer Minesweeper

A real-time multiplayer Minesweeper game built with PixiJS, Socket.IO, and Express.

## Features

- Real-time multiplayer gameplay
- Classic Minesweeper mechanics
- Up to 4 players per game
- Automatic game joining
- Flag placement synchronization
- Player count display

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)

## Installation

1. Clone this repository or download the files
2. Navigate to the project directory
3. Install dependencies:
```bash
npm install
```

## Running the Game

1. Start the server:
```bash
npm start
```

2. Open your web browser and navigate to:
```
http://localhost:3000
```

## How to Play

- Left-click to reveal a cell
- Right-click to place/remove a flag
- Numbers indicate how many mines are adjacent to that cell
- Avoid clicking on mines!
- Collaborate with other players to clear the board

## Game Rules

- The game board is 16x16 with 40 mines
- Multiple players can reveal cells and place flags simultaneously
- The game continues until all non-mine cells are revealed or a mine is hit
- Players can join ongoing games with up to 4 players per game

## Technologies Used

- PixiJS - 2D rendering engine
- Socket.IO - Real-time communication
- Express - Web server
- Node.js - Runtime environment 