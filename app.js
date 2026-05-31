// Captura de Elementos Estruturais
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const systemViewport = document.getElementById('workspace-viewport');
const toastIndicator = document.getElementById('workspace-overlay-toast');
const filePicker = document.getElementById('system-file-picker');

// Variáveis de Estado Global do OS
const workspaces = { home: {}, media: {}, browser: {}, files: {}, ai: {} };
const workspaceOrder = ["home", "media", "browser", "files", "ai"];
let currentWorkspace = "home";

let lastHandX = null;
let swipeCooldown = false;
let isDraggingMedia = false;
let mediaPosition = { x: 400, y: 50, scale: 1.0 };
let activeFileObject = null; // Guarda referências de upload
let currentVolume = 0.5;

// Mapeamento e Inicialização do Reconhecimento de Voz (Nativo)
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognitionActive = false;
let voiceRecognitionNode = null;

if (SpeechRecognition) {
    voiceRecognitionNode = new SpeechRecognition();
    voiceRecognitionNode.continuous = true;
    voiceRecognitionNode.lang = 'pt-BR';
    voiceRecognitionNode.interimResults = false;

    voiceRecognitionNode.onresult = (event) => {
        const command = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
        processVoiceCommand(command);
    };
    
    voiceRecognitionNode.onerror = () => { recognitionActive = false; };
}

// Mecanismo de Renderização de Componentes Dinâmicos (Workspaces)
function loadWorkspace(targetWS) {
    currentWorkspace = targetWS;
    systemViewport.className = ""; // Limpa animações anteriores
    void systemViewport.offsetWidth; // Trigger reflow
    systemViewport.className = "workspace-animate-fade";

    // Dispara alerta flutuante na tela (HUD Toast)
    toastIndicator.innerText = `WORKSPACE ${targetWS.toUpperCase()}`;
    toastIndicator.style.opacity = "1";
    setTimeout(() => { toastIndicator.style.opacity = "0"; }, 800);

    // Injeção de Templates Modulares baseados no escopo do Projeto
    if (targetWS === "home") {
        systemViewport.innerHTML = `
            <div class="home-layout">
                <div class="home-dashboard glass-card spatial-tilt-left">
                    <div class="clock-display" id="live-clock">00:00:00</div>
                    <div class="dash-row"><span>SYS STATUS</span><span>READY</span></div>
                    <div class="dash-row"><span>BATTERY</span><span>98%</span></div>
                    <div class="dash-row"><span>WI-FI</span><span>5G_EXT</span></div>
                    <div class="dash-row"><span>FPS METER</span><span>60 hz</span></div>
                </div>
                <div class="home-shortcuts">
                    <div class="shortcut-item glass-card" id="sc-media"><div class="shortcut-icon">🎵</div><div class="shortcut-label">MEDIA HUD</div></div>
                    <div class="shortcut-item glass-card" id="sc-browser"><div class="shortcut-icon">🌐</div><div class="shortcut-label">NAVEGADOR</div></div>
                    <div class="shortcut-item glass-card" id="sc-files"><div class="shortcut-icon">📂</div><div class="shortcut-label">ARQUIVOS</div></div>
                    <div class="shortcut-item glass-card" id="sc-ai"><div class="shortcut-icon">🧠</div><div class="shortcut-label">ASSISTENTE IA</div></div>
                </div>
            </div>`;
        startLiveClock();
    } 
    else if (targetWS === "media") {
        systemViewport.innerHTML = `
            <div class="home-layout">
                <div class="media-player-container glass-card spatial-tilt-left">
                    <div class="card-header">MEDIA CONTROLS</div>
                    <div class="hud-display" style="font-size:14px; text-align:left;" id="track-name">Nenhuma mídia ativa</div>
                    <div class="slider-container-horizontal" style="margin-top:15px;">
                        <span class="step-icon">ZOOM</span>
                        <div class="hud-track"><div class="hud-bar" id="media-zoom-bar" style="width: 50%;"></div></div>
                    </div>
                    <div class="shortcut-item glass-card" id="media-trigger-upload" style="margin-top:20px; padding:15px; flex-direction:row; gap:10px;">
                        <span>📂</span><strong>CARREGAR STREAM</strong>
                    </div>
                </div>
                <div class="media-display-screen" id="cinema-projection-screen">
                    </div>
            </div>`;
        renderActiveMedia();
    }
    else if (targetWS === "browser") {
        systemViewport.innerHTML = `
            <div class="browser-container glass-card">
                <div class="browser-bar">
                    <input type="text" class="browser-input" id="browser-url-bar" value="https://www.google.com/search?igu=1">
                    <button class="dock-btn-round" id="browser-go-btn" style="width:36px; height:36px;">➔</button>
                </div>
                <div class="browser-iframe-wrapper">
                    <iframe id="spatial-iframe-node" src="https://www.google.com/search?igu=1"></iframe>
                </div>
            </div>`;
    }
    else if (targetWS === "files") {
        systemViewport.innerHTML = `
            <div class="home-layout">
                <div class="home-dashboard glass-card spatial-tilt-left" id="drop-zone-spatial">
                    <div class="card-header">GERENCIADOR OS</div>
                    <div style="border:2px dashed rgba(0,191,255,0.3); border-radius:12px; padding:30px 10px; text-align:center; font-size:12px;" id="file-zone-btn">
                        ARRASTE OU TOQUE<br>PARA PROJETAR MÍDIA
                    </div>
                </div>
                <div class="home-shortcuts" id="file-output-grid" style="grid-template-columns: repeat(3, 1fr);">
                    <div class="shortcut-item glass-card"><div class="shortcut-icon">📄</div><div class="shortcut-label">Documento.pdf</div></div>
                </div>
            </div>`;
    }
    else if (targetWS === "ai") {
        systemViewport.innerHTML = `
            <div class="ai-container glass-card">
                <div class="card-header">CORE AI ASSISTANT</div>
                <div class="ai-chat-history" id="ai-chat-wall">
                    <div class="ai-bubble system">Olá, sou o assistente espacial do MR OS. Ative os comandos de voz usando a palavra-chave ou interaja diretamente.</div>
                </div>
                <div class="ai-input-bar">
                    <div class="shortcut-item glass-card" id="toggle-mic-btn" style="padding:10px 20px; flex-direction:row; gap:10px; margin:0; width:100%;">
                        <span id="mic-icon-state">🎙️</span> <strong id="mic-label">LIGAR CAPTURA DE VOZ</strong>
                    </div>
                </div>
            </div>`;
        if (recognitionActive) updateMicUI(true);
    }
}

