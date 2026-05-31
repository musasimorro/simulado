// ========== GERENCIAMENTO DE ARQUIVOS ==========

let mediaElements = [];
const filesGrid = document.getElementById('files-grid');
const fileInput = document.getElementById('file-input');

function addFileToDesktop(file) {
    const url = URL.createObjectURL(file);
    const fileCard = document.createElement('div');
    fileCard.className = 'file-card';
    fileCard.setAttribute('data-url', url);
    
    // Determinar ícone baseado no tipo
    let icon = '📄';
    if (file.type.startsWith('image/')) icon = '🖼️';
    else if (file.type.startsWith('video/')) icon = '🎬';
    else if (file.type.startsWith('audio/')) icon = '🎵';
    
    fileCard.innerHTML = `
        <span>${icon}</span>
        <div class="file-name">${file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name}</div>
    `;
    
    // Evento de clique
    fileCard.addEventListener('click', () => {
        if (file.type.startsWith('image/')) {
            window.open(url, '_blank');
        } else if (file.type.startsWith('video/')) {
            const videoWindow = window.open();
            videoWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head><title>${file.name}</title></head>
                <body style="margin:0; background:#000;">
                    <video src="${url}" controls autoplay style="width:100%;height:100vh;object-fit:contain;"></video>
                </body>
                </html>
            `);
        } else {
            alert(`Arquivo: ${file.name}\nTipo: ${file.type || 'desconhecido'}`);
        }
    });
    
    // Remover placeholder se existir
    const placeholder = filesGrid.querySelector('.empty-placeholder');
    if (placeholder && filesGrid.children.length === 1) {
        filesGrid.removeChild(placeholder);
    }
    
    filesGrid.appendChild(fileCard);
    mediaElements.push(fileCard);
}

function clearFiles() {
    mediaElements.forEach(el => {
        if (el && el.parentNode) el.remove();
    });
    mediaElements = [];
    
    // Recriar placeholder
    filesGrid.innerHTML = `
        <div class="file-card empty-placeholder">
            <span>📂</span>
            <div class="file-name">Arraste arquivos ou use o botão abaixo</div>
        </div>
    `;
}

function initFiles() {
    const uploadBtn = document.getElementById('upload-btn');
    const trashBtn = document.getElementById('trash-btn');
    
    if (uploadBtn) {
        uploadBtn.addEventListener('click', () => fileInput.click());
    }
    
    if (trashBtn) {
        trashBtn.addEventListener('click', clearFiles);
    }
    
    // Upload via input
    fileInput.addEventListener('change', (e) => {
        Array.from(e.target.files).forEach(file => addFileToDesktop(file));
        fileInput.value = '';
    });
    
    // Drag & Drop
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            files.forEach(file => addFileToDesktop(file));
            updateStatus('📁 Arquivos adicionados', 2000);
        }
    });
}
