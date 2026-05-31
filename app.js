// =====================================================
// MR SPATIAL OS - FASE 6
// APP.JS - PARTE A
// =====================================================

// ELEMENTOS BASE

const videoElement =
document.getElementById("webcam");

const canvasElement =
document.getElementById("output_canvas");

const canvasCtx =
canvasElement.getContext("2d");

const systemViewport =
document.getElementById("workspace-viewport");

const toastIndicator =
document.getElementById("workspace-overlay-toast");

const filePicker =
document.getElementById("system-file-picker");

// =====================================================
// ESTADO GLOBAL
// =====================================================

const workspaces = {
    home:{},
    media:{},
    browser:{},
    files:{},
    ai:{},
    desktop:{}
};

const workspaceOrder = [
    "home",
    "media",
    "browser",
    "files",
    "ai",
    "desktop"
];

let currentWorkspace = "home";

let lastHandX = null;
let swipeCooldown = false;

let currentVolume = 0.5;

let activeFileObject = null;

let lastActionTime = 0;

let mediaPosition = {
    x:400,
    y:50,
    scale:1
};

// =====================================================
// VOICE ENGINE
// =====================================================

const SpeechRecognition =
window.SpeechRecognition ||
window.webkitSpeechRecognition;

let recognitionActive = false;

let voiceRecognitionNode = null;

if(SpeechRecognition){

    voiceRecognitionNode =
    new SpeechRecognition();

    voiceRecognitionNode.continuous = true;

    voiceRecognitionNode.lang = "pt-BR";

    voiceRecognitionNode.interimResults = false;

    voiceRecognitionNode.onresult = (event)=>{

        const command =
        event.results[
            event.results.length - 1
        ][0]
        .transcript
        .toLowerCase()
        .trim();

        processVoiceCommand(command);

    };

    voiceRecognitionNode.onerror = ()=>{

        recognitionActive = false;

    };

}

// =====================================================
// WORKSPACE LOADER
// =====================================================

