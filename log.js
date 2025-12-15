// ============================================
// LOGGING SYSTEM
// ============================================
const log = {
    event(message, details = null) {
        const logList = document.getElementById('gameLogList');
        if (!logList) return;
        const li = document.createElement('li');
        
        // Create message span
        const messageSpan = document.createElement('span');
        messageSpan.innerHTML = utils.linkifyPlayerNumbers(message);
        li.appendChild(messageSpan);
        
        if (details) {
            // Add expand indicator
            const expandIndicator = document.createElement('span');
            expandIndicator.className = 'expand-indicator';
            expandIndicator.innerHTML = ' [+]';
            expandIndicator.style.color = 'var(--title-color)';
            expandIndicator.style.fontSize = '0.8em';
            messageSpan.appendChild(expandIndicator);
            
            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'log-expandable';
            detailsDiv.innerHTML = utils.linkifyPlayerNumbers(details);
            li.appendChild(detailsDiv);
            li.style.cursor = 'pointer';
            li.onclick = (e) => {
                // Don't toggle if clicking a player link
                if (e.target.classList.contains('player-link')) return;
                const isOpen = detailsDiv.classList.toggle('open');
                expandIndicator.innerHTML = isOpen ? ' [-]' : ' [+]';
            };
        }
        logList.prepend(li);
    },

    clear() {
        const logList = document.getElementById('gameLogList');
        if (logList) logList.innerHTML = '';
    }
};
