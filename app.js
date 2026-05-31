const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const statusDiv = document.getElementById('status');
const fileInput = document.getElementById('file_input');

const hiddenImg = document.getElementById('hidden_img');
const hiddenVideo = document.getElementById('hidden_video');

let mediaType = null;
let mediaX = window.innerWidth / 2 - 150;
let mediaY = window.innerHeight / 2 - 150;
let mediaW = 300;
let mediaH = 200;
let mediaScale = 0.6;

let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let lastActionTime = 0;

// Configuração do Canvas Responsivo
function resizeCanvas() {
    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Captura e atribuição de arquivos de mídia
fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const fileURL = URL.createObjectURL(file);
    
    if (file.type.startsWith('video/')) {
        mediaType = 'video';
        hiddenImg.src = "";
        hiddenVideo.src = fileURL;
        hiddenVideo.play().catch(() => console.log("Permissão pendente"));
        hiddenVideo.volume = 0.5;
    } else {
        mediaType = 'image';
        hiddenVideo.pause();
        hiddenVideo.src = "";
        hiddenImg.src = fileURL;
    }
    mediaX = window.innerWidth / 2 - 150;
    mediaY = window.innerHeight / 2 - 150;
});

function getDistance(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

// ALGORITMO CRUCIAL: Detecção de colisão entre as coordenadas do MediaPipe e elementos DOM reais
function checkDOMCollision(x, y) {
    // Remove os efeitos visuais anteriores de hover
    document.querySelectorAll('.hud-hover').forEach(el => el.classList.remove('hud-hover'));

    // Coleta todas as tags interativas da HUD
    const interactiveElements = document.querySelectorAll('.glass-card, .hud-btn-round, .hud-btn-main, .hud-card');
    
    for (let el of interactiveElements) {
        const rect = el.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            el.classList.add('hud-hover'); // Ativa realce luminoso via CSS
            return el.id;
        }
    }
    return null;
}