// Algoritmo de Relógio para o Workspace Home
function startLiveClock() {
    const clockNode = document.getElementById('live-clock');
    if (!clockNode) return;
    const update = () => {
        const d = new Date();
        if(document.getElementById('live-clock')) {
            document.getElementById('live-clock').innerText = d.toTimeString().split(' ')[0];
            setTimeout(update, 1000);
        }
    };
    update();
}

// Motor Base para Gerenciamento de Mídias nos Canais de Projeção
function renderActiveMedia() {
    const screen = document.getElementById('cinema-projection-screen');
    const trackLabel = document.getElementById('track-name');
    if (!screen || !activeFileObject) return;

    trackLabel.innerText = activeFileObject.name;
    screen.innerHTML = "";

    let node;
    if (activeFileObject.type.startsWith('video/')) {
        node = document.createElement('video');
        node.src = activeFileObject.url;
        node.autoplay = true;
        node.controls = true;
        node.loop = true;
        node.volume = currentVolume;
    } else {
        node = document.createElement('img');
        node.src = activeFileObject.url;
    }
    node.style.transform = `scale(${mediaPosition.scale})`;
    screen.appendChild(node);
}

// Interpretador de Comandos de Voz Espaciais
function processVoiceCommand(cmd) {
    const chatWall = document.getElementById('ai-chat-wall');
    if (chatWall) {
        chatWall.innerHTML += `<div class="ai-bubble user">${cmd}</div>`;
        chatWall.scrollTop = chatWall.scrollHeight;
    }

    let response = "Comando não catalogado pelo Core.";

    if (cmd.includes("abrir navegador") || cmd.includes("browser")) {
        loadWorkspace("browser");
        response = "Carregando ambiente de navegação.";
    } else if (cmd.includes("home") || cmd.includes("menu principal")) {
        loadWorkspace("home");
        response = "Retornando à central Home.";
    } else if (cmd.includes("media") || cmd.includes("tocar música")) {
        loadWorkspace("media");
        response = "Workspace Media ativo.";
    } else if (cmd.includes("aumentar volume")) {
        adjustVolume(0.15);
        response = "Volume mestre expandido.";
    } else if (cmd.includes("abrir arquivo") || cmd.includes("upload")) {
        filePicker.click();
        response = "Abrindo seletor de arquivos do sistema.";
    }

    if (chatWall) {
        setTimeout(() => {
            chatWall.innerHTML += `<div class="ai-bubble system">${response}</div>`;
            chatWall.scrollTop = chatWall.scrollHeight;
        }, 600);
    }
}

function adjustVolume(delta) {
    currentVolume = Math.min(1.0, Math.max(0.0, currentVolume + delta));
    document.getElementById('master-slider-fill').style.height = `${currentVolume * 100}%`;
    const videoNode = document.querySelector('#cinema-projection-screen video');
    if (videoNode) videoNode.volume = currentVolume;
}

function updateMicUI(active) {
    const icon = document.getElementById('mic-icon-state');
    const label = document.getElementById('mic-label');
    if (!icon || !label) return;
    if (active) {
        icon.className = "mic-status-node";
        label.innerText = "CAPTURA ATIVA... FALE AGORA";
    } else {
        icon.className = "";
        label.innerText = "LIGAR CAPTURA DE VOZ";
    }
}

