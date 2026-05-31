// ==========================================================================
// MR SPATIAL OS - CORE ENGINE & TWO-HANDED PINCH ZOOM
// ==========================================================================

const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');

// Gerenciamento de Workspaces
const workspaces = ['home', 'files', 'search'];
let currentWorkspaceIndex = 0;
let currentWorkspace = "home";

// Estado de Navegação / Swipe por Movimento
let lastHandX = null;
const swipeThreshold = 0.18;
let swipeCooldown = false;

// Estado do Clique Virtual (Mão Direita/Principal)
let lastClickTime = 0;
const doubleClickDelay = 350;
let isPinchedRight = false;

// Estado do Zoom com Duas Mãos
let isZoomingMode = false;
let initialPinchDistance = 0;
let initialScale = 1.0;
let globalZoomScale = 1.0; // Fator de zoom mestre aplicado aos elementos da UI

function initOS() {
    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;
    window.addEventListener('resize', () => {
        canvasElement.width = window.innerWidth;
        canvasElement.height = window.innerHeight;
    });
    loadWorkspace("home");
}

/**
 * Retorna a distância Euclidiana 3D entre dois pontos do MediaPipe
 */
function getDistance3D(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z);
}

/**
 * Callback principal processado a cada quadro capturado pela câmera
 */
function onResults(results) {
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    let leftHandLandmarks = null;
    let rightHandLandmarks = null;

    // Identificar e separar a Mão Esquerda e a Mão Direita no frame
    if (results.multiHandLandmarks && results.multiHandedness) {
        results.multiHandLandmarks.forEach((landmarks, index) => {
            const label = results.multiHandedness[index].label; // "Left" ou "Right"
            
            // Desenhar o esqueleto virtual holográfico na tela
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: 'rgba(0, 191, 255, 0.25)', lineWidth: 1.5});
            drawLandmarks(canvasCtx, landmarks, {color: '#00BFFF', lineWidth: 0.5, radius: 1.5});

            if (label === 'Left') leftHandLandmarks = landmarks;
            if (label === 'Right') rightHandLandmarks = landmarks;
        });
    }

    // --- LOGICA 1: ZOOM COM AS DUAS MÃOS (TWO-HANDED PINCH) ---
    if (leftHandLandmarks && rightHandLandmarks) {
        // Verificar se AMBAS as mãos estão fazendo pinça (indicador tocando o dedão)
        const leftPinchDist = getDistance3D(leftHandLandmarks[4], leftHandLandmarks[8]);
        const rightPinchDist = getDistance3D(rightHandLandmarks[4], rightHandLandmarks[8]);
        
        const leftIsPinching = leftPinchDist < 0.052;
        const rightIsPinching = rightPinchDist < 0.052;

        if (leftIsPinching && rightIsPinching) {
            // Centro das pinças de cada mão para medir a distância entre elas
            const leftCenter = leftHandLandmarks[8];
            const rightCenter = rightHandLandmarks[8];
            const currentHandDistance = Math.hypot(leftCenter.x - rightCenter.x, leftCenter.y - rightCenter.y);

            if (!isZoomingMode) {
                // Ativar modo de zoom e capturar estado inicial para cálculo de delta
                isZoomingMode = true;
                initialPinchDistance = currentHandDistance;
                initialScale = globalZoomScale;
                showOSToast("ZOOM ATIVO");
            } else {
                // Calcula a mudança proporcional baseada na distância das suas mãos
                const zoomFactor = currentHandDistance / initialPinchDistance;
                globalZoomScale = Math.min(2.0, Math.max(0.5, initialScale * zoomFactor));
                
                // Aplica a escala tridimensional ao viewport central em tempo real
                applyGlobalZoomUI(globalZoomScale);
            }
            return; // Bloqueia outras interações durante o controle de zoom
        }
    }
    
    // Resetar o modo de zoom assim que soltar uma das mãos
    if (isZoomingMode) {
        isZoomingMode = false;
        showOSToast(`ZOOM FIXADO: ${Math.round(globalZoomScale * 100)}%`);
    }

    // --- LOGICA 2: INTERAÇÃO MONOMANUAL (MÃO DIREITA PRINCIPAL) ---
    if (rightHandLandmarks) {
        const thumbTip = rightHandLandmarks[4];
        const indexTip = rightHandLandmarks[8];
        const wrist = rightHandLandmarks[0];

        // Gesto de Swipe Lateral (Mover o pulso para navegar nos Workspaces)
        handleWorkspaceSwipe(wrist.x);

        // Mapear posição do cursor na tela baseada no seu indicador
        const cursorX = window.innerWidth * (1 - indexTip.x);
        const cursorY = window.innerHeight * indexTip.y;
        updateVirtualCursor(cursorX, cursorY);

        // Deteção de Clique Simples/Duplo por Pinça Direita
        const rightPinchDist = getDistance3D(thumbTip, indexTip);
        if (rightPinchDist < 0.052) {
            if (!isPinchedRight) {
                isPinchedRight = true;
                handleVirtualClick(cursorX, cursorY);
            }
        } else {
            isPinchedRight = false;
        }
    } else {
        lastHandX = null;
        removeVirtualCursor();
    }
}

