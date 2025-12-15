// ============================================
// UI MANAGEMENT
// ============================================
const ui = {
    scale: 1,
    currentPlayerInCardId: null,
    currentPlayerPhotoVariant: 'auto',
    currentCardPhotoIndex: 0,
    isSpawning: false,

    updateAllPlayerDivs() {
        // Normalize any newly eliminated players (prize pot, ally cleanup, logs)
        utils.processNewEliminations();

        const container = document.getElementById('players');
        if (!container) return;

        container.innerHTML = '';

        // Determine which players to draw based on compact view
        // Compact view removes eliminated players entirely
        // Hide eliminated just dims them but keeps them in place
        let playersToDraw;
        if (appState.isCompactedView) {
            playersToDraw = appState.players.filter(p => !p.eliminated && !p.votedOut);
        } else {
            playersToDraw = appState.players;
        }

        // Calculate grid positions for the players we're drawing
        const gridPositions = this.calculateGridPositions(playersToDraw);

        // Sort by ID and draw
        playersToDraw.slice().sort((a, b) => a.id - b.id).forEach(player => {
            const div = document.createElement('div');
            div.className = 'player';
            div.id = `player-${player.id}`;
            div.dataset.playerId = player.id;

            // If not in spawn animation, show immediately
            if (!this.isSpawning) {
                div.style.opacity = '1';
            }

            // Photo handling - only show photo if player has one, otherwise use default pink background
            const photoURL = this.getPhotoUrlForPlayer(player);
            let numberClasses = ['player-number'];

            if (photoURL) {
                // Add image container with proper rotation
                const imageContent = `<div class="player-image-container"><img src="${photoURL}" style="transform: rotate(-135deg);"></div>`;
                div.innerHTML = imageContent;
                numberClasses.push('player-text-shadow');
                div.style.backgroundColor = 'transparent';
            }

            // Player number (or baby icon)
            const numberContent = player.isBaby
                ? `<span class="player-baby-icon">👶</span>`
                : `<span class="${numberClasses.join(' ')}">${utils.formatPlayerNumber(player.id)}</span>`;
            div.innerHTML += numberContent;

            // Apply position from grid calculation
            const pos = gridPositions[player.id];
            if (pos) {
                div.style.left = pos.x + 'px';
                div.style.top = pos.y + 'px';
            }

            // Mouse handlers
            div.onmouseenter = (e) => {
                this.showPlayerTooltip(player.id, e);
                if (appState.showGroups) this.highlightGroup(player.id);
            };
            div.onmouseleave = () => {
                this.hidePlayerTooltip();
                if (appState.showGroups) this.clearGroupHighlight();
            };
            div.onclick = () => this.openPlayerCard(player.id);

            // Apply status classes (order matters for CSS priority)
            if (player.votedOut) div.classList.add('voted-out');
            else if (player.eliminated) div.classList.add('eliminated');
            else if (player.isWinner) div.classList.add('winner');
            else if (player.isFinalist) div.classList.add('finalist');
            else if (player.isEasterEgg) div.classList.add('player-easter-egg');

            // Voting colors (Season 2)
            if (appState.showVoteColors && player.currentVote) {
                if (player.currentVote === 'O') div.classList.add('voted-o');
                else if (player.currentVote === 'X') div.classList.add('voted-x');
            }

            // Additional status indicators
            if (player.isFavorite) div.classList.add('player-favorite-highlight');
            if (player.injury) div.style.boxShadow = '0 0 10px 3px red';
            if (player.isPregnant) div.classList.add('player-pregnant');
            if (player.caretakerFor != null) div.classList.add('player-caretaker');

            // VIP bet styling
            if (player.hasVipBet) {
                if (player.eliminated || player.votedOut) {
                    div.classList.add('player-vip-eliminated');
                } else {
                    div.classList.add('player-vip');
                }
            }

            // Hidden eliminated - dims players but keeps them in place (not compact view)
            if (!appState.isCompactedView && (player.eliminated || player.votedOut) && appState.eliminatedHidden) {
                div.classList.add('hidden-eliminated');
            }

            // Group visualization: alliance colors & faded solos
            if (appState.showGroups && !player.eliminated && !player.votedOut) {
                const groupKey = relationships.getGroupKeyForPlayer(player);
                if (groupKey) {
                    const color = relationships.getGroupColor(groupKey);
                    if (color) {
                        div.style.backgroundColor = color;
                    }
                } else {
                    // Solo active players are visually faded
                    div.classList.add('faded-group-view');
                }
            }

            container.appendChild(div);
        });

        // Refresh game statistics every time the grid is redrawn.
        this.updateLeaderboards('statisticsContent');
    },

    getPhotoUrlForPlayer(player) {
        const rec = utils.getPhotoRecord(player.id);
        if (!rec) return null;

        const isHistory = appState.isViewingHistory;
        const isFinalistInView = !!player.confirmedFinalist;

        // When viewing historical snapshots before confirmation, show original only
        const canUseFinalistVariant = !isHistory && isFinalistInView;

        if (canUseFinalistVariant && rec.finalist) {
            return rec.finalist;
        }
        return rec.original || rec.finalist || null;
    },

    openPlayerCard(playerId) {
        const player = appState.players.find(p => p.id === playerId);
        if (!player) return;

        this.currentPlayerInCardId = playerId;
        this.currentCardPhotoIndex = 0;

        // Populate card fields
        document.getElementById('playerCardNumber').innerText = utils.formatPlayerNumber(player.id);
        document.getElementById('playerCardName').innerText = player.name || 'Unknown';
        document.getElementById('playerCardAge').innerText = player.age || '?';
        document.getElementById('playerCardGender').innerText = player.gender || '?';
        document.getElementById('playerCardCountry').innerText = player.country || '?';
        document.getElementById('playerCardOccupation').innerText = player.occupation || '?';
        document.getElementById('playerCardDebt').innerText = utils.formatCurrency(player.debt || 0);

        // Status
        let status = 'Active';
        if (player.eliminated) status = `Eliminated (GR${player.eliminationRound || '?'})`;
        else if (player.votedOut) status = 'Out of Game';
        else if (player.isWinner) status = '🏆 WINNER';
        document.getElementById('playerCardStatus').innerText = status;

        // Stats
        document.getElementById('playerCardStrength').innerText = player.baseStats.strength;
        document.getElementById('playerCardAgility').innerText = player.baseStats.agility;
        document.getElementById('playerCardIntelligence').innerText = player.baseStats.intelligence;
        document.getElementById('playerCardCharisma').innerText = player.baseStats.charisma;
        document.getElementById('playerCardLuck').innerText = player.baseStats.luck;
        document.getElementById('playerCardCowardice').innerText = player.baseStats.cowardice;
        document.getElementById('playerCardGreed').innerText = player.baseStats.greed;

        // Protection
        document.getElementById('playerCardProtection').innerText = player.protection || 0;

        // Allies
        const alliesSpan = document.getElementById('playerCardAllies');
        const allyHtml = (player.allies || []).map(id => {
            const ally = appState.players.find(p => p.id === id);
            const name = ally ? ally.name : `Player ${utils.formatPlayerNumber(id)}`;
            return `${utils.createPlayerLink(id)} (${name})`;
        }).join(', ');
        alliesSpan.innerHTML = allyHtml || 'None';

        // Enemies
        const enemiesSpan = document.getElementById('playerCardEnemies');
        const enemyHtml = (player.enemies || []).map(id => {
            const enemy = appState.players.find(p => p.id === id);
            const name = enemy ? enemy.name : `Player ${utils.formatPlayerNumber(id)}`;
            return `${utils.createPlayerLink(id)} (${name})`;
        }).join(', ');
        enemiesSpan.innerHTML = enemyHtml || 'None';

        // Injury
        const injuryEl = document.getElementById('playerCardInjury');
        if (player.injury) {
            injuryEl.innerText = `${player.injury.type} (${player.injury.roundsRemaining} round(s) left)`;
            injuryEl.style.color = 'red';
        } else {
            injuryEl.innerText = 'None';
            injuryEl.style.color = 'inherit';
        }

        // Action Log
        const logContainer = document.getElementById('playerCardActionLog');
        if (logContainer) {
            const logLines = (player.actionLog || []).slice();
            if (Array.isArray(player.voteHistory)) {
                player.voteHistory.forEach(v => {
                    logLines.push(`VR${v.votingRound}: Voted ${v.vote}`);
                });
            }
            logContainer.innerHTML = logLines.map(line => utils.linkifyPlayerNumbers(line)).join('<br>') || '<em>No recorded actions yet.</em>';
        }

        // Photo
        const imgEl = document.getElementById('playerCardImg');
        const url = this.getPhotoUrlForPlayer(player) || 'https://i.imgur.com/AJ3InNO.png';
        if (imgEl) imgEl.src = url;

        // Show modal
        const modal = document.getElementById('playerCardModal');
        if (modal) modal.style.display = 'flex';
    },

    closePlayerCard(event) {
        if (!event || event.target.id === 'playerCardModal') {
            const modal = document.getElementById('playerCardModal');
            if (modal) modal.style.display = 'none';
            this.currentPlayerInCardId = null;
        }
    },

    showPlayerTooltip(playerId, event) {
        const player = appState.players.find(p => p.id === playerId);
        if (!player) return;
        const tooltip = document.getElementById('playerTooltip');
        if (!tooltip) return;

        let info = `Player ${utils.formatPlayerNumber(playerId)}`;
        if (player.name) info += ` (${player.name})`;
        info += '\n(Click for dossier)\n';
        if (player.eliminated) info += `Status: Eliminated (R${player.eliminationRound})\n`;
        else if (player.votedOut) info += 'Status: Out of Game\n';
        else info += 'Status: Active\n';
        info += `Protection: ${player.protection}\n`;

        tooltip.innerHTML = info.replace(/\n/g, '<br>');
        tooltip.style.display = 'block';
        tooltip.style.left = (event.pageX + 10) + 'px';
        tooltip.style.top = (event.pageY + 10) + 'px';
    },

    hidePlayerTooltip() {
        const tooltip = document.getElementById('playerTooltip');
        if (tooltip) tooltip.style.display = 'none';
    },

    updateCounters() {
        const el = document.getElementById('playersRemaining');
        if (el) el.innerText = utils.getActivePlayers().length;
    },

    toggleEliminatedVisibility() {
        if (appState.isViewingArchivedGame) return;
        appState.eliminatedHidden = !appState.eliminatedHidden;
        const btn = document.getElementById('toggleEliminatedBtn');
        if (btn) btn.innerText = appState.eliminatedHidden ? 'Show Eliminated/Out' : 'Hide Eliminated/Out';
        this.updateAllPlayerDivs();
    },

    toggleGroupView() {
        appState.showGroups = !appState.showGroups;
        const btn = document.getElementById('toggleGroupBtn');
        if (btn) btn.innerText = appState.showGroups ? 'Hide Groups' : 'Show Groups';
        this.updateAllPlayerDivs();
    },

    toggleVoteColors() {
        if (appState.isViewingArchivedGame) return;
        if (!appState.season2ModeActive) { alert("Season 2 Mode is not active."); return; }
        appState.showVoteColors = !appState.showVoteColors;
        const btn = document.getElementById('toggleVoteColorsBtn');
        if (btn) btn.innerText = appState.showVoteColors ? "Hide Vote Colors" : "Show Vote Colors";
        this.updateAllPlayerDivs();
    },

    toggleRosterView() {
        if (appState.isViewingArchivedGame || appState.isViewingHistory) return;
        appState.isCompactedView = !appState.isCompactedView;
        const btn = document.getElementById('toggleRosterBtn');
        if (btn) btn.innerText = appState.isCompactedView ? "Restore Full Roster" : "Compact Roster (Delete Out)";
        this.updateAllPlayerDivs();
    },

    openTab(event, tabName) {
        const tabcontent = document.getElementsByClassName("tab-content");
        for (let i = 0; i < tabcontent.length; i++) tabcontent[i].style.display = "none";
        const tablinks = document.getElementsByClassName("tab-link");
        for (let i = 0; i < tablinks.length; i++) tablinks[i].className = tablinks[i].className.replace(" active", "");
        const tab = document.getElementById(tabName);
        if (tab) tab.style.display = "block";
        if (event && event.currentTarget) event.currentTarget.className += " active";
    },

    zoom(factor) {
        const playersDiv = document.getElementById('players');
        if (!playersDiv) return;
        this.scale *= factor;
        playersDiv.style.transform = `scale(${this.scale})`;
    },

    resetZoom() {
        const playersDiv = document.getElementById('players');
        const viewport = document.getElementById('grid-viewport');
        this.scale = 1;
        if (playersDiv) playersDiv.style.transform = `scale(${this.scale})`;
        if (viewport) { viewport.scrollLeft = 0; viewport.scrollTop = 0; }
    },

    displayWinnerHistory() {
        const historyContainer = document.getElementById('winnerHistoryContainer');
        const historyList = document.getElementById('winnerHistoryList');
        if (!historyList) return;
        historyList.innerHTML = '';

        if (appState.allGamesHistory.length === 0) {
            if (historyContainer) historyContainer.style.display = 'none';
            return;
        }
        if (historyContainer) historyContainer.style.display = 'block';

        appState.allGamesHistory.forEach(gameRecord => {
            const listItem = document.createElement('li');
            let text = `<strong>Game #${gameRecord.gameNumber}</strong>: `;
            if (gameRecord.winnerId) {
                text += `Winner: ${utils.createPlayerLink(gameRecord.winnerId)} (${gameRecord.winnerName})`;
            } else {
                text += "No winner.";
            }
            listItem.innerHTML = text;
            historyList.appendChild(listItem);
        });
    },

    updateEliminationOrderList() {
        const listEl = document.getElementById('eliminationOrderList');
        if (!listEl) return;
        listEl.innerHTML = '';

        const displayedIds = new Set();
        let count = 1;

        appState.eliminationOrder.forEach(item => {
            const div = document.createElement('div');
            if (item.isHeader) {
                div.className = 'elim-order-header';
                div.innerHTML = `— ${item.text} —`;
            } else if (!displayedIds.has(item.playerId)) {
                div.className = 'elim-order-item';
                div.innerHTML = `${count}. ${utils.createPlayerLink(item.playerId)}`;
                displayedIds.add(item.playerId);
                count++;
            } else {
                return;
            }
            listEl.appendChild(div);
        });
    },

    updateHistorySliderUI() {
        const slider = document.getElementById('historySlider');
        if (!slider) return;
        slider.max = appState.gameHistorySnapshots.length - 1;
        slider.value = slider.max;
        const label = document.getElementById('historySliderLabel');
        if (label) label.innerText = 'Live';
    },

    updateVipTab() {
        const balanceEl = document.getElementById('bettingBalanceDisplay');
        const mainContentEl = document.getElementById('betting-main-content');
        const disabledMsgEl = document.getElementById('betting-disabled-msg');

        if (balanceEl) balanceEl.textContent = utils.formatCurrency(appState.bettingBalance);

        if (appState.isGameModified || appState.isViewingArchivedGame) {
            if (mainContentEl) mainContentEl.style.display = 'none';
            if (disabledMsgEl) {
                disabledMsgEl.style.display = 'block';
                disabledMsgEl.textContent = "Betting disabled for modified or archived games.";
            }
            return;
        }

        if (disabledMsgEl) disabledMsgEl.style.display = 'none';
        if (mainContentEl) mainContentEl.style.display = 'block';
    },

    renderAchievements() {
        const listEl = document.getElementById('achievements-list');
        if (!listEl) return;
        listEl.innerHTML = '';
        for (const id in appState.achievements) {
            const ach = appState.achievements[id];
            const item = document.createElement('div');
            item.style.cssText = 'border-bottom: 1px solid #ccc; padding: 8px 4px; margin-bottom: 4px;';
            if (ach.unlocked) {
                item.style.backgroundColor = '#d4edda';
                item.style.border = '1px solid #81c784';
            }
            const check = ach.unlocked ? '✔ ' : '';
            let html = `<h5>${check}${ach.name}</h5><p>${ach.desc}</p>`;
            if (ach.goal) {
                html += `<progress value="${ach.progress}" max="${ach.goal}"></progress> (${ach.progress}/${ach.goal})`;
            }
            item.innerHTML = html;
            listEl.appendChild(item);
        }
    },

    renderCustomGames() {
        const list = document.getElementById('customGamesList');
        if (!list) return;
        list.innerHTML = '';
        appState.customGames.forEach((game, index) => {
            const btn = document.createElement('button');
            btn.innerText = game.name;
            btn.onclick = () => gameEngine.playCustomGame(index);
            list.appendChild(btn);
        });
    },

    updateEventButtons() {
        const eventButtons = document.querySelectorAll('#events-controls button');
        eventButtons.forEach(button => {
            const eventName = button.id.split('-')[1];
            if (eventName && eventName !== 'random') {
                button.disabled = appState.usedEvents.has(eventName) || appState.isViewingArchivedGame;
            }
        });
    },

    lockForAnimation(isLocked) {
        const animBtn = document.getElementById('animationModeBtn');
        const pauseBtn = document.getElementById('pausePlayButton');
        const gamePresetButtons = document.querySelectorAll('.game-presets-box button');

        if (animBtn) animBtn.disabled = isLocked;
        if (pauseBtn) pauseBtn.disabled = !isLocked;
        gamePresetButtons.forEach(btn => { btn.disabled = isLocked; });
    },

    setTheme(theme) {
        const body = document.body;
        const themes = ['light', 'dark', 'ocean', 'forest', 'sunset', 'neon', 'cyber'];
        themes.forEach(t => body.classList.remove('theme-' + t));
        if (theme !== 'light') body.classList.add('theme-' + theme);
        appState.currentTheme = theme;
        localStorage.setItem('squidGameTheme', theme);
    },

    toggleForceWinner(playerId) {
        if (appState.forcedWinnerId === playerId) {
            appState.forcedWinnerId = null;
            log.event(`God Mode disabled for P${utils.formatPlayerNumber(playerId)}.`);
        } else {
            appState.forcedWinnerId = playerId;
            appState.isGameModified = true;
            log.event(`God Mode enabled for P${utils.formatPlayerNumber(playerId)}. They will survive all games.`);
        }
        this.openPlayerCard(playerId);
    },

    toggleFavorite(playerId) {
        if (appState.favoritedPlayerIds.has(playerId)) {
            appState.favoritedPlayerIds.delete(playerId);
        } else {
            appState.favoritedPlayerIds.add(playerId);
        }
        playerMgmt.updateFavoritedPlayersList();
        this.updateAllPlayerDivs();
    },

    updateLeaderboards(containerId = 'statisticsContent') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const activePlayers = utils.getActivePlayers();
        const prizePotDisplay = utils.formatCurrency(appState.currentPrizePot || 0);

        let html = `<div><strong>Current Prize Pot:</strong> ${prizePotDisplay}</div>`;
        html += `<div><strong>Active Players:</strong> ${activePlayers.length}</div>`;
        container.innerHTML = html;
    },

    updateAllUI() {
        if (appState.players.length > 0) this.calculateGridPositions(appState.players);
        this.updateAllPlayerDivs();
        this.updateCounters();
        this.updateAllCustomLists();
        playerMgmt.updateSuperpowerList();
        // Make sure the Easter Egg list is always in sync
        playerMgmt.initEasterEggCharacterList();
        // Keep the Favorited Players sidebar in sync with the current view
        playerMgmt.updateFavoritedPlayersList();
        this.displayWinnerHistory();
        this.updateEliminationOrderList();
        this.renderCustomGames();
        this.updateVipTab();
        if (Object.keys(appState.achievements).length > 0) this.renderAchievements();
        this.updateEventButtons();
        this.updateHistorySliderUI();
        this.resetZoom();
        if (typeof lobbyTalk !== 'undefined') {
            lobbyTalk.refreshPreviousGameOptions();
            lobbyTalk.render();
        }
    },

    calculateGridPositions(playersToLayout) {
        const DIAMOND_SIZE = 36;
        const DIAMOND_GAP = 8;
        const X_STEP = DIAMOND_SIZE + DIAMOND_GAP;
        const Y_STEP = (DIAMOND_SIZE + DIAMOND_GAP) / 2;
        const BORDER_PADDING = 40;

        if (!playersToLayout || playersToLayout.length === 0) return {};

        let widestRow = Math.ceil(Math.sqrt(playersToLayout.length));
        let totalRows = widestRow * 2 - 1;

        let playersContainer = document.getElementById('players');
        if (!playersContainer) return {};
        
        let containerWidth = (widestRow * X_STEP) + BORDER_PADDING;
        let containerHeight = (totalRows * Y_STEP) + BORDER_PADDING;
        playersContainer.style.width = containerWidth + 'px';
        playersContainer.style.height = containerHeight + 'px';

        let gridPositions = {};
        let currentPlayerIndex = 0;

        for (let r = 1; r <= totalRows; r++) {
            let numColsInRow = r <= widestRow ? r : widestRow * 2 - r;
            for (let c = 1; c <= numColsInRow; c++) {
                if (currentPlayerIndex >= playersToLayout.length) break;
                const player = playersToLayout[currentPlayerIndex];
                const yPos = (r - 1) * Y_STEP + Y_STEP;
                const xPos = (containerWidth / 2) + (c - (numColsInRow + 1) / 2) * X_STEP;
                gridPositions[player.id] = { x: xPos, y: yPos };
                currentPlayerIndex++;
            }
            if (currentPlayerIndex >= playersToLayout.length) break;
        }
        return gridPositions;
    },

    switchGameLogTab(tab) {
        const eventsBtn = document.getElementById('gameLogTabEvents');
        const lobbyBtn = document.getElementById('gameLogTabLobby');
        const eventsContent = document.getElementById('gameLogTabContentEvents');
        const lobbyContent = document.getElementById('gameLogTabContentLobby');

        if (!eventsBtn || !lobbyBtn || !eventsContent || !lobbyContent) return;

        if (tab === 'lobby') {
            eventsBtn.classList.remove('active');
            lobbyBtn.classList.add('active');
            eventsContent.classList.remove('active');
            lobbyContent.classList.add('active');
        } else {
            lobbyBtn.classList.remove('active');
            eventsBtn.classList.add('active');
            lobbyContent.classList.remove('active');
            eventsContent.classList.add('active');
        }
    },

    toggleFavoritePlayer() {
        if (appState.isViewingArchivedGame || appState.isViewingHistory) {
            alert("You cannot change favorites while viewing a past or archived game.");
            return;
        }
        const playerId = this.currentPlayerInCardId;
        if (!playerId) return;

        const player = appState.players.find(p => p.id === playerId);
        if (!player) return;

        player.isFavorite = !player.isFavorite;
        if (player.isFavorite) {
            appState.favoritedPlayerIds.add(player.id);
        } else {
            appState.favoritedPlayerIds.delete(player.id);
        }

        const starEl = document.getElementById('favoriteStar');
        if (starEl) {
            starEl.textContent = player.isFavorite ? '⭐' : '☆';
            starEl.title = player.isFavorite ? 'Unstar this player' : 'Star this player';
        }

        playerMgmt.updateFavoritedPlayersList();
        this.updateAllPlayerDivs();
    },

    nextPhoto() {
        if (!this.currentPlayerInCardId) return;
        const currentPlayers = appState.isViewingHistory
            ? (appState.gameHistorySnapshots[document.getElementById('historySlider').value]?.players || [])
            : appState.players;
        const player = currentPlayers.find(p => p.id === this.currentPlayerInCardId);
        if (!player) return;
        player.photoAlbum = player.photoAlbum || [];
        const album = player.photoAlbum.filter(Boolean);
        if (!album.length) return;

        this.currentCardPhotoIndex = (this.currentCardPhotoIndex + 1) % album.length;
        const imgEl = document.getElementById('playerCardImg');
        const modeLabel = document.getElementById('playerCardPhotoModeLabel');
        if (imgEl) imgEl.src = album[this.currentCardPhotoIndex];
        if (modeLabel) modeLabel.textContent = `Photo ${this.currentCardPhotoIndex + 1}`;
    },

    prevPhoto() {
        if (!this.currentPlayerInCardId) return;
        const currentPlayers = appState.isViewingHistory
            ? (appState.gameHistorySnapshots[document.getElementById('historySlider').value]?.players || [])
            : appState.players;
        const player = currentPlayers.find(p => p.id === this.currentPlayerInCardId);
        if (!player) return;
        player.photoAlbum = player.photoAlbum || [];
        const album = player.photoAlbum.filter(Boolean);
        if (!album.length) return;

        this.currentCardPhotoIndex = (this.currentCardPhotoIndex - 1 + album.length) % album.length;
        const imgEl = document.getElementById('playerCardImg');
        const modeLabel = document.getElementById('playerCardPhotoModeLabel');
        if (imgEl) imgEl.src = album[this.currentCardPhotoIndex];
        if (modeLabel) modeLabel.textContent = `Photo ${this.currentCardPhotoIndex + 1}`;
    },

    ensurePlayerPhoto(player) {
        // Placeholder for AI photo generation
    },

    preloadAllPlayerPhotos() {
        // Placeholder for batch photo generation
    },

    toggleInstructions() {
        const content = document.getElementById('instructions-content');
        const toggle = document.getElementById('instructions-toggle');
        if (!content || !toggle) return;
        const isOpen = content.classList.toggle('open');
        toggle.innerText = isOpen ? 'Instructions & Guide [Click to Close]' : 'Instructions & Guide [Click to Open]';
    },

    toggleAdvancedSettings() {
        const content = document.getElementById('advanced-settings-content');
        const toggle = document.getElementById('advanced-settings-toggle');
        if (!content || !toggle) return;
        const isOpen = content.classList.toggle('open');
        toggle.innerText = isOpen ? 'Advanced New Game Settings [Click to Close]' : 'Advanced New Game Settings [Click to Open]';
    },

    toggleControlPanel() {
        const panel = document.getElementById('controlPanelContainer');
        const toggle = document.getElementById('controlPanelToggle');
        if (!panel || !toggle) return;
        const isOpen = panel.classList.toggle('open');
        toggle.innerHTML = isOpen ? 'Game Control & Customization ▲' : 'Game Control & Customization ▼';
    },

    updateAllCustomLists() {
        // Stub for updating custom lists - can be expanded as needed
    },

    showPlayerCard(playerId) {
        // Alias for openPlayerCard for compatibility
        this.openPlayerCard(playerId);
    },

    animateNewGameSpawn(totalPlayers) {
        const container = document.getElementById('players');
        if (!container) {
            this.isSpawning = false;
            return;
        }

        const allNodes = Array.from(container.querySelectorAll('.player'));
        if (!allNodes.length) {
            this.isSpawning = false;
            return;
        }

        allNodes.forEach(el => { el.style.opacity = '0'; });
        let remaining = allNodes.slice();

        const step = () => {
            if (!remaining.length) {
                this.isSpawning = false;
                return;
            }

            const batchSize = Math.max(1, Math.ceil(remaining.length / 2));
            const batch = [];
            for (let i = 0; i < batchSize && remaining.length > 0; i++) {
                const idx = Math.floor(Math.random() * remaining.length);
                const el = remaining.splice(idx, 1)[0];
                batch.push(el);
            }

            batch.forEach(el => { el.style.opacity = '1'; });
            if (typeof sound !== 'undefined' && sound.playPresetClick) sound.playPresetClick();
            setTimeout(step, 500);
        };

        setTimeout(step, 100);
    },

    highlightGroup(playerId) {
        const player = appState.players.find(p => p.id === playerId);
        if (!player) return;
        const ids = new Set([player.id, ...(player.allies || [])]);
        ids.forEach(id => {
            const el = document.getElementById(`player-${id}`);
            if (el) el.classList.add('group-highlight');
        });
    },

    clearGroupHighlight() {
        document.querySelectorAll('.group-highlight').forEach(el => {
            el.classList.remove('group-highlight');
        });
    },

    openAdjacentPlayer(direction) {
        if (!this.currentPlayerInCardId) return;
        const currentPlayers = appState.isViewingHistory
            ? (appState.gameHistorySnapshots[document.getElementById('historySlider').value]?.players || [])
            : appState.players;
        
        const currentIndex = currentPlayers.findIndex(p => p.id === this.currentPlayerInCardId);
        if (currentIndex === -1) return;
        
        let nextIndex = currentIndex + direction;
        if (nextIndex < 0) nextIndex = currentPlayers.length - 1;
        if (nextIndex >= currentPlayers.length) nextIndex = 0;
        
        const nextPlayer = currentPlayers[nextIndex];
        if (nextPlayer) this.openPlayerCard(nextPlayer.id);
    },

    stopPhotoGeneration() {
        appState.cancelPhotoGeneration = true;
        if (appState.photoAutoIntervalId) {
            clearInterval(appState.photoAutoIntervalId);
            appState.photoAutoIntervalId = null;
        }
    },

    toggleAutoPhotoGeneration(enabled) {
        appState.autoPhotoGenerationEnabled = enabled;
    },

    applyUrlFromCard() {
        if (!this.currentPlayerInCardId) return;
        const player = appState.players.find(p => p.id === this.currentPlayerInCardId);
        if (!player) return;

        const urlInput = document.getElementById('playerCardUrlInput');
        if (!urlInput || !urlInput.value.trim()) {
            alert("Please enter a valid URL.");
            return;
        }

        const url = urlInput.value.trim();
        player.photoAlbum = player.photoAlbum || [];
        if (!player.photoAlbum.includes(url)) {
            player.photoAlbum.push(url);
        }
        appState.customPlayerPhotos[player.id] = url;

        const imgEl = document.getElementById('playerCardImg');
        if (imgEl) imgEl.src = url;

        this.currentCardPhotoIndex = player.photoAlbum.indexOf(url);
        const modeLabel = document.getElementById('playerCardPhotoModeLabel');
        if (modeLabel) modeLabel.textContent = `Photo ${this.currentCardPhotoIndex + 1}`;

        this.updateAllPlayerDivs();
        log.event(`Photo URL applied to P${utils.formatPlayerNumber(player.id)}.`);
    },

    removePhotoFromCard() {
        if (!this.currentPlayerInCardId) return;
        const player = appState.players.find(p => p.id === this.currentPlayerInCardId);
        if (!player) return;

        player.photoAlbum = [];
        delete appState.customPlayerPhotos[player.id];
        player.photoURL = null;

        const imgEl = document.getElementById('playerCardImg');
        if (imgEl) imgEl.src = 'https://i.imgur.com/AJ3InNO.png';

        this.currentCardPhotoIndex = 0;
        const modeLabel = document.getElementById('playerCardPhotoModeLabel');
        if (modeLabel) modeLabel.textContent = 'Photo 1';

        this.updateAllPlayerDivs();
        log.event(`Photo removed from P${utils.formatPlayerNumber(player.id)}.`);
    },

    // --- WIN CHANCE CALCULATOR ENGINE HELPERS ---
    // Heuristic "Power Level" for a given player + game, based on your spec.
    calculatePlayerSurvivalScore(player, gameName) {
        if (!player || !player.baseStats) return 0;

        const bs = player.baseStats;
        const strength     = bs.strength     || 0;
        const agility      = bs.agility      || 0;
        const intelligence = bs.intelligence || 0;
        const charisma     = bs.charisma     || 0;
        const luck         = bs.luck         || 0;
        const cowardice    = bs.cowardice    || 0;
        const greed        = bs.greed        || 0;

        // 1. Base Score
        let score = strength + agility + intelligence + charisma + luck;

        // 2. Stat Penalties
        score -= cowardice * 2.5;
        score -= greed * 1.5;

        const name = (gameName || '').toLowerCase();

        // 3. Game-Specific Multipliers
        if (name.includes('tug of war')) {
            score += strength * 15;
        } else if (name.includes('marbles')) {
            score += intelligence * 10 + luck * 10;
        } else if (name.includes('glass bridge')) {
            score += luck * 20;
        } else if (name.includes('squid game')) {
            score += strength * 10 + agility * 10;
        }

        // 4. Social Modifiers
        const allies = player.allies || [];
        const enemies = player.enemies || [];
        score += allies.length * 10;
        score -= enemies.length * 8;

        // 5. Plot Armor
        const protection = player.protection || 0;
        if (protection > 0) score += protection * 100;
        if (player.hasHint) score += 80;

        // 6. God Mode
        if (appState.forcedWinnerId && appState.forcedWinnerId === player.id) {
            score += 10000;
        }

        // Clamp to non-negative
        if (score < 0) score = 0;
        return score;
    },

    /**
     * Normalize a single player's chance (%) relative to the entire lobby for a given game.
     */
    computeChanceForPlayer(targetId, playersArr, gameName) {
        const simPlayers = playersArr || [];
        if (!simPlayers.length) return 0;
        const scores = simPlayers.map(p => this.calculatePlayerSurvivalScore(p, gameName));
        const total = scores.reduce((a, b) => a + b, 0);
        if (total <= 0) return 0;

        const idx = simPlayers.findIndex(p => p.id === targetId);
        if (idx === -1) return 0;

        const chance = (scores[idx] / total) * 100;
        return chance;
    },

    /**
     * Render a simple line chart onto the Win Chance canvas.
     */
    renderWinChanceChart(labels, data, seriesLabel) {
        const canvas = document.getElementById('winChanceCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!window._winChanceChart) {
            window._winChanceChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: seriesLabel,
                        data,
                        borderColor: '#ff80ab',
                        backgroundColor: 'rgba(255,128,171,0.15)',
                        tension: 0.3,
                        fill: true,
                        pointRadius: 3,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: { callback: v => v + '%' }
                        }
                    },
                    plugins: {
                        legend: { display: true }
                    }
                }
            });
        } else {
            const chart = window._winChanceChart;
            chart.data.labels = labels;
            chart.data.datasets[0].label = seriesLabel;
            chart.data.datasets[0].data = data;
            chart.update();
        }
    },

    // Prediction game list stored on the UI object
    predictionGameList: [],

    showTopContenders() {
        const listEl = document.getElementById('topContendersList');
        const activePlayers = utils.getActivePlayers();
        if (!listEl) return;
        if (activePlayers.length === 0) {
            listEl.innerHTML = 'No active players.';
            return;
        }

        // Use currently selected game as context, default to "Squid Game"
        const select = document.getElementById('winChanceGameSelect');
        const gameName = select && select.value ? select.value : 'Squid Game';

        const scored = activePlayers.map(p => ({
            player: p,
            score: this.calculatePlayerSurvivalScore(p, gameName)
        }));
        scored.sort((a, b) => b.score - a.score);
        const top = scored.slice(0, 10);

        const items = top.map((entry, i) => {
            const p = entry.player;
            const score = entry.score.toFixed(1);
            return `<li>${i + 1}. ${utils.createPlayerLink(p.id)} (${p.name}) – Score: ${score}</li>`;
        }).join('');

        listEl.innerHTML = `<ol>${items}</ol>`;
    },

    addGameToPredictionList() {
        const select = document.getElementById('winChanceGameSelect');
        const container = document.getElementById('winChanceGameListContainer');
        if (!select || !container) return;
        const gameName = select && select.value ? select.value : select.options[select.selectedIndex]?.text || '';
        if (!gameName) return;

        this.predictionGameList = this.predictionGameList || [];
        this.predictionGameList.push(gameName);

        const pills = this.predictionGameList.map((g, idx) =>
            `<span style="display:inline-block;margin:2px 4px;padding:2px 6px;border-radius:999px;background:#eee;color:#333;font-size:0.8em;">
                ${idx + 1}. ${g}
            </span>`
        ).join('');
        container.innerHTML = pills || '<em>No games added yet.</em>';
    },

    clearPredictionList() {
        this.predictionGameList = [];
        const container = document.getElementById('winChanceGameListContainer');
        if (container) container.innerHTML = '<em>No games added yet.</em>';
    },

    /**
     * Win % trajectory:
     *  - isPrediction = true: simulate future using predictionGameList (with 30% cuts each step)
     *  - isPrediction = false: look backwards over gameHistorySnapshots.
     */
    calculateWinChance(isPrediction) {
        const playerIdInput = document.getElementById('winChancePlayerId');
        const playerId = parseInt(playerIdInput?.value || '0', 10);
        if (!playerId) {
            alert('Enter a Primary Player ID first.');
            return;
        }

        if (isPrediction) {
            // Predictive mode: use current lobby + user game list
            const predictionGames = this.predictionGameList || [];
            if (!predictionGames.length) {
                alert('Add at least one game to the prediction list.');
                return;
            }

            let simPlayers = JSON.parse(JSON.stringify(utils.getActivePlayers()));
            if (!simPlayers.length) {
                alert('No active players to simulate.');
                return;
            }

            const labels = [];
            const data = [];
            let targetDead = false;

            predictionGames.forEach((gameName, idx) => {
                labels.push(`${idx + 1}. ${gameName}`);

                if (targetDead) {
                    data.push(0);
                    return;
                }

                const chance = this.computeChanceForPlayer(playerId, simPlayers, gameName);
                data.push(Number.isFinite(chance) ? Math.max(0, Math.min(100, chance)) : 0);

                // Simulated deaths: eliminate bottom 30% by score
                const scored = simPlayers.map(p => ({
                    player: p,
                    score: this.calculatePlayerSurvivalScore(p, gameName),
                }));
                scored.sort((a, b) => a.score - b.score); // ascending: weakest first

                let cutCount = Math.floor(scored.length * 0.3);
                if (cutCount < 1 && scored.length > 1) cutCount = 1;

                const losers = scored.slice(0, cutCount).map(e => e.player.id);
                if (losers.includes(playerId)) {
                    targetDead = true;
                }

                // Remove losers from simPlayers for next step
                const losersSet = new Set(losers);
                simPlayers = simPlayers.filter(p => !losersSet.has(p.id));
            });

            this.renderWinChanceChart(labels, data, 'Predicted Win %');
        } else {
            // Trajectory mode: use gameHistorySnapshots
            const snaps = appState.gameHistorySnapshots || [];
            if (!snaps.length) {
                alert('No game history available yet.');
                return;
            }

            const labels = [];
            const data = [];

            snaps.forEach((snap, idx) => {
                const players = snap.players || [];
                const activeInSnap = players.filter(p => !p.eliminated && !p.votedOut);
                const target = players.find(p => p.id === playerId);

                const label = `GR ${snap.round}: ${snap.name || 'Game'}`;
                labels.push(label);

                if (!target || target.eliminated || target.votedOut) {
                    data.push(0);
                } else {
                    const chance = this.computeChanceForPlayer(playerId, activeInSnap, snap.name);
                    data.push(Number.isFinite(chance) ? Math.max(0, Math.min(100, chance)) : 0);
                }
            });

            this.renderWinChanceChart(labels, data, 'Historical Win %');
        }
    },

    /**
     * Per-game survival %, based on predictionGameList.
     */
    calculateSurvivalChance() {
        const playerIdInput = document.getElementById('winChancePlayerId');
        const playerId = parseInt(playerIdInput?.value || '0', 10);
        if (!playerId) {
            alert('Enter a Primary Player ID first.');
            return;
        }

        const predictionGames = this.predictionGameList || [];
        if (!predictionGames.length) {
            alert('Add at least one game to the prediction list.');
            return;
        }

        let simPlayers = JSON.parse(JSON.stringify(utils.getActivePlayers()));
        if (!simPlayers.length) {
            alert('No active players to simulate.');
            return;
        }

        const labels = [];
        const data = [];
        let targetDead = false;

        predictionGames.forEach((gameName, idx) => {
            labels.push(`${idx + 1}. ${gameName}`);

            if (targetDead) {
                data.push(0);
                return;
            }

            const scored = simPlayers.map(p => ({
                player: p,
                score: this.calculatePlayerSurvivalScore(p, gameName),
            }));
            scored.sort((a, b) => a.score - b.score); // ascending: weakest first

            let cutCount = Math.floor(scored.length * 0.3);
            if (cutCount < 1 && scored.length > 1) cutCount = 1;

            const losers = scored.slice(0, cutCount).map(e => e.player.id);
            const survived = !losers.includes(playerId);
            data.push(survived ? 100 : 0);

            if (!survived) {
                targetDead = true;
            }

            const losersSet = new Set(losers);
            simPlayers = simPlayers.filter(p => !losersSet.has(p.id));
        });

        this.renderWinChanceChart(labels, data, 'Per-Game Survival %');
    },

    updateLeaderboards(containerId = 'statisticsContent') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const activePlayers = utils.getActivePlayers();
        const prizePotDisplay = utils.formatCurrency(appState.currentPrizePot || 0);

        let html = `<div><strong>Current Prize Pot:</strong> ${prizePotDisplay}</div>`;
        html += `<div><strong>Active Players:</strong> ${activePlayers.length}</div>`;
        html += `<div><strong>Round:</strong> ${appState.round}</div>`;
        container.innerHTML = html;
    },

    openWinChanceCalculator() {
        document.getElementById('winChanceModal').style.display = 'flex';
    },

    closeWinChanceCalculator() {
        document.getElementById('winChanceModal').style.display = 'none';
    },
};
