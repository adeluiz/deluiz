const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let width, height;
let particles = [];
const numParticles = 4000;
let alphaPoints = [];

let mouse = { x: -1000, y: -1000 };
let hoverState = 0; // 0 = black hole, 1 = alpha
let targetHoverState = 0;

const mouseRadius = 300;

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    initAlphaPoints();
}

window.addEventListener('resize', resize);
window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});
window.addEventListener('touchmove', (e) => {
    if(e.touches.length > 0) {
        mouse.x = e.touches[0].clientX;
        mouse.y = e.touches[0].clientY;
    }
});
window.addEventListener('mouseleave', () => {
    mouse.x = -1000;
    mouse.y = -1000;
});
window.addEventListener('touchend', () => {
    mouse.x = -1000;
    mouse.y = -1000;
});

function initAlphaPoints() {
    const offCanvas = document.createElement('canvas');
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
    
    // We want the alpha symbol to be roughly 60% of the screen height
    const size = Math.min(width, height) * 0.6;
    offCanvas.width = width;
    offCanvas.height = height;
    
    offCtx.fillStyle = 'white';
    offCtx.font = `bold ${size}px 'Times New Roman', serif`; // Times provides a nice greek alpha
    offCtx.textAlign = 'center';
    offCtx.textBaseline = 'middle';
    offCtx.fillText('α', width / 2, height / 2);
    
    const imageData = offCtx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    alphaPoints = [];
    for (let y = 0; y < height; y += 4) {
        for (let x = 0; x < width; x += 4) {
            const index = (y * width + x) * 4;
            // check alpha channel
            if (data[index + 3] > 128) {
                alphaPoints.push({ x, y });
            }
        }
    }
    
    // If we haven't created particles yet, do it now
    if (particles.length === 0 && alphaPoints.length > 0) {
        createParticles();
    } else if (alphaPoints.length > 0) {
        // Re-assign alpha points if resized
        particles.forEach((p, i) => {
            const ap = alphaPoints[i % alphaPoints.length];
            p.alphaX = ap.x + (Math.random() - 0.5) * 5;
            p.alphaY = ap.y + (Math.random() - 0.5) * 5;
        });
    }
}

class Particle {
    constructor(index) {
        this.index = index;
        
        // Alpha position
        const ap = alphaPoints[index % alphaPoints.length];
        this.alphaX = ap.x + (Math.random() - 0.5) * 5;
        this.alphaY = ap.y + (Math.random() - 0.5) * 5;
        
        // Black hole properties
        // Accretion disk: mostly concentrated near center but spread out
        const minRadius = 50;
        const maxRadius = Math.max(width, height) * 0.8;
        // Power distribution to concentrate near center
        const rDist = Math.pow(Math.random(), 2); 
        this.bhRadius = minRadius + rDist * maxRadius;
        
        this.bhAngle = Math.random() * Math.PI * 2;
        // Kepler-like velocity (faster near center)
        this.bhSpeed = (0.02 + Math.random() * 0.01) * (100 / (this.bhRadius + 10));
        
        // Add some 3D tilt effect variables
        this.tiltX = Math.random() * 20 - 10;
        this.tiltY = Math.random() * 20 - 10;
        
        // Current actual position
        this.x = width / 2;
        this.y = height / 2;
        
        // Colors - Orange instead of blue
        // Hot white/yellow near center, cooling to deep orange/red outward
        const colorRatio = 1 - rDist;
        const r = Math.floor(255);
        const g = Math.floor(100 + 155 * colorRatio);
        const b = Math.floor(200 * colorRatio); // Yellow near center, red outward
        
        // Update: Let's adjust b to make it warmer.
        // Pure orange is roughly (255, 165, 0).
        // Center: white/yellow -> r:255, g:255, b:200
        // Edge: dark red/orange -> r:255, g:50, b:0
        const new_g = Math.floor(50 + 205 * colorRatio);
        const new_b = Math.floor(200 * colorRatio);
        
        this.color = `rgb(${r}, ${new_g}, ${new_b})`;
        this.size = Math.random() * 1.5 + 0.5;
        
        // Custom velocity for gravity
        this.vx = 0;
        this.vy = 0;
    }
    
