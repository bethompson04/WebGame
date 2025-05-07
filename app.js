// script.js

/**
 * This function generates a random hexadecimal color code
 * Hexadecimal colors use the format #RRGGBB where each position
 * is a hexadecimal digit (0-9, A-F) representing color intensity
 * @returns {string} A random color in hexadecimal format (e.g., "#A3F012")
 */
function getRandomColor() {
    // Define all possible hexadecimal digits (0-9 and A-F)
    const letters = '0123456789ABCDEF';

    // Start with # symbol which indicates a hexadecimal color code
    let color = '#';

    // We need 6 digits for a complete hex color (2 each for R, G, and B values)
    for (let i = 0; i < 6; i++) {
        // Generate a random index between 0 and 15
        const randomIndex = Math.floor(Math.random() * 16);

        // Use that index to get a character from our letters string
        const hexDigit = letters[randomIndex];
        
        // Add this randomly selected hex digit to our color string
        color += hexDigit;
    }
    // Return the complete 7-character color code (e.g., "#A3F012")
    return color;
}

/**
 * Wait for the DOM to fully load before attaching event listeners
 */
document.addEventListener('DOMContentLoaded', function() {
    // Create and display an instructional message for users
    const message = document.createElement('h1');
    message.textContent = 'Click anywhere to change the background color!';
    message.style.textAlign = 'center';
    message.style.fontFamily = 'Arial, sans-serif';
    message.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
    message.style.padding = '20px';
    message.style.borderRadius = '10px';
    message.style.position = 'absolute';
    message.style.top = '50%';
    message.style.left = '50%';
    message.style.transform = 'translate(-50%, -50%)';
    message.style.pointerEvents = 'none'; // This makes the message "click-through"
    document.body.appendChild(message);

    // Change background color when the page is clicked
    // We attach this to document instead of document.body to ensure it captures all clicks
    document.addEventListener('click', function() {
        document.body.style.backgroundColor = getRandomColor();
    });
});