// Algoritmo de Detecção de Swipe Integrado ao MediaPipe
function detectSwipe(currentX) {
    if (swipeCooldown) return;

    if (lastHandX !== null) {
        const delta = currentX - lastHandX;
        let currentIndex = workspaceOrder.indexOf(currentWorkspace);

        if (delta < -0.18) { // Deslocamento Rápido Direita -> Esquerda
            let nextIdx = (currentIndex + 1) % workspaceOrder.length;
            loadWorkspace(workspaceOrder[nextIdx]);
            activateCooldown();
        }
        else if (delta > 0.18) { // Deslocamento Rápido Esquerda -> Direita
            let prevIdx = (currentIndex - 1 + workspaceOrder.length) % workspaceOrder.length;
            loadWorkspace(workspaceOrder[prevIdx]);
            activateCooldown();
        }
    }
    lastHandX = currentX;
}

function activateCooldown() {
    swipeCooldown = true;
    lastHandX = null;
    setTimeout(() => { swipeCooldown = false; }, 1100);
}

// Mecanismo de Varredura de Colisão Geométrica Baseado em Bounds Reais
function checkDOMCollision(x, y) {
    document.querySelectorAll('.hud-hover').forEach(el => el.classList.remove('hud-hover'));
    const interactives = document.querySelectorAll('.glass-card, .dock-btn-round, .dock-btn-main, .shortcut-item, #vertical-master-slider');

    for (let el of interactives) {
        const rect = el.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            el.classList.add('hud-hover');
            return el.id || el.className;
        }
    }
    return null;
}

// Resposta Dinâmica do Frame do MediaPipe Hands
function onResults(results) {
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];

        // Esqueleto Virtual Suave
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: 'rgba(0, 191, 255, 0.25)', lineWidth: 1});
        drawLandmarks(canvasCtx, landmarks, {color: '#00BFFF', lineWidth: 0.5, radius: 1});

        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];

        // Análise de Gesto de Pinça
        const distance = Math.sqrt(Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2));
        const isPinching = distance < 0.052;

        const screenX = indexTip.x * canvasElement.width;
        const screenY = indexTip.y * canvasElement.height;

        // Executa Monitoramento de Gestos de Navegação Volumétrica (Swipe)
        detectSwipe(indexTip.x);

        let targetHit = checkDOMCollision(screenX, screenY);
        const now = Date.now();

        if (isPinching) {
            // Executores de Cliques Físicos por Mapeamento Direto de ID
            if (targetHit && (now - lastActionTime > 800)) {
                lastActionTime = now;

                if (targetHit.includes('shortcut-item') || targetHit.includes('hud-btn')) {
                    const hoveredElement = document.querySelector('.hud-hover');
                    if (hoveredElement) {
                        const targetID = hoveredElement.id;
                        if (targetID === 'sc-media') loadWorkspace('media');
                        if (targetID === 'sc-browser') loadWorkspace('browser');
                        if (targetID === 'sc-files') loadWorkspace('files');
                        if (targetID === 'sc-ai') loadWorkspace('ai');
                        
                        if (targetID === 'media-trigger-upload' || targetID === 'file-zone-btn') filePicker.click();
                        if (targetID === 'toggle-mic-btn' && voiceRecognitionNode) {
                            if (!recognitionActive) {
                                voiceRecognitionNode.start();
                                recognitionActive = true;
                            } else {
                                voiceRecognitionNode.stop();
                                recognitionActive = false;
                            }
                            updateMicUI(recognitionActive);
                        }
                    }
                }
                // Controle do Dock Base do VisionOS
                else if (targetHit === 'dock-refresh') { location.reload(); }
                else if (targetHit === 'dock-next') {
                    let idx = (workspaceOrder.indexOf(currentWorkspace) + 1) % workspaceOrder.length;
                    loadWorkspace(workspaceOrder[idx]);
                }
                else if (targetHit === 'dock-prev' || targetHit === 'dock-back') {
                    let idx = (workspaceOrder.indexOf(currentWorkspace) - 1 + workspaceOrder.length) % workspaceOrder.length;
                    loadWorkspace(workspaceOrder[idx]);
                }
                // Ajuste de Volume via Slider da Direita por Colisão Direct-Touch
                else if (targetHit === 'vertical-master-slider') {
                    adjustVolume(screenY < window.innerHeight / 2 ? 0.1 : -0.1);
                }
            }
        }
    } else {
        lastHandX = null; // Limpa rastro ao remover a mão do campo de visão
    }
}

// Ouvintes de upload e arrasto físico de mídias locais
filePicker.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    activeFileObject = { name: file.name, type: file.type, url: URL.createObjectURL(file) };
    if (currentWorkspace === 'media' || currentWorkspace === 'files') {
        loadWorkspace(currentWorkspace);
    }
});

// Inicializador da Engine do MediaPipe
const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.65, minTrackingConfidence: 0.65 });
hands.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => { await hands.send({ image: videoElement }); },
    width: 1280, height: 720, facingMode: "environment"
});

// Boot Inicializador do Sistema Operacional Espacial
window.addEventListener('resize', () => { canvasElement.width = window.innerWidth; canvasElement.height = window.innerHeight; });
canvasElement.width = window.innerWidth; canvasElement.height = window.innerHeight;

loadWorkspace("home");
camera.start();