    update(hover) {
        // Update black hole physics
        this.bhAngle += this.bhSpeed;
        
        // Squeeze Y to make it look like an angled disk
        const squeeze = 0.4;
        
        // Calculate black hole position
        const bhTargetX = width / 2 + Math.cos(this.bhAngle) * this.bhRadius + this.tiltX;
        const bhTargetY = height / 2 + Math.sin(this.bhAngle) * this.bhRadius * squeeze + this.tiltY;
        
        // Apply a little noise to alpha target for a "living" effect
        const aliveAlphaX = this.alphaX + Math.sin(Date.now() * 0.002 + this.index) * 2;
        const aliveAlphaY = this.alphaY + Math.cos(Date.now() * 0.002 + this.index) * 2;
        
        // Lerp based on hover state
        let targetX = bhTargetX + (aliveAlphaX - bhTargetX) * hover;
        let targetY = bhTargetY + (aliveAlphaY - bhTargetY) * hover;
        
        // Mouse gravity attraction (slingshot effect)
        if (mouse.x !== -1000) {
            const dx = mouse.x - this.x;
            const dy = mouse.y - this.y;
            const distSq = dx * dx + dy * dy;
            const dist = Math.sqrt(distSq);
            
            // Interaction radius for mouse gravity
            const gravityRadius = 350;
            if (dist < gravityRadius) {
                // Gravity force is inversely proportional to distance squared
                // We add a softening parameter to avoid infinite acceleration at center
                const force = 3000 / (distSq + 2000); 
                this.vx += (dx / dist) * force;
                this.vy += (dy / dist) * force;
            }
        }
        
        // Spring force pulling particle back to its target position
        const springX = (targetX - this.x) * 0.08;
        const springY = (targetY - this.y) * 0.08;
        
        this.vx += springX;
        this.vy += springY;
        
        // Damping/friction to prevent infinite bouncing
        this.vx *= 0.90;
        this.vy *= 0.90;
        
        // Update actual position
        this.x += this.vx;
        this.y += this.vy;
    }
    
    draw(ctx, hover) {
        ctx.fillStyle = this.color;
        // Make particles slightly bigger and brighter when in alpha shape
        const currentSize = this.size * (1 + hover * 1.0);
        ctx.globalAlpha = 0.6 + hover * 0.4;
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentSize, 0, Math.PI * 2);
        ctx.fill();
    }
}

function createParticles() {
    particles = [];
    for (let i = 0; i < numParticles; i++) {
        particles.push(new Particle(i));
    }
}

function animate() {
    // Semi-transparent black to create trails for the black hole
    ctx.fillStyle = 'rgba(5, 5, 10, 0.2)';
    ctx.fillRect(0, 0, width, height);
    
    // Calculate distance from mouse to center of screen
    const dx = mouse.x - width / 2;
    const dy = mouse.y - height / 2;
    const distToCenter = Math.hypot(dx, dy);
    
    if (distToCenter < mouseRadius) {
        targetHoverState = 1;
    } else {
        targetHoverState = 0;
    }
    
    // Smooth transition for hoverState
    hoverState += (targetHoverState - hoverState) * 0.05;
    
    // Draw event horizon effect (dark center) when in black hole mode
    if (hoverState < 0.9) {
        const horizonRadius = 45 * (1 - hoverState);
        const gradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, horizonRadius * 2);
        gradient.addColorStop(0, 'rgba(0,0,0,1)');
        gradient.addColorStop(0.5, 'rgba(0,0,0,0.8)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(width/2, height/2, horizonRadius * 2, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Draw particles
    for (let i = 0; i < particles.length; i++) {
        particles[i].update(hoverState);
        particles[i].draw(ctx, hoverState);
    }
    
    requestAnimationFrame(animate);
}

// Initial setup
resize();
animate();
