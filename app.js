// ==========================================================================
// MR SPATIAL OS - CORE ENGINE & GESTURE CONTROLLER (NATIVE LOOP STABLE v4.5)
// ==========================================================================

const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const systemViewport = document.getElementById('workspace-viewport');

// 1. GERENCIAMENTO DE WORKSPACES
const workspaces = ['home', 'files', 'search'];
let currentWorkspaceIndex = 0;
let currentWorkspace = "home";
let fileSystemHandle = null; 

// 2. ESTADO DE GESTOS E CONTROLOS ESPACIAIS
let lastHandX = null;
const swipeThreshold = 0.18;
let swipeCooldown = false;
let lastClickTime = 0;
const doubleClickDelay = 350;
let isPinchedRight = false;

let isZoomingMode = false;
let initialPinchDistance = 0;
let initialScale = 1.0;
let globalZoomScale = 1.0; 

// Controlos de ciclo de processamento ativo
let isStreamActive = false;

/**
 * MÓDULO DE INICIALIZAÇÃO NATIVA DA CÂMERA (SEM UTILIÁRIOS CONFLITUOSOS)
 */
async function requestOSPermissions() {
    showOSToast("A INICIALIZAR ECOSSISTEMA...");

    // Limpeza radical de qualquer instância ou stream anterior
    if (videoElement.srcObject) {
        const tracks = videoElement.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        videoElement.srcObject = null;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: "environment", // Garante a câmara de trás do telemóvel
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false 
        });
        
        videoElement.srcObject = stream;
        videoElement.setAttribute('autoplay', '');
        videoElement.setAttribute('muted', '');
        videoElement.setAttribute('playsinline', '');
        
        await videoElement.play();
        isStreamActive = true;
        
        // Arranca o loop de processamento nativo (Substitui o instável new Camera)
        renderAndTrackLoop();
        
        showOSToast("CÂMARA MESTRE ONLINE");
    } catch (err) {
        console.error("Erro ao aceder ao hardware de vídeo:", err);
        showOSToast("ERRO: CÂMARA INDISPONÍVEL");
        alert("A câmara está presa por outro processo. Feche as abas em segundo plano e recarregue a página.");
    }

    loadWorkspace("home");
}

/**
 * LOOP ESPACIAL NATIVO: Evita conflitos de concorrência e envia frames limpos
 */
async function renderAndTrackLoop() {
    if (!isStreamActive) return;

    if (videoElement.readyState >= 2) {
        try {
            // Desenha primeiro o frame real da câmara no fundo
            canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
            canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
            
            // Envia o frame atual diretamente para análise do MediaPipe
            await hands.send({ image: videoElement });
        } catch (e) {
            console.warn("MediaPipe descartou frame ocupado:", e);
        }
    }
    
    // Executa continuamente sincronizado com a taxa de atualização do ecrã
    requestAnimationFrame(renderAndTrackLoop);
}

/**
 * REQUISIÇÃO DE ARQUIVOS LOCAL DO DISPOSITIVO
 */
