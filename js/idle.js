/* js/idle.js */
const idleGif = document.querySelector('.idle-gif');

function triggerGlitch() {
  // Only flash if we are on the idle screen
  if (window.currentChannel === 'idle') {
    // Show the gif
    idleGif.style.opacity = "0.7";
    
    // Hide it again after 150ms-300ms
    setTimeout(() => {
      idleGif.style.opacity = "0";
    }, Math.random() * 150 + 150);
  }

  // Schedule the next flash (between 2 and 7 seconds)
  setTimeout(triggerGlitch, Math.random() * 5000 + 2000);
}

// Initial state
if (idleGif) {
  idleGif.style.opacity = "0";
  idleGif.style.transition = "opacity 0.05s";
  triggerGlitch();
}