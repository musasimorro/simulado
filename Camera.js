// ========== GERENCIAMENTO DE CÂMERA ==========

let availableCameras = [];
let currentStream = null;
let isCameraActive = false;

const videoElement = document.getElementById('webcam');
const fallbackBg = document.getElementById('fallback-bg');
const statusBar = document.getElementById('status-bar');
const cameraSelect = document.getElementById('camera-select');
const cameraSelectorDiv = document.getElementById('camera-selector');

function updateStatus(message, duration = 3000) {
    if (statusBar) {
        statusBar.textContent = message;
        if (duration > 0) {
            setTimeout(() => {
                if (statusBar.textContent === message) {
                    statusBar.textContent = isCameraActive ? '📷 Câmera ATIVA' : '🎨 Modo DEMO';
                }
            }, duration);
        }
    }
}

async function listCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        availableCameras = videoDevices;
        
        cameraSelect.innerHTML = '';
        
        if (videoDevices.length === 0) {
            cameraSelect.innerHTML = '<option value="">Nenhuma câmera encontrada</option>';
            updateStatus('❌ Nenhuma câmera detectada');
            return;
        }
        
        videoDevices.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            
            // Identificar tipo da câmera
            let label = device.label || `Câmera ${index + 1}`;
            if (label.toLowerCase().includes('front') || label.toLowerCase().includes('user')) {
                label = '📸 Frontal';
            } else if (label.toLowerCase().includes('back') || label.toLowerCase().includes('environ')) {
                label = '📷 Traseira';
            } else {
                label = `🎥 Câmera ${index + 1}`;
            }
            
            option.textContent = label;
            cameraSelect.appendChild(option);
        });
        
        cameraSelectorDiv.style.display = 'block';
        updateStatus(`📹 ${videoDevices.length} câmera(s) detectada(s)`);
        
        // Tentar iniciar com a primeira câmera
        if (videoDevices.length > 0) {
            await startCameraWithDeviceId(videoDevices[0].deviceId);
        }
        
    } catch (err) {
        console.error('Erro ao listar câmeras:', err);
        updateStatus('❌ Erro ao acessar câmeras');
    }
}

async function startCameraWithDeviceId(deviceId) {
    // Parar stream anterior
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }
    
    // Parar MediaPipe se existir
    if (window.stopMediaPipe) {
        window.stopMediaPipe();
    }
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: deviceId } }
        });
        
        currentStream = stream;
        videoElement.srcObject = stream;
        videoElement.style.display = 'block';
        fallbackBg.style.display = 'none';
        isCameraActive = true;
        
        await videoElement.play();
        
        // Identificar tipo de câmera
        const selectedDevice = availableCameras.find(c => c.deviceId === deviceId);
        const isFrontCamera = selectedDevice?.label?.toLowerCase().includes('front') || 
                             selectedDevice?.label?.toLowerCase().includes('user');
        
        // Aplicar espelhamento apenas para câmera frontal
        videoElement.style.transform = isFrontCamera ? 'scaleX(-1)' : 'scaleX(1)';
        
        updateStatus(isFrontCamera ? '📸 Câmera Frontal ATIVA' : '📷 Câmera Traseira ATIVA');
        
        // Inicializar MediaPipe
        if (window.initMediaPipe) {
            window.initMediaPipe();
        }
        
    } catch (err) {
        console.error('Erro ao iniciar câmera:', err);
        isCameraActive = false;
        videoElement.style.display = 'none';
        fallbackBg.style.display = 'block';
        updateStatus(`❌ Erro: ${err.name} - Tente outra câmera`);
    }
}

function initCamera() {
    cameraSelect.addEventListener('change', (e) => {
        if (e.target.value) {
            startCameraWithDeviceId(e.target.value);
        }
    });
    
    // Solicitar permissão e listar câmeras
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            stream.getTracks().forEach(track => track.stop());
            listCameras();
        })
        .catch(err => {
            console.error('Permissão negada:', err);
            updateStatus('❌ Permissão da câmera negada');
            fallbackBg.style.display = 'block';
            cameraSelectorDiv.style.display = 'block';
            cameraSelect.innerHTML = '<option value="">Permissão necessária</option>';
        });
}
