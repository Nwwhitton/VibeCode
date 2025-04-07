const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('scoreDisplay');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let score = 0;
let gameObjects = [];
let slingshot = { x: canvas.width / 2, y: canvas.height - 100 };
let projectile = null;
let isDragging = false;
let isLaunched = false;
let startX, startY;
let projectileLifetime = 3500; // 7 seconds lifetime
let resetDelay = 2225; // 4.5 seconds before reset
let resetTimer = null;
let powerups = [];
let currentPowerups = []; // Array to hold stacked powerups
let maxPowerups = 4; // Maximum number of powerups that can be stacked
let powerupChance = .1; // 10% chance to spawn a powerup
let clouds = []; // Array to hold cloud objects

// Cloud class
class Cloud {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * (canvas.height * 0.3); // Only in top 30% of the screen
        this.width = Math.random() * 150 + 100;
        this.height = Math.random() * 60 + 30;
        this.speed = Math.random() * 0.3 + 0.1;
        this.opacity = Math.random() * 0.4 + 0.6; // Random opacity between 0.6 and 1.0
        this.segments = Math.floor(Math.random() * 3) + 3; // 3-5 segments for cloud variations
    }

    update() {
        this.x += this.speed;
        if (this.x > canvas.width + this.width) {
            this.x = -this.width;
            this.y = Math.random() * (canvas.height * 0.3);
        }
    }

    draw() {
        const segmentWidth = this.width / this.segments;
        ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
        
        // Draw cloud as multiple overlapping circles with varying sizes
        for (let i = 0; i < this.segments; i++) {
            const centerX = this.x + i * segmentWidth;
            const variation = Math.sin(i / this.segments * Math.PI) * 0.5 + 0.5; // Height variation
            const radius = (this.height/2) * (0.7 + variation * 0.6);
            
            ctx.beginPath();
            ctx.arc(centerX, this.y + Math.random() * 5, radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// Initialize clouds
function initClouds() {
    const numClouds = Math.floor(canvas.width / 250) + 4; // More clouds
    for (let i = 0; i < numClouds; i++) {
        clouds.push(new Cloud());
    }
}

// Projectile class
class Projectile {
    constructor(x, y, powerupTypes = [], angle = 0) {
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.color = 'red';
        this.velocityX = 0;
        this.velocityY = 0;
        this.gravity = 0.2;
        this.friction = 0.99;
        this.powerupTypes = Array.isArray(powerupTypes) ? [...powerupTypes] : [powerupTypes];
        this.angle = angle; // For triple shot
        this.createdAt = Date.now();
    }

    update() {
        // Apply extra angle for triple shot if needed
        if (this.hasPowerup("triple") && this.velocityX === 0 && this.velocityY === 0) {
            // Only apply on launch
            return false;
        }

        this.velocityY += this.gravity;
        this.x += this.velocityX;
        this.y += this.velocityY;
        
        this.velocityX *= this.friction;
        
        // Bounce off walls
        if (this.x + this.radius > canvas.width) {
            this.x = canvas.width - this.radius;
            this.velocityX *= -0.7;
        } else if (this.x - this.radius < 0) {
            this.x = this.radius;
            this.velocityX *= -0.7;
        }
        
        // Bounce off ground
        if (this.y + this.radius > canvas.height) {
            this.y = canvas.height - this.radius;
            this.velocityY *= -0.7;
        }
        
        // Check if projectile lifetime is over
        if (Date.now() - this.createdAt > projectileLifetime) {
            return true; // Signal to remove this projectile
        }
        
        return false;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        
        // Determine color based on powerups
        const explosiveCount = this.countPowerup("explosive");
        const tripleCount = this.countPowerup("triple");
        
        if (explosiveCount === 0 && tripleCount === 0) {
            ctx.fillStyle = 'red';
        } else if (explosiveCount >= 1 && tripleCount >= 1) {
            ctx.fillStyle = 'magenta'; // Combination color
        } else if (explosiveCount >= 1) {
            ctx.fillStyle = 'purple';
        } else if (tripleCount >= 1) {
            ctx.fillStyle = 'orange';
        }
        
        ctx.fill();
        ctx.closePath();
        
        // If we have multiple powerups, draw a small indicator
        if (this.powerupTypes.length > 0) {
            ctx.font = '10px Arial';
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.fillText(this.powerupTypes.length.toString(), this.x, this.y + 3);
        }
    }
    
    launch(dx, dy) {
        this.velocityX = dx * 0.4;
        this.velocityY = dy * 0.4;
        
        // Apply angle for triple shot
        if (this.angle !== 0) {
            const speed = Math.sqrt(this.velocityX * this.velocityX + this.velocityY * this.velocityY);
            const baseAngle = Math.atan2(this.velocityY, this.velocityX);
            const newAngle = baseAngle + this.angle;
            
            this.velocityX = Math.cos(newAngle) * speed;
            this.velocityY = Math.sin(newAngle) * speed;
        }
        projectileLifetime = 3500;
        resetDelay = 2225;
    }
    
    explode() {
        // Only if it has explosive powerup
        const explosiveCount = this.countPowerup("explosive");
        if (explosiveCount > 0) {
            // Base explosion radius that increases with more explosive powerups
            let explosionRadius = 100;
            
            // Increase explosion radius based on number of explosive powerups
            if (explosiveCount === 2) {
                explosionRadius = 150;
            } else if (explosiveCount === 3) {
                explosionRadius = 200;
            } else if (explosiveCount >= 4) {
                explosionRadius = 300; // Nuke mode
                
                // Draw larger explosion effect for nuke
                ctx.beginPath();
                ctx.arc(this.x, this.y, explosionRadius, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 50, 50, 0.7)';
                ctx.fill();
                ctx.closePath();
                
                // Nuclear mushroom cloud effect
                ctx.beginPath();
                ctx.arc(this.x, this.y - 100, 80, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 120, 50, 0.8)';
                ctx.fill();
                ctx.closePath();
                
                ctx.beginPath();
                ctx.moveTo(this.x - 80, this.y);
                ctx.lineTo(this.x + 80, this.y);
                ctx.lineTo(this.x + 40, this.y - 150);
                ctx.lineTo(this.x - 40, this.y - 150);
                ctx.fillStyle = 'rgba(255, 170, 50, 0.7)';
                ctx.fill();
                ctx.closePath();
                
                // Return a special value for nuke to clear all powerups
                return -explosionRadius;
            }
            
            // Regular explosion effect
            ctx.beginPath();
            ctx.arc(this.x, this.y, explosionRadius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 100, 0, 0.5)';
            ctx.fill();
            ctx.closePath();
            
            return explosionRadius;
        }
        return 0;
    }
    
    hasPowerup(type) {
        return this.powerupTypes.includes(type);
    }
    
    countPowerup(type) {
        return this.powerupTypes.filter(p => p === type).length;
    }
}

// Falling object class
class FallingObject {
    constructor() {
        this.radius = Math.random() * 20 + 20;
        this.x = Math.random() * (canvas.width - this.radius * 2) + this.radius;
        this.y = -this.radius * 2;
        this.velocityY = Math.random() * 2 + 1;
        this.color = getRandomColor();
        this.points = Math.floor(100 / this.radius);
        this.hit = false;
    }

    update() {
        this.y += this.velocityY;
        
        // Remove if it goes off screen
        if (this.y - this.radius > canvas.height) {
            const index = gameObjects.indexOf(this);
            if (index > -1) {
                gameObjects.splice(index, 1);
            }
        }
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }

    checkCollision(projectile) {
        if (this.hit) return false;
        
        const dx = this.x - projectile.x;
        const dy = this.y - projectile.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < this.radius + projectile.radius) {
            this.hit = true;
            
            // Explosive projectile destroys nearby objects too
            const explosionRadius = projectile.explode();
            
            if (explosionRadius > 0) {
                // Normal explosion
                gameObjects.forEach(obj => {
                    if (!obj.hit) {
                        const explosionDx = obj.x - projectile.x;
                        const explosionDy = obj.y - projectile.y;
                        const explosionDistance = Math.sqrt(explosionDx * explosionDx + explosionDy * explosionDy);
                        
                        if (explosionDistance < explosionRadius + obj.radius) {
                            obj.hit = true;
                            score += obj.points;
                        }
                    }
                });
            } else if (explosionRadius < 0) {
                // Nuke - destroy everything
                gameObjects.forEach(obj => {
                    if (!obj.hit) {
                        obj.hit = true;
                        score += obj.points;
                    }
                });
                
                // Clear all powerups after a nuke
                currentPowerups = [];
            }
            
            return true;
        }
        return false;
    }
}

// Powerup class
class Powerup {
    constructor() {
        this.radius = 15;
        this.x = Math.random() * (canvas.width - this.radius * 2) + this.radius;
        this.y = -this.radius * 2;
        this.velocityY = 1.5;
        this.type = getRandomPowerup();
        this.hit = false;
    }
    
    update() {
        this.y += this.velocityY;
        
        // Remove if it goes off screen
        if (this.y - this.radius > canvas.height) {
            const index = powerups.indexOf(this);
            if (index > -1) {
                powerups.splice(index, 1);
            }
        }
    }
    
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        
        // Different colors for different powerups
        if (this.type === "triple") {
            ctx.fillStyle = 'orange';
        } else if (this.type === "explosive") {
            ctx.fillStyle = 'purple';
        }
        
        ctx.fill();
        ctx.closePath();
        
        // Draw star shape
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
            const x = this.x + Math.cos(angle) * (this.radius - 5);
            const y = this.y + Math.sin(angle) * (this.radius - 5);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.closePath();
    }
    
    checkCollision(projectile) {
        if (this.hit) return false;
        
        const dx = this.x - projectile.x;
        const dy = this.y - projectile.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < this.radius + projectile.radius) {
            this.hit = true;
            
            // Add to current powerups if limit not reached
            if (currentPowerups.length < maxPowerups) {
                currentPowerups.push(this.type);
            } else {
                // Replace the oldest powerup if at limit
                currentPowerups.shift();
                currentPowerups.push(this.type);
            }
            
            return true;
        }
        return false;
    }
}

