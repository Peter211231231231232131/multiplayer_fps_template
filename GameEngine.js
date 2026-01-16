const THREE = require('three');

class GameEngine {
    constructor() {
        this.players = {};
        this.gravity = 9.8;
        this.mass = 100.0;
        this.moveSpeed = 400.0; // Increased speed for responsiveness
        this.jumpForce = 350.0;
        this.damping = 10.0;

        this.physicsState = {};

        // Define Obstacles (Map)
        this.obstacles = [];
        for (let i = 0; i < 20; i++) {
            this.obstacles.push({
                x: (Math.random() - 0.5) * 100,
                y: 2.5, // Center Y
                z: (Math.random() - 0.5) * 100,
                width: 5,
                height: 5,
                depth: 5
            });
        }
    }

    addPlayer(id) {
        this.players[id] = {
            x: 0,
            y: 2,
            z: 0,
            rotation: 0
        };

        this.physicsState[id] = {
            velocity: new THREE.Vector3(),
            direction: new THREE.Vector3(),
            canJump: false
        };
    }

    removePlayer(id) {
        delete this.players[id];
        delete this.physicsState[id];
    }

    handleInput(id, inputData) {
        if (!this.physicsState[id]) return;
        this.physicsState[id].inputs = inputData;
        if (inputData.rotation !== undefined) {
            this.players[id].rotation = inputData.rotation;
        }
    }

    checkCollision(player, newX, newZ) {
        // Simple AABB vs Point/Radius (Approximate player as a 1x1 box for now)
        const playerSize = 1;

        for (const obs of this.obstacles) {
            // Check overlap
            const minX = obs.x - obs.width / 2;
            const maxX = obs.x + obs.width / 2;
            const minZ = obs.z - obs.depth / 2;
            const maxZ = obs.z + obs.depth / 2;

            if (newX + playerSize > minX && newX - playerSize < maxX &&
                newZ + playerSize > minZ && newZ - playerSize < maxZ) {
                return true; // Collision detected
            }
        }
        return false;
    }

    update(delta) {
        for (const id in this.players) {
            const player = this.players[id];
            const physics = this.physicsState[id];
            const inputs = physics.inputs || {};

            if (!physics.velocity) continue;

            const velocity = physics.velocity;

            // Damping
            velocity.x -= velocity.x * this.damping * delta;
            velocity.z -= velocity.z * this.damping * delta;
            velocity.y -= this.gravity * this.mass * delta;

            // Direction calculation (Relative to Camera Rotation)
            // Forward/Back uses Z, Left/Right uses X
            physics.direction.z = Number(inputs.forward || 0) - Number(inputs.backward || 0);
            physics.direction.x = Number(inputs.right || 0) - Number(inputs.left || 0);
            physics.direction.normalize();

            // Rotate direction vector by player rotation (Y-axis)
            if (physics.direction.lengthSq() > 0) {
                physics.direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), player.rotation);
            }

            // Movement force
            if (inputs.forward || inputs.backward || inputs.left || inputs.right) {
                velocity.x -= physics.direction.x * this.moveSpeed * delta;
                velocity.z -= physics.direction.z * this.moveSpeed * delta;
            }

            // Jump
            if (inputs.jump && physics.canJump) {
                velocity.y += this.jumpForce;
                physics.canJump = false;
            }

            // Apply Velocity with Collision
            const oldX = player.x;
            const oldZ = player.z;

            // Try X movement
            player.x -= velocity.x * delta;
            if (this.checkCollision(player, player.x, oldZ)) {
                player.x = oldX; // Revert X
                velocity.x = 0;
            }

            // Try Z movement
            player.z -= velocity.z * delta;
            if (this.checkCollision(player, player.x, player.z)) {
                player.z = oldZ; // Revert Z
                velocity.z = 0;
            }

            player.y += velocity.y * delta;

            // Ground Collision
            if (player.y < 1.6) {
                velocity.y = 0;
                player.y = 1.6;
                physics.canJump = true;
            }
        }
    }

    getMap() {
        return this.obstacles;
    }

    getState() {
        return this.players;
    }
}

module.exports = GameEngine;
