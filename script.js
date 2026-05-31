import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

// ---- GLOBAL VARIABLES ----
let scene, camera, renderer, particles;
let particleCount = 20000;
let positions, targetPositions, velocities, originalTargetPositions;
let isWater = true; 
let currentShape = 'sphere'; 
let loadedModelGeometry = null;
const clock = new THREE.Clock();

// Scroll tracking
let currentScroll = 0;
let targetScroll = 0;
let lastScrollPercent = 0;
let baseX = 0;
let baseY = 0;

// Drag rotation
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let targetRotationX = 0;
let targetRotationY = 0;
let currentRotationX = 0;
let currentRotationY = 0;
let dragSpeed = 0;

// UI Physics
let currentUIX = 0;
let currentUIY = 0;
let currentUIScale = 1;
let currentUIRotX = 0;
let currentUIRotY = 0;

// Solid Mesh Representation & Print Animation Plane
let solidMesh = null;
let printY = null;
const localPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), -26); // Start fully clipping
let arrowStep = 'upload'; // 'upload', 'material', 'color'

// Target Position Arrays for Continuous Scroll Interpolation
let sphereTargets = new Float32Array(particleCount * 3);
let uploadTargets = new Float32Array(particleCount * 3);
let productTargets = new Float32Array(particleCount * 3);
let footerTargets = new Float32Array(particleCount * 3);
let nozzleTargets = new Float32Array(particleCount * 3);
let designTargets = new Float32Array(particleCount * 3);
let modelTargets = null; // Generated only on STL load

// Branching Navigation State
let activePath = 'main'; // 'main', 'upload', 'products', 'design'

// Image sequence preloading variables
const frameCount = 240;
const images = [];
let loadedImagesCount = 0;
let introCanvas = null;
let introCtx = null;
let lastDrawnImg = null;

function preloadImages() {
    const loaderScreen = document.createElement('div');
    loaderScreen.id = 'loader-screen';
    loaderScreen.innerHTML = `
        <div class="loader-content">
            <div class="loader-logo">3D CREATOR AI</div>
            <div class="loader-spinner"></div>
            <div class="loader-text">Yüksek Kaliteli Kareler Yükleniyor: <span id="loader-percent">0</span>%</div>
        </div>
    `;
    document.body.appendChild(loaderScreen);

    for (let i = 1; i <= frameCount; i++) {
        const img = new Image();
        const paddedIndex = String(i).padStart(3, '0');
        img.src = `images/kare_${paddedIndex}.jpg`;
        img.onload = () => {
            loadedImagesCount++;
            const percent = Math.floor((loadedImagesCount / frameCount) * 100);
            const percentEl = document.getElementById('loader-percent');
            if (percentEl) percentEl.innerText = percent;

            if (loadedImagesCount === frameCount) {
                // Fade loader screen out smoothly
                gsap.to(loaderScreen, { 
                    opacity: 0, 
                    duration: 1.0, 
                    onComplete: () => loaderScreen.remove() 
                });
            }
        };
        img.onerror = () => {
            // Fallback for missing frames so loading completes
            loadedImagesCount++;
            if (loadedImagesCount === frameCount && loaderScreen) {
                loaderScreen.remove();
            }
        };
        images.push(img);
    }
}

function resizeIntroCanvas() {
    if (!introCanvas) return;
    introCanvas.width = window.innerWidth;
    introCanvas.height = window.innerHeight;
}

function drawFrame(img) {
    if (!introCtx || !img || !img.complete) return;
    if (lastDrawnImg === img) return; // Performance optimization!
    lastDrawnImg = img;
    
    const canvasWidth = introCanvas.width;
    const canvasHeight = introCanvas.height;
    
    // cover scaling
    const imgRatio = img.width / img.height;
    const canvasRatio = canvasWidth / canvasHeight;
    
    let drawWidth, drawHeight, drawX, drawY;
    
    if (imgRatio > canvasRatio) {
        drawHeight = canvasHeight;
        drawWidth = canvasHeight * imgRatio;
        drawX = (canvasWidth - drawWidth) / 2;
        drawY = 0;
    } else {
        drawWidth = canvasWidth;
        drawHeight = canvasWidth / imgRatio;
        drawX = 0;
        drawY = (canvasHeight - drawHeight) / 2;
    }
    
    introCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    introCtx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
}

