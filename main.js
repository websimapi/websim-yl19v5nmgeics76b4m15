// ============================================
// INITIALIZATION
// ============================================
document.addEventListener("DOMContentLoaded", () => {
    // Initialize achievements
    achievements.init();

    // Initialize background music
    bgm.init();

    // Set default theme
    ui.setTheme(appState.currentTheme);

    // Initialize lobby talk if available
    if (typeof lobbyTalk !== 'undefined' && lobbyTalk.init) {
        lobbyTalk.init();
    }

    // Startup animation sequence
    const overlay = document.getElementById('startupOverlay');
    const titleContainer = document.querySelector('.title-container');
    const gridContainer = document.getElementById('grid-viewport-container');
    const topBar = document.querySelector('.top-bar');
    const advancedPanel = document.getElementById('advanced-settings-panel');
    const controls = document.querySelectorAll('.controls');
    const instructionsPanel = document.getElementById('instructions-panel');
    const controlPanelWrapper = document.querySelector('.control-panel-wrapper');

    // Fade out overlay
    setTimeout(() => {
        if (overlay) overlay.classList.add('hidden');
    }, 100);

    // Animate title
    setTimeout(() => {
        if (titleContainer) titleContainer.classList.add('animate-in-title');
    }, 200);

    // Animate grid
    setTimeout(() => {
        if (gridContainer) gridContainer.classList.add('animate-in-grid');
    }, 400);

    // Animate rest of UI
    setTimeout(() => {
        if (topBar) topBar.classList.add('animate-in-rest');
        if (advancedPanel) advancedPanel.classList.add('animate-in-rest');
        controls.forEach(c => c.classList.add('animate-in-rest'));
        if (instructionsPanel) instructionsPanel.classList.add('animate-in-rest');
        if (controlPanelWrapper) controlPanelWrapper.classList.add('animate-in-rest');
    }, 600);

    // Remove overlay from DOM after animation
    setTimeout(() => {
        if (overlay) overlay.remove();
    }, 1500);

    // Add click sound to all buttons
    document.querySelectorAll('button').forEach(btn => {
        const original = btn.onclick;
        if (original) {
            btn.onclick = function(e) {
                sound.playPresetClick();
                return original.call(this, e);
            };
        }
    });

    console.log('Squid Game Simulator initialized');
});