function onResults(results) {
    // 1. Renderiza o Feed da Câmera em segundo plano no Canvas
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    let overTrash = false;

    // 2. Renderiza a Mídia Flutuante se houver arquivo ativo
    if (mediaType) {
        let currentMedia = mediaType === 'image' ? hiddenImg : hiddenVideo;
        let origW = currentMedia.videoWidth || currentMedia.width || 400;
        let origH = currentMedia.videoHeight || currentMedia.height || 300;
        
        const baseFactor = (canvasElement.width * 0.45) / origW;
        mediaW = origW * baseFactor * mediaScale;
        mediaH = origH * baseFactor * mediaScale;

        // Verifica colisão da Mídia com o Card da Lixeira física no HTML
        const trashRect = document.getElementById('card-trash').getBoundingClientRect();
        let mediaCenterX = mediaX + (mediaW / 2);
        let mediaCenterY = mediaY + (mediaH / 2);

        if (mediaCenterX >= trashRect.left && mediaCenterX <= trashRect.right &&
            mediaCenterY >= trashRect.top && mediaCenterY <= trashRect.bottom) {
            overTrash = true;
            document.getElementById('card-trash').classList.add('hud-hover');
        }

        canvasCtx.save();
        canvasCtx.globalAlpha = 0.9;
        canvasCtx.drawImage(currentMedia, mediaX, mediaY, mediaW, mediaH);
        
        // Borda Dinâmica da Mídia
        canvasCtx.strokeStyle = overTrash ? '#FF3333' : '#00BFFF';
        canvasCtx.lineWidth = isDragging ? 3 : 1;
        canvasCtx.strokeRect(mediaX, mediaY, mediaW, mediaH);
        canvasCtx.restore();
    }

    // 3. Processamento de Rastreamento de Mãos
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        statusDiv.innerText = "SISTEMA MR ATIVO";
        const landmarks = results.multiHandLandmarks[0];

        // Linhas de rastreamento virtuais sutis
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: 'rgba(0, 191, 255, 0.4)', lineWidth: 1.5});
        drawLandmarks(canvasCtx, landmarks, {color: '#00BFFF', lineWidth: 0.5, radius: 1.5});

        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];

        const pinchX = ((thumbTip.x + indexTip.x) / 2) * canvasElement.width;
        const pinchY = ((thumbTip.y + indexTip.y) / 2) * canvasElement.height;
        const isPinching = getDistance(thumbTip, indexTip) < 0.055;

        const pointerX = indexTip.x * canvasElement.width;
        const pointerY = indexTip.y * canvasElement.height;
        
        let targetX = isPinching ? pinchX : pointerX;
        let targetY = isPinching ? pinchY : pointerY;

        // Identifica em qual ID de elemento HTML o dedo está pairando/colidindo
        let hitID = checkDOMCollision(targetX, targetY);
        const now = Date.now();

        // GESTOS E EXECUÇÃO DE COMANDOS
        if (isPinching || (getDistance(thumbTip, indexTip) > 0.08)) {
            if (hitID && (now - lastActionTime > 700)) {
                
                if (hitID === 'card-upload') {
                    fileInput.click();
                    lastActionTime = now;
                }
                else if (hitID === 'media-play' && mediaType === 'video') {
                    if (hiddenVideo.paused) hiddenVideo.play(); else hiddenVideo.pause();
                    lastActionTime = now;
                }
                else if (hitID === 'card-zoom' || hitID === 'v-up') {
                    mediaScale = Math.min(2.0, mediaScale + 0.1);
                    document.getElementById('zoom-txt').innerText = `${Math.round(mediaScale * 200)}%`;
                    document.getElementById('zoom-bar').style.width = `${(mediaScale / 2) * 100}%`;
                    document.getElementById('v-bar-fill').style.height = `${(mediaScale / 2) * 100}%`;
                    lastActionTime = now;
                }
                else if (hitID === 'v-down') {
                    mediaScale = Math.max(0.2, mediaScale - 0.1);
                    document.getElementById('zoom-txt').innerText = `${Math.round(mediaScale * 200)}%`;
                    document.getElementById('zoom-bar').style.width = `${(mediaScale / 2) * 100}%`;
                    document.getElementById('v-bar-fill').style.height = `${(mediaScale / 2) * 100}%`;
                    lastActionTime = now;
                }
                else if (hitID === 'card-volume' && mediaType === 'video') {
                    hiddenVideo.volume = Math.min(1.0, hiddenVideo.volume + 0.1);
                    document.getElementById('vol-bar').style.width = `${hiddenVideo.volume * 100}%`;
                    lastActionTime = now;
                }
                else if (hitID === 'nav-refresh') {
                    location.reload();
                }
            }
        }

        // CONTROLE DE ARRASTO DA MÍDIA (Apenas com Pinça real tocando na mídia)
        if (isPinching && !hitID && mediaType) {
            if (!isDragging) {
                if (pinchX >= mediaX && pinchX <= mediaX + mediaW && pinchY >= mediaY && pinchY <= mediaY + mediaH) {
                    isDragging = true;
                    dragOffsetX = pinchX - mediaX;
                    dragOffsetY = pinchY - mediaY;
                }
            } else {
                mediaX = pinchX - dragOffsetX;
                mediaY = pinchY - dragOffsetY;
            }
        } else if (!isPinching) {
            if (isDragging && overTrash) {
                mediaType = null;
                hiddenVideo.pause();
                hiddenVideo.src = "";
                hiddenImg.src = "";
            }
            isDragging = false;
        }
    } else {
        statusDiv.innerText = "POSICIONE A MÃO NA CÂMERA";
        isDragging = false;
        document.querySelectorAll('.hud-hover').forEach(el => el.classList.remove('hud-hover'));
    }
}

// Inicializador do Framework de Visão Computacional
const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
});
hands.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => { await hands.send({image: videoElement}); },
    width: 1280,
    height: 720,
    facingMode: "environment"
});
camera.start();
  