/**
 * Controla a mudança de workspace movendo a mão lateralmente
 */
function handleWorkspaceSwipe(currentX) {
    if (swipeCooldown) return;
    if (lastHandX !== null) {
        const deltaX = currentX - lastHandX;
        if (deltaX > swipeThreshold) { // Swipe Direita -> Workspace Anterior
            navigateWorkspace(-1);
            triggerSwipeCooldown();
        } else if (deltaX < -swipeThreshold) { // Swipe Esquerda -> Próximo Workspace
            navigateWorkspace(1);
            triggerSwipeCooldown();
        }
    }
    lastHandX = currentX;
}

function triggerSwipeCooldown() {
    swipeCooldown = true;
    lastHandX = null;
    setTimeout(() => { swipeCooldown = false; }, 1000);
}

function navigateWorkspace(direction) {
    currentWorkspaceIndex = (currentWorkspaceIndex + direction + workspaces.length) % workspaces.length;
    loadWorkspace(workspaces[currentWorkspaceIndex]);
}

/**
 * Aplica a transformação de escala 3D ao container principal do OS
 */
function applyGlobalZoomUI(scale) {
    const viewport = document.getElementById('workspace-viewport');
    if (viewport) {
        viewport.style.transform = `scale(${scale}) translateZ(${(scale - 1) * 50}px)`;
    }
    // Opcional: Atualizar barras de status de zoom visuais se existirem
    const zoomBar = document.getElementById('media-zoom-bar');
    if (zoomBar) {
        zoomBar.style.width = `${((scale - 0.5) / 1.5) * 100}%`;
    }
}

/**
 * Gerenciador de Duplo Clique Virtual por colisão geométrica
 */
function handleVirtualClick(x, y) {
    const currentTime = Date.now();
    const timeDiff = currentTime - lastClickTime;
    const elementAtCursor = document.elementFromPoint(x, y);
    
    if (!elementAtCursor) return;

    if (timeDiff < doubleClickDelay && timeDiff > 0) {
        const clickable = elementAtCursor.closest('.glass-card, .dock-btn-round, .shortcut-item, button');
        if (clickable) {
            clickable.style.transform = 'scale(0.92) translateZ(-15px)';
            setTimeout(() => { clickable.style.transform = ''; }, 130);
            clickable.click(); // Dispara o evento de clique do elemento HTML
        }
        lastClickTime = 0;
    } else {
        lastClickTime = currentTime;
        const clickable = elementAtCursor.closest('.glass-card, .dock-btn-round, .shortcut-item');
        if (clickable) {
            document.querySelectorAll('.hud-hover').forEach(el => el.classList.remove('hud-hover'));
            clickable.classList.add('hud-hover');
        }
    }
}

function updateVirtualCursor(x, y) {
    let pointer = document.getElementById('spatial-pointer');
    if (!pointer) {
        pointer = document.createElement('div');
        pointer.id = 'spatial-pointer';
        document.body.appendChild(pointer);
    }
    pointer.style.left = `${x}px`;
    pointer.style.top = `${y}px`;
    if (isPinchedRight) pointer.classList.add('clicking');
    else pointer.classList.remove('clicking');
}

