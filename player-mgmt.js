// ============================================
// PLAYER MANAGEMENT
// ============================================
const playerMgmt = {
    applyPersonality() {
        const id = parseInt(document.getElementById('personalityPlayerId').value);
        const player = appState.players.find(p => p.id === id);
        if (!player) {
            alert("Player not found.");
            return;
        }

        if (player.isEasterEgg) {
            alert("This is an Easter Egg character. Their core traits are locked and cannot be edited.");
            return;
        }

        appState.isGameModified = true;
        
        const firstName = document.getElementById('playerFirstName').value.trim();
        const lastName = document.getElementById('playerLastName').value.trim();
        const nickname = document.getElementById('playerNickname').value.trim();
        const age = document.getElementById('playerAge').value;
        const gender = document.getElementById('playerGender').value;
        const country = document.getElementById('playerCountry').value.trim();
        const occupation = document.getElementById('playerOccupation').value.trim();
        const debt = document.getElementById('playerDebt').value;

        if (firstName) player.firstName = firstName;
        if (lastName) player.lastName = lastName;
        if (firstName || lastName) player.name = `${player.firstName} ${player.lastName}`;
        if (nickname) player.nickname = nickname;
        if (age) player.age = parseInt(age);
        if (gender) player.gender = gender;
        if (country) player.country = country;
        if (occupation) player.occupation = occupation;
        if (debt) player.debt = parseInt(debt);

        appState.personalityPlayers.add(id);
        
        log.event(`${utils.createPlayerLink(id)} personality updated.`);
        this.updatePersonalityList();
        ui.updateAllPlayerDivs();
    },

    updatePersonalityList() {
        const list = document.getElementById('personalityPlayers');
        if (!list) return;
        list.innerHTML = '';
        
        appState.personalityPlayers.forEach(id => {
            const player = appState.players.find(p => p.id === id);
            if (player) {
                let statusText = '';
                if (player.eliminated) {
                    const r = player.eliminationRound != null ? player.eliminationRound : '?';
                    statusText = ` - Eliminated GR${r}`;
                } else if (player.votedOut) {
                    const r = player.roundVotedOut != null ? player.roundVotedOut : '?';
                    statusText = ` - Out VR${r}`;
                }
                const li = document.createElement('li');
                li.innerHTML = `${utils.createPlayerLink(id)} (${player.name})${statusText}`;
                list.appendChild(li);
            }
        });
    },

    updateFavoritedPlayersList() {
        const listEl = document.getElementById('favoritedPlayersList');
        if (!listEl) return;
        listEl.innerHTML = '';

        if (!appState.favoritedPlayerIds || appState.favoritedPlayerIds.size === 0) {
            const li = document.createElement('li');
            li.innerHTML = '<em>No players have been starred yet.</em>';
            listEl.appendChild(li);
            return;
        }

        appState.favoritedPlayerIds.forEach(id => {
            const player = appState.players.find(p => p.id === id);
            if (!player) return;

            let statusText = 'In Game';
            if (player.eliminated) {
                const r = player.eliminationRound != null ? player.eliminationRound : '?';
                statusText = `Eliminated GR${r}`;
            } else if (player.votedOut) {
                const r = player.roundVotedOut != null ? player.roundVotedOut : '?';
                statusText = `Out VR${r}`;
            }

            const li = document.createElement('li');
            li.innerHTML = `${utils.createPlayerLink(player.id)} - ${player.name} - ${statusText}`;
            listEl.appendChild(li);
        });
    },

    applyTraits() {
        const id = parseInt(document.getElementById('traitPlayerId').value);
        const player = appState.players.find(p => p.id === id);
        if (!player) {
            alert("Player not found.");
            return;
        }

        if (player.isEasterEgg) {
            alert("This is an Easter Egg character. Their traits are locked and cannot be edited.");
            return;
        }

        appState.isGameModified = true;

        const str = parseInt(document.getElementById('traitStrength').value);
        const agi = parseInt(document.getElementById('traitAgility').value);
        const int = parseInt(document.getElementById('traitIntelligence').value);
        const cha = parseInt(document.getElementById('traitCharisma').value);
        const lck = parseInt(document.getElementById('traitLuck').value);
        const cow = parseInt(document.getElementById('traitCowardice').value);
        const grd = parseInt(document.getElementById('traitGreed').value);

        if (!isNaN(str)) player.baseStats.strength = str;
        if (!isNaN(agi)) player.baseStats.agility = agi;
        if (!isNaN(int)) player.baseStats.intelligence = int;
        if (!isNaN(cha)) player.baseStats.charisma = cha;
        if (!isNaN(lck)) player.baseStats.luck = lck;
        if (!isNaN(cow)) player.baseStats.cowardice = cow;
        if (!isNaN(grd)) player.baseStats.greed = grd;

        log.event(`${utils.createPlayerLink(id)} traits updated.`);
        ui.updateAllPlayerDivs();
    },

    loadPlayerTraits(id) {
        id = parseInt(id);
        const player = appState.players.find(p => p.id === id);
        if (!player) return;

        document.getElementById('traitStrength').value = player.baseStats.strength;
        document.getElementById('traitAgility').value = player.baseStats.agility;
        document.getElementById('traitIntelligence').value = player.baseStats.intelligence;
        document.getElementById('traitCharisma').value = player.baseStats.charisma;
        document.getElementById('traitLuck').value = player.baseStats.luck;
        document.getElementById('traitCowardice').value = player.baseStats.cowardice;
        document.getElementById('traitGreed').value = player.baseStats.greed;

        const locked = !!player.isEasterEgg;
        const notice = locked ? " (locked – Easter Egg canonical traits)" : "";
        document.getElementById('traitPlayerId').title =
            `Editing traits for P${utils.formatPlayerNumber(player.id)}${notice}`;
    },

    randomizeTraitsForSelectedPlayer() {
        const id = parseInt(document.getElementById('traitPlayerId').value);
        const player = appState.players.find(p => p.id === id);
        if (!player) return;

        if (player.isEasterEgg) {
            alert("This is an Easter Egg character. Their traits are locked and cannot be randomized.");
            return;
        }

        player.baseStats.strength = Math.floor(Math.random() * 15) + 1;
        player.baseStats.agility = Math.floor(Math.random() * 15) + 1;
        player.baseStats.intelligence = Math.floor(Math.random() * 15) + 1;
        player.baseStats.charisma = Math.floor(Math.random() * 15) + 1;
        player.baseStats.luck = Math.floor(Math.random() * 15) + 1;
        player.baseStats.cowardice = Math.floor(Math.random() * 15);
        player.baseStats.greed = Math.floor(Math.random() * 15);

        this.loadPlayerTraits(id);
    },

    applySuperpower() {
        const id = parseInt(document.getElementById('superpowerPlayerId').value);
        const protection = parseInt(document.getElementById('protectionLevel').value);
        
        const player = appState.players.find(p => p.id === id);
        if (!player) {
            alert("Player not found.");
            return;
        }

        appState.isGameModified = true;
        player.protection = protection;
        appState.superpoweredPlayerIds.add(id);

        log.event(`${utils.createPlayerLink(id)} given protection level ${protection}.`);
        this.updateSuperpowerList();
    },

    updateSuperpowerList() {
        const list = document.getElementById('superpoweredPlayers');
        if (!list) return;
        list.innerHTML = '';
        
        appState.superpoweredPlayerIds.forEach(id => {
            const player = appState.players.find(p => p.id === id);
            if (player) {
                const li = document.createElement('li');
                li.innerHTML = `${utils.createPlayerLink(id)} - Prot: ${player.protection}`;
                list.appendChild(li);
            }
        });
    },

    manualElimination(isRandom, playerIdOverride = null, playerIdInputId = 'manualPlayerId_other', reasonInputId = 'manualActionReason_other') {
        if (appState.isViewingArchivedGame || appState.isViewingHistory) return;
        
        let playerId;
        if (playerIdOverride !== null) {
            playerId = playerIdOverride;
        } else {
            playerId = parseInt(document.getElementById(playerIdInputId).value);
        }

        const player = appState.players.find(p => p.id === playerId);
        if (!player) {
            alert("Player not found.");
            return;
        }

        if (player.eliminated || player.votedOut) {
            alert("Player is already out.");
            return;
        }

        appState.isGameModified = true;
        appState.round++;
        
        player.eliminated = true;
        player.eliminationRound = appState.round;

        const reasonEl = document.getElementById(reasonInputId);
        const reason = reasonEl && reasonEl.value.trim() ? reasonEl.value : 'was manually eliminated';

        log.event(`${utils.createPlayerLink(playerId)} ${reason}`);
        achievements.unlock('handOfGod');
        
        gameEngine.takeSnapshot(appState.round, `Manual: ${reason}`);
        ui.updateAllPlayerDivs();
        ui.updateCounters();
    },

    eliminateRandomPlayer() {
        const activePlayers = utils.getActivePlayers();
        if (activePlayers.length === 0) {
            alert("No active players.");
            return;
        }
        
        const randomPlayer = activePlayers[Math.floor(Math.random() * activePlayers.length)];
        this.manualElimination(true, randomPlayer.id);
    },

    revivePlayer(playerIdInputId) {
        if (appState.isViewingArchivedGame || appState.isViewingHistory) return;
        
        const playerId = parseInt(document.getElementById(playerIdInputId).value);
        const player = appState.players.find(p => p.id === playerId);
        
        if (!player) {
            alert("Player not found.");
            return;
        }

        if (!player.eliminated && !player.votedOut) {
            alert("Player is not eliminated.");
            return;
        }

        appState.isGameModified = true;
        player.eliminated = false;
        player.votedOut = false;
        player.eliminationRound = null;

        log.event(`${utils.createPlayerLink(playerId)} has been revived!`);
        achievements.unlock('necromancer');
        
        gameEngine.takeSnapshot(appState.round, "Revival");
        ui.updateAllPlayerDivs();
        ui.updateCounters();
    },

    manualInjury(playerIdOverride = null, doLog = true, isEventInjury = false) {
        if (appState.isViewingArchivedGame) return;
        
        const playerId = playerIdOverride || parseInt(document.getElementById('manualInjuryPlayerId').value);
        const player = appState.players.find(p => p.id === playerId);
        
        if (!player || player.eliminated || player.votedOut) {
            if (!playerIdOverride) alert("Player not found or not active.");
            return;
        }

        const injuryType = document.querySelector('input[name="injuryType"]:checked').value;
        const reasonEl = document.getElementById('manualInjuryReason');
        const reason = reasonEl && reasonEl.value.trim() ? reasonEl.value : 'was injured';

        let type = 'Minor';
        let roundsRemaining = 1;
        let cowardiceDebuff = 1;
        if (injuryType === 'regular') {
            type = 'Regular';
            roundsRemaining = 2;
            cowardiceDebuff = 1;
        } else if (injuryType === 'major') {
            type = 'Major';
            roundsRemaining = 3;
            cowardiceDebuff = 2;
        }

        player.injury = {
            type,
            roundsRemaining,
            cowardiceDebuff,
            reason,
        };

        if (doLog) {
            log.event(
                `${utils.createPlayerLink(playerId)} ${reason} (${type} injury, ${roundsRemaining} round${roundsRemaining === 1 ? '' : 's'}).`
            );
        }
        
        ui.updateAllPlayerDivs();
    },

    removeInjury() {
        if (appState.isViewingArchivedGame) return;
        
        const playerId = parseInt(document.getElementById('manualInjuryPlayerId').value);
        const player = appState.players.find(p => p.id === playerId);
        
        if (!player) {
            alert("Player not found.");
            return;
        }

        player.injury = null;
        log.event(`${utils.createPlayerLink(playerId)} injury removed.`);
        ui.updateAllPlayerDivs();
    },

    makePlayerPregnant() {
        if (appState.isViewingArchivedGame) return;
        
        const playerId = parseInt(document.getElementById('pregnantPlayerId').value);
        const player = appState.players.find(p => p.id === playerId);
        
        if (!player || player.eliminated || player.votedOut) {
            alert("Player not found or not active.");
            return;
        }

        if (player.gender !== 'Female') {
            alert("Only female players can be pregnant.");
            return;
        }

        appState.isGameModified = true;
        player.isPregnant = true;
        player.protection += 1;
        appState.superpoweredPlayerIds.add(playerId);

        log.event(`${utils.createPlayerLink(playerId)} is now pregnant.`);
        playerMgmt.updateSuperpowerList();
        ui.updateAllPlayerDivs();
    },

    removePregnancy() {
        if (appState.isViewingArchivedGame) return;
        
        const playerId = parseInt(document.getElementById('pregnantPlayerId').value);
        const player = appState.players.find(p => p.id === playerId);
        
        if (!player) {
            alert("Player not found.");
            return;
        }

        player.isPregnant = false;
        if (player.hasBaby) {
            const baby = appState.players.find(p => p.id === player.hasBaby);
            if (baby) {
                baby.eliminated = true;
                baby.eliminationRound = appState.round;
            }
            player.hasBaby = null;
        }

        log.event(`${utils.createPlayerLink(playerId)} pregnancy removed.`);
        ui.updateAllPlayerDivs();
    },

    handlePregnancy() {
        const potentialMothers = appState.players.filter(p => 
            p.gender === 'Female' && 
            p.age >= 18 && 
            p.age <= 40 && 
            !p.isEasterEgg && 
            !p.isPreviousWinner
        );
        
        if (potentialMothers.length > 0) {
            const pregnantPlayer = potentialMothers[Math.floor(Math.random() * potentialMothers.length)];
            pregnantPlayer.isPregnant = true;
            pregnantPlayer.protection += 1;
            appState.superpoweredPlayerIds.add(pregnantPlayer.id);
            log.event(`${utils.createPlayerLink(pregnantPlayer.id)} (${pregnantPlayer.name}) has entered the games while pregnant.`);
        }
    },

    tryAddPreviousWinner() {
        const loneWinners = appState.allGamesHistory.filter(g => g.winnerId !== null);
        if (loneWinners.length === 0) return;

        const randomWinnerRecord = loneWinners[Math.floor(Math.random() * loneWinners.length)];
        const winnerData = randomWinnerRecord.fullState.players.find(p => p.id === randomWinnerRecord.winnerId);
        if (!winnerData) return;

        const nonSpecialPlayers = appState.players.filter(p => 
            !p.isEasterEgg && 
            !p.isPreviousWinner && 
            p.id > 10
        );
        
        if (nonSpecialPlayers.length === 0) return;

        const playerToReplace = nonSpecialPlayers[Math.floor(Math.random() * nonSpecialPlayers.length)];
        const originalId = playerToReplace.id;
        const replacedIndex = appState.players.findIndex(p => p.id === originalId);

        if (replacedIndex === -1) return;

        // Create the previous winner player
        const previousWinner = {
            ...winnerData,
            id: originalId,
            isPreviousWinner: true,
            eliminated: false,
            votedOut: false,
            eliminationRound: null,
            protection: 1,
            allies: [],
            enemies: [],
            actionLog: [`Returned to the games as a previous winner from Game #${randomWinnerRecord.gameNumber}.`],
        };

        appState.players[replacedIndex] = previousWinner;
        appState.superpoweredPlayerIds.add(originalId);

        log.event(`${utils.createPlayerLink(originalId)} (${previousWinner.name}) has returned as a previous winner!`);
    },

    updateWinnerDefaultId() {
        const select = document.getElementById('previousWinnerSelect');
        const idInput = document.getElementById('newWinnerPlayerId');
        if (!select || !idInput) return;

        const selectedValue = select.value;
        if (selectedValue) {
            // Suggest a random available ID
            const usedIds = new Set(appState.players.map(p => p.id));
            let suggestedId = 1;
            while (usedIds.has(suggestedId) && suggestedId <= appState.players.length) {
                suggestedId++;
            }
            idInput.value = suggestedId;
        }
    },

    addPreviousWinnerToGame() {
        const select = document.getElementById('previousWinnerSelect');
        const idInput = document.getElementById('newWinnerPlayerId');
        if (!select || !idInput) return;

        const gameIndex = parseInt(select.value);
        const targetId = parseInt(idInput.value);

        if (isNaN(gameIndex) || isNaN(targetId) || targetId < 1) {
            alert("Please select a winner and enter a valid player ID.");
            return;
        }

        const gameRecord = appState.allGamesHistory[gameIndex];
        if (!gameRecord || !gameRecord.winnerId) {
            alert("Invalid game selection.");
            return;
        }

        const winnerData = gameRecord.fullState.players.find(p => p.id === gameRecord.winnerId);
        if (!winnerData) {
            alert("Could not find winner data.");
            return;
        }

        const existingPlayer = appState.players.find(p => p.id === targetId);
        if (!existingPlayer) {
            alert("Target player ID does not exist in current game.");
            return;
        }

        const replacedIndex = appState.players.findIndex(p => p.id === targetId);
        if (replacedIndex === -1) return;

        appState.isGameModified = true;

        const previousWinner = {
            ...winnerData,
            id: targetId,
            isPreviousWinner: true,
            eliminated: false,
            votedOut: false,
            eliminationRound: null,
            protection: 1,
            allies: [],
            enemies: [],
            actionLog: [`Manually added as a previous winner from Game #${gameRecord.gameNumber}.`],
        };

        appState.players[replacedIndex] = previousWinner;
        appState.superpoweredPlayerIds.add(targetId);
        appState.personalityPlayers.add(targetId);

        log.event(`${utils.createPlayerLink(targetId)} (${previousWinner.name}) has been added as a previous winner!`);
        this.updateSuperpowerList();
        this.updatePersonalityList();
        ui.updateAllPlayerDivs();
    },

    populatePreviousWinnerSelect() {
        const select = document.getElementById('previousWinnerSelect');
        if (!select) return;

        select.innerHTML = '<option value="">-- Select a Winner --</option>';
        appState.allGamesHistory.forEach((game, index) => {
            if (game.winnerId) {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = `Game #${game.gameNumber}: ${game.winnerName}`;
                select.appendChild(option);
            }
        });
    },

    /**
     * Initialize the Easter Egg character list in the Personalities tab.
     * Shows all available canon characters with buttons to add them to the game.
     */
    initEasterEggCharacterList() {
        const container = document.getElementById('easterEggCharacterList');
        if (!container) return;
        container.innerHTML = '';

        if (typeof manualEasterEggData === 'undefined') return;

        const sortedIds = Object.keys(manualEasterEggData).map(Number).sort((a, b) => a - b);

        sortedIds.forEach(id => {
            const eggData = manualEasterEggData[id];
            if (!eggData) return;

            const existingPlayer = appState.players.find(p => p.id === id);
            const isInGame = existingPlayer && existingPlayer.isEasterEgg;
            const slotTaken = existingPlayer && !existingPlayer.isEasterEgg;

            const div = document.createElement('div');
            div.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.1);';

            const label = document.createElement('span');
            label.innerHTML = `<strong>P${utils.formatPlayerNumber(id)}</strong>: ${eggData.name}`;

            const btn = document.createElement('button');
            btn.style.cssText = 'padding:2px 8px;font-size:0.8em;';

            if (isInGame) {
                btn.textContent = 'In Game';
                btn.disabled = true;
                btn.style.opacity = '0.5';
            } else if (slotTaken) {
                btn.textContent = 'Add (Replace)';
                btn.onclick = () => this.addEasterEggToGame(id);
            } else {
                btn.textContent = 'Add';
                btn.onclick = () => this.addEasterEggToGame(id);
            }

            div.appendChild(label);
            div.appendChild(btn);
            container.appendChild(div);
        });
    },

    /**
     * Add an Easter Egg character to the current game at their canonical ID.
     */
    addEasterEggToGame(eggId) {
        if (typeof manualEasterEggData === 'undefined') return;

        const eggData = manualEasterEggData[eggId];
        if (!eggData) {
            alert('Easter Egg data not found.');
            return;
        }

        const existingPlayer = appState.players.find(p => p.id === eggId);
        if (!existingPlayer) {
            alert(`Player slot ${eggId} does not exist in this game. Start a game with at least ${eggId} players.`);
            return;
        }

        if (existingPlayer.isEasterEgg) {
            alert('This Easter Egg character is already in the game.');
            return;
        }

        appState.isGameModified = true;

        // Apply easter egg data to the existing player slot
        existingPlayer.name = eggData.name;
        existingPlayer.isEasterEgg = true;
        existingPlayer.protection = 1;

        if (eggData.personality) {
            if (eggData.personality.age) existingPlayer.age = eggData.personality.age;
            if (eggData.personality.gender) existingPlayer.gender = eggData.personality.gender;
            if (eggData.personality.country) existingPlayer.country = eggData.personality.country;
            if (eggData.personality.occupation) existingPlayer.occupation = eggData.personality.occupation;
            if (typeof eggData.personality.debt === 'number') existingPlayer.debt = eggData.personality.debt;
        }

        if (eggData.stats) {
            existingPlayer.baseStats = { ...existingPlayer.baseStats, ...eggData.stats };
        }

        if (eggData.photoURL) {
            appState.customPlayerPhotos[eggId] = eggData.photoURL;
            existingPlayer.photoAlbum = existingPlayer.photoAlbum || [];
            if (!existingPlayer.photoAlbum.includes(eggData.photoURL)) {
                existingPlayer.photoAlbum.push(eggData.photoURL);
            }
        }

        appState.usedEasterEggIds.add(eggId);
        appState.superpoweredPlayerIds.add(eggId);
        appState.personalityPlayers.add(eggId);

        log.event(`${utils.createPlayerLink(eggId)} (${eggData.name}) has been added as an Easter Egg character!`);
        achievements.unlock('specialCharacter');

        this.initEasterEggCharacterList();
        this.updateSuperpowerList();
        this.updatePersonalityList();
        ui.updateAllPlayerDivs();
    },
};