function loadWorkspace(targetWS){

    currentWorkspace = targetWS;

    systemViewport.className = "";

    void systemViewport.offsetWidth;

    systemViewport.className =
    "workspace-animate-fade";

    toastIndicator.innerText =
    `WORKSPACE ${targetWS.toUpperCase()}`;

    toastIndicator.style.opacity = "1";

    setTimeout(()=>{

        toastIndicator.style.opacity = "0";

    },800);

    // ==========================================
    // HOME
    // ==========================================

    if(targetWS === "home"){

        systemViewport.innerHTML = `

        <div class="home-layout">

            <div class="home-dashboard glass-card spatial-tilt-left">

                <div
                    class="clock-display"
                    id="live-clock">

                    00:00:00

                </div>

                <div class="dash-row">
                    <span>SYSTEM</span>
                    <span>READY</span>
                </div>

                <div class="dash-row">
                    <span>BATTERY</span>
                    <span>98%</span>
                </div>

                <div class="dash-row">
                    <span>NETWORK</span>
                    <span>ONLINE</span>
                </div>

                <div class="dash-row">
                    <span>FPS</span>
                    <span>60</span>
                </div>

            </div>

            <div class="home-shortcuts">

                <div
                    class="shortcut-item glass-card"
                    id="sc-media">

                    <div class="shortcut-icon">
                        🎵
                    </div>

                    <div class="shortcut-label">
                        MEDIA
                    </div>

                </div>

                <div
                    class="shortcut-item glass-card"
                    id="sc-browser">

                    <div class="shortcut-icon">
                        🌐
                    </div>

                    <div class="shortcut-label">
                        BROWSER
                    </div>

                </div>

                <div
                    class="shortcut-item glass-card"
                    id="sc-files">

                    <div class="shortcut-icon">
                        📂
                    </div>

                    <div class="shortcut-label">
                        FILES
                    </div>

                </div>

                <div
                    class="shortcut-item glass-card"
                    id="sc-ai">

                    <div class="shortcut-icon">
                        🧠
                    </div>

                    <div class="shortcut-label">
                        AI
                    </div>

                </div>

                <div
                    class="shortcut-item glass-card"
                    id="sc-desktop">

                    <div class="shortcut-icon">
                        🖥️
                    </div>

                    <div class="shortcut-label">
                        DESKTOP
                    </div>

                </div>

            </div>

        </div>

        `;

        startLiveClock();

    }

    // ==========================================
    // MEDIA
    // ==========================================

    else if(targetWS === "media"){

        systemViewport.innerHTML = `

        <div class="home-layout">

            <div
                class="media-player-container glass-card spatial-tilt-left">

                <div class="card-header">
                    MEDIA CENTER
                </div>

                <div id="track-name">

                    Nenhuma mídia carregada

                </div>

                <div
                    class="shortcut-item glass-card"
                    id="media-trigger-upload">

                    📂 CARREGAR ARQUIVO

                </div>

            </div>

            <div
                class="media-display-screen"
                id="cinema-projection-screen">

            </div>

        </div>

        `;

        renderActiveMedia();

    }

    // ==========================================
    // BROWSER
    // ==========================================

    else if(targetWS === "browser"){

        systemViewport.innerHTML = `

        <div class="browser-container glass-card">

            <div class="browser-bar">

                <input
                    type="text"
                    id="browser-url-bar"
                    class="browser-input"
                    value="https://www.google.com/search?igu=1">

                <button
                    class="dock-btn-round"
                    id="browser-go-btn">

                    ➜

                </button>

            </div>

            <div class="browser-iframe-wrapper">

                <iframe
                    id="spatial-iframe-node"
                    src="https://www.google.com/search?igu=1">

                </iframe>

            </div>

        </div>

        `;
    }
    
/* ==========================================
   RENDER WORKSPACES
========================================== */

function loadWorkspace(targetWS){

    currentWorkspace = targetWS;

    systemViewport.className = "";
    void systemViewport.offsetWidth;
    systemViewport.className = "workspace-animate-fade";

    toastIndicator.innerText =
        `WORKSPACE ${targetWS.toUpperCase()}`;

    toastIndicator.style.opacity = "1";

    setTimeout(()=>{
        toastIndicator.style.opacity = "0";
    },800);

    /* ==========================
       HOME
    ========================== */

    if(targetWS === "home"){

        systemViewport.innerHTML = `

        <div class="home-layout">

            <div class="home-dashboard glass-card spatial-tilt-left">

                <div class="clock-display" id="live-clock">
                    00:00:00
                </div>

                <div class="dash-row">
                    <span>SYSTEM</span>
                    <span>READY</span>
                </div>

                <div class="dash-row">
                    <span>BATTERY</span>
                    <span>98%</span>
                </div>

                <div class="dash-row">
                    <span>NETWORK</span>
                    <span>ONLINE</span>
                </div>

                <div class="dash-row">
                    <span>FPS</span>
                    <span>60</span>
                </div>

            </div>

            <div class="home-shortcuts">

                <div class="shortcut-item glass-card" id="sc-desktop">
                    <div class="shortcut-icon">🖥️</div>
                    <div class="shortcut-label">DESKTOP</div>
                </div>

                <div class="shortcut-item glass-card" id="sc-media">
                    <div class="shortcut-icon">🎵</div>
                    <div class="shortcut-label">MEDIA</div>
                </div>

                <div class="shortcut-item glass-card" id="sc-browser">
                    <div class="shortcut-icon">🌐</div>
                    <div class="shortcut-label">BROWSER</div>
                </div>

                <div class="shortcut-item glass-card" id="sc-files">
                    <div class="shortcut-icon">📂</div>
                    <div class="shortcut-label">FILES</div>
                </div>

                <div class="shortcut-item glass-card" id="sc-ai">
                    <div class="shortcut-icon">🧠</div>
                    <div class="shortcut-label">AI</div>
                </div>

            </div>

        </div>
        `;

        startLiveClock();
    }

    /* ==========================
       DESKTOP
    ========================== */

    else if(targetWS === "desktop"){

        systemViewport.innerHTML = `

        <div class="desktop-workspace">

            <div class="desktop-grid">

                <div class="desktop-icon glass-card" id="desktop-media">
                    🎵
                    <span>Media</span>
                </div>

                <div class="desktop-icon glass-card" id="desktop-browser">
                    🌐
                    <span>Browser</span>
                </div>

                <div class="desktop-icon glass-card" id="desktop-files">
                    📂
                    <span>Files</span>
                </div>

                <div class="desktop-icon glass-card" id="desktop-ai">
                    🧠
                    <span>AI</span>
                </div>

            </div>

        </div>
        `;
    }

    /* ==========================
       MEDIA
    ========================== */

    else if(targetWS === "media"){

        systemViewport.innerHTML = `

        <div class="home-layout">

            <div class="media-player-container glass-card">

                <h3>MEDIA CENTER</h3>

                <div id="track-name">
                    Nenhuma mídia carregada
                </div>

                <button
                    class="shortcut-item glass-card"
                    id="media-trigger-upload">

                    📂 CARREGAR MÍDIA

                </button>

            </div>

            <div
                class="media-display-screen"
                id="cinema-projection-screen">
            </div>

        </div>
        `;

        renderActiveMedia();
    }

    /* ==========================
       BROWSER
    ========================== */

    else if(targetWS === "browser"){

        systemViewport.innerHTML = `

        <div class="browser-container glass-card">

            <div class="browser-bar">

                <input
                    id="browser-url-bar"
                    class="browser-input"
                    value="https://www.google.com/search?igu=1">

                <button
                    class="dock-btn-round"
                    id="browser-go-btn">

                    ➜

                </button>

            </div>

            <div class="browser-iframe-wrapper">

                <iframe
                    id="spatial-iframe-node"
                    src="https://www.google.com/search?igu=1">
                </iframe>

            </div>

        </div>
        `;

        setTimeout(()=>{

            const goBtn =
                document.getElementById("browser-go-btn");

            const input =
                document.getElementById("browser-url-bar");

            const iframe =
                document.getElementById("spatial-iframe-node");

            if(goBtn){

                goBtn.onclick = ()=>{

                    let url = input.value.trim();

                    if(!url.startsWith("http")){
                        url = "https://" + url;
                    }

                    iframe.src = url;
                };
            }

        },100);
    }

    /* ==========================
       FILES
    ========================== */

    else if(targetWS === "files"){

        systemViewport.innerHTML = `

        <div class="files-workspace">

            <div
                class="glass-card file-upload-zone"
                id="file-zone-btn">

                📂 TOQUE PARA CARREGAR

            </div>

            <div
                class="file-list-area"
                id="file-output-grid">

            </div>

        </div>
        `;
    }

    /* ==========================
       AI
    ========================== */

    else if(targetWS === "ai"){

        systemViewport.innerHTML = `

        <div class="ai-container glass-card">

            <div
                class="ai-chat-history"
                id="ai-chat-wall">

                <div class="ai-bubble system">

                    Sistema IA online.

                </div>

            </div>

            <div class="ai-input-bar">

                <button
                    id="toggle-mic-btn"
                    class="shortcut-item glass-card">

                    <span id="mic-icon-state">🎙️</span>

                    <span id="mic-label">
                        LIGAR VOZ
                    </span>

                </button>

            </div>

        </div>
        `;

        updateMicUI(recognitionActive);
    }

    registerWorkspaceEvents();
        }
    /* ==========================================
   RELÓGIO
========================================== */

function startLiveClock(){

    const clock =
        document.getElementById("live-clock");

    if(!clock) return;

    function update(){

        const now = new Date();

        clock.innerText =
            now.toLocaleTimeString("pt-BR");

        if(document.getElementById("live-clock")){
            setTimeout(update,1000);
        }
    }

    update();
}

/* ==========================================
   MEDIA RENDER
========================================== */

function renderActiveMedia(){

    const screen =
        document.getElementById(
            "cinema-projection-screen"
        );

    const track =
        document.getElementById("track-name");

    if(!screen) return;

    screen.innerHTML = "";

    if(!activeFileObject){

        screen.innerHTML = `
            <div class="empty-media">
                Nenhuma mídia carregada
            </div>
        `;

        return;
    }

    track.innerText =
        activeFileObject.name;

    let node;

    if(
        activeFileObject.type.startsWith("video/")
    ){

        node =
            document.createElement("video");

        node.src =
            activeFileObject.url;

        node.controls = true;
        node.autoplay = true;
        node.loop = true;
        node.volume = currentVolume;

    }else if(
        activeFileObject.type.startsWith("image/")
    ){

        node =
            document.createElement("img");

        node.src =
            activeFileObject.url;

    }else{

        node =
            document.createElement("iframe");

        node.src =
            activeFileObject.url;
    }

    node.style.maxWidth = "100%";
    node.style.maxHeight = "100%";

    screen.appendChild(node);
}

/* ==========================================
   MICROFONE UI
========================================== */

function updateMicUI(active){

    const icon =
        document.getElementById(
            "mic-icon-state"
        );

    const label =
        document.getElementById(
            "mic-label"
        );

    if(!icon || !label) return;

    if(active){

        icon.innerText = "🔴";

        label.innerText =
            "CAPTURA ATIVA";

    }else{

        icon.innerText = "🎙️";

        label.innerText =
            "LIGAR VOZ";
    }
}

/* ==========================================
   COMANDOS DE VOZ
========================================== */

function processVoiceCommand(cmd){

    const wall =
        document.getElementById(
            "ai-chat-wall"
        );

    if(wall){

        wall.innerHTML += `
        <div class="ai-bubble user">
            ${cmd}
        </div>
        `;
    }

    let response =
        "Comando não reconhecido.";

    if(cmd.includes("desktop")){

        loadWorkspace("desktop");
        response = "Abrindo desktop.";

    }

    else if(cmd.includes("home")){

        loadWorkspace("home");
        response = "Voltando para home.";

    }

    else if(cmd.includes("media")){

        loadWorkspace("media");
        response = "Abrindo media.";

    }

    else if(cmd.includes("browser")){

        loadWorkspace("browser");
        response = "Abrindo navegador.";

    }

    else if(cmd.includes("arquivo")){

        loadWorkspace("files");
        response = "Abrindo arquivos.";

    }

    else if(cmd.includes("inteligência")
        || cmd.includes("assistente")
        || cmd.includes("ia")){

        loadWorkspace("ai");
        response = "Abrindo IA.";

    }

    else if(cmd.includes("volume")){

        adjustVolume(0.1);
        response = "Volume aumentado.";
    }

    if(wall){

        wall.innerHTML += `
        <div class="ai-bubble system">
            ${response}
        </div>
        `;

        wall.scrollTop =
            wall.scrollHeight;
    }
}

/* ==========================================
   REGISTRAR EVENTOS
========================================== */

function registerWorkspaceEvents(){

    const mediaBtn =
        document.getElementById("sc-media");

    if(mediaBtn)
        mediaBtn.onclick =
            ()=>loadWorkspace("media");

    const browserBtn =
        document.getElementById("sc-browser");

    if(browserBtn)
        browserBtn.onclick =
            ()=>loadWorkspace("browser");

    const filesBtn =
        document.getElementById("sc-files");

    if(filesBtn)
        filesBtn.onclick =
            ()=>loadWorkspace("files");

    const aiBtn =
        document.getElementById("sc-ai");

    if(aiBtn)
        aiBtn.onclick =
            ()=>loadWorkspace("ai");

    const desktopBtn =
        document.getElementById("sc-desktop");

    if(desktopBtn)
        desktopBtn.onclick =
            ()=>loadWorkspace("desktop");

    const uploadBtn =
        document.getElementById(
            "media-trigger-upload"
        );

    if(uploadBtn)
        uploadBtn.onclick =
            ()=>filePicker.click();

    const fileZone =
        document.getElementById(
            "file-zone-btn"
        );

    if(fileZone)
        fileZone.onclick =
            ()=>filePicker.click();

    const micBtn =
        document.getElementById(
            "toggle-mic-btn"
        );

    if(micBtn){

        micBtn.onclick = ()=>{

            if(!voiceRecognitionNode)
                return;

            if(!recognitionActive){

                voiceRecognitionNode.start();

                recognitionActive = true;

            }else{

                voiceRecognitionNode.stop();

                recognitionActive = false;
            }

            updateMicUI(
                recognitionActive
            );
        };
    }

    const dMedia =
        document.getElementById(
            "desktop-media"
        );

    if(dMedia)
        dMedia.onclick =
            ()=>loadWorkspace("media");

    const dBrowser =
        document.getElementById(
            "desktop-browser"
        );

    if(dBrowser)
        dBrowser.onclick =
            ()=>loadWorkspace("browser");

    const dFiles =
        document.getElementById(
            "desktop-files"
        );

    if(dFiles)
        dFiles.onclick =
            ()=>loadWorkspace("files");

    const dAI =
        document.getElementById(
            "desktop-ai"
        );

    if(dAI)
        dAI.onclick =
            ()=>loadWorkspace("ai");
}

/* ==========================================
   UPLOAD DE ARQUIVOS
========================================== */

filePicker.addEventListener(
    "change",
    (e)=>{

        const file =
            e.target.files[0];

        if(!file) return;

        activeFileObject = {

            name: file.name,
            type: file.type,
            url: URL.createObjectURL(file)
        };

        loadWorkspace("media");
    }
);
    /* ==========================================
   VOLUME
========================================== */

function adjustVolume(delta){

    currentVolume += delta;

    if(currentVolume > 1)
        currentVolume = 1;

    if(currentVolume < 0)
        currentVolume = 0;

    const fill =
        document.getElementById(
            "master-slider-fill"
        );

    if(fill){

        fill.style.height =
            (currentVolume * 100) + "%";
    }

    const video =
        document.querySelector(
            "#cinema-projection-screen video"
        );

    if(video){

        video.volume =
            currentVolume;
    }
}

/* ==========================================
   SWIPE
========================================== */

function activateCooldown(){

    swipeCooldown = true;

    lastHandX = null;

    setTimeout(()=>{

        swipeCooldown = false;

    },1000);
}

function detectSwipe(currentX){

    if(swipeCooldown) return;

    if(lastHandX !== null){

        const delta =
            currentX - lastHandX;

        const currentIndex =
            workspaceOrder.indexOf(
                currentWorkspace
            );

        if(delta < -0.18){

            const nextIndex =
                (currentIndex + 1)
                % workspaceOrder.length;

            loadWorkspace(
                workspaceOrder[nextIndex]
            );

            activateCooldown();
        }

        if(delta > 0.18){

            const prevIndex =
                (
                    currentIndex - 1
                    + workspaceOrder.length
                )
                %
                workspaceOrder.length;

            loadWorkspace(
                workspaceOrder[prevIndex]
            );

            activateCooldown();
        }
    }

    lastHandX = currentX;
}

/* ==========================================
   COLLISION
========================================== */

function checkDOMCollision(x,y){

    document
        .querySelectorAll(".hud-hover")
        .forEach(el=>{

            el.classList.remove(
                "hud-hover"
            );
        });

    const nodes =
        document.querySelectorAll(
            ".glass-card,.dock-btn-round,.dock-btn-main,.shortcut-item,#vertical-master-slider"
        );

    for(let el of nodes){

        const rect =
            el.getBoundingClientRect();

        if(
            x >= rect.left &&
            x <= rect.right &&
            y >= rect.top &&
            y <= rect.bottom
        ){

            el.classList.add(
                "hud-hover"
            );

            return el.id;
        }
    }

    return null;
}

/* ==========================================
   MEDIAPIPE
========================================== */

let lastActionTime = 0;

function onResults(results){

    canvasCtx.save();

    canvasCtx.clearRect(
        0,
        0,
        canvasElement.width,
        canvasElement.height
    );

    canvasCtx.drawImage(
        results.image,
        0,
        0,
        canvasElement.width,
        canvasElement.height
    );

    if(
        results.multiHandLandmarks &&
        results.multiHandLandmarks.length
    ){

        const hand =
            results.multiHandLandmarks[0];

        drawConnectors(
            canvasCtx,
            hand,
            HAND_CONNECTIONS,
            {
                color:"#00BFFF",
                lineWidth:1
            }
        );

        drawLandmarks(
            canvasCtx,
            hand,
            {
                color:"#FFFFFF",
                radius:2
            }
        );

        const thumb =
            hand[4];

        const index =
            hand[8];

        const distance =
            Math.sqrt(
                Math.pow(
                    thumb.x-index.x,
                    2
                )
                +
                Math.pow(
                    thumb.y-index.y,
                    2
                )
            );

        const isPinching =
            distance < 0.05;

        const x =
            index.x
            *
            canvasElement.width;

        const y =
            index.y
            *
            canvasElement.height;

        detectSwipe(index.x);

        const target =
            checkDOMCollision(
                x,
                y
            );

        const now =
            Date.now();

        if(
            isPinching &&
            target &&
            now-lastActionTime > 800
        ){

            lastActionTime = now;

            const hovered =
                document.querySelector(
                    ".hud-hover"
                );

            if(hovered){

                hovered.click();
            }
        }
    }

    canvasCtx.restore();
}

/* ==========================================
   DOCK
========================================== */

document
.getElementById("dock-next")
?.addEventListener("click",()=>{

    const current =
        workspaceOrder.indexOf(
            currentWorkspace
        );

    const next =
        (current+1)
        %
        workspaceOrder.length;

    loadWorkspace(
        workspaceOrder[next]
    );
});

document
.getElementById("dock-prev")
?.addEventListener("click",()=>{

    const current =
        workspaceOrder.indexOf(
            currentWorkspace
        );

    const prev =
        (
            current-1
            + workspaceOrder.length
        )
        %
        workspaceOrder.length;

    loadWorkspace(
        workspaceOrder[prev]
    );
});

document
.getElementById("dock-back")
?.addEventListener("click",()=>{

    loadWorkspace("home");
});

document
.getElementById("dock-refresh")
?.addEventListener("click",()=>{

    location.reload();
});

document
.getElementById("dock-center-action")
?.addEventListener("click",()=>{

    filePicker.click();
});

/* ==========================================
   RESIZE
========================================== */

window.addEventListener(
    "resize",
    ()=>{

        canvasElement.width =
            window.innerWidth;

        canvasElement.height =
            window.innerHeight;
    }
);

canvasElement.width =
    window.innerWidth;

canvasElement.height =
    window.innerHeight;

/* ==========================================
   MEDIAPIPE START
========================================== */

const hands = new Hands({

    locateFile:(file)=>
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({

    maxNumHands:1,

    modelComplexity:1,

    minDetectionConfidence:0.65,

    minTrackingConfidence:0.65
});

hands.onResults(onResults);

const camera =
new Camera(videoElement,{

    onFrame:async()=>{

        await hands.send({
            image:videoElement
        });
    },

    width:1280,
    height:720
});

/* ==========================================
   BOOT
========================================== */

loadWorkspace("home");

camera.start();
