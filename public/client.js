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


// --- Input Handling ---
const inputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false
};

const onKeyDown = (event) => {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW': inputState.forward = true; break;
        case 'ArrowLeft':
        case 'KeyA': inputState.left = true; break;
        case 'ArrowDown':
        case 'KeyS': inputState.backward = true; break;
        case 'ArrowRight':
        case 'KeyD': inputState.right = true; break;
        case 'Space': inputState.jump = true; break;
    }
};

const onKeyUp = (event) => {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW': inputState.forward = false; break;
        case 'ArrowLeft':
        case 'KeyA': inputState.left = false; break;
        case 'ArrowDown':
        case 'KeyS': inputState.backward = false; break;
        case 'ArrowRight':
        case 'KeyD': inputState.right = false; break;
        case 'Space': inputState.jump = false; break;
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
    if (id === socket.id) {
        // Update MY camera
        // Server sends player feet position (roughly), camera eyes are higher
        // Our server code assumes player.y matches client, but let's check.
        // GameEngine: y starts at 2.
        // Client previously: camera y=1.6. y sent was camera.y - 1.6 (so 0).
        // If server says y=2, that's feet center? or capsule center?
        // Capsule height 4. Center is 2 units up from bottom. So feet at y=0.
        // Camera eye level is usually +1.6 from feet.
        // So if server.y is capsule center (2), feet are at 0. Camera should be at 1.6.
        // Wait, logic in GameEngine: y starts at 2. Ground collision checks y < 1.6.
        // That implies y IS the representation of "camera/eye" ish?
        // Let's stick to: gameEngine.y IS the camera Y.
        camera.position.x = info.x;
        camera.position.y = info.y;
        camera.position.z = info.z;
    } else {
        if (!otherPlayers[id]) {
            const mesh = createPlayerMesh();
            scene.add(mesh);
            otherPlayers[id] = mesh;
        }
        const mesh = otherPlayers[id];
        // If info.y is Camera Y (1.6), and Mesh is Capsule (height 4, center 2 units from bottom),
        // we want feet at 0.
        // Mesh center needs to be at y=2.
        // So if info.y = 1.6 (meaning feet at 0), we want mesh at 2.
        // Offset = +0.4?
        // Let's just trust visual for now.
        mesh.position.set(info.x, info.y, info.z);
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

socket.on('gameState', (players) => {
    Object.keys(players).forEach((id) => {
        updatePlayerPosition(id, players[id]);
    });
});

socket.on('disconnect', (id) => {
    if (otherPlayers[id]) {
        scene.remove(otherPlayers[id]);
        delete otherPlayers[id];
    }
});

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);

    if (controls.isLocked === true) {
        // Send inputs to server
        socket.emit('playerInput', {
            ...inputState,
            rotation: camera.rotation.y
        });
    }

    renderer.render(scene, camera);
}

animate();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
