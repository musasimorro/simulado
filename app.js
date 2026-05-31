// ==========================================================================
// MR SPATIAL OS - CORE ENGINE & GESTURE CONTROLLER (FIXED CAMERA v3.1)
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

// Estado do Clique Virtual (Mão de Interação)
let lastClickTime = 0;
const doubleClickDelay = 350;
let isPinchedRight = false;

// Estado do Zoom Coordenado com Duas Mãos
let isZoomingMode = false;
let initialPinchDistance = 0;
let initialScale = 1.0;
let globalZoomScale = 1.0; 

/**
 * Boot e Configuração Inicial da Interface do Sistema
 */
function initOS() {
    resizeCanvas();
    loadWorkspace("home");
}

function resizeCanvas() {
    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;
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
    
    // Desenha o frame da câmara ocupando todo o fundo
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    let leftHandLandmarks = null;
    let rightHandLandmarks = null;

    if (results.multiHandLandmarks && results.multiHandedness) {
        results.multiHandLandmarks.forEach((landmarks, index) => {
            const label = results.multiHandedness[index].label; 
            
            // Desenha as linhas holográficas neon azuis de tracking sobre as tuas mãos
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: 'rgba(0, 191, 255, 0.4)', lineWidth: 2});
            drawLandmarks(canvasCtx, landmarks, {color: '#00BFFF', lineWidth: 1, radius: 2});

            if (label === 'Left') leftHandLandmarks = landmarks;
            if (label === 'Right') rightHandLandmarks = landmarks;
        });
    }

    // --- LÓGICA 1: PINCH ZOOM COM AS DUAS MÃOS ---
    if (leftHandLandmarks && rightHandLandmarks) {
        const leftPinchDist = getDistance3D(leftHandLandmarks[4], leftHandLandmarks[8]);
        const rightPinchDist = getDistance3D(rightHandLandmarks[4], rightHandLandmarks[8]);
        
        const leftIsPinching = leftPinchDist < 0.055;
        const rightIsPinching = rightPinchDist < 0.055;

        if (leftIsPinching && rightIsPinching) {
            const leftCenter = leftHandLandmarks[8];
            const rightCenter = rightHandLandmarks[8];
            const currentHandDistance = Math.hypot(leftCenter.x - rightCenter.x, leftCenter.y - rightCenter.y);

            if (!isZoomingMode) {
                isZoomingMode = true;
                initialPinchDistance = currentHandDistance;
                initialScale = globalZoomScale;
                showOSToast("ZOOM MANUAL ATIVO");
            } else {
                const zoomFactor = currentHandDistance / initialPinchDistance;
                globalZoomScale = Math.min(2.5, Math.max(0.5, initialScale * zoomFactor));
                applyGlobalZoomUI(globalZoomScale);
            }
            return; 
        }
    }
    
    if (isZoomingMode) {
        isZoomingMode = false;
        showOSToast(`ZOOM CONFIGURADO: ${Math.round(globalZoomScale * 100)}%`);
    }

    // --- LÓGICA 2: CONTROLOS MONOMANUAIS (MÃO DIREITA) ---
    if (rightHandLandmarks) {
        const thumbTip = rightHandLandmarks[4];
        const indexTip = rightHandLandmarks[8];
        const wrist = rightHandLandmarks[0];

        handleWorkspaceSwipe(wrist.x);

        const cursorX = window.innerWidth * (1 - indexTip.x);
        const cursorY = window.innerHeight * indexTip.y;
        updateVirtualCursor(cursorX, cursorY);

        const rightPinchDist = getDistance3D(thumbTip, indexTip);
        if (rightPinchDist < 0.055) {
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

function handleWorkspaceSwipe(currentX) {
    if (swipeCooldown) return;
    if (lastHandX !== null) {
        const deltaX = currentX - lastHandX;
        if (deltaX > swipeThreshold) { 
            navigateWorkspace(-1);
            triggerSwipeCooldown();
        } else if (deltaX < -swipeThreshold) { 
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

function applyGlobalZoomUI(scale) {
    // Altera o zoom visual do HUD de forma suave
    const uiContainer = document.querySelector('.spatial-hud-wrapper');
    if (uiContainer) {
        uiContainer.style.transform = `scale(${scale})`;
    }
    // Atualiza o indicador textual se ele existir na tela
    const zoomText = document.getElementById('dynamic-zoom-percentage');
    if (zoomText) {
        zoomText.innerText = `${Math.round(scale * 100)}%`;
    }
}

function handleVirtualClick(x, y) {
    const currentTime = Date.now();
    const timeDiff = currentTime - lastClickTime;
    const elementAtCursor = document.elementFromPoint(x, y);
    
    if (!elementAtCursor) return;

    if (timeDiff < doubleClickDelay && timeDiff > 0) {
        const clickable = elementAtCursor.closest('.hud-card, .action-btn, button');
        if (clickable) {
            clickable.style.transform = 'scale(0.92)';
            setTimeout(() => { clickable.style.transform = ''; }, 130);
            clickable.click(); 
        }
        lastClickTime = 0;
    } else {
        lastClickTime = currentTime;
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
 * Cria a Interface Futurista exatamente igual aos teus prints funcionais
 */
function loadWorkspace(targetWS) {
    currentWorkspace = targetWS;
    showOSToast(`CONECTADO: ${targetWS.toUpperCase()}`);

    // Injeção do teu belo template com o efeito Cyber-Glow azul transparente dos teus prints
    systemViewport.innerHTML = `
        <div class="spatial-hud-wrapper" style="width:90%; height:90%; display:flex; justify-content:space-between; align-items:center; position:relative;">
            
            <div class="hud-side-panel" style="display:flex; flex-direction:column; gap:20px; width:220px;">
                <div class="hud-card" style="background:rgba(10,25,50,0.5); backdrop-filter:blur(20px); border:2px solid #00bfff; border-radius:24px; padding:20px; color:#fff; box-shadow:0 0 20px rgba(0,191,255,0.2);">
                    <div style="font-size:12px; color:#00bfff; letter-spacing:2px; margin-bottom:10px;">VOLUME</div>
                    <input type="range" style="width:100%; accent-color:#00bfff;">
                </div>

                <div class="hud-card" style="background:rgba(10,25,50,0.5); backdrop-filter:blur(20px); border:2px solid #00bfff; border-radius:24px; padding:20px; color:#fff; box-shadow:0 0 20px rgba(0,191,255,0.2);">
                    <div style="font-size:12px; color:#00bfff; letter-spacing:2px; margin-bottom:5px;">ZOOM METRIC</div>
                    <div id="dynamic-zoom-percentage" style="font-size:32px; font-weight:bold; color:#fff;">100%</div>
                </div>

                <div class="hud-card" style="background:rgba(200,30,30,0.2); backdrop-filter:blur(20px); border:2px solid #ff3333; border-radius:24px; padding:20px; text-align:center; color:#fff; cursor:pointer;">
                    <span style="font-size:24px;">🗑️</span>
                    <div style="font-size:11px; margin-top:5px; letter-spacing:1px;">LIMPAR ESPAÇO</div>
                </div>
            </div>

            <div class="spatial-reticle" style="width:80px; height:80px; border:2px dashed rgba(0,191,255,0.6); border-radius:50%; display:flex; justify-content:center; align-items:center;">
                <div style="width:8px; height:8px; background:#00bfff; border-radius:50%;"></div>
            </div>

            <div class="hud-card" style="background:rgba(10,25,50,0.5); backdrop-filter:blur(20px); border:2px solid #00bfff; border-radius:30px; width:60px; height:350px; display:flex; flex-direction:column; align-items:center; justify-content:space-between; padding:20px 0; box-shadow:0 0 25px rgba(0,191,255,0.25);">
                <div style="color:#00bfff; font-weight:bold; font-size:20px;">+</div>
                <div style="width:6px; height:180px; background:rgba(255,255,255,0.1); border-radius:3px; position:relative;">
                    <div style="position:absolute; bottom:0; width:100%; height:50%; background:#00bfff; border-radius:3px;"></div>
                </div>
                <div style="color:#00bfff; font-weight:bold; font-size:20px;">-</div>
            </div>
        </div>
    `;
    applyGlobalZoomUI(globalZoomScale);
}

function showOSToast(text) {
    const toast = document.getElementById('workspace-overlay-toast');
    if (toast) {
        toast.innerText = text;
        toast.style.opacity = '1';
        setTimeout(() => { toast.style.opacity = '0'; }, 1500);
    }
}

// Configuração do Pipeline MediaPipe Hands
const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({
    maxNumHands: 2, 
    modelComplexity: 1,
    minDetectionConfidence: 0.60,
    minTrackingConfidence: 0.60
});
hands.onResults(onResults);

/**
 * Inicialização com tratamento de erros corrigido para mobile e desktop
 */
async function startSpatialCamera() {
    const constraints = {
        video: { 
            width: { ideal: 1280 }, 
            height: { ideal: 720 }, 
            facingMode: "environment" // Altere para "user" caso queira testar com a frontal do telemóvel
        },
        audio: false
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = stream;
        
        // Força a reprodução manual necessária em navegadores mobile
        videoElement.setAttribute('autoplay', '');
        videoElement.setAttribute('muted', '');
        videoElement.setAttribute('playsinline', '');
        await videoElement.play();

        resizeCanvas();

        const camera = new Camera(videoElement, {
            onFrame: async () => {
                if (videoElement.readyState >= 2) {
                    await hands.send({ image: videoElement });
                }
            },
            width: 1280, height: 720
        });

        await camera.start();
        showOSToast("MR OS: CÂMARA ATIVA");
        
    } catch (err) {
        console.error("Falha no acesso à câmara:", err);
        showOSToast("ERRO: ACESSO À CÂMARA NEGADO");
        
        // Fallback genérico para contornar restrições
        try {
            const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
            videoElement.srcObject = fallbackStream;
            await videoElement.play();
        } catch(e) {
            alert("Ative as permissões de câmara no seu browser (definições do site) para rodar a Realidade Misturada.");
        }
    }
}

// Inicializadores globais do Ciclo de Vida do App
window.addEventListener('DOMContentLoaded', () => {
    initOS();
    startSpatialCamera();
});

window.addEventListener('resize', () => {
    resizeCanvas();
});
