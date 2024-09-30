const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let cloudsArray = [];
let fogOpacity = 0.4; // Initial fog opacity

// Cloud class to create and animate realistic clouds
class Cloud {
  constructor(x, y, size, speed) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.speed = speed;
  }

  update() {
    this.x += this.speed;
    if (this.x > canvas.width + this.size * 2) {
      this.x = -this.size * 2;
      this.y = Math.random() * canvas.height * 0.7;
    }
  }

  draw() {
    const gradient = ctx.createRadialGradient(this.x, this.y, this.size * 0.2, this.x, this.y, this.size);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.8)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
  }
}

// Create clouds
function init() {
  cloudsArray = [];
  for (let i = 0; i < 15; i++) {
    const size = Math.random() * 100 + 50;
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height * 0.7;
    const speed = Math.random() * 0.5 + 0.2;
    cloudsArray.push(new Cloud(x, y, size, speed));
  }
}

// Create fog effect
function createFog() {
  ctx.globalAlpha = fogOpacity;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 1.0; // Reset alpha
}

// Animate the clouds and fog
function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw the background (sky)
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, 'rgba(180, 210, 230, 1)');
  gradient.addColorStop(1, 'rgba(220, 240, 255, 1)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw clouds
  for (let i = 0; i < cloudsArray.length; i++) {
    cloudsArray[i].update();
    cloudsArray[i].draw();
  }

  // Draw fog effect on top
  createFog();

  requestAnimationFrame(animate);
}

// Handle window resize
window.addEventListener('resize', function() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  init();
});

// Initialize clouds and start animation
init();
animate();