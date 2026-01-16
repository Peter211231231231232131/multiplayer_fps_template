import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// --- Socket.io Setup ---
const socket = io();

// --- Three.js Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Sky blue
scene.fog = new THREE.Fog(0x87ceeb, 0, 750);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.y = 1.6; // Typical eye height

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// --- Lighting ---
const light = new THREE.HemisphereLight(0xeeeeff, 0x777788, 0.75);
light.position.set(0.5, 1, 0.75);
scene.add(light);

const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(50, 200, 100);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
scene.add(dirLight);

// --- Environment ---
const floorGeometry = new THREE.PlaneGeometry(2000, 2000, 100, 100);
const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x44aa44 }); // Grass green
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Add some random boxes for reference
const boxGeometry = new THREE.BoxGeometry(5, 5, 5);
const boxMaterial = new THREE.MeshLambertMaterial({ color: 0xffaa00 });

for (let i = 0; i < 20; i++) {
    const box = new THREE.Mesh(boxGeometry, boxMaterial);
    box.position.x = (Math.random() - 0.5) * 100;
    box.position.y = 2.5;
    box.position.z = (Math.random() - 0.5) * 100;
    box.castShadow = true;
    box.receiveShadow = true;
    scene.add(box);
}

// --- Player Controls ---
const controls = new PointerLockControls(camera, document.body);

const instructions = document.getElementById('instructions');

document.addEventListener('click', () => {
    controls.lock();
});

controls.addEventListener('lock', () => {
    instructions.style.display = 'none';
});

controls.addEventListener('unlock', () => {
    instructions.style.display = 'block';
});

// Movement variables
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

const onKeyDown = (event) => {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW': moveForward = true; break;
        case 'ArrowLeft':
        case 'KeyA': moveLeft = true; break;
        case 'ArrowDown':
        case 'KeyS': moveBackward = true; break;
        case 'ArrowRight':
        case 'KeyD': moveRight = true; break;
        case 'Space':
            if (canJump === true) velocity.y += 350;
            canJump = false;
            break;
    }
};

const onKeyUp = (event) => {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW': moveForward = false; break;
        case 'ArrowLeft':
        case 'KeyA': moveLeft = false; break;
        case 'ArrowDown':
        case 'KeyS': moveBackward = false; break;
        case 'ArrowRight':
        case 'KeyD': moveRight = false; break;
    }
};

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

// --- Multiplayer Logic ---
const otherPlayers = {};

function createPlayerMesh(color = 0xff0000) {
    // Simple player representation
    const geometry = new THREE.CapsuleGeometry(1, 4, 4, 8);
    const material = new THREE.MeshLambertMaterial({ color: color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

function updatePlayerPosition(id, info) {
    if (!otherPlayers[id]) {
        // Create new player
        const mesh = createPlayerMesh();
        mesh.position.set(info.x, info.y + 2, info.z); // Adjust Y for capsule center
        scene.add(mesh);
        otherPlayers[id] = mesh;
    } else {
        // Update existing player
        const mesh = otherPlayers[id];
        mesh.position.set(info.x, info.y + 2, info.z);
        mesh.rotation.y = info.rotation;
    }
}

socket.on('currentPlayers', (players) => {
    Object.keys(players).forEach((id) => {
        if (id !== socket.id) {
            updatePlayerPosition(id, players[id]);
        }
    });
});

socket.on('newPlayer', (data) => {
    if (data.playerId !== socket.id) {
        updatePlayerPosition(data.playerId, data.playerInfo);
    }
});

socket.on('playerMoved', (data) => {
    if (otherPlayers[data.playerId]) {
        updatePlayerPosition(data.playerId, data.playerInfo);
    }
});

socket.on('disconnect', (id) => {
    if (otherPlayers[id]) {
        scene.remove(otherPlayers[id]);
        delete otherPlayers[id];
    }
});

// --- Animation Loop ---
let prevTime = performance.now();

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();

    if (controls.isLocked === true) {
        const delta = (time - prevTime) / 1000;

        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 9.8 * 100.0 * delta; // 100.0 = mass

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize(); // this ensures consistent movements in all directions

        if (moveForward || moveBackward) velocity.z -= direction.z * 400.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta;

        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
        controls.getObject().position.y += (velocity.y * delta); // new behavior

        if (controls.getObject().position.y < 1.6) {
            velocity.y = 0;
            controls.getObject().position.y = 1.6;
            canJump = true;
        }

        // Send position to server
        // Limit updates to save bandwidth (e.g., every 15ms or simply every frame for local test)
        socket.emit('playerMovement', {
            x: controls.getObject().position.x,
            y: controls.getObject().position.y - 1.6, // Send foot position roughly
            z: controls.getObject().position.z,
            rotation: controls.getObject().rotation.y
        });
    }

    prevTime = time;

    renderer.render(scene, camera);
}

animate();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
