// ============================================
// APPLICATION STATE MANAGEMENT
// ============================================
// Centralized state object that holds all game data.

let lobbyChatHistory = [];

const appState = {
    // Core game state
    players: [],
    round: 0,
    currentGameNumber: 0,
    originalRosterSize: 0,
    currentPrizePot: 0,
    firstEliminationOfGame: false,
    
    // AI photo generation progress
    photoGenerationOffset: 0,
    autoPhotoGenerationEnabled: false,
    photoAutoIntervalId: null,
    cancelPhotoGeneration: false,

    // UI state
    eliminatedHidden: false,
    isCompactedView: false,
    showGroups: false,
    season2ModeActive: false,
    showVoteColors: false,
    isViewingHistory: false,
    isViewingArchivedGame: false,
    currentTheme: 'light',

    // Collections
    personalityPlayers: new Set(),
    superpoweredPlayerIds: new Set(),
    usedEasterEggIds: new Set(),
    favoritedPlayerIds: new Set(),
    eliminationOrder: [],
    gameHistorySnapshots: [],
    usedEvents: new Set(),
    customGames: [],
    allGamesHistory: [],

    // Voting
    votingRoundCount: 0,

    // VIP & Betting
    bettingBalance: 1000000,
    isGameModified: false,
    currentBets: [],
    isPlayer001VIP: false,
    player001VIP_Id: null,

    // Photos & achievements
    customPlayerPhotos: {},
    achievements: {},

    // Advanced features
    forcedWinnerId: null,
    livePlayersState: null,
    liveGameStateBackup: null,

    // Save/load
    saveGame() {
        if (this.isViewingArchivedGame) {
            alert("Cannot save while viewing an archived game.");
            return;
        }
        try {
            const saveData = this.createSaveObject();
            const dataStr = JSON.stringify(saveData);
            const dataBlob = new Blob([dataStr], {type: "application/json"});
            const url = URL.createObjectURL(dataBlob);
            const a = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
            a.href = url;
            a.download = `squid-game-save-${timestamp}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            log.event("Game state saved successfully.");
        } catch (error) {
            console.error("Error saving game:", error);
            alert("Could not save game state.");
        }
    },

    loadGame(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const loadedData = JSON.parse(e.target.result);
                this.restoreGameState(loadedData);
                alert("Game state loaded successfully.");
            } catch (error) {
                alert("Failed to load game state.");
                console.error(error);
            }
            event.target.value = '';
        };
        reader.readAsText(file);
    },

    createSaveObject() {
        return {
            customPlayerPhotos: this.customPlayerPhotos,
            players: this.players,
            round: this.round,
            currentGameNumber: this.currentGameNumber,
            currentPrizePot: this.currentPrizePot,
            firstEliminationOfGame: this.firstEliminationOfGame,
            personalityPlayers: Array.from(this.personalityPlayers),
            superpoweredPlayerIds: Array.from(this.superpoweredPlayerIds),
            usedEasterEggIds: Array.from(this.usedEasterEggIds),
            favoritedPlayerIds: Array.from(this.favoritedPlayerIds),
            currentTheme: this.currentTheme,
            eliminatedHidden: this.eliminatedHidden,
            showGroups: this.showGroups,
            season2ModeActive: this.season2ModeActive,
            showVoteColors: this.showVoteColors,
            votingRoundCount: this.votingRoundCount,
            eliminationOrder: this.eliminationOrder,
            gameHistorySnapshots: this.gameHistorySnapshots,
            bettingBalance: this.bettingBalance,
            isGameModified: this.isGameModified,
            currentBets: this.currentBets,
            usedEvents: Array.from(this.usedEvents),
            customGames: this.customGames,
            isPlayer001VIP: this.isPlayer001VIP,
            player001VIP_Id: this.player001VIP_Id,
            achievements: this.achievements,
            allGamesHistory: this.allGamesHistory,
            forcedWinnerId: this.forcedWinnerId,
            lobbyChatHistory: lobbyChatHistory,
        };
    },

    restoreGameState(data, showAlert = true) {
        this.players = data.players || [];
        this.round = data.round || 0;
        this.customPlayerPhotos = data.customPlayerPhotos || {};
        this.personalityPlayers = new Set(data.personalityPlayers || []);
        this.superpoweredPlayerIds = new Set(data.superpoweredPlayerIds || []);
        this.eliminatedHidden = data.eliminatedHidden || false;
        this.season2ModeActive = data.season2ModeActive || false;
        this.showVoteColors = data.showVoteColors || false;
        this.votingRoundCount = data.votingRoundCount || 0;
        this.showGroups = data.showGroups || false;
        this.firstEliminationOfGame = data.firstEliminationOfGame === undefined ? true : data.firstEliminationOfGame;
        this.favoritedPlayerIds = new Set(data.favoritedPlayerIds || []);
        this.eliminationOrder = data.eliminationOrder || [];
        this.gameHistorySnapshots = data.gameHistorySnapshots || [];
        this.usedEvents = new Set(data.usedEvents || []);
        this.customGames = data.customGames || [];
        this.currentPrizePot = data.currentPrizePot || 0;
        this.isGameModified = data.isGameModified || false;
        this.currentBets = data.currentBets || [];
        this.isPlayer001VIP = data.isPlayer001VIP || false;
        this.player001VIP_Id = data.player001VIP_Id || null;
        this.currentGameNumber = data.currentGameNumber || 0;
        this.bettingBalance = data.bettingBalance !== undefined ? data.bettingBalance : 1000000;
        this.achievements = data.achievements || {};
        this.allGamesHistory = data.allGamesHistory || [];
        this.forcedWinnerId = data.forcedWinnerId || null;
        this.currentTheme = data.currentTheme || 'light';
        lobbyChatHistory = data.lobbyChatHistory || [];
        this.players.forEach(p => p.isFavorite = this.favoritedPlayerIds.has(p.id));
        this.isViewingHistory = false;
        this.livePlayersState = null;
        if (showAlert) {
            ui.updateAllUI();
            if (typeof lobbyTalk !== 'undefined') {
                lobbyTalk.refreshPreviousGameOptions();
                lobbyTalk.render();
            }
        }
    },

    handleHistorySlide(value) {
        if (!this.isViewingHistory) {
            this.isViewingHistory = true;
            if (!this.isViewingArchivedGame && !this.livePlayersState) {
                this.livePlayersState = JSON.parse(JSON.stringify(this.players));
            }
        }

        const snapshot = this.gameHistorySnapshots[value];
        if (!snapshot) return;

        const snapshotPlayers = snapshot.players;
        const playersRemainingInSnapshot = snapshotPlayers.filter(p => !p.eliminated && !p.votedOut).length;

        this.players = JSON.parse(JSON.stringify(snapshotPlayers));
        document.getElementById('historySliderLabel').innerText = `Round ${snapshot.round}: ${snapshot.name} (${playersRemainingInSnapshot} remaining)`;

        ui.updateAllPlayerDivs();
        ui.updateAllCustomLists();
    },

    returnToLive() {
        if (!this.isViewingHistory) return;

        this.isViewingHistory = false;
        if (!this.isViewingArchivedGame) {
            this.players = JSON.parse(JSON.stringify(this.livePlayersState));
            this.livePlayersState = null;
        } else {
            const lastSnapshot = this.gameHistorySnapshots[this.gameHistorySnapshots.length - 1];
            if (lastSnapshot) this.players = JSON.parse(JSON.stringify(lastSnapshot.players));
        }

        const slider = document.getElementById('historySlider');
        slider.value = slider.max;
        document.getElementById('historySliderLabel').innerText = `Live (${utils.getActivePlayers().length} remaining)`;

        ui.updateAllPlayerDivs();
        ui.updateAllCustomLists();
    },

    returnToLiveGame() {
        if (!this.isViewingArchivedGame || !this.liveGameStateBackup) return;
        this.restoreGameState(this.liveGameStateBackup, false);
        this.liveGameStateBackup = null;
        this.isViewingArchivedGame = false;
        this.isViewingHistory = false;
        document.getElementById('archive-view-banner').style.display = 'none';
        document.querySelectorAll('button, input, select').forEach(el => { el.disabled = false; });
        ui.updateAllUI();
    },

    setGameAsModified() {
        if (!this.isGameModified) {
            this.isGameModified = true;
            if (typeof ui !== 'undefined' && ui.updateVipTab) {
                ui.updateVipTab();
            }
        }
    },

    startGame(isAdvancedGame = false) {
        if (this.isViewingArchivedGame) return;
        if (isAdvancedGame) this.setGameAsModified();
        
        sound.play('start');
        if (typeof bgm !== 'undefined' && bgm.playConcertoOnGameStart) bgm.playConcertoOnGameStart();
        
        this.currentGameNumber++;
        this.photoGenerationOffset = 0;
        this.autoPhotoGenerationEnabled = false;
        if (this.photoAutoIntervalId) {
            clearInterval(this.photoAutoIntervalId);
            this.photoAutoIntervalId = null;
        }
        this.isPlayer001VIP = false;
        this.player001VIP_Id = null;
        this.currentPrizePot = 0;
        this.firstEliminationOfGame = true;
        this.usedEasterEggIds.clear();
        this.forcedWinnerId = null;
        this.customPlayerPhotos = {};
        this.favoritedPlayerIds.clear();
        this.eliminationOrder = [];
        this.gameHistorySnapshots = [];
        this.isViewingHistory = false;
        this.livePlayersState = null;
        this.usedEvents.clear();
        this.players.forEach(p => { p.hasVipBet = false; });
        this.currentBets = [];

        achievements.unlock('newGame');

        let numPlayersInput;
        if (isAdvancedGame) {
            const advFemaleRaw = document.getElementById('advFemaleCount')?.value || '';
            const advMaleRaw = document.getElementById('advMaleCount')?.value || '';
            const advFemale = advFemaleRaw !== '' && !isNaN(advFemaleRaw) ? parseInt(advFemaleRaw, 10) : 0;
            const advMale = advMaleRaw !== '' && !isNaN(advMaleRaw) ? parseInt(advMaleRaw, 10) : 0;
            const advTotal = advFemale + advMale;
            numPlayersInput = advTotal > 0 ? advTotal : parseInt(document.getElementById('numPlayers').value, 10);
        } else {
            numPlayersInput = parseInt(document.getElementById('numPlayers').value, 10);
        }

        if (isNaN(numPlayersInput) || numPlayersInput < 2) {
            alert("Need at least 2 players.");
            return;
        }

        if (numPlayersInput >= 456 && !isAdvancedGame) achievements.unlock('fullHouse');
        if (numPlayersInput >= 1000) achievements.unlock('megaGame');

        this.players = [];
        this.round = 0;
        this.personalityPlayers.clear();
        this.superpoweredPlayerIds.clear();
        this.eliminatedHidden = false;
        this.votingRoundCount = 0;

        const toggleBtn = document.getElementById('toggleEliminatedBtn');
        if (toggleBtn) toggleBtn.innerText = 'Hide Eliminated/Out';
        const pausePlayBtn = document.getElementById('pausePlayButton');
        if (pausePlayBtn) { pausePlayBtn.innerText = 'Pause Animation'; pausePlayBtn.disabled = true; }

        if (gameEngine.animationTimeoutId) clearTimeout(gameEngine.animationTimeoutId);
        gameEngine.animationTimeoutId = null;

        const playersContainer = document.getElementById('players');
        if (playersContainer) playersContainer.innerHTML = '';

        const genderPool = utils.createGenderPool(numPlayersInput, isAdvancedGame);
        for (let i = 1; i <= numPlayersInput; i++) {
            let player;
            const eggDef = !isAdvancedGame && typeof easterEggPlayersData !== 'undefined' ? easterEggPlayersData[i] : null;
            const canSpawnEgg = !isAdvancedGame && !!eggDef && !this.usedEasterEggIds.has(i);

            if (canSpawnEgg && Math.random() < 0.05) {
                let resolved = eggDef;
                if (typeof eggDef.resolver === 'function') resolved = eggDef.resolver();
                const baseGender = resolved.personality?.gender || (genderPool.pop() || 'Male');
                const base = utils.createPlayer(i, baseGender, isAdvancedGame);
                const p = { ...base, isEasterEgg: true, protection: 1 };

                if (resolved.personality) {
                    if (typeof resolved.personality.age === "number") p.age = resolved.personality.age;
                    if (resolved.personality.gender) p.gender = resolved.personality.gender;
                    if (resolved.personality.country) p.country = resolved.personality.country;
                    if (resolved.personality.occupation) p.occupation = resolved.personality.occupation;
                    if (typeof resolved.personality.debt === "number") p.debt = resolved.personality.debt;
                }
                if (resolved.name) p.name = resolved.name;
                if (resolved.stats) {
                    p.baseStats = { ...p.baseStats, ...resolved.stats };
                }
                if (resolved.photoURL) {
                    this.customPlayerPhotos[p.id] = resolved.photoURL;
                    p.photoAlbum = p.photoAlbum || [];
                    if (!p.photoAlbum.includes(resolved.photoURL)) p.photoAlbum.push(resolved.photoURL);
                }
                this.usedEasterEggIds.add(i);
                player = p;
            } else {
                const gender = genderPool.pop() || 'Male';
                player = utils.createPlayer(i, gender, isAdvancedGame);
            }
            this.players.push(player);
        }

        this.originalRosterSize = numPlayersInput;
        this.isCompactedView = false;

        if (Math.random() < 1/13 && !isAdvancedGame && typeof playerMgmt !== 'undefined') {
            playerMgmt.handlePregnancy();
        }
        if (typeof relationships !== 'undefined') relationships.establishRelations();
        if (this.allGamesHistory.length > 0 && Math.random() < 0.05 && !isAdvancedGame && typeof playerMgmt !== 'undefined') {
            playerMgmt.tryAddPreviousWinner();
        }

        ui.calculateGridPositions(this.players);
        const gameLogList = document.getElementById('gameLogList');
        if (gameLogList) gameLogList.innerHTML = '';

        ui.resetZoom();
        ui.isSpawning = true;
        ui.updateAllPlayerDivs();
        if (typeof playerMgmt !== 'undefined') playerMgmt.updateSuperpowerList();
        ui.updateCounters();
        ui.displayWinnerHistory();
        ui.updateEliminationOrderList();

        gameEngine.takeSnapshot(0, "Game Start");
        ui.updateHistorySliderUI();
        const historySliderContainer = document.getElementById('history-slider-container');
        if (historySliderContainer) historySliderContainer.style.display = 'block';
        const historySliderLabel = document.getElementById('historySliderLabel');
        if (historySliderLabel) historySliderLabel.innerText = `Live (${this.players.length} remaining)`;

        if (isAdvancedGame) utils.clearAdvancedSettings();
        ui.updateEventButtons();
        ui.setTheme(this.currentTheme);

        if (typeof ui.animateNewGameSpawn === 'function') {
            ui.animateNewGameSpawn(this.players.length);
        } else {
            ui.isSpawning = false;
        }
    },
};
