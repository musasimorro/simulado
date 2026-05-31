// ==========================================================================
// MR SPATIAL OS - CORE ENGINE & GESTURE CONTROLLER (UNIFIED v3)
// ==========================================================================

const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const systemViewport = document.getElementById('workspace-viewport');

// Gerenciamento de Workspaces
const workspaces = ['home', 'files', 'search'];
let currentWorkspaceIndex = 0;
let currentWorkspace = "home";

// Estado de Navegação / Swipe por Movimento Lateral
let lastHandX = null;
const swipeThreshold = 0.18;
let swipeCooldown = false;

// Estado do Clique Virtual (Mão Direita/Principal)
let lastClickTime = 0;
const doubleClickDelay = 350;
let isPinchedRight = false;

// Estado do Zoom Coordenado com Duas Mãos
let isZoomingMode = false;
let initialPinchDistance = 0;
let initialScale = 1.0;
let globalZoomScale = 1.0; // Fator de escala mestre (Usa valores entre 0.5 e 2.0)

/**
 * Boot e Configuração Inicial da Interface do Sistema
 */
function initOS() {
    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;
    loadWorkspace("home");
}

/**
 * Calcula a distância Euclidiana 3D entre dois pontos do esqueleto da mão
 */
function getDistance3D(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z);
}

/**
 * Callback Principal: Processa cada Quadro de Vídeo capturado pela Câmara
 */
