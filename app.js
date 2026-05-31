// ==========================================================================
// MR SPATIAL OS - CORE ENGINE & GESTURE CONTROLLER (TOTAL INTEGRATION v3.3)
// ==========================================================================

const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const systemViewport = document.getElementById('workspace-viewport');

// 1. GERENCIAMENTO DE WORKSPACES
const workspaces = ['home', 'files', 'search'];
let currentWorkspaceIndex = 0;
let currentWorkspace = "home";
let fileSystemHandle = null; // Guardará o acesso autorizado à pasta de arquivos

// 2. ESTADO DE NAVEGAÇÃO / SWIPE POR MOVIMENTO LATERAL (PULSO)
let lastHandX = null;
const swipeThreshold = 0.18;
let swipeCooldown = false;

// 3. ESTADO DO CLIQUE VIRTUAL E CURSOR (MÃO DIREITA/PRINCIPAL)
let lastClickTime = 0;
const doubleClickDelay = 350;
let isPinchedRight = false;

// 4. ESTADO DO ZOOM COORDENADO COM DUAS MÃOS
let isZoomingMode = false;
let initialPinchDistance = 0;
let initialScale = 1.0;
let globalZoomScale = 1.0; 

/**
 * MÓDULO DE PERMISSÕES CRÍTICAS DO SISTEMA OPERACIONAL
 */
async function requestOSPermissions() {
    showOSToast("A INICIALIZAR ECOSSISTEMA...");

    // Força o pedido de hardware da câmara em tempo real
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment", width: 1280, height: 720 },
            audio: false 
        });
        
        videoElement.srcObject = stream;
        videoElement.setAttribute('autoplay', '');
        videoElement.setAttribute('muted', '');
        videoElement.setAttribute('playsinline', '');
        await videoElement.play();
        
        // Inicializa o utilitário de animação contínua da câmara do MediaPipe
        const camera = new Camera(videoElement, {
            onFrame: async () => {
                if (videoElement.readyState >= 2) {
                    await hands.send({ image: videoElement });
                }
            },
            width: 1280, height: 720
        });
        camera.start();
        showOSToast("CÂMARA MESTRE ONLINE");
    } catch (err) {
        console.error("Permissão de hardware negada:", err);
        showOSToast("ERRO: CAMERA BLOQUEADA");
        alert("Acesso negado. Ative a câmara nas definições de segurança do seu navegador para rodar o MR OS.");
    }

    // Carrega o espaço inicial
    loadWorkspace("home");
}

/**
 * Pedido de Autorização e Acesso ao Sistema de Arquivos (Ativado pelo botão)
 */
async function requestFilePermission() {
    if ('showDirectoryPicker' in window) {
        try {
            fileSystemHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            showOSToast("PASTA LOCAL VINCULADA");
        } catch (err) {
            console.log("Utilizador optou por seleção isolada ou cancelou:", err);
            fallbackFileSelector();
        }
    } else {
        fallbackFileSelector();
    }
}

function fallbackFileSelector() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.style.display = 'none';
    
    fileInput.onchange = (e) => {
        const files = e.target.files;
        showOSToast(`${files.length} ARQUIVOS DETETADOS`);
    };
    
    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
}

/**
 * CALBACK DO PIPELINE MEDIAPE: PROCESSAMENTO ANALÍTICO DOS GESTOS
 */