function removeVirtualCursor() {
    const pointer = document.getElementById('spatial-pointer');
    if (pointer) pointer.remove();
}

/**
 * Injeta dinamicamente a interface do Workspace ativo
 */
function loadWorkspace(targetWS) {
    currentWorkspace = targetWS;
    showOSToast(`WORKSPACE ${targetWS.toUpperCase()}`);

    // Injeção de Template HTML Limpo e Responsivo
    if (targetWS === "home") {
        systemViewport.innerHTML = `
            <div class="home-layout">
                <div class="glass-card home-dashboard">
                    <div class="clock-display">04:14</div>
                    <div class="dash-row"><span>SISTEMA</span><span>OS SPATIAL v3</span></div>
                    <div class="dash-row"><span>ZOOM ATUAL</span><span>${Math.round(globalZoomScale * 100)}%</span></div>
                </div>
                <div class="home-shortcuts">
                    <div class="glass-card shortcut-item" onclick="loadWorkspace('files')">
                        <div class="shortcut-icon">📤</div><div class="shortcut-label">Enviar Arquivos</div>
                    </div>
                    <div class="glass-card shortcut-item" onclick="loadWorkspace('search')">
                        <div class="shortcut-icon">🌐</div><div class="shortcut-label">Google Search</div>
                    </div>
                </div>
            </div>`;
    } 
    else if (targetWS === "files") {
        systemViewport.innerHTML = `
            <div class="media-player-container">
                <div class="glass-card" style="flex-grow:1; display:flex; flex-direction:column; align-items:center; justify-content:center; border-style:dashed;">
                    <div style="font-size:42px; margin-bottom:12px;">📁</div>
                    <h3 style="font-size:14px; letter-spacing:1px; margin-bottom:8px;">CONCENTRADOR DE ARQUIVOS</h3>
                    <p style="font-size:11px; color:rgba(255,255,255,0.5); text-align:center;">Dê duplo clique virtual abaixo para fazer upload</p>
                    <input type="file" id="hidden-picker" style="display:none;" onchange="showOSToast('Arquivo Pronto!')">
                    <button class="glass-card" style="margin-top:15px; padding:10px 20px; color:#fff;" onclick="document.getElementById('hidden-picker').click()">PROCURAR</button>
                </div>
            </div>`;
    }
    else if (targetWS === "search") {
        systemViewport.innerHTML = `
            <div class="browser-container glass-card">
                <div class="browser-bar">
                    <input type="text" class="browser-input" id="browser-url-field" value="https://www.google.com/search?igu=1">
                    <button class="glass-card" style="padding:0 15px; color:#fff;" onclick="executeSpatialSearch()">IR</button>
                </div>
                <div class="browser-iframe-wrapper">
                    <iframe id="spatial-iframe" src="https://www.google.com/search?igu=1"></iframe>
                </div>
            </div>`;
    }
    applyGlobalZoomUI(globalZoomScale);
}

function executeSpatialSearch() {
    const q = document.getElementById('browser-url-field').value;
    const f = document.getElementById('spatial-iframe');
    f.src = q.startsWith('http') ? q : `https://www.google.com/search?q=${encodeURIComponent(q)}&igu=1`;
}

function showOSToast(text) {
    const toast = document.getElementById('workspace-overlay-toast');
    if (toast) {
        toast.innerText = text;
        toast.style.opacity = '1';
        setTimeout(() => { toast.style.opacity = '0'; }, 1200);
    }
}

// Configuração e Inicialização do Pipeline MediaPipe Hands
const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({
    maxNumHands: 2, // CRUCIAL para capturar ambas as mãos ao mesmo tempo para o zoom
    modelComplexity: 1,
    minDetectionConfidence: 0.65,
    minTrackingConfidence: 0.65
});
hands.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => { await hands.send({ image: videoElement }); },
    width: 1280, height: 720, facingMode: "environment"
});

window.onload = () => { initOS(); camera.start(); };
    