// Get random color
function getRandomColor() {
    const colors = ['#4CAF50', '#FFC107', '#2196F3', '#9C27B0', '#F44336'];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Get random powerup
function getRandomPowerup() {
    const powerups = ["triple", "explosive"];
    return powerups[Math.floor(Math.random() * powerups.length)];
}

// Count occurrences of a powerup type
function countPowerupType(type) {
    return currentPowerups.filter(p => p === type).length;
}

// Draw slingshot
function drawSlingshot() {
    ctx.fillStyle = 'brown';
    ctx.fillRect(slingshot.x - 5, slingshot.y, 10, 80);
    
    // Draw powerup indicator
    ctx.font = '16px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    
    // Show all active powerups with counts
    if (currentPowerups.length === 0) {
        ctx.fillText("Powerup: normal", slingshot.x, slingshot.y + 100);
    } else {
        // Count each type of powerup
        const explosiveCount = countPowerupType("explosive");
        const tripleCount = countPowerupType("triple");
        
        let powerupText = [];
        if (explosiveCount > 0) {
            powerupText.push(`explosive x${explosiveCount}`);
        }
        if (tripleCount > 0) {
            powerupText.push(`triple x${tripleCount}`);
        }
        
        ctx.fillText("Powerups: " + powerupText.join(", ") + 
                     " (" + currentPowerups.length + "/" + maxPowerups + ")", 
                     slingshot.x, slingshot.y + 100);
    }
    
    if (!isLaunched && projectile) {
        ctx.beginPath();
        ctx.moveTo(slingshot.x, slingshot.y);
        ctx.lineTo(projectile.x, projectile.y);
        ctx.strokeStyle = '#8D6E63';
        ctx.lineWidth = 5;
        ctx.stroke();
    }
}

// Initialize the game
function init() {
    projectile = new Projectile(slingshot.x, slingshot.y - 30, currentPowerups);
    
    // Initialize clouds
    initClouds();
    
    canvas.addEventListener('mousedown', (e) => {
        if (isLaunched) return;
        
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const dx = mouseX - projectile.x;
        const dy = mouseY - projectile.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < projectile.radius) {
            isDragging = true;
            startX = mouseX;
            startY = mouseY;
        }
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (!isDragging || isLaunched) return;
        
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        projectile.x = mouseX;
        projectile.y = mouseY;
        
        // Limit drag distance
        const dx = projectile.x - slingshot.x;
        const dy = projectile.y - slingshot.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 100) {
            const angle = Math.atan2(dy, dx);
            projectile.x = slingshot.x + Math.cos(angle) * 100;
            projectile.y = slingshot.y + Math.sin(angle) * 100;
        }
    });
    
    canvas.addEventListener('mouseup', (e) => {
        if (!isDragging || isLaunched) return;
        
        isDragging = false;
        isLaunched = true;
        
        const dx = slingshot.x - projectile.x;
        const dy = slingshot.y - projectile.y;
        
        projectile.launch(dx, dy);
        
        // Handle triple shot powerup stacking
        const tripleCount = countPowerupType("triple");
        
        if (tripleCount > 0) {
            let additionalShots = 0;
            
            // Calculate number of additional shots based on triple shot count
            if (tripleCount === 1) additionalShots = 2;        // 3 total
            else if (tripleCount === 2) additionalShots = 4;   // 5 total
            else if (tripleCount === 3) additionalShots = 6;   // 7 total
            else if (tripleCount >= 4) additionalShots = 8;    // 9 total
            
            // Create additional projectiles at different angles
            for (let i = 0; i < additionalShots; i++) {
                // Calculate evenly distributed angles
                let angle = 0;
                if (additionalShots === 2) {
                    angle = (i === 0) ? Math.PI/12 : -Math.PI/12;
                } else if (additionalShots === 4) {
                    angle = (i - 2) * Math.PI/12; // -2/12π, -1/12π, 1/12π, 2/12π
                } else if (additionalShots === 6) {
                    angle = (i - 3) * Math.PI/15; // evenly distributed between -π/5 and π/5
                } else if (additionalShots === 8) {
                    angle = (i - 4) * Math.PI/15; // evenly distributed between -4π/15 and 4π/15
                }
                
                const additionalProjectile = new Projectile(projectile.x, projectile.y, projectile.powerupTypes, angle);
                additionalProjectile.launch(dx, dy);
                projectiles.push(additionalProjectile);
            }
        }
        
        // Start timer for resetting the projectile
        clearTimeout(resetTimer);
        resetTimer = setTimeout(() => {
            resetProjectile();
        }, resetDelay);
    });
    
    // Add new falling objects periodically
    setInterval(() => {
        if (gameObjects.length < 10) {
            gameObjects.push(new FallingObject());
        }
        
        // Add powerup with a chance
        if (Math.random() < powerupChance && powerups.length < 2) {
            powerups.push(new Powerup());
        }
    }, 1000);
    
    gameLoop();
}