// ---- INITIALIZATION ----
function init() {
    // 1. Scene Setup
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050505, 0.005);
    
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 80;

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.localClippingEnabled = true; // Enable local clipping planes for printing!
    container.appendChild(renderer.domElement);

    // 1.2 Setup Intro Canvas
    introCanvas = document.getElementById('intro-canvas');
    introCtx = introCanvas.getContext('2d');
    resizeIntroCanvas();
    window.addEventListener('resize', resizeIntroCanvas);

    // Preload Zip Frames
    preloadImages();

    // 1.5 Add Studio Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x00ffff, 0.9);
    dirLight1.position.set(200, 200, 100);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xff00ff, 0.65);
    dirLight2.position.set(-200, 100, -100);
    scene.add(dirLight2);

    const pointLight = new THREE.PointLight(0xffffff, 0.8, 200);
    pointLight.position.set(150, 50, 50);
    scene.add(pointLight);

    // 2. Particle Setup
    createParticles();

    // 3. Events
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('mousemove', onMouseMove);
    
    // Window scroll listener
    window.addEventListener('scroll', () => {
        targetScroll = window.scrollY;
    });

    // Setup interactive drag events on the canvas
    setupDragInteraction();

    setupUI();
    setupDropZone();

    // Generate design shape once at startup
    formDesignShape();

    // 4. Start Loop
    animate();
}

function createParticles() {
    const geometry = new THREE.BufferGeometry();
    positions = new Float32Array(particleCount * 3);
    targetPositions = new Float32Array(particleCount * 3);
    originalTargetPositions = new Float32Array(particleCount * 3);
    velocities = new Float32Array(particleCount * 3);

    const arrowCount = Math.floor(particleCount * 0.3);

    for (let i = 0; i < particleCount; i++) {
        // Initial random spread in space
        const x = (Math.random() - 0.5) * 200;
        const y = (Math.random() - 0.5) * 200;
        const z = (Math.random() - 0.5) * 200;

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        // 1. Generate Nozzle Shape Targets (Tightly clustered at 0, 15, 0)
        nozzleTargets[i * 3] = (Math.random() - 0.5) * 2;
        nozzleTargets[i * 3 + 1] = 15 + (Math.random() - 0.5) * 2;
        nozzleTargets[i * 3 + 2] = (Math.random() - 0.5) * 2;

        // 2. Generate Sphere Shape Targets (Centered at 0, 0, 0)
        const r = 30 * Math.cbrt(Math.random());
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(2 * Math.random() - 1);
        
        sphereTargets[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        sphereTargets[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        sphereTargets[i * 3 + 2] = r * Math.cos(phi);

        // 3. Generate Upload Scene Targets (Right: x = 150)
        // 30% arrow pointing down, 70% pooling inside the box
        if (i < arrowCount) {
            const rand = Math.random();
            let ax, ay, az;
            az = (Math.random() - 0.5) * 8;

            if (rand < 0.6) {
                // Arrow shaft
                ax = 150 + (Math.random() - 0.5) * 6;
                ay = 15 + (Math.random() - 0.5) * 20;
            } else {
                // Arrow head
                ay = -5 - Math.random() * 12;
                const width = (ay + 17) * 1.5;
                ax = 150 + (Math.random() - 0.5) * width;
            }
            uploadTargets[i * 3] = ax;
            uploadTargets[i * 3 + 1] = ay;
            uploadTargets[i * 3 + 2] = az;
        } else {
            // Water pooling inside the box (x=150, bottom)
            uploadTargets[i * 3] = 150 + (Math.random() - 0.5) * 45;
            uploadTargets[i * 3 + 1] = -27 + Math.random() * 10;
            uploadTargets[i * 3 + 2] = (Math.random() - 0.5) * 22;
        }

        // 4. Generate Product Scene Targets (Left: x = -150)
        // Swirling galaxy/ambient flow around the products
        const pR = 40 + Math.random() * 20;
        const pTheta = Math.random() * 2 * Math.PI;
        productTargets[i * 3] = -150 + pR * Math.cos(pTheta);
        productTargets[i * 3 + 1] = (Math.random() - 0.5) * 80;
        productTargets[i * 3 + 2] = pR * Math.sin(pTheta) + (Math.random() - 0.5) * 20;

        // 5. Generate Footer Scene Targets (Down: y = -150)
        // Ambient particles floating around the footer text
        footerTargets[i * 3] = (Math.random() - 0.5) * 150;
        footerTargets[i * 3 + 1] = -150 + (Math.random() - 0.5) * 50;
        footerTargets[i * 3 + 2] = (Math.random() - 0.5) * 50;

        // Initialize targetPositions to nozzle targets at start
        targetPositions[i * 3] = nozzleTargets[i * 3];
        targetPositions[i * 3 + 1] = nozzleTargets[i * 3 + 1];
        targetPositions[i * 3 + 2] = nozzleTargets[i * 3 + 2];

        originalTargetPositions[i * 3] = targetPositions[i * 3];
        originalTargetPositions[i * 3 + 1] = targetPositions[i * 3 + 1];
        originalTargetPositions[i * 3 + 2] = targetPositions[i * 3 + 2];
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // Create texture canvas
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(16, 16, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
        color: 0x00ffff,
        size: 0.8,
        transparent: true,
        opacity: 0, // Start invisible, fade in on scroll Zone 2!
        map: texture,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);
}

function setupDragInteraction() {
    window.addEventListener('mousedown', (e) => {
        // If clicking on an interactive UI element, do not drag
        const isInteractive = e.target.closest('button, select, input, .content-box, .controls, #drop-zone, .premium-toast');
        if (isInteractive) return;

        isDragging = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;
        
        dragSpeed = Math.min(Math.sqrt(deltaX*deltaX + deltaY*deltaY), 50);

        targetRotationY += deltaX * 0.005;
        targetRotationX += deltaY * 0.005;

        // Clamp vertical rotation so it doesn't flip completely upside down
        targetRotationX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, targetRotationX));

        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // Mobile touch controls
    window.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            const isInteractive = e.target.closest('button, select, input, .content-box, .controls, #drop-zone, .premium-toast');
            if (isInteractive) return;

            isDragging = true;
            previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    });

    window.addEventListener('touchmove', (e) => {
        if (!isDragging || e.touches.length !== 1) return;

        const deltaX = e.touches[0].clientX - previousMousePosition.x;
        const deltaY = e.touches[0].clientY - previousMousePosition.y;
        
        dragSpeed = Math.min(Math.sqrt(deltaX*deltaX + deltaY*deltaY), 50);

        targetRotationY += deltaX * 0.005;
        targetRotationX += deltaY * 0.005;
        targetRotationX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, targetRotationX));

        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    });

    window.addEventListener('touchend', () => {
        isDragging = false;
    });
}

