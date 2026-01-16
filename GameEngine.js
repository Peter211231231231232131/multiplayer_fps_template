const THREE = require('three');

class GameEngine {
    constructor() {
        this.players = {};
        this.gravity = 9.8;
        this.mass = 100.0;
        this.moveSpeed = 400.0;
        this.jumpForce = 350.0;
        this.damping = 10.0;

        // Internal physics state needs more than just position
        // We need velocity for each player
        this.physicsState = {};
    }

    addPlayer(id) {
        this.players[id] = {
            x: 0,
            y: 2, // Start slightly above ground (capsule height adjustment)
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
        // inputData: { forward, backward, left, right, jump, rotation }
        if (!this.physicsState[id]) return;

        // processing happens in update loop, just store latest inputs?
        // Actually, for smoothness, we process inputs in the loop based on "isButtonPressed"
        // So we need to store the *state* of the buttons.
        this.physicsState[id].inputs = inputData;

        // Update rotation immediately as it's direct control
        if (inputData.rotation !== undefined) {
            this.players[id].rotation = inputData.rotation;
        }
    }

    update(delta) {
        for (const id in this.players) {
            const player = this.players[id];
            const physics = this.physicsState[id];
            const inputs = physics.inputs || {}; // { forward: bool, ... }

            if (!physics.velocity) continue;

            const velocity = physics.velocity;

            // Damping (Drag)
            velocity.x -= velocity.x * this.damping * delta;
            velocity.z -= velocity.z * this.damping * delta;

            // Gravity
            velocity.y -= this.gravity * this.mass * delta;

            // Direction calculation
            physics.direction.z = Number(inputs.forward || 0) - Number(inputs.backward || 0);
            physics.direction.x = Number(inputs.right || 0) - Number(inputs.left || 0);
            physics.direction.normalize();

            // Movement force
            if (inputs.forward || inputs.backward) velocity.z -= physics.direction.z * this.moveSpeed * delta;
            if (inputs.left || inputs.right) velocity.x -= physics.direction.x * this.moveSpeed * delta;

            // Jump
            if (inputs.jump && physics.canJump) {
                velocity.y += this.jumpForce;
                physics.canJump = false;
            }

            // Apply Velocity
            player.x -= velocity.x * delta;
            player.z -= velocity.z * delta; // Forward is -z usually in ThreeJS, let's keep consistent with client
            player.y += velocity.y * delta;

            // Ground Collision (Simple floor at y=0, eye height at 1.6, capsule height ~2-4)
            // Original client said: if ( camera.position.y < 1.6 ) ...
            // That implied the camera `y` was the check. 
            // Here `player.y` is the position we send.
            // Let's assume `player.y` is the camera position for simplicity of sync
            // Ground is at y=1.6 (eye level standing on ground).
            if (player.y < 1.6) {
                velocity.y = 0;
                player.y = 1.6;
                physics.canJump = true;
            }
        }
    }

    getState() {
        return this.players;
    }
}

module.exports = GameEngine;