// Reset projectile
function resetProjectile() {
    isLaunched = false;
    projectiles = [];
    projectile = new Projectile(slingshot.x, slingshot.y - 30, currentPowerups);
}

// Array to hold multiple projectiles
let projectiles = [];

// Main game loop
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw sky
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Update and draw clouds
    clouds.forEach(cloud => {
        cloud.update();
        cloud.draw();
    });
    
    // Draw ground
    ctx.fillStyle = '#2E7D32';
    ctx.fillRect(0, canvas.height - 20, canvas.width, 20);
    
    // Draw slingshot
    drawSlingshot();
    
    // Update and draw main projectile
    if (projectile) {
        if (isLaunched) {
            if (projectile.update()) {
                // If update returns true, the projectile should be removed due to lifetime
                resetProjectile();
            }
        }
        projectile.draw();
    }
    
    // Update and draw additional projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        if (projectiles[i].update()) {
            projectiles.splice(i, 1);
        } else {
            projectiles[i].draw();
        }
    }
    
    // Remove hit objects
    for (let i = gameObjects.length - 1; i >= 0; i--) {
        if (gameObjects[i].hit) {
            gameObjects.splice(i, 1);
        }
    }
    
    // Update and draw falling objects
    gameObjects.forEach((obj) => {
        obj.update();
        obj.draw();
        
        // Check collision with main projectile
        if (projectile && isLaunched && obj.checkCollision(projectile)) {
            score += obj.points;
            scoreDisplay.textContent = `Score: ${score}`;
        }
        
        // Check collision with additional projectiles
        projectiles.forEach((proj) => {
            if (obj.checkCollision(proj)) {
                score += obj.points;
                scoreDisplay.textContent = `Score: ${score}`;
            }
        });
    });
    
    // Update and draw powerups
    for (let i = powerups.length - 1; i >= 0; i--) {
        if (!powerups[i]) continue; // Skip if undefined (safety check)
        
        powerups[i].update();
        powerups[i].draw();
        
        // Check collision with main projectile
        if (projectile && isLaunched && powerups[i] && powerups[i].checkCollision(projectile)) {
            powerups.splice(i, 1);
            continue;
        }
        
        // Check collision with additional projectiles
        let collided = false;
        for (let j = 0; j < projectiles.length; j++) {
            if (i < powerups.length && powerups[i] && projectiles[j] && powerups[i].checkCollision(projectiles[j])) {
                powerups.splice(i, 1);
                collided = true;
                break;
            }
        }
        if (collided) continue;
    }
    
    requestAnimationFrame(gameLoop);
}

// Handle window resize
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    slingshot.x = canvas.width / 2;
    slingshot.y = canvas.height - 100;
    
    if (!isLaunched && projectile) {
        projectile.x = slingshot.x;
        projectile.y = slingshot.y - 30;
    }
    
    // Reinitialize clouds for the new canvas size
    clouds = [];
    initClouds();
});

init();