function formSphereShape() {
    currentShape = 'sphere';
    for (let i = 0; i < particleCount; i++) {
        const r = 30 * Math.cbrt(Math.random());
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(2 * Math.random() - 1);
        
        targetPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        targetPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        targetPositions[i * 3 + 2] = r * Math.cos(phi);

        originalTargetPositions[i*3] = targetPositions[i*3];
        originalTargetPositions[i*3+1] = targetPositions[i*3+1];
        originalTargetPositions[i*3+2] = targetPositions[i*3+2];
    }
}

function formDesignShape() {
    // A structured cube for the design request
    for (let i = 0; i < particleCount; i++) {
        // Random point on the surface of a cube
        let x, y, z;
        const face = Math.floor(Math.random() * 6);
        const r1 = (Math.random() - 0.5) * 40;
        const r2 = (Math.random() - 0.5) * 40;
        
        // Add some noise to make it holographic
        const noise = (Math.random() - 0.5) * 2;

        if (face === 0) { x = 20; y = r1; z = r2; }
        else if (face === 1) { x = -20; y = r1; z = r2; }
        else if (face === 2) { y = 20; x = r1; z = r2; }
        else if (face === 3) { y = -20; x = r1; z = r2; }
        else if (face === 4) { z = 20; x = r1; y = r2; }
        else { z = -20; x = r1; y = r2; }

        // Shift it up because we set baseY = subScroll * 150
        // Wait, if baseY goes positive, camera moves up, so we see objects that are UP
        designTargets[i * 3] = x + noise;
        designTargets[i * 3 + 1] = y + 150 + noise; // Match baseY = 150
        designTargets[i * 3 + 2] = z + noise;
    }
}

