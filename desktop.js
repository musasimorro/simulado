// ========== GERENCIAMENTO DE ÁREAS DE TRABALHO ==========

let currentDesktop = 0;
const desktopContainer = document.getElementById('desktop-container');

function switchDesktop(index) {
    if (index < 0) index = 0;
    if (index > 2) index = 2;
    currentDesktop = index;
    desktopContainer.style.transform = `translateX(-${currentDesktop * 100}%)`;
    
    // Atualizar indicadores
    document.querySelectorAll('.indicator-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === currentDesktop);
    });
    document.querySelectorAll('.menu-item').forEach((item, i) => {
        item.classList.toggle('active', i === currentDesktop);
    });
}

function initDesktop() {
    // Eventos dos botões do menu
    document.querySelectorAll('.menu-item').forEach((item, index) => {
        item.addEventListener('click', () => switchDesktop(index));
    });
    
    // Atualizar relógio
    function updateClock() {
        const now = new Date();
        const clockElement = document.getElementById('clock');
        const dateElement = document.getElementById('date');
        
        if (clockElement) {
            clockElement.textContent = now.toLocaleTimeString('pt-BR');
        }
        if (dateElement) {
            dateElement.textContent = now.toLocaleDateString('pt-BR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        }
    }
    
    updateClock();
    setInterval(updateClock, 1000);
}
