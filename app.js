// ========== APLICAÇÃO PRINCIPAL ==========
// Inicialização da Pesquisa por Voz

function initVoiceSearch() {
    const voiceBtn = document.getElementById('voice-btn');
    const searchInput = document.getElementById('search-input');
    const searchIframe = document.getElementById('search-iframe');
    const searchResult = document.getElementById('search-result');
    
    let recognition = null;
    
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.continuous = false;
        recognition.interimResults = false;
        
        recognition.onresult = (event) => {
            const query = event.results[0][0].transcript;
            if (searchResult) searchResult.textContent = `🔍 "${query}"`;
            if (searchInput) searchInput.value = query;
            if (searchIframe) {
                searchIframe.src = `https://www.google.com/search?q=${encodeURIComponent(query)}&igu=1`;
            }
        };
        
        recognition.onerror = () => {
            if (searchResult) searchResult.textContent = '🎤 Não entendi. Tente novamente.';
        };
    }
    
    if (voiceBtn) {
        voiceBtn.addEventListener('click', () => {
            if (recognition) {
                if (searchResult) searchResult.textContent = '🎤 Ouvindo...';
                recognition.start();
            } else {
                if (searchResult) searchResult.textContent = '❌ Reconhecimento de voz não suportado';
            }
        });
    }
    
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && searchIframe) {
                searchIframe.src = `https://www.google.com/search?q=${encodeURIComponent(searchInput.value)}&igu=1`;
            }
        });
    }
}

// Inicialização da aplicação
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Inicializando Vision HUD...');
    
    // Inicializar módulos
    initDesktop();
    initFiles();
    initCamera();
    initVoiceSearch();
    
    // Redimensionar canvas inicialmente
    const handCanvas = document.getElementById('hand-canvas');
    if (handCanvas) {
        handCanvas.width = window.innerWidth;
        handCanvas.height = window.innerHeight;
    }
    
    console.log('✅ HUD Inicializado com sucesso!');
    console.log('📱 Gestos disponíveis:');
    console.log('   👆 Dedo indicador = Clique (segure 0.5s)');
    console.log('   ✌️ Pinça com duas mãos = Zoom');
    console.log('   🤚 Deslizar mão = Trocar área de trabalho');
});