// ---- UI & LOGIC ----
function setupUI() {
    const btnUpload = document.getElementById('btn-upload');
    const btnProducts = document.getElementById('btn-products');
    const btnDesign = document.getElementById('btn-design');

    // "Kendi Modelini Al" -> activePath = 'upload', scroll to bottom
    btnUpload.addEventListener('click', () => {
        activePath = 'upload';
        window.scrollTo({
            top: 2 * window.innerHeight,
            behavior: 'smooth'
        });
    });

    // "Ürünler" button -> activePath = 'products', scroll to bottom
    btnProducts.addEventListener('click', () => {
        activePath = 'products';
        window.scrollTo({
            top: 2 * window.innerHeight,
            behavior: 'smooth'
        });
    });

    // "Tasarım Baskı" button -> activePath = 'design', scroll to bottom
    if (btnDesign) {
        btnDesign.addEventListener('click', () => {
            activePath = 'design';
            window.scrollTo({
                top: 2 * window.innerHeight,
                behavior: 'smooth'
            });
        });
    }

    // Reset path to main if user scrolls back up to the main menu area
    window.addEventListener('scroll', () => {
        if (window.scrollY <= window.innerHeight * 1.1) {
            activePath = 'main';
        }
    });

    // Color buttons
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const colorHex = e.target.getAttribute('data-color');
            
            // Animate particles color
            gsap.to(particles.material.color, {
                r: new THREE.Color(colorHex).r,
                g: new THREE.Color(colorHex).g,
                b: new THREE.Color(colorHex).b,
                duration: 1
            });

            // Animate solid mesh color
            if (solidMesh) {
                gsap.to(solidMesh.material.color, {
                    r: new THREE.Color(colorHex).r,
                    g: new THREE.Color(colorHex).g,
                    b: new THREE.Color(colorHex).b,
                    duration: 1
                });
            }

            // Update UI glow colors
            document.getElementById('price-display').style.color = colorHex;
            document.getElementById('price-display').style.textShadow = `0 0 20px ${colorHex}`;
            
            const dropText = document.getElementById('drop-text');
            if (dropText) {
                dropText.style.textShadow = `0 0 30px ${colorHex}`;
            }
        });
    });

    // Filament selection
    document.getElementById('filament-select').addEventListener('change', (e) => {
        if (e.target.value === 'solid') {
            isWater = false; // Hardening state

            if (solidMesh) {
                solidMesh.visible = true;
                solidMesh.material.opacity = 1;
                localPlane.constant = -26; // Start clipping from the bottom
                printY = -26;

                // Animate layer-by-layer printing!
                gsap.killTweensOf(localPlane);
                gsap.to(localPlane, {
                    constant: 26,
                    duration: 3.5,
                    ease: "power1.inOut",
                    onUpdate: () => {
                        printY = localPlane.constant;
                    },
                    onComplete: () => {
                        printY = null; // Printing complete!
                        // Fade particles down so solid mesh shines
                        gsap.to(particles.material, { opacity: 0.08, size: 0.25, duration: 0.8 });
                    }
                });
            }

            // Guide user to Step 3: Color selection
            if (loadedModelGeometry) {
                morphToModel(loadedModelGeometry, 'color');
            }
        } else {
            isWater = true; // Fluid state
            printY = null;

            if (solidMesh) {
                gsap.killTweensOf(localPlane);
                gsap.to(solidMesh.material, { 
                    opacity: 0, 
                    duration: 0.8, 
                    onComplete: () => { solidMesh.visible = false; } 
                });
            }

            // Restore particles visibility & size
            gsap.to(particles.material, { opacity: 0.6, size: 0.8, duration: 0.8 });

            // Guide user back to Step 2: Material selection
            if (loadedModelGeometry) {
                morphToModel(loadedModelGeometry, 'material');
            }
        }
    });
}