function onResults(results) {
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    let leftHandLandmarks = null;
    let rightHandLandmarks = null;

    // Deteta as mãos e separa a Esquerda da Direita na Realidade Misturada
    if (results.multiHandLandmarks && results.multiHandedness) {
        results.multiHandLandmarks.forEach((landmarks, index) => {
            const label = results.multiHandedness[index].label; // "Left" ou "Right"
            
            // Desenha as linhas holográficas neons de tracking
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: 'rgba(0, 191, 255, 0.25)', lineWidth: 1.5});
            drawLandmarks(canvasCtx, landmarks, {color: '#00BFFF', lineWidth: 0.5, radius: 1.5});

            if (label === 'Left') leftHandLandmarks = landmarks;
            if (label === 'Right') rightHandLandmarks = landmarks;
        });
    }

    // --- LÓGICA 1: PINCH ZOOM COM AS DUAS MÃOS ---
    if (leftHandLandmarks && rightHandLandmarks) {
        // Mede a distância da pinça (Dedão [4] + Indicador [8]) em ambas as mãos
        const leftPinchDist = getDistance3D(leftHandLandmarks[4], leftHandLandmarks[8]);
        const rightPinchDist = getDistance3D(rightHandLandmarks[4], rightHandLandmarks[8]);
        
        const leftIsPinching = leftPinchDist < 0.052;
        const rightIsPinching = rightPinchDist < 0.052;

        if (leftIsPinching && rightIsPinching) {
            // Posição central de cada pinça para calcular a distância entre as duas mãos
            const leftCenter = leftHandLandmarks[8];
            const rightCenter = rightHandLandmarks[8];
            const currentHandDistance = Math.hypot(leftCenter.x - rightCenter.x, leftCenter.y - rightCenter.y);

            if (!isZoomingMode) {
                isZoomingMode = true;
                initialPinchDistance = currentHandDistance;
                initialScale = globalZoomScale;
                showOSToast("ZOOM ATIVO");
            } else {
                // Multiplicador baseado na aproximação ou afastamento das mãos
                const zoomFactor = currentHandDistance / initialPinchDistance;
                globalZoomScale = Math.min(2.0, Math.max(0.5, initialScale * zoomFactor));
                
                applyGlobalZoomUI(globalZoomScale);
            }
            return; // Tranca outras ações para focar apenas no gesto de zoom
        }
    }
    
    // Desativa o modo zoom quando soltas uma das pinças
    if (isZoomingMode) {
        isZoomingMode = false;
        showOSToast(`ZOOM FIXADO: ${Math.round(globalZoomScale * 100)}%`);
    }

    // --- LÓGICA 2: CONTROLOS MONOMANUAIS (MÃO DIREITA) ---
    if (rightHandLandmarks) {
        const thumbTip = rightHandLandmarks[4];
        const indexTip = rightHandLandmarks[8];
        const wrist = rightHandLandmarks[0];

        // 1. Swipe Lateral (Usa a posição X do pulso para transições)
        handleWorkspaceSwipe(wrist.x);

        // 2. Cursor Virtual (Inverte o X para corrigir o efeito de espelho da câmara)
        const cursorX = window.innerWidth * (1 - indexTip.x);
        const cursorY = window.innerHeight * indexTip.y;
        updateVirtualCursor(cursorX, cursorY);

        // 3. Duplo Clique Virtual (Pinça rápida com a mão direita)
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
 * Processa a troca de ecrã ao movimentar a mão de um lado para o outro
 */
function handleWorkspaceSwipe(currentX) {
    if (swipeCooldown) return;
    if (lastHandX !== null) {
        const deltaX = currentX - lastHandX;
        if (deltaX > swipeThreshold) { // Mão movida para a direita -> Workspace Anterior
            navigateWorkspace(-1);
            triggerSwipeCooldown();
        } else if (deltaX < -swipeThreshold) { // Mão movida para a esquerda -> Próximo Workspace
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
 * Altera a escala 3D e profundidade da UI central do OS
 */
function applyGlobalZoomUI(scale) {
    const viewport = document.getElementById('workspace-viewport');
    if (viewport) {
        viewport.style.transform = `scale(${scale}) translateZ(${(scale - 1) * 50}px)`;
    }
}

/**
 * Deteta colisões e executa o duplo clique virtual em botões HTML
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
            clickable.click(); // Dispara a ação do botão nativo
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
 * Construtor e Injetor Dinâmico dos 3 Espaços de Trabalho Solicitados
 */
function loadWorkspace(targetWS) {
    currentWorkspace = targetWS;
    showOSToast(`WORKSPACE ${targetWS.toUpperCase()}`);

    if (targetWS === "home") {
        systemViewport.innerHTML = `
            <div class="home-layout">
                <div class="glass-card home-dashboard">
                    <div class="clock-display">04:20</div>
                    <div class="dash-row"><span>SISTEMA</span><span>OS SPATIAL v3</span></div>
                    <div class="dash-row"><span>ZOOM INTERNO</span><span>${Math.round(globalZoomScale * 100)}%</span></div>
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
                    <input type="file" id="hidden-picker" style="display:none;" onchange="showOSToast('Arquivo Carregado!')">
                    <button class="glass-card" style="margin-top:15px; padding:10px 20px; color:#fff;" onclick="document.getElementById('hidden-picker').click()">PROCURAR</button>
                </div>
            </div>`;
    }
    else if (targetWS === "search") {
        systemViewport.innerHTML = `
            <div class="browser-container glass-card">
                <div class="browser-bar">
                    <input type="text" class="browser-input" id="browser-url-field" value="https://www.google.com/search?igu=1">
                    <button class="glass-card" style="padding:0 15px; color:#fff;" onclick="executeSpatialSearch()">PESQUISAR</button>
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

// Configuração Estrita do Pipeline MediaPipe Hands
const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({
    maxNumHands: 2, // Ativa a leitura simultânea das duas mãos para o Zoom
    modelComplexity: 1,
    minDetectionConfidence: 0.65,
    minTrackingConfidence: 0.65
});
hands.onResults(onResults);

/**
 * Inicialização Blindada da Câmara com Tratamento Ativo de Erros do Navegador
 */
async function startSpatialCamera() {
    const constraints = {
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "environment" },
        audio: false
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = stream;
        canvasElement.width = window.innerWidth;
        canvasElement.height = window.innerHeight;

        const camera = new Camera(videoElement, {
            onFrame: async () => {
                if (videoElement.readyState >= 2) {
                    await hands.send({ image: videoElement });
                }
            },
            width: 1280, height: 720
        });

        await camera.start();
        showOSToast("MR SPATIAL ONLINE");
        
    } catch (err) {
        console.error("Erro no hardware de captura:", err);
        showOSToast("ERRO DE PERMISSÃO NA CÂMARA");
        
        // Fallback rápido
        try {
            const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
            videoElement.srcObject = fallbackStream;
            videoElement.play();
        } catch(e) {
            alert("Acesso negado à câmara. Por favor, ative as permissões nas definições do navegador.");
        }
    }
}

// Inicializadores globais do Ciclo de Vida do App
window.addEventListener('DOMContentLoaded', () => {
    initOS();
    startSpatialCamera();
});

window.addEventListener('resize', () => {
    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;
});
             
