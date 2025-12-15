        const appState = {
            // Core game state
            players: [],
            round: 0,
            currentGameNumber: 0,
            originalRosterSize: 0,
            currentPrizePot: 0,
            firstEliminationOfGame: false,
+            // Track when finalists were confirmed for reference/history logic
+            finalistsConfirmedRound: null,
            // AI photo generation progress
            photoGenerationOffset: 0,

            createSaveObject() {
                return {
-                    customPlayerPhotos: this.customPlayerPhotos,
+                    customPlayerPhotos: this.customPlayerPhotos,
                    players: this.players,
                    round: this.round,

            restoreGameState(data, showAlert = true) {
                this.players = data.players || [];
                this.round = data.round || 0;
-                this.customPlayerPhotos = data.customPlayerPhotos || {};
+                this.customPlayerPhotos = data.customPlayerPhotos || {};

            startGame(isAdvancedGame = false) {
                if (this.isViewingArchivedGame) return;
                if (isAdvancedGame) this.isGameModified = true;
                sound.play('start');
                this.currentGameNumber++;
                this.photoGenerationOffset = 0;
                this.autoPhotoGenerationEnabled = false;
                // ... existing code ...
                this.usedEvents.clear();
+                this.finalistsConfirmedRound = null;
                this.forcedWinnerId = null;
                this.customPlayerPhotos = {};

        const utils = {
+            // Normalize photo record for a given player ID (handles legacy string storage)
+            getPhotoRecord(playerId) {
+                const rec = appState.customPlayerPhotos[playerId];
+                if (!rec) return null;
+                if (typeof rec === 'string') {
+                    return { original: rec };
+                }
+                return rec;
+            },
+
            getActivePlayers() {
                return appState.players.filter(p => !p.eliminated && !p.votedOut && !p.isBaby);
            },

            // Confirm Finalists:
            // Marks all current active players as finalists, logs the event,
-            // and replaces their portraits with a unified "suit" version.
+            // and generates separate "finalist suit" portraits per player.
             async handleConfirmFinalists() {
                 if (appState.isViewingArchivedGame || appState.isViewingHistory) return;
 
                 const activePlayers = utils.getActivePlayers();
                 if (!activePlayers.length) return;
 
                 // 1. Header in elimination order (non-round event)
                 appState.eliminationOrder.push({
                     isHeader: true,
                     text: 'Event: Confirm Finalists',
                 });
+                // Record that finalists are locked at this round
+                appState.finalistsConfirmedRound = appState.round;
 
                 const grLabel = appState.round > 0 ? `GR ${appState.round}` : 'GR 0';
 
                 // 2. Flag all active players as finalists and update their action logs
                 activePlayers.forEach(p => {
                     p.isFinalist = true;
                     p.confirmedFinalist = true;
                     p.actionLog = p.actionLog || [];
                     p.actionLog.push(`${grLabel}: Confirmed as FINALIST.`);
                 });
 
                 // 3. Generate an individual "suit" portrait for each finalist
                 try {
                     if (typeof websim !== 'undefined' && websim.imageGen) {
                         // Helper to convert an image URL to a base64 data URL for image_inputs
                         const urlToDataUrl = async (url) => {
                             const response = await fetch(url);
                             const blob = await response.blob();
                             return new Promise((resolve, reject) => {
                                 const reader = new FileReader();
                                 reader.onloadend = () => resolve(reader.result);
                                 reader.onerror = reject;
                                 reader.readAsDataURL(blob);
                             });
                         };
 
                         for (const p of activePlayers) {
                             try {
-                                // Ensure we have this player's base portrait first
-                                await ui.ensurePlayerPhoto(p);
-                                const baseUrl = appState.customPlayerPhotos[p.id];
+                                // Ensure we have this player's base portrait first
+                                await ui.ensurePlayerPhoto(p);
+                                const rec = utils.getPhotoRecord(p.id) || {};
+                                const baseUrl = rec.original || rec.finalist || null;
                                 let dataUrl = null;
 
                                 if (baseUrl) {
                                     try {
                                         dataUrl = await urlToDataUrl(baseUrl);
                                     } catch (e) {
                                         console.error('Failed to convert base portrait to data URL for suit generation', e);
                                     }
                                 }
 
                                 const playerNumber = utils.formatPlayerNumber(p.id);
                                 const suitPrompt = [
                                     "high-quality portrait of the same Squid Game contestant now wearing a sharp formal black suit with a black bow tie,",
                                     "clean background, realistic face, upper body shot,",
+                                    "their face looks more roughed up, tired, and serious, with subtle bruises or scrapes from surviving deadly games,",
                                     `their Squid Game player number ${playerNumber} is clearly visible as a badge, patch, or embroidery on the front of the suit,`,
-                                    "cinematic lighting, serious expression"
+                                    "cinematic lighting, dramatic serious expression"
                                 ].join(" ");
 
                                 const imageGenOptions = {
                                     prompt: suitPrompt,
                                     aspect_ratio: "1:1",
                                 };
@@
-                                const result = await websim.imageGen(imageGenOptions);
-                                if (result && result.url) {
-                                    appState.customPlayerPhotos[p.id] = result.url;
-                                }
+                                const result = await websim.imageGen(imageGenOptions);
+                                if (result && result.url) {
+                                    const updatedRec = utils.getPhotoRecord(p.id) || {};
+                                    updatedRec.finalist = result.url;
+                                    appState.customPlayerPhotos[p.id] = updatedRec;
+                                }
                             } catch (e) {
                                 console.error("Failed to generate suit portrait for finalist", p.id, e);
                             }
                         }
                     }
                 } catch (err) {
                     console.error("Confirm Finalists suit-portrait generation failed", err);
                 }
 
                 // 4. Global log + UI refresh
                 log.event(
                     `Event (Post-GR ${appState.round}): All ${activePlayers.length} remaining players are confirmed as FINALISTS.`
                 );
 
                 ui.updateAllPlayerDivs();
                 ui.updateCounters();
                 this.takeSnapshot(appState.round, 'Confirm Finalists');
                 ui.updateEliminationOrderList();
                 ui.updateHistorySliderUI();
             },

        const ui = {
-            scale: 1,
+            scale: 1,
+            currentPlayerInCardId: null,
+            currentPlayerPhotoVariant: 'auto', // 'auto' | 'original' | 'finalist'

            updateAllPlayerDivs() {
                const playersContainer = document.getElementById('players');
                playersContainer.innerHTML = '';
                // ... existing code ...
-                playersToDraw.sort((a, b) => a.id - b.id).forEach(p => {
+                playersToDraw.sort((a, b) => a.id - b.id).forEach(p => {
                     let playerDiv = document.createElement('div');
                     playerDiv.id = `player-${p.id}`;
                     playerDiv.className = 'player';
                     playerDiv.dataset.playerId = p.id;
 
-                    const photoURL = appState.customPlayerPhotos[p.id];
+                    const photoURL = this.getPhotoUrlForPlayer(p);
                     let numberClasses = [];
 
                     if (photoURL) {
                         const imageContent = `<div class="player-image-container"><img src="${photoURL}" style="transform: rotate(-135deg);"></div>`;

            showPlayerCard(playerId) {
-                const currentPlayers = appState.isViewingHistory 
+                const currentPlayers = appState.isViewingHistory 
                     ? appState.gameHistorySnapshots[document.getElementById('historySlider').value].players
                     : appState.players;
                 const player = currentPlayers.find(p => p.id === playerId);
                 if (!player) return;
+
+                this.currentPlayerInCardId = player.id;
+                this.currentPlayerPhotoVariant = 'auto';
@@
-                // Initialize photo with cached AI portrait or fallback while we generate
-                const imgEl = document.getElementById('playerCardImg');
-                const cachedUrl = appState.customPlayerPhotos[player.id];
-                if (cachedUrl) {
-                    imgEl.src = cachedUrl;
-                } else {
-                    imgEl.src = "https://i.imgur.com/AJ3InNO.png";
-                }
-
-                document.getElementById('playerCardModal').style.display = 'flex';
-
-                // Lazily ensure an AI-generated portrait for this player
-                this.ensurePlayerPhoto(player);
+                // Initialize photo + navigation state
+                this.updatePlayerCardPhoto(player);
+
+                document.getElementById('playerCardModal').style.display = 'flex';
+
+                // Lazily ensure an AI-generated portrait for this player (original)
+                this.ensurePlayerPhoto(player);
             },

            closePlayerCard(event) {
-                if (!event || event.target.id === 'playerCardModal') {
-                    document.getElementById('playerCardModal').style.display = 'none';
-                }
+                if (!event || event.target.id === 'playerCardModal') {
+                    document.getElementById('playerCardModal').style.display = 'none';
+                    this.currentPlayerInCardId = null;
+                    this.currentPlayerPhotoVariant = 'auto';
+                }
            },

            applyUrlFromCard() { alert('Photo URL feature requires full implementation.'); },
            removePhotoFromCard() { alert('Photo removal requires full implementation.'); },
+
+            // Decide which photo URL to show on the grid for a given player
+            getPhotoUrlForPlayer(player) {
+                const rec = utils.getPhotoRecord(player.id);
+                if (!rec) return null;
+
+                const isHistory = appState.isViewingHistory;
+                const isFinalistInView = !!player.confirmedFinalist;
+
+                // When viewing historical snapshots before confirmation, show original only
+                const canUseFinalistVariant = !isHistory && isFinalistInView;
+
+                if (canUseFinalistVariant && rec.finalist) {
+                    return rec.finalist;
+                }
+                return rec.original || rec.finalist || null;
+            },
+
+            updatePlayerCardPhoto(player) {
+                const imgEl = document.getElementById('playerCardImg');
+                const prevBtn = document.getElementById('playerCardPhotoPrev');
+                const nextBtn = document.getElementById('playerCardPhotoNext');
+                const modeLabel = document.getElementById('playerCardPhotoModeLabel');
+                if (!imgEl || !modeLabel || !prevBtn || !nextBtn) return;
+
+                const rec = utils.getPhotoRecord(player.id);
+                const isHistory = appState.isViewingHistory;
+                const isFinalistInView = !!player.confirmedFinalist;
+
+                const variants = [];
+                if (rec && rec.original) variants.push('original');
+                // Only expose finalist variant if the player is a finalist in this snapshot
+                if (rec && rec.finalist && !isHistory && isFinalistInView) {
+                    variants.push('finalist');
+                }
+
+                if (variants.length === 0) {
+                    imgEl.src = "https://i.imgur.com/AJ3InNO.png";
+                    modeLabel.textContent = "Base";
+                    prevBtn.disabled = true;
+                    nextBtn.disabled = true;
+                    return;
+                }
+
+                let currentVariant = this.currentPlayerPhotoVariant;
+                if (currentVariant === 'auto' || !variants.includes(currentVariant)) {
+                    currentVariant = variants[0];
+                    this.currentPlayerPhotoVariant = currentVariant;
+                }
+
+                const url =
+                    currentVariant === 'finalist'
+                        ? (rec.finalist || rec.original)
+                        : (rec.original || rec.finalist);
+
+                imgEl.src = url || "https://i.imgur.com/AJ3InNO.png";
+
+                if (currentVariant === 'finalist') {
+                    modeLabel.textContent = "Finalist Suit";
+                } else {
+                    modeLabel.textContent = "Original";
+                }
+
+                if (variants.length === 1) {
+                    prevBtn.disabled = true;
+                    nextBtn.disabled = true;
+                } else {
+                    prevBtn.disabled = false;
+                    nextBtn.disabled = false;
+                }
+            },
+
+            cyclePlayerCardPhoto(direction) {
+                if (!this.currentPlayerInCardId) return;
+
+                const currentPlayers = appState.isViewingHistory
+                    ? appState.gameHistorySnapshots[document.getElementById('historySlider').value].players
+                    : appState.players;
+                const player = currentPlayers.find(p => p.id === this.currentPlayerInCardId);
+                if (!player) return;
+
+                const rec = utils.getPhotoRecord(player.id);
+                if (!rec) return;
+
+                const isHistory = appState.isViewingHistory;
+                const isFinalistInView = !!player.confirmedFinalist;
+
+                const variants = [];
+                if (rec.original) variants.push('original');
+                if (rec.finalist && !isHistory && isFinalistInView) variants.push('finalist');
+
+                if (variants.length <= 1) return;
+
+                let currentVariant = this.currentPlayerPhotoVariant;
+                if (currentVariant === 'auto' || !variants.includes(currentVariant)) {
+                    currentVariant = variants[0];
+                }
+
+                const idx = variants.indexOf(currentVariant);
+                let nextIdx = idx + direction;
+                if (nextIdx < 0) nextIdx = variants.length - 1;
+                if (nextIdx >= variants.length) nextIdx = 0;
+
+                this.currentPlayerPhotoVariant = variants[nextIdx];
+                this.updatePlayerCardPhoto(player);
+            },

-            async ensurePlayerPhoto(player) {
+            async ensurePlayerPhoto(player) {
                 try {
                     // If we already have an AI portrait cached, nothing to do
-                    if (appState.customPlayerPhotos[player.id]) {
-                        const imgEl = document.getElementById('playerCardImg');
-                        if (imgEl) imgEl.src = appState.customPlayerPhotos[player.id];
-                        return;
-                    }
+                    const existingRec = utils.getPhotoRecord(player.id);
+                    if (existingRec && existingRec.original) {
+                        const imgEl = document.getElementById('playerCardImg');
+                        if (imgEl && this.currentPlayerInCardId === player.id) {
+                            imgEl.src = existingRec.original;
+                        }
+                        return;
+                    }
@@
-                    const traitsSummary = [
+                    const traitsSummary = [
                         `strong: ${player.baseStats.strength}`,
                         `agile: ${player.baseStats.agility}`,
                         `smart: ${player.baseStats.intelligence}`,
                         `charismatic: ${player.baseStats.charisma}`,
                         `lucky: ${player.baseStats.luck}`,
                     ].join(", ");
 
                     const playerNumber = utils.formatPlayerNumber(player.id);
-
-                    const strength = player.baseStats.strength || 0;
-                    let physiqueDesc = "with an average build";
-                    if (strength >= 1 && strength <= 4) {
-                        physiqueDesc = "with a slightly scrawny, slimmer build";
-                    } else if (strength >= 5 && strength <= 6) {
-                        physiqueDesc = "with an average, everyday build";
-                    } else if (strength >= 7 && strength <= 9) {
-                        physiqueDesc = "with an athletic, well-trained build";
-                    } else if (strength >= 10) {
-                        physiqueDesc = "with a very buff, muscular build";
-                    }
+                    const strength = player.baseStats.strength || 0;
+                    let physiqueDesc = "with an average build";
+                    if (strength === 1) {
+                        physiqueDesc = "with an extremely skinny, fragile, weak, and vulnerable-looking build";
+                    } else if (strength >= 2 && strength <= 4) {
+                        physiqueDesc = "with a noticeably skinny, underfed, and timid-looking build";
+                    } else if (strength >= 5 && strength <= 6) {
+                        physiqueDesc = "with an average, everyday build";
+                    } else if (strength >= 7 && strength <= 9) {
+                        physiqueDesc = "with an athletic, well-trained build";
+                    } else if (strength >= 10) {
+                        physiqueDesc = "with a very buff, muscular build";
+                    }
@@
-                    const prompt = [
+                    const prompt = [
                         "cinematic portrait of a Squid Game contestant,",
                         `${age} ${gender.toLowerCase()} from ${country},`,
                         `works as a ${occupation},`,
                         debtText + ",",
-                        `personality hinted by stats (${traitsSummary}),`,
-                        physiqueDesc + ",",
-                        `wearing the green Squid Game tracksuit with the number ${playerNumber} clearly visible on the chest,`,
+                        `personality hinted by stats (${traitsSummary}),`,
+                        physiqueDesc + ",",
+                        `wearing the green Squid Game tracksuit with the number ${playerNumber} clearly visible on the chest,`,
                         "dramatic lighting, realistic face, neutral background, upper body shot"
                     ].join(" ");
@@
-                    const result = await websim.imageGen({
+                    const result = await websim.imageGen({
                         prompt,
                         aspect_ratio: "1:1",
                     });
 
                     if (result && result.url) {
-                        appState.customPlayerPhotos[player.id] = result.url;
-                        const img = document.getElementById('playerCardImg');
-                        if (img) img.src = result.url;
+                        const rec = utils.getPhotoRecord(player.id) || {};
+                        rec.original = result.url;
+                        appState.customPlayerPhotos[player.id] = rec;
+                        const img = document.getElementById('playerCardImg');
+                        if (img && this.currentPlayerInCardId === player.id) img.src = result.url;
                         // Also refresh grid so this portrait appears on the diamond
                         ui.updateAllPlayerDivs();
                     }
                 } catch (err) {
                     console.error("AI portrait generation failed", err);
                 }
             },

-            async preloadAllPlayerPhotos() {
+            // Pre-generate portraits for players in resumable batches,
+            // and keep looping until all missing photos are generated.
+            async preloadAllPlayerPhotos() {
                 // If AI image generation is not available, skip quietly
                 if (typeof websim === "undefined" || !websim.imageGen) return;
@@
-                    const batch = playersNeeding.slice(startIndex, endIndex);
-                    if (batch.length === 0) {
-                        this.updatePhotoGenerationStatus();
-                        break;
-                    }
+                    const batch = playersNeeding.slice(startIndex, endIndex);
+                    if (batch.length === 0) {
+                        this.updatePhotoGenerationStatus();
+                        break;
+                    }
@@
-                    appState.photoGenerationOffset = endIndex;
-                    this.updatePhotoGenerationStatus();
-                }
-            },
-
-            updatePhotoGenerationStatus() {
-                const statusEl = document.getElementById('photoGenStatus');
-                if (!statusEl) return;
-
-                if (!appState.players || appState.players.length === 0) {
-                    statusEl.textContent = "";
-                    return;
-                }
-
-                const remaining = appState.players.filter(
-                    (p) => !appState.customPlayerPhotos[p.id]
-                ).length;
-
-                let baseText;
-                if (remaining <= 0) {
-                    baseText = "All photos generated";
-                } else {
-                    baseText = `${remaining} photos left`;
-                }
-
-                // Append countdown if auto-generation is enabled
-                if (appState.autoPhotoGenerationEnabled && typeof appState.photoAutoCountdown === "number") {
-                    baseText += ` | auto in ${appState.photoAutoCountdown}s`;
-                }
-
-                statusEl.textContent = baseText;
-            },
-
-            toggleAutoPhotoGeneration(enabled) {
+                    appState.photoGenerationOffset = endIndex;
+                    this.updatePhotoGenerationStatus();
+                }
+            },
+
+            updatePhotoGenerationStatus() {
+                const statusEl = document.getElementById('photoGenStatus');
+                if (!statusEl) return;
+
+                if (!appState.players || appState.players.length === 0) {
+                    statusEl.textContent = "";
+                    return;
+                }
+
+                const remaining = appState.players.filter(
+                    (p) => !utils.getPhotoRecord(p.id) || !utils.getPhotoRecord(p.id).original
+                ).length;
+
+                let baseText;
+                if (remaining <= 0) {
+                    baseText = "All photos generated";
+                } else {
+                    baseText = `${remaining} photos left`;
+                }
+
+                // Append countdown if auto-generation is enabled
+                if (appState.autoPhotoGenerationEnabled && typeof appState.photoAutoCountdown === "number") {
+                    baseText += ` | auto in ${appState.photoAutoCountdown}s`;
+                }
+
+                statusEl.textContent = baseText;
+            },
+
+            toggleAutoPhotoGeneration(enabled) {
                 appState.autoPhotoGenerationEnabled = enabled;
                 const toggleEl = document.getElementById('autoPhotoGenToggle');

        document.addEventListener("DOMContentLoaded", () => {
            // Initialize achievements
            achievements.init();
            // Set default tab
            document.querySelector('.tab-buttons .tab-link').click();
            // Initialize UI
            document.getElementById('history-slider-container').style.display = 'none';
-            ui.updateVipTab();
-            ui.updateEventButtons();
-            ui.updatePhotoGenerationStatus();
+            ui.updateVipTab();
+            ui.updateEventButtons();
+            ui.updatePhotoGenerationStatus();
            // Load saved theme
            const savedTheme = localStorage.getItem('squidGameTheme') || 'light';
            ui.setTheme(savedTheme);
            // ... existing code ...
        });

