// game.js - A simple Phaser game

// Game configuration
const config = {
    type: Phaser.AUTO,  // Automatically choose WebGL or Canvas
    width: 800,         // Game width in pixels
    height: 600,        // Game height in pixels
    backgroundColor: '#3498db',  // Background color (light blue)
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 300 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

// Initialize the game
const game = new Phaser.Game(config);

// Load assets
function preload() {
    // Load images
    this.load.image('sky', 'https://labs.phaser.io/assets/skies/space3.png');
    this.load.image('logo', 'https://labs.phaser.io/assets/sprites/phaser3-logo.png');
    this.load.image('red', 'https://labs.phaser.io/assets/particles/red.png');
}

// Set up the game
function create() {
    // Add background
    this.add.image(400, 300, 'sky');

    // Add particles
    const particles = this.add.particles(0, 0, 'red', {
        speed: 100,
        scale: { start: 1, end: 0 },
        blendMode: 'ADD'
    });

    // Add logo
    const logo = this.physics.add.image(400, 100, 'logo');

    // Make the logo bounce
    logo.setVelocity(100, 200);
    logo.setBounce(1, 1);
    logo.setCollideWorldBounds(true);

    // Make particles follow the logo
    particles.startFollow(logo);
}

// Game loop
function update() {
    // This function is called 60 times per second
    // Add any game logic that needs to run continuously
}