// ========== RECONHECIMENTO DE GESTOS COM MEDIAPIPE ==========

let hands = null;
let cameraProcessor = null;
let lastHandX = null;
let lastSwipeTime = 0;
let pinchActive = false;
let pinchStartDistance = 0;
let currentScale = 1;

const handCanvas = document.getElementById('hand-canvas');
const ctx = handCanvas.getContext('2d');

// Conexões dos dedos para desenho
const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4], // Polegar
    [0, 5], [5, 6], [6, 7], [7, 8], // Indicador
    [0, 9], [9, 10], [10, 11], [11, 12], // Médio
    [0, 13], [13, 14], [14, 15], [15, 16], // Anelar
    [0, 17], [17, 18], [18, 19], [19, 20] // Mínimo
];

function drawHand(landmarks) {
    if (!ctx) return;
    
    for (let i = 0; i < landmarks.length; i++) {
        const x = landmarks[i].x * handCanvas.width;
        const y = landmarks[i].y * handCanvas.height;
        
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#00BFFF';
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00BFFF';
    }
    
    ctx.beginPath();
    ctx.strokeStyle = '#00BFFF';
    ctx.lineWidth = 2;
    for (let conn of HAND_CONNECTIONS) {
        const p1 = landmarks[conn[0]];
        const p2 = landmarks[conn[1]];
        ctx.moveTo(p1.x * handCanvas.width, p1.y * handCanvas.height);
        ctx.lineTo(p2.x * handCanvas.width, p2.y * handCanvas.height);
        ctx.stroke();
    }
}

function detectSwipeGesture(landmarks) {
    const palmCenter = landmarks[0];
    const currentX = palmCenter.x;
    
    if (lastHandX !== null) {
        const deltaX = currentX - lastHandX;
        const now = Date.now();
        
        if (Math.abs(deltaX) > 0.04 && (now - lastSwipeTime) > 500) {
            if (deltaX > 0.04) {
                switchDesktop(currentDesktop - 1);
            } else if (deltaX < -0.04) {
                switchDesktop(currentDesktop + 1);
            }
            lastSwipeTime = now;
        }
    }
    lastHandX = currentX;
}

function detectTwoHandGestures(handsLandmarks) {
    if (handsLandmarks.length < 2) {
        pinchActive = false;
        return;
    }
    
    const hand1 = handsLandmarks[0];
    const hand2 = handsLandmarks[1];
    
    const thumb1 = hand1[4], index1 = hand1[8];
    const thumb2 = hand2[4], index2 = hand2[8];
    
    const distance1 = Math.hypot(thumb1.x - index1.x, thumb1.y - index1.y);
    const distance2 = Math.hypot(thumb2.x - index2.x, thumb2.y - index2.y);
    
    const isPinching1 = distance1 < 0.05;
    const isPinching2 = distance2 < 0.05;
    
    if (isPinching1 && isPinching2) {
        const center1 = { x: (thumb1.x + index1.x) / 2, y: (thumb1.y + index1.y) / 2 };
        const center2 = { x: (thumb2.x + index2.x) / 2, y: (thumb2.y + index2.y) / 2 };
        const currentDistance = Math.hypot(center1.x - center2.x, center1.y - center2.y);
        
        if (!pinchActive) {
            pinchActive = true;
            pinchStartDistance = currentDistance;
        } else {
            const scaleDelta = currentDistance / pinchStartDistance;
            if (Math.abs(scaleDelta - 1) > 0.05) {
                const newScale = Math.min(2, Math.max(0.5, currentScale * scaleDelta));
                currentScale = newScale;
                const desktopDiv = document.querySelector(`.desktop[data-desktop="${currentDesktop}"]`);
                if (desktopDiv) {
                    desktopDiv.style.transform = `scale(${newScale})`;
                    desktopDiv.style.transition = 'transform 0.1s ease';
                }
                pinchStartDistance = currentDistance;
            }
        }
    } else {
        pinchActive = false;
    }
}

function detectIndexFingerClick(handsLandmarks) {
    for (const landmarks of handsLandmarks) {
        const indexTip = landmarks[8];
        const indexMcp = landmarks[5];
        
        // Verificar se o dedo indicador está esticado
        const isExtended = indexTip.y < indexMcp.y;
        
        if (isExtended) {
            const x = indexTip.x * window.innerWidth;
            const y = indexTip.y * window.innerHeight;
            
            const clickableElements = document.querySelectorAll('.file-card, .menu-item, .voice-btn, #upload-btn');
            
            for (let element of clickableElements) {
                const rect = element.getBoundingClientRect();
                if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                    element.classList.add('hand-hover');
                    
                    if (!element.hasAttribute('data-hover-start')) {
                        element.setAttribute('data-hover-start', Date.now());
                    } else {
                        const hoverTime = Date.now() - parseInt(element.getAttribute('data-hover-start'));
                        if (hoverTime > 500) {
                            element.click();
                            element.removeAttribute('data-hover-start');
                        }
                    }
                } else {
                    element.classList.remove('hand-hover');
                    element.removeAttribute('data-hover-start');
                }
            }
        }
    }
}

function onHandResults(results) {
    if (!ctx || !handCanvas) return;
    
    ctx.save();
    ctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
    
    // Redimensionar canvas se necessário
    if (handCanvas.width !== window.innerWidth || handCanvas.height !== window.innerHeight) {
        handCanvas.width = window.innerWidth;
        handCanvas.height = window.innerHeight;
    }
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        for (const landmarks of results.multiHandLandmarks) {
            drawHand(landmarks);
        }
        
        detectTwoHandGestures(results.multiHandLandmarks);
        detectSwipeGesture(results.multiHandLandmarks[0]);
        detectIndexFingerClick(results.multiHandLandmarks);
    }
    
    ctx.restore();
}

function initMediaPipe() {
    const videoElement = document.getElementById('webcam');
    if (!videoElement || !videoElement.srcObject) return;
    
    // Fechar instância anterior
    if (hands) {
        hands.close();
    }
    
    hands = new Hands({