async function requestFilePermission() {
    if ('showDirectoryPicker' in window) {
        try {
            fileSystemHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            showOSToast("PASTA LOCAL VINCULADA");
        } catch (err) {
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
        showOSToast(`${e.target.files.length} ARQUIVOS DETETADOS`);
    };
    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
}

/**
 * CALLBACK DO ECOSSISTEMA MEDIAPIPE: APENAS CALCULA OS GESTOS
 */
function onResults(results) {
    let leftHandLandmarks = null;
    let rightHandLandmarks = null;

    if (results.multiHandLandmarks && results.multiHandedness) {
        results.multiHandLandmarks.forEach((landmarks, index) => {
            const label = results.multiHandedness[index].label; 
            
            // Desenha o esqueleto holográfico por cima da imagem da câmara
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: 'rgba(0, 191, 255, 0.4)', lineWidth: 2});
            drawLandmarks(canvasCtx, landmarks, {color: '#00BFFF', lineWidth: 1, radius: 2});

            if (label === 'Left') leftHandLandmarks = landmarks;
            if (label === 'Right') rightHandLandmarks = landmarks;
        });
    }

    // MECÂNICA 1: ZOOM COM A PINÇA DAS DUAS MÃOS SIMULTÂNEAS
    if (leftHandLandmarks && rightHandLandmarks) {
        const leftPinchDist = getDistance3D(leftHandLandmarks[4], leftHandLandmarks[8]);
        const rightPinchDist = getDistance3D(rightHandLandmarks[4], rightHandLandmarks[8]);
        
        if (leftPinchDist < 0.055 && rightPinchDist < 0.055) {
            const leftCenter = leftHandLandmarks[8];
            const rightCenter = rightHandLandmarks[8];
            const currentHandDistance = Math.hypot(leftCenter.x - rightCenter.x, leftCenter.y - rightCenter.y);

            if (!isZoomingMode) {
                isZoomingMode = true;
                initialPinchDistance = currentHandDistance;
                initialScale = globalZoomScale;
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
        showOSToast(`ZOOM FIXADO: ${Math.round(globalZoomScale * 100)}%`);
    }

    // MECÂNICA 2 & 3: SWIPE E CURSOR INTERATIVO COM A MÃO DIREITA
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

/**
 * GESTÃO DO INTERCAMBIO DE ESPAÇOS (SWIPE)
 */
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
    const uiContainer = document.querySelector('.spatial-hud-wrapper');
    if (uiContainer) uiContainer.style.transform = `scale(${scale})`;
    
    const zoomText = document.getElementById('dynamic-zoom-percentage');
    if (zoomText) zoomText.innerText = `${Math.round(scale * 100)}%`;
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

function getDistance3D(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z);
}

/**
 * CONSTRUTOR DE INTERFACE DOS WORKSPACES
 */
function loadWorkspace(targetWS) {
    currentWorkspace = targetWS;
    showOSToast(`SISTEMA: ${targetWS.toUpperCase()}`);

    let innerContent = "";

    if (targetWS === "home") {
        innerContent = `
            <div class="hud-side-panel" style="display:flex; flex-direction:column; gap:20px; width:220px;">
                <div class="hud-card" style="background:rgba(10,25,50,0.5); backdrop-filter:blur(20px); border:2px solid #00bfff; border-radius:24px; padding:20px; color:#fff;">
                    <div style="font-size:12px; color:#00bfff; letter-spacing:2px; margin-bottom:10px;">VOLUME</div>
                    <input type="range" style="width:100%; accent-color:#00bfff;">
                </div>

                <div class="hud-card" style="background:rgba(10,25,50,0.5); backdrop-filter:blur(20px); border:2px solid #00bfff; border-radius:24px; padding:20px; color:#fff;">
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

            <div class="hud-card" style="background:rgba(10,25,50,0.5); backdrop-filter:blur(20px); border:2px solid #00bfff; border-radius:30px; width:60px; height:350px; display:flex; flex-direction:column; align-items:center; justify-content:space-between; padding:20px 0;">
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
            <div class="hud-card" style="width:100%; height:300px; background:rgba(10,25,50,0.6); backdrop-filter:blur(20px); border:2px dashed #00bfff; border-radius:24px; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff; padding:20px;">
                <span style="font-size:48px; margin-bottom:15px;">📥</span>
                <div style="font-size:16px; letter-spacing:1px; color:#00bfff; font-weight:bold;">CONCENTRADOR DE MÍDIA</div>
                <button class="action-btn" onclick="requestFilePermission()" style="margin-top:20px; background:#00bfff; color:#0a1932; border:none; padding:10px 25px; border-radius:12px; font-weight:bold; cursor:pointer;">SELECIONAR DIRETÓRIO</button>
            </div>
        `;
    }
    else if (targetWS === "search") {
        innerContent = `
            <div class="hud-card" style="width:100%; height:400px; background:rgba(10,25,50,0.6); backdrop-filter:blur(20px); border:2px solid #00bfff; border-radius:24px; display:flex; flex-direction:column; overflow:hidden;">
                <div style="display:flex; padding:12px; gap:10px; background:rgba(0,0,0,0.3); border-bottom:1px solid rgba(0,191,255,0.3);">
                    <input type="text" id="spatial-search-input" value="https://www.google.com/search?igu=1" style="flex-grow:1; background:rgba(255,255,255,0.1); border:1px solid #00bfff; border-radius:8px; padding:8px; color:#fff; outline:none;">
                    <button class="action-btn" onclick="executeSpatialSearch()" style="background:#00bfff; border:none; padding:0 20px; border-radius:8px; font-weight:bold; cursor:pointer;">BUSCAR</button>
                </div>
                <iframe id="spatial-iframe" src="https://www.google.com/search?igu=1" style="width:100%; flex-grow:1; border:none; background:#fff;"></iframe>
            </div>
        `;
    }

    systemViewport.innerHTML = `<div class="spatial-hud-wrapper" style="width:90%; height:90%; display:flex; justify-content:space-between; align-items:center; position:relative;">${innerContent}</div>`;
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

// INICIALIZADOR DO ENGINE DE INTELIGÊNCIA ARTIFICIAL
const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.60, minTrackingConfidence: 0.60 });
hands.onResults(onResults);

window.addEventListener('DOMContentLoaded', () => {
    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;
    requestOSPermissions();
});

window.addEventListener('resize', () => {
    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;
});
                             