function onResults(results) {
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    let leftHandLandmarks = null;
    let rightHandLandmarks = null;

    if (results.multiHandLandmarks && results.multiHandedness) {
        results.multiHandLandmarks.forEach((landmarks, index) => {
            const label = results.multiHandedness[index].label; 
            
            // Renderização das conexões holográficas azuis do HUD nas mãos
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: 'rgba(0, 191, 255, 0.4)', lineWidth: 2});
            drawLandmarks(canvasCtx, landmarks, {color: '#00BFFF', lineWidth: 1, radius: 2});

            if (label === 'Left') leftHandLandmarks = landmarks;
            if (label === 'Right') rightHandLandmarks = landmarks;
        });
    }

    // [RETIDO] MECÂNICA 1: PINCH ZOOM DE DUAS MÃOS SIMULTÂNEO
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
                showOSToast("ZOOM MANUAL EM CURSO");
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
        showOSToast(`ZOOM GRAVADO: ${Math.round(globalZoomScale * 100)}%`);
    }

    // [RETIDO] MECÂNICA 2 & 3: CURSOR, CLIQUE E SWIPE (MÃO DIREITA)
    if (rightHandLandmarks) {
        const thumbTip = rightHandLandmarks[4];
        const indexTip = rightHandLandmarks[8];
        const wrist = rightHandLandmarks[0];

        // Atualiza a transição por swipe monitorizando o pulso
        handleWorkspaceSwipe(wrist.x);

        // Movimentação livre do ponteiro virtual
        const cursorX = window.innerWidth * (1 - indexTip.x);
        const cursorY = window.innerHeight * indexTip.y;
        updateVirtualCursor(cursorX, cursorY);

        // Gatilho do clique virtual ao fechar pinça
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

/**
 * GESTÃO DE TRANSIÇÃO LATERAL DE ECOSSISTEMAS (SWIPE)
 */
function handleWorkspaceSwipe(currentX) {
    if (swipeCooldown) return;
    if (lastHandX !== null) {
        const deltaX = currentX - lastHandX;
        if (deltaX > swipeThreshold) { 
            navigateWorkspace(-1); // Swipe para a Direita -> Workspace Anterior
            triggerSwipeCooldown();
        } else if (deltaX < -swipeThreshold) { 
            navigateWorkspace(1);  // Swipe para a Esquerda -> Próximo Workspace
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
 * COMPUTAÇÃO DA ESCALA VISUAL DO SISTEMA
 */
function applyGlobalZoomUI(scale) {
    const uiContainer = document.querySelector('.spatial-hud-wrapper');
    if (uiContainer) {
        uiContainer.style.transform = `scale(${scale})`;
    }
    const zoomText = document.getElementById('dynamic-zoom-percentage');
    if (zoomText) {
        zoomText.innerText = `${Math.round(scale * 100)}%`;
    }
}

/**
 * DETEÇÃO E PROCESSAMENTO DE COLISÃO DO CURSOR COM ELEMENTOS HTML
 */
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

function getDistance3D(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z);
}

/**
 * COMPILADOR DOS TRÊS ESPAÇOS DE TRABALHO SOLICITADOS (INJEÇÃO DINÂMICA)
 */
function loadWorkspace(targetWS) {
    currentWorkspace = targetWS;
    showOSToast(`SISTEMA: ${targetWS.toUpperCase()}`);

    // Cria a casca estrutural base do teu design visionOS futurista azul transparente
    let innerContent = "";

    if (targetWS === "home") {
        innerContent = `
            <div class="hud-side-panel" style="display:flex; flex-direction:column; gap:20px; width:220px;">
                <div class="hud-card" style="background:rgba(10,25,50,0.5); backdrop-filter:blur(20px); border:2px solid #00bfff; border-radius:24px; padding:20px; color:#fff; box-shadow:0 0 20px rgba(0,191,255,0.2);">
                    <div style="font-size:12px; color:#00bfff; letter-spacing:2px; margin-bottom:10px;">VOLUME</div>
                    <input type="range" style="width:100%; accent-color:#00bfff;">
                </div>

                <div class="hud-card" style="background:rgba(10,25,50,0.5); backdrop-filter:blur(20px); border:2px solid #00bfff; border-radius:24px; padding:20px; color:#fff; box-shadow:0 0 20px rgba(0,191,255,0.2);">
                    <div style="font-size:12px; color:#00bfff; letter-spacing:2px; margin-bottom:5px;">ZOOM METRIC</div>
                    <div id="dynamic-zoom-percentage" style="font-size:32px; font-weight:bold; color:#fff;">100%</div>
                </div>

                <div class="hud-card" onclick="requestFilePermission()" style="background:rgba(10,25,50,0.6); backdrop-filter:blur(20px); border:2px solid #00bfff; border-radius:24px; padding:20px; text-align:center; color:#fff; cursor:pointer;">
                    <span style="font-size:24px;">📁</span>
                    <div style="font-size:11px; margin-top:5px; letter-spacing:1px; color:#00bfff; font-weight:bold;">ABRIR ARQUIVO</div>
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
        `;
    } 
    else if (targetWS === "files") {
        innerContent = `
            <div class="hud-card" style="width:100%; height:300px; background:rgba(10,25,50,0.6); backdrop-filter:blur(20px); border:2px dashed #00bfff; border-radius:24px; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff;">
                <span style="font-size:48px; margin-bottom:15px;">📥</span>
                <div style="font-size:16px; letter-spacing:1px; color:#00bfff; font-weight:bold; margin-bottom:5px;">CONCENTRADOR DE MÍDIA</div>
                <p style="font-size:12px; color:rgba(255,255,255,0.6);">Faça o gesto de clique no botão para autorizar arquivos</p>
                <button class="action-btn" onclick="requestFilePermission()" style="margin-top:15px; background:#00bfff; color:#0a1932; border:none; padding:10px 25px; border-radius:12px; font-weight:bold; cursor:pointer;">ESCOLHER DIRETÓRIO</button>
            </div>
        `;
    }
    else if (targetWS === "search") {
        innerContent = `
            <div class="hud-card" style="width:100%; height:400px; background:rgba(10,25,50,0.6); backdrop-filter:blur(20px); border:2px solid #00bfff; border-radius:24px; display:flex; flex-direction:column; overflow:hidden;">
                <div style="display:flex; padding:12px; gap:10px; background:rgba(0,0,0,0.3); border-bottom:1px solid rgba(0,191,255,0.3);">
                    <input type="text" id="spatial-search-input" value="https://www.google.com/search?igu=1" style="flex-grow:1; background:rgba(255,255,255,0.1); border:1px solid #00bfff; border-radius:8px; padding:8px; color:#fff; outline:none;">
                    <button class="action-btn" onclick="executeSpatialSearch()" style="background:#00bfff; border:none; padding:0 20px; border-radius:8px; font-weight:bold; cursor:pointer;">IR</button>
                </div>
                <iframe id="spatial-iframe" src="https://www.google.com/search?igu=1" style="width:100%; flex-grow:1; border:none; background:#fff;"></iframe>
            </div>
        `;
    }

    // Injeta mantendo a estrutura wrapper e reaplica a escala global ativa
    systemViewport.innerHTML = `<div class="spatial-hud-wrapper" style="width:90%; height:90%; display:flex; justify-content:space-between; align-items:center; position:relative; transition: transform 0.1s ease-out;">${innerContent}</div>`;
    applyGlobalZoomUI(globalZoomScale);
}

function executeSpatialSearch() {
    const query = document.getElementById('spatial-search-input').value;
    const iframe = document.getElementById('spatial-iframe');
    if (iframe) {
        iframe.src = query.startsWith('http') ? query : `https://www.google.com/search?q=${encodeURIComponent(query)}&igu=1`;
    }
}

function showOSToast(text) {
    const toast = document.getElementById('workspace-overlay-toast');
    if (toast) {
        toast.innerText = text;
        toast.style.opacity = '1';
        setTimeout(() => { toast.style.opacity = '0'; }, 1600);
    }
}

// CONFIGURAÇÃO DO PIPELINE MEDIA PIPE HANDS
const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.60, minTrackingConfidence: 0.60 });
hands.onResults(onResults);

// CICLO DE VIDA DO ECOSSISTEMA
window.addEventListener('DOMContentLoaded', () => {
    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;
    requestOSPermissions();
});

window.addEventListener('resize', () => {
    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;
});
        