// Premium glassmorphic toast helper
function showToast(message) {
    // Remove existing toast if any
    const existing = document.querySelector('.premium-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'premium-toast';
    toast.innerText = message;
    document.body.appendChild(toast);

    // Trigger animations
    setTimeout(() => toast.classList.add('visible'), 50);
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

// ---- SHAPE MORPHING ----
// ---- SHAPE MORPHING ----
function formArrowShape(step = 'upload') {
    currentShape = 'arrow';
    arrowStep = step;

    // Dedicate 30% of particles to the arrow, 70% to the water pool
    const arrowCount = Math.floor(particleCount * 0.3);

    for (let i = 0; i < particleCount; i++) {
        if (i < arrowCount) {
            // Generate arrow particles
            let x, y, z;
            z = (Math.random() - 0.5) * 8;
            const rand = Math.random();

            if (step === 'upload') {
                // Arrow pointing down at the upload box (centered at x=150, y=-20)
                if (rand < 0.6) {
                    // Arrow shaft (vertical)
                    x = 150 + (Math.random() - 0.5) * 6;
                    y = 15 + (Math.random() - 0.5) * 20;
                } else {
                    // Arrow head (pointing down)
                    y = -5 - Math.random() * 12;
                    const width = (y + 17) * 1.5; // point at -17, wider at -5
                    x = 150 + (Math.random() - 0.5) * width;
                }
            } else if (step === 'material') {
                // Arrow pointing down-right towards the Filament selector (bottom right)
                if (rand < 0.6) {
                    const t = Math.random();
                    x = 155 + t * 20 + (Math.random() - 0.5) * 4;
                    y = 3 - t * 22 + (Math.random() - 0.5) * 4;
                } else {
                    const t = Math.random();
                    x = 175 + t * 8 + (Math.random() - 0.5) * 6;
                    y = -18 - t * 10 + (Math.random() - 0.5) * 6;
                }
            } else if (step === 'color') {
                // Arrow pointing down-left towards the Color picker (bottom left)
                if (rand < 0.6) {
                    const t = Math.random();
                    x = 145 - t * 20 + (Math.random() - 0.5) * 4;
                    y = 3 - t * 22 + (Math.random() - 0.5) * 4;
                } else {
                    const t = Math.random();
                    x = 125 - t * 8 + (Math.random() - 0.5) * 6;
                    y = -18 - t * 10 + (Math.random() - 0.5) * 6;
                }
            }

            targetPositions[i * 3] = x;
            targetPositions[i * 3 + 1] = y;
            targetPositions[i * 3 + 2] = z;
        } else {
            // Remaining 70% of particles form a flowing water pool inside the drop zone box
            const poolX = 150 + (Math.random() - 0.5) * 45;
            const poolY = -27 + Math.random() * 10; // Pool at the very bottom of the upload zone
            const poolZ = (Math.random() - 0.5) * 22;

            targetPositions[i * 3] = poolX;
            targetPositions[i * 3 + 1] = poolY;
            targetPositions[i * 3 + 2] = poolZ;
        }

        originalTargetPositions[i*3] = targetPositions[i*3];
        originalTargetPositions[i*3+1] = targetPositions[i*3+1];
        originalTargetPositions[i*3+2] = targetPositions[i*3+2];
    }
}

function morphToModel(geometry, step = 'material') {
    loadedModelGeometry = geometry;
    currentShape = 'model';
    arrowStep = step;

    const posAttribute = geometry.getAttribute('position');
    const vCount = posAttribute.count;

    // Normalize and scale model
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 50 / maxDim; // Fit within 50 units

    // Scale and center the geometry perfectly in-place!
    geometry.scale(scale, scale, scale);
    geometry.center();

    // Re-fetch the perfectly scaled and centered positions
    const newPosAttribute = geometry.getAttribute('position');

    // Create or update the solid mesh representation
    if (!solidMesh) {
        const meshMat = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            roughness: 0.25,
            metalness: 0.1,
            transparent: true,
            opacity: 0, // Start invisible, fade in on print animation
            clippingPlanes: [localPlane],
            clipShadows: true,
            side: THREE.DoubleSide
        });
        
        solidMesh = new THREE.Mesh(geometry, meshMat);
        solidMesh.position.set(150, 0, 0); // Position at the Right upload scene center (X = 150)
        scene.add(solidMesh);
    } else {
        solidMesh.geometry.dispose();
        solidMesh.geometry = geometry;
        solidMesh.position.set(150, 0, 0);
    }

    // Allocate 25% of particles to the guide arrow, 75% to the 3D model volume
    const arrowCount = Math.floor(particleCount * 0.25);

    // Initialize modelTargets array if not done
    if (!modelTargets) {
        modelTargets = new Float32Array(particleCount * 3);
    }

    for (let i = 0; i < particleCount; i++) {
        if (i < arrowCount) {
            // Arrow particles pointing to the target controls step
            let x, y, z;
            z = (Math.random() - 0.5) * 8;
            const rand = Math.random();

            if (step === 'material') {
                // Arrow pointing down-right towards the Filament Selector
                if (rand < 0.6) {
                    const t = Math.random();
                    x = 155 + t * 20 + (Math.random() - 0.5) * 4;
                    y = 5 - t * 22 + (Math.random() - 0.5) * 4;
                } else {
                    const t = Math.random();
                    x = 175 + t * 8 + (Math.random() - 0.5) * 6;
                    y = -18 - t * 10 + (Math.random() - 0.5) * 6;
                }
            } else if (step === 'color') {
                // Arrow pointing down-left towards the Color Picker
                if (rand < 0.6) {
                    const t = Math.random();
                    x = 145 - t * 20 + (Math.random() - 0.5) * 4;
                    y = 5 - t * 22 + (Math.random() - 0.5) * 4;
                } else {
                    const t = Math.random();
                    x = 125 - t * 8 + (Math.random() - 0.5) * 6;
                    y = -18 - t * 10 + (Math.random() - 0.5) * 6;
                }
            }

            modelTargets[i * 3] = x;
            modelTargets[i * 3 + 1] = y;
            modelTargets[i * 3 + 2] = z;
        } else {
            // Model volume particles
            const vIndex = Math.floor(Math.random() * vCount);
            const noise = (Math.random() - 0.5) * 1.2;
            
            const x = newPosAttribute.getX(vIndex) + 150 + noise; // Center is at X = 150
            const y = newPosAttribute.getY(vIndex) + noise; 
            const z = newPosAttribute.getZ(vIndex) + noise;

            modelTargets[i * 3] = x;
            modelTargets[i * 3 + 1] = y;
            modelTargets[i * 3 + 2] = z;
        }
    }

    // Hide upload visual indicators, reveal configurations
    const dropText = document.getElementById('drop-text');
    if (dropText) gsap.to(dropText, { opacity: 0, duration: 0.5 });
    
    document.getElementById('controls').classList.remove('hidden');
    document.getElementById('price-display').classList.remove('hidden');
    
    // Animate pricing numbers
    const priceEl = document.getElementById('price-value');
    if (priceEl.innerText === '0') {
        let currentPrice = 0;
        const targetPrice = Math.floor(Math.random() * 500 + 100);
        
        const interval = setInterval(() => {
            currentPrice += 11;
            if(currentPrice >= targetPrice) {
                currentPrice = targetPrice;
                clearInterval(interval);
            }
            priceEl.innerText = currentPrice;
        }, 30);
    }
}

// ---- DRAG AND DROP ----
function setupDropZone() {
    const dropZone = document.getElementById('scene-upload');
    const dropVisual = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    dropVisual.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    function handleFile(file) {
        if (file.name.toLowerCase().endsWith('.stl')) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const loader = new STLLoader();
                const geometry = loader.parse(event.target.result);
                morphToModel(geometry);
            };
            reader.readAsArrayBuffer(file);
        } else {
            alert('Lütfen bir .stl dosyası yükleyin.');
        }
    }

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropVisual.style.border = '2px dashed rgba(0, 255, 255, 0.5)';
        dropVisual.style.background = 'rgba(0, 255, 255, 0.05)';
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropVisual.style.border = '2px dashed transparent';
        dropVisual.style.background = 'transparent';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropVisual.style.border = '2px dashed transparent';
        dropVisual.style.background = 'transparent';
        
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });
}

// ---- MOUSE INTERACTION ----
let mouseX = 0;
let mouseY = 0;
let targetCameraX = 0;
let targetCameraY = 0;

function onMouseMove(event) {
    // Normalized mouse coordinates (-1 to +1)
    mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ---- ANIMATION LOOP ----
// ---- ANIMATION LOOP ----
const lerp = (start, end, amt) => start + (end - start) * amt;

function animate() {
    requestAnimationFrame(animate);

    const time = clock.getElapsedTime();
    const positionsAttr = particles.geometry.attributes.position;
    const posArray = positionsAttr.array;

    const h = window.innerHeight;
    
    // Smooth scroll interpolation (Lerp) with physics inertia
    currentScroll += (targetScroll - currentScroll) * 0.08;
    const maxScroll = 2 * h; // scrollHeight is 300vh, so scrollable range is 200vh (2 viewports)
    const clampedScroll = Math.max(0, Math.min(maxScroll, currentScroll));

    const sceneMain = document.getElementById('scene-main');
    const sceneUpload = document.getElementById('scene-upload');
    const dropText = document.getElementById('drop-text');

    let baseY = 0;

    // THREE SCROLLING PHASES (ZONES)
    if (clampedScroll < h) {
        // ---- ZONE 1: Play image sequence (0 to 1 viewport scroll) ----
        const scrollPercent = Math.max(0, Math.min(1, clampedScroll / h));
        
        // Canvas is fully visible
        if (introCanvas) introCanvas.style.opacity = 1;

        // Render target sequence frame
        const frameIdx = Math.floor(scrollPercent * 239);
        drawFrame(images[frameIdx]);

        // Hide landing page particles and UI layers completely
        particles.material.opacity = 0;
        if (sceneMain) sceneMain.style.opacity = 0;
        if (sceneUpload) sceneUpload.style.opacity = 0;
        if (sceneMain) sceneMain.classList.remove('active');
        if (sceneUpload) sceneUpload.classList.remove('active');

        // Lock particles at nozzle tip in case of quick scrolling
        for (let i = 0; i < particleCount; i++) {
            originalTargetPositions[i * 3] = nozzleTargets[i * 3];
            originalTargetPositions[i * 3 + 1] = nozzleTargets[i * 3 + 1];
            originalTargetPositions[i * 3 + 2] = nozzleTargets[i * 3 + 2];
        }

        camera.position.y = 0;
        baseY = 0;

    } else if (clampedScroll >= h && clampedScroll < 1.4 * h) {
        // ---- ZONE 2: Particles emerge from nozzle to sphere (1 to 1.4 scroll) ----
        const subScroll = Math.max(0, Math.min(1, (clampedScroll - h) / (0.4 * h)));

        // Lock sequence canvas at the final frame and fade it out
        if (introCanvas) {
            introCanvas.style.opacity = Math.max(0, 1 - subScroll * 1.5);
            drawFrame(images[239]);
        }

        // Fade in landing page particles and main UI scene
        particles.material.opacity = subScroll * 0.6;
        if (sceneMain) {
            sceneMain.style.opacity = subScroll;
            sceneMain.classList.add('active');
        }
        if (sceneUpload) { sceneUpload.style.opacity = 0; sceneUpload.classList.remove('active'); }
        if (sceneProducts) { sceneProducts.style.opacity = 0; sceneProducts.classList.remove('active'); }
        if (sceneFooter) { sceneFooter.style.opacity = 0; sceneFooter.classList.remove('active'); }

        // Continuous mathematical interpolation: nozzle -> sphere shape!
        currentShape = 'sphere';
        for (let i = 0; i < particleCount; i++) {
            originalTargetPositions[i * 3] = lerp(nozzleTargets[i * 3], sphereTargets[i * 3], subScroll);
            originalTargetPositions[i * 3 + 1] = lerp(nozzleTargets[i * 3 + 1], sphereTargets[i * 3 + 1], subScroll);
            originalTargetPositions[i * 3 + 2] = lerp(nozzleTargets[i * 3 + 2], sphereTargets[i * 3 + 2], subScroll);
        }

        camera.position.x = 0;
        camera.position.y = 0;
        baseX = 0;
        baseY = 0;

    } else {
        // ---- ZONE 3: Transition to workspace / upload (1.4 to 2.0 scroll) ----
        const subScroll = Math.max(0, Math.min(1, (clampedScroll - 1.4 * h) / (0.6 * h)));

        if (introCanvas) introCanvas.style.opacity = 0;

        // Keep particles fully visible
        particles.material.opacity = isWater ? 0.6 : 0.08;

        // Determine correct end targets and camera translation based on selected path
        let endTargets;
        
        const sceneProducts = document.getElementById('scene-products');
        const sceneFooter = document.getElementById('scene-footer');

        if (activePath === 'upload') {
            endTargets = modelTargets ? modelTargets : uploadTargets;
            baseX = subScroll * 150;
            baseY = 0;
            currentShape = modelTargets ? 'model' : 'arrow';
        } else if (activePath === 'products') {
            endTargets = productTargets;
            baseX = -subScroll * 150;
            baseY = 0;
            currentShape = 'gallery';
        } else if (activePath === 'design') {
            endTargets = designTargets;
            baseX = 0;
            baseY = subScroll * 150; // Pan camera up (so UI appears to scroll down)
            currentShape = 'design';
        } else { // 'main' default scroll downward
            endTargets = footerTargets;
            baseX = 0;
            baseY = -subScroll * 150;
            currentShape = 'ambient';
        }

        // Continuous mathematical interpolation: sphere -> active path shape!
        for (let i = 0; i < particleCount; i++) {
            originalTargetPositions[i * 3] = lerp(sphereTargets[i * 3], endTargets[i * 3], subScroll);
            originalTargetPositions[i * 3 + 1] = lerp(sphereTargets[i * 3 + 1], endTargets[i * 3 + 1], subScroll);
            originalTargetPositions[i * 3 + 2] = lerp(sphereTargets[i * 3 + 2], endTargets[i * 3 + 2], subScroll);
        }

        // UI Management
        if (sceneMain) {
            sceneMain.style.opacity = Math.max(0, 1 - subScroll * 2.5);
            if (subScroll > 0.4) sceneMain.classList.remove('active');
            else sceneMain.classList.add('active');
        }

        // Hide all inactive path scenes
        if (sceneUpload) { sceneUpload.style.opacity = 0; sceneUpload.classList.remove('active'); }
        if (sceneProducts) { sceneProducts.style.opacity = 0; sceneProducts.classList.remove('active'); }
        if (sceneFooter) { sceneFooter.style.opacity = 0; sceneFooter.classList.remove('active'); }
        const sceneDesign = document.getElementById('scene-design');
        if (sceneDesign) { sceneDesign.style.opacity = 0; sceneDesign.classList.remove('active'); }

        // Fade in active scene
        const targetScene = activePath === 'upload' ? sceneUpload : (activePath === 'products' ? sceneProducts : (activePath === 'design' ? sceneDesign : sceneFooter));
        if (targetScene) {
            targetScene.style.opacity = Math.max(0, (subScroll - 0.3) * 1.5);
            if (subScroll > 0.9) targetScene.classList.add('active');
        }

        if (activePath === 'upload' && currentShape !== 'model' && dropText) {
            dropText.style.opacity = Math.max(0, (subScroll - 0.3) * 1.5);
        }
    }

    lastScrollPercent = clampedScroll / maxScroll;

    // Camera Translation based on Scroll & Mouse Parallax
    if (!isDragging) {
        targetCameraX = baseX + mouseX * 15;
        targetCameraY = baseY + mouseY * 15;
    } else {
        targetCameraX = baseX;
        targetCameraY = baseY;
    }

    camera.position.x += (targetCameraX - camera.position.x) * 0.05;
    camera.position.y += (targetCameraY - camera.position.y) * 0.05;
    
    // Focus camera on the current virtual viewport center
    camera.lookAt(baseX, baseY, 0);

    // Apply fluid noise & 3D holographic printing head effects
    for (let i = 0; i < particleCount; i++) {
        let ix = i * 3;
        let iy = i * 3 + 1;
        let iz = i * 3 + 2;

        if (isWater) {
            // Apply sine waves based on time and original position
            const noiseX = Math.sin(time * 1.2 + originalTargetPositions[iy] * 0.1) * 2.5;
            const noiseY = Math.cos(time * 1.5 + originalTargetPositions[ix] * 0.1) * 2.5;
            const noiseZ = Math.sin(time * 1.8 + originalTargetPositions[iz] * 0.1) * 2.5;
            
            targetPositions[ix] = originalTargetPositions[ix] + noiseX;
            targetPositions[iy] = originalTargetPositions[iy] + noiseY;
            targetPositions[iz] = originalTargetPositions[iz] + noiseZ;
        } else if (printY !== null) {
            // 3D holographic printing effect!
            if (originalTargetPositions[iy] > printY) {
                targetPositions[ix] = originalTargetPositions[ix] + (Math.random() - 0.5) * 5.0; // horizontal spark noise
                targetPositions[iy] = printY;
                targetPositions[iz] = originalTargetPositions[iz] + (Math.random() - 0.5) * 5.0;
            } else {
                targetPositions[ix] = originalTargetPositions[ix];
                targetPositions[iy] = originalTargetPositions[iy];
                targetPositions[iz] = originalTargetPositions[iz];
            }
        } else {
            // Hardening complete
            targetPositions[ix] = originalTargetPositions[ix];
            targetPositions[iy] = originalTargetPositions[iy];
            targetPositions[iz] = originalTargetPositions[iz];
        }

        // Interpolate current position to target position (Spring/Easing)
        const ease = isWater ? 0.03 : 0.15; // Water moves smoothly, solid snaps firmly
        posArray[ix] += (targetPositions[ix] - posArray[ix]) * ease;
        posArray[iy] += (targetPositions[iy] - posArray[iy]) * ease;
        posArray[iz] += (targetPositions[iz] - posArray[iz]) * ease;
    }

    positionsAttr.needsUpdate = true;

    // Interactive Drag Rotation with Inertia & Auto-Rotation
    if (!isDragging) {
        if (isWater && currentShape === 'model') {
            targetRotationY += 0.003;
        } else if (currentShape === 'sphere') {
            targetRotationY += 0.002;
            targetRotationX += 0.001;
        } else if (currentShape === 'arrow') {
            targetRotationY = Math.sin(time * 0.5) * 0.08;
            targetRotationX = 0;
        }
    }

    // Apply rotation with a smooth interpolation (Lerp) for physics-like inertia
    currentRotationX += (targetRotationX - currentRotationX) * 0.08;
    currentRotationY += (targetRotationY - currentRotationY) * 0.08;

    // Calculate shake based on drag speed
    dragSpeed *= 0.9; // Friction
    let shakeX = 0;
    let shakeY = 0;
    if (isDragging && dragSpeed > 0.5) {
        shakeX = Math.sin(time * 60) * dragSpeed * 0.002;
        shakeY = Math.cos(time * 60) * dragSpeed * 0.002;
    }

    particles.rotation.x = currentRotationX + shakeX;
    particles.rotation.y = currentRotationY + shakeY;

    if (solidMesh) {
        solidMesh.rotation.x = currentRotationX + shakeX;
        solidMesh.rotation.y = currentRotationY + shakeY;
    }
    
    // UI Parallax: Move main scene content inversely to mouse position
    const sceneMainContent = document.querySelector('#scene-main .content-box');
    if (sceneMainContent) {
        let targetUIX = -mouseX * 30;
        let targetUIY = -mouseY * 30;
        let targetUIScale = 1;
        let targetUIRotX = mouseY * 5;
        let targetUIRotY = -mouseX * 5;

        if (isDragging) {
            // "Biraz geri düşmesini istiyorum" -> scale down / fall back
            targetUIScale = 0.8;
            
            // "Ekranın dağına dayanmış gibi olsun" -> push strongly towards the edges
            targetUIX = -mouseX * 250; 
            targetUIY = -mouseY * 250;
        }

        // Spring physics interpolation
        currentUIX += (targetUIX - currentUIX) * 0.1;
        currentUIY += (targetUIY - currentUIY) * 0.1;
        currentUIScale += (targetUIScale - currentUIScale) * 0.1;

        sceneMainContent.style.transform = `translate(${currentUIX}px, ${currentUIY}px) scale(${currentUIScale})`;
    }

    renderer.render(scene, camera);
}

// Boot
init();
