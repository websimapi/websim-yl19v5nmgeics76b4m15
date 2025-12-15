// ============================================
// ADDITIONAL GAME HANDLERS
// ============================================

// Extend gameEngine with additional game handlers
Object.assign(gameEngine, {
    toggleAnimationMode() {
        if (appState.isViewingArchivedGame) return;
        this.animationModeEnabled = !this.animationModeEnabled;
        const btn = document.getElementById('animationModeBtn');
        const pauseBtn = document.getElementById('pausePlayButton');
        
        if (this.animationModeEnabled) {
            if (btn) btn.innerText = 'Arm Animation Mode (ON)';
            if (pauseBtn) pauseBtn.disabled = false;
        } else {
            if (btn) btn.innerText = 'Arm Animation Mode';
            if (pauseBtn) pauseBtn.disabled = true;
        }
    },

    pausePlayAnimation() {
        this.animationPaused = !this.animationPaused;
        const btn = document.getElementById('pausePlayButton');
        if (btn) btn.innerText = this.animationPaused ? 'Resume Animation' : 'Pause Animation';
        
        if (!this.animationPaused && this.animationTimeoutId === null) {
            this.processNextAnimatedElimination();
        }
    },

    playPresetGame(name, minPct, maxPct, desc) {
        if (appState.isViewingArchivedGame || appState.isViewingHistory) return;
        if (name === 'Rebellion') {
            this.handleRebellion();
            return;
        }
        const activePlayers = utils.getActivePlayers();
        if (activePlayers.length === 0) return;
        const pct = minPct + Math.random() * (maxPct - minPct);
        const numToEliminate = Math.max(1, Math.floor(activePlayers.length * (pct / 100)));
        appState.round++;
        this.eliminatePlayers(numToEliminate, desc, [], this.animationModeEnabled);
    },

    handleHopscotch() {
        if (!this.preRoundUpdate()) return;
        const activePlayers = utils.getActivePlayers();
        if (activePlayers.length === 0) return;

        appState.round++;
        const grLabel = `GR ${appState.round}`;
        appState.eliminationOrder.push({ isHeader: true, text: `${grLabel}: Hopscotch` });

        const eliminatedThisRound = [];

        const weightedRoll = (player) => {
            const base = Math.floor(Math.random() * 6) + 1;
            const luck = utils.getEffectiveStat(player, 'luck') || 0;
            const luckFactor = (luck - 7.5) / 15;
            let roll = base;
            if (Math.random() < Math.abs(luckFactor)) {
                roll += luckFactor > 0 ? 1 : -1;
            }
            return Math.max(1, Math.min(6, roll));
        };

        activePlayers.forEach(p => {
            p.actionLog = p.actionLog || [];
            const r1 = weightedRoll(p), r2 = weightedRoll(p), r3 = weightedRoll(p);
            const total = r1 + r2 + r3;
            const pass = total >= 11;

            if (!pass) {
                const survived = this.checkSurvivalMechanics(p, 'Hopscotch');
                if (!survived) {
                    p.eliminated = true;
                    p.eliminationRound = appState.round;
                    p.wasFinalistWhenEliminated = p.isFinalist;
                    p.actionLog.push(`${grLabel}: Rolled [${r1}, ${r2}, ${r3}] = ${total}... FAILED.`);
                    eliminatedThisRound.push(p);
                } else {
                    p.actionLog.push(`${grLabel}: Rolled [${r1}, ${r2}, ${r3}] = ${total}... FAILED but protected.`);
                }
            } else {
                p.actionLog.push(`${grLabel}: Rolled [${r1}, ${r2}, ${r3}] = ${total}... PASSED.`);
            }
        });

        eliminatedThisRound.forEach(p => {
            appState.eliminationOrder.push({ playerId: p.id, round: appState.round, reason: "failed Hopscotch.", isHeader: false });
        });

        log.event(`${grLabel} (Hopscotch): ${eliminatedThisRound.length} player(s) eliminated.`);
        if (appState.firstEliminationOfGame && eliminatedThisRound.length > 0) {
            appState.currentPrizePot = appState.originalRosterSize * 100000000;
            appState.firstEliminationOfGame = false;
        }
        this.takeSnapshot(appState.round, "Hopscotch");
        ui.updateAllPlayerDivs();
        ui.updateCounters();
        ui.updateEliminationOrderList();
        ui.updateHistorySliderUI();
        this.checkGameOver();
    },

    handleMingle() {
        if (!this.preRoundUpdate()) return;
        const activePlayers = utils.getActivePlayers();
        if (activePlayers.length === 0) return;

        appState.round++;
        const grLabel = `GR ${appState.round}`;
        appState.eliminationOrder.push({ isHeader: true, text: `${grLabel}: Mingle` });

        let playersInGame = activePlayers.slice();
        const mingleSubRounds = ["first", "second", "third", "fourth", "fifth"];
        const eliminatedInOrder = [];
        const roundDetails = [];

        mingleSubRounds.forEach(roundName => {
            if (playersInGame.length === 0) return;
            const failedThisSubRound = [];
            const survivorsNext = [];

            playersInGame.forEach(p => {
                p.actionLog = p.actionLog || [];
                const cha = utils.getEffectiveStat(p, "charisma") || 0;
                const lck = utils.getEffectiveStat(p, "luck") || 0;
                const cow = utils.getEffectiveStat(p, "cowardice") || 0;
                let failChance = Math.max(0.01, Math.min(0.9, 0.15 - (cha + lck - cow) / 150));

                if (Math.random() < failChance) {
                    const survived = this.checkSurvivalMechanics(p, `Mingle (${roundName} round)`);
                    if (survived) {
                        survivorsNext.push(p);
                    } else {
                        p.eliminated = true;
                        p.eliminationRound = appState.round;
                        p.wasFinalistWhenEliminated = p.isFinalist;
                        p.actionLog.push(`${grLabel}: Failed Mingle in the ${roundName} round.`);
                        failedThisSubRound.push(p);
                        eliminatedInOrder.push(p);
                    }
                } else {
                    survivorsNext.push(p);
                }
            });
            playersInGame = survivorsNext;
            if (failedThisSubRound.length > 0) {
                roundDetails.push(`Eliminated in ${roundName} round: ${failedThisSubRound.map(p => utils.createPlayerLink(p.id)).join(", ")}`);
            }
        });

        playersInGame.forEach(p => { p.actionLog = p.actionLog || []; p.actionLog.push(`${grLabel}: Passed Mingle.`); });

        if (eliminatedInOrder.length === 0) {
            log.event(`${grLabel} (Mingle): Few eliminations occurred.`);
        } else {
            eliminatedInOrder.forEach(p => {
                appState.eliminationOrder.push({ playerId: p.id, round: appState.round, reason: "failed to form a group in Mingle.", isHeader: false });
            });
            log.event(`${grLabel} (Mingle): ${eliminatedInOrder.length} player(s) eliminated.`, roundDetails.join("<br>"));
        }
        if (appState.firstEliminationOfGame && eliminatedInOrder.length > 0) appState.firstEliminationOfGame = false;
        this.takeSnapshot(appState.round, "Mingle");
        ui.updateAllPlayerDivs();
        ui.updateCounters();
        ui.updateEliminationOrderList();
        ui.updateHistorySliderUI();
        this.checkGameOver();
    },

    handleHotPotato() {
        if (!this.preRoundUpdate()) return;
        const activePlayers = utils.getActivePlayers();
        if (activePlayers.length < 2) return;

        appState.round++;
        const grLabel = `GR ${appState.round}`;
        appState.eliminationOrder.push({ isHeader: true, text: `${grLabel}: Hot Potato` });

        const targetToEliminate = Math.max(1, Math.floor(activePlayers.length * 0.75));
        activePlayers.forEach(p => {
            const luck = utils.getEffectiveStat(p, 'luck') || 0;
            p.eliminationRisk = 50 - (luck * 2.5);
            p._hotPotatoSortKey = Math.random();
        });

        const sortedByRisk = activePlayers.slice().sort((a, b) => {
            if (b.eliminationRisk !== a.eliminationRisk) return b.eliminationRisk - a.eliminationRisk;
            return a._hotPotatoSortKey - b._hotPotatoSortKey;
        });

        const initialElimCandidates = sortedByRisk.slice(0, Math.min(targetToEliminate, sortedByRisk.length));
        const eliminatedThisRound = [];
        const interactionSummaries = [];

        for (const victim of initialElimCandidates) {
            if (victim.eliminated || victim.votedOut) continue;
            victim.actionLog = victim.actionLog || [];

            const survived = this.checkSurvivalMechanics(victim, "Hot Potato");
            if (survived) {
                victim.actionLog.push(`${grLabel}: Narrowly avoided being left with the Hot Potato.`);
                continue;
            }

            victim.eliminated = true;
            victim.eliminationRound = appState.round;
            victim.wasFinalistWhenEliminated = victim.isFinalist;
            eliminatedThisRound.push(victim);

            const eliminatedIds = new Set(eliminatedThisRound.map(p => p.id));
            const survivorCandidates = activePlayers.filter(p => !eliminatedIds.has(p.id) && p.id !== victim.id);

            if (survivorCandidates.length > 0) {
                const passer = survivorCandidates[Math.floor(Math.random() * survivorCandidates.length)];
                passer.actionLog = passer.actionLog || [];
                passer.actionLog.push(`${grLabel}: Passed the final Hot Potato to P${utils.formatPlayerNumber(victim.id)}.`);
                victim.actionLog.push(`${grLabel}: Was passed the final Hot Potato by P${utils.formatPlayerNumber(passer.id)}.`);
                this.creditElimination(passer.id, victim.id);
                interactionSummaries.push(`${utils.createPlayerLink(passer.id)} passed the final potato to ${utils.createPlayerLink(victim.id)}.`);
            } else {
                victim.actionLog.push(`${grLabel}: Was left holding the Hot Potato when it exploded.`);
                interactionSummaries.push(`${utils.createPlayerLink(victim.id)} was left with the potato at the end.`);
            }
        }

        const eliminatedIdsFinal = new Set(eliminatedThisRound.map(p => p.id));
        activePlayers.forEach(p => { if (!eliminatedIdsFinal.has(p.id)) { p.actionLog = p.actionLog || []; p.actionLog.push(`${grLabel}: Passed Hot Potato.`); } });

        if (eliminatedThisRound.length === 0) {
            log.event(`${grLabel} (Hot Potato): Few eliminations occurred.`);
        } else {
            eliminatedThisRound.forEach(p => {
                appState.eliminationOrder.push({ playerId: p.id, round: appState.round, reason: 'was holding the Hot Potato when it exploded.', isHeader: false });
            });
            log.event(`${grLabel} (Hot Potato): ${eliminatedThisRound.length} player(s) eliminated.`, interactionSummaries.join('<br>'));
        }
        if (appState.firstEliminationOfGame && eliminatedThisRound.length > 0) appState.firstEliminationOfGame = false;
        this.takeSnapshot(appState.round, 'Hot Potato');
        ui.updateAllPlayerDivs();
        ui.updateCounters();
        ui.updateEliminationOrderList();
        ui.updateHistorySliderUI();
        this.checkGameOver();
    },

    handleRebellion() {
        if (appState.isViewingArchivedGame || appState.isViewingHistory) return;
        const activePlayers = utils.getActivePlayers();
        if (activePlayers.length < 2) { log.event("Rebellion failed – not enough players."); return; }

        appState.round++;
        const grLabel = `GR ${appState.round}`;
        appState.eliminationOrder.push({ isHeader: true, text: `${grLabel}: Rebellion` });

        const isSeason2Active = appState.season2ModeActive === true;
        const xVoters = isSeason2Active ? activePlayers.filter(p => p.currentVote === 'X') : [];
        const isRealRebellion = isSeason2Active && xVoters.length > 0;
        const rebellionPool = isRealRebellion ? xVoters : activePlayers;
        const eliminationPercent = isRealRebellion ? 0.30 : 0.10;
        const targetEliminations = Math.max(1, Math.floor(rebellionPool.length * eliminationPercent));

        const rebellionDeathReasons = ["Died while getting flanked", "Got shot by guard", "Died while shot on the stairs", "Died in the control room"];

        if (isRealRebellion && Math.random() < 0.10) {
            log.event("REBELLION SUCCESSFUL! The players have overthrown the game!");
            const leader = rebellionPool.slice().sort((a, b) => 
                ((utils.getEffectiveStat(b, 'charisma') || 0) + (utils.getEffectiveStat(b, 'strength') || 0)) -
                ((utils.getEffectiveStat(a, 'charisma') || 0) + (utils.getEffectiveStat(a, 'strength') || 0))
            )[0];
            log.event(`${utils.createPlayerLink(leader.id)} took down the Front Man!`);
            achievements.unlock('revolution');
            ui.updateAllPlayerDivs();
            ui.updateCounters();
            return;
        }

        log.event(`${grLabel} (Rebellion): The uprising was crushed by overwhelming force.`);
        const eliminatedThisRound = [];
        const availablePlayersToPickFrom = rebellionPool.slice();

        while (availablePlayersToPickFrom.length > 0 && eliminatedThisRound.length < targetEliminations) {
            const idx = Math.floor(Math.random() * availablePlayersToPickFrom.length);
            const player = availablePlayersToPickFrom.splice(idx, 1)[0];
            if (!player) continue;
            const survived = this.checkSurvivalMechanics(player, "Rebellion suppression");
            if (survived) continue;

            player.eliminated = true;
            player.eliminationRound = appState.round;
            player.wasFinalistWhenEliminated = player.isFinalist;
            player.actionLog = player.actionLog || [];
            player.actionLog.push(`${grLabel}: ${rebellionDeathReasons[Math.floor(Math.random() * rebellionDeathReasons.length)]} during the rebellion.`);
            eliminatedThisRound.push(player);
        }

        eliminatedThisRound.forEach(p => {
            appState.eliminationOrder.push({ playerId: p.id, round: appState.round, reason: "died during the failed rebellion.", isHeader: false });
        });

        if (eliminatedThisRound.length > 0) {
            log.event(`${grLabel} (Rebellion): ${eliminatedThisRound.length} player(s) eliminated.`, `Casualties: ${eliminatedThisRound.map(p => utils.createPlayerLink(p.id)).join(', ')}`);
        }
        this.takeSnapshot(appState.round, "Rebellion");
        ui.updateAllPlayerDivs();
        ui.updateCounters();
        ui.updateEliminationOrderList();
        ui.updateHistorySliderUI();
        this.checkGameOver();
    },

    handleBathroomFight() {
        if (appState.isViewingArchivedGame || appState.usedEvents.has('bathroomFight')) return;
        if (!appState.season2ModeActive) { alert("Bathroom Fight requires Voting Mode (Season 2) to be enabled."); return; }

        const activePlayers = utils.getActivePlayers();
        if (activePlayers.length < 4) return;

        const grLabel = appState.round > 0 ? `GR ${appState.round}` : 'Event';
        appState.usedEvents.add('bathroomFight');

        const xVoters = activePlayers.filter(p => p.currentVote === 'X');
        const oVoters = activePlayers.filter(p => p.currentVote === 'O');
        if (xVoters.length === 0 || oVoters.length === 0) {
            log.event("Event: Bathroom Fight fizzled out – both X and O sides are not present.");
            ui.updateEventButtons();
            return;
        }

        const shuffleArr = arr => arr.slice().sort(() => Math.random() - 0.5);
        const xShuffled = shuffleArr(xVoters);
        const oShuffled = shuffleArr(oVoters);
        const maxPairsPossible = Math.min(xShuffled.length, oShuffled.length);
        const skirmishPairs = Math.floor(Math.random() * 6) + Math.min(5, maxPairsPossible);

        const pairs = [];
        for (let i = 0; i < skirmishPairs && i < maxPairsPossible; i++) pairs.push([xShuffled[i], oShuffled[i]]);

        const eliminatedThisEvent = [];
        const battleLines = [];
        const combatScore = p => (utils.getEffectiveStat(p, 'strength') || 0) + (utils.getEffectiveStat(p, 'agility') || 0) + Math.random() * 10;

        pairs.forEach(([xP, oP]) => {
            if (!xP || !oP || xP.eliminated || oP.eliminated) return;
            xP.actionLog = xP.actionLog || [];
            oP.actionLog = oP.actionLog || [];

            const xScore = combatScore(xP), oScore = combatScore(oP);
            let killer = xScore >= oScore ? xP : oP;
            let victim = xScore >= oScore ? oP : xP;

            const survived = this.checkSurvivalMechanics(victim, "Bathroom Fight");
            if (survived) {
                victim.actionLog.push(`${grLabel}: Event: Survived the Bathroom Fight after being overpowered by P${utils.formatPlayerNumber(killer.id)}.`);
                battleLines.push(`${utils.createPlayerLink(killer.id)} nearly killed ${utils.createPlayerLink(victim.id)} but they were saved.`);
            } else {
                victim.eliminated = true;
                victim.eliminationRound = appState.round;
                victim.wasFinalistWhenEliminated = victim.isFinalist;
                eliminatedThisEvent.push(victim);
                killer.eliminationsByPlayer = (killer.eliminationsByPlayer || 0) + 1;
                killer.actionLog.push(`${grLabel}: Event: Killed P${utils.formatPlayerNumber(victim.id)} during the Bathroom Fight.`);
                victim.actionLog.push(`${grLabel}: Event: Killed by P${utils.formatPlayerNumber(killer.id)} during the Bathroom Fight.`);
                battleLines.push(`${utils.createPlayerLink(killer.id)} killed ${utils.createPlayerLink(victim.id)} in the Bathroom Fight.`);
            }
        });

        appState.round++;
        log.event(`Event: Bathroom Fight — ${eliminatedThisEvent.length} player(s) killed.`, battleLines.join('<br>'));
        this.takeSnapshot(appState.round, "Bathroom Fight");
        ui.updateAllPlayerDivs();
        ui.updateCounters();
        ui.updateEventButtons();
    },

    handleXvsO() {
        if (appState.isViewingArchivedGame || appState.usedEvents.has('xVsO')) return;
        if (!appState.season2ModeActive) { alert("X vs O Brawl requires Voting Mode (Season 2) to be enabled."); return; }

        const activePlayers = utils.getActivePlayers();
        const xSide = activePlayers.filter(p => p.currentVote === 'X');
        const oSide = activePlayers.filter(p => p.currentVote === 'O');
        if (xSide.length === 0 || oSide.length === 0) {
            log.event("Event: X vs O Brawl could not start – both sides must have voters.");
            ui.updateEventButtons();
            return;
        }

        appState.usedEvents.add('xVsO');
        const grLabel = appState.round > 0 ? `GR ${appState.round}` : 'Event';

        const shuffleArr = arr => arr.slice().sort(() => Math.random() - 0.5);
        const pairs = [];
        const xShuffled = shuffleArr(xSide), oShuffled = shuffleArr(oSide);
        const maxPairs = Math.min(xShuffled.length, oShuffled.length);
        for (let i = 0; i < maxPairs; i++) pairs.push([xShuffled[i], oShuffled[i]]);

        const eliminatedThisEvent = [];
        const brawlLines = [];
        const combatScore = p => (utils.getEffectiveStat(p, 'strength') || 0) + (utils.getEffectiveStat(p, 'agility') || 0) + Math.random() * 10;

        pairs.forEach(([xP, oP]) => {
            if (!xP || !oP || xP.eliminated || oP.eliminated) return;
            xP.actionLog = xP.actionLog || [];
            oP.actionLog = oP.actionLog || [];

            const xScore = combatScore(xP), oScore = combatScore(oP);
            let winner = xScore >= oScore ? xP : oP;
            let loser = xScore >= oScore ? oP : xP;

            const loserEscapes = Math.random() < 0.45;
            if (loserEscapes) {
                loser.injury = { duration: 1, cowardiceDebuff: 1, reason: "Injury from X vs O Brawl" };
                loser.actionLog.push(`${grLabel}: Event: Lost fight but escaped with injuries.`);
                brawlLines.push(`${utils.createPlayerLink(winner.id)} beat ${utils.createPlayerLink(loser.id)}; the loser escaped with injuries.`);
            } else {
                const survived = this.checkSurvivalMechanics(loser, "X vs O Brawl");
                if (survived) {
                    loser.injury = { duration: 2, cowardiceDebuff: 1, reason: "Survived lethal blow in X vs O Brawl" };
                    brawlLines.push(`${utils.createPlayerLink(winner.id)} nearly killed ${utils.createPlayerLink(loser.id)} but they survived.`);
                } else {
                    loser.eliminated = true;
                    loser.eliminationRound = appState.round;
                    loser.wasFinalistWhenEliminated = loser.isFinalist;
                    eliminatedThisEvent.push(loser);
                    winner.eliminationsByPlayer = (winner.eliminationsByPlayer || 0) + 1;
                    winner.actionLog.push(`${grLabel}: Event: Killed P${utils.formatPlayerNumber(loser.id)} in the X vs O Brawl.`);
                    loser.actionLog.push(`${grLabel}: Event: Killed by P${utils.formatPlayerNumber(winner.id)} in the X vs O Brawl.`);
                    brawlLines.push(`${utils.createPlayerLink(winner.id)} killed ${utils.createPlayerLink(loser.id)} in the X vs O Brawl.`);
                }
            }
        });

        appState.round++;
        log.event(`Event: X vs O Brawl — ${eliminatedThisEvent.length} player(s) killed.`, brawlLines.join('<br>'));
        this.takeSnapshot(appState.round, "X vs O Brawl");
        ui.updateAllPlayerDivs();
        ui.updateCounters();
        ui.updateEventButtons();
    },

    handleHideAndSeek() {
        if (!this.preRoundUpdate()) return;
        const activePlayers = utils.getActivePlayers();
        if (activePlayers.length < 2) { log.event("Hide & Seek could not be played (not enough active players)."); return; }

        appState.round++;
        const grLabel = `GR ${appState.round}`;
        appState.eliminationOrder.push({ isHeader: true, text: `${grLabel}: Hide & Seek` });

        const shuffled = activePlayers.slice().sort(() => Math.random() - 0.5);
        const splitPoint = Math.floor(shuffled.length / 2);
        const seekers = shuffled.slice(0, splitPoint);
        const hiders = shuffled.slice(splitPoint);

        seekers.forEach(p => { p.actionLog = p.actionLog || []; p.actionLog.push(`${grLabel}: Was a Seeker in Hide and Seek.`); });
        hiders.forEach(p => { p.actionLog = p.actionLog || []; p.actionLog.push(`${grLabel}: Was a Hider in Hide and Seek.`); });

        const eliminatedThisRound = [];
        const availableHiders = new Set(hiders.map(p => p.id));

        seekers.forEach(seeker => {
            seeker.actionLog = seeker.actionLog || [];
            let seekerSuccess = 0;
            const greed = utils.getEffectiveStat(seeker, 'greed') || 0;
            let attempts = 1;
            if (greed > 10 && Math.random() < 0.15) attempts = 2;

            for (let i = 0; i < attempts; i++) {
                if (availableHiders.size === 0) break;
                const availableArray = Array.from(availableHiders).map(id => appState.players.find(p => p.id === id)).filter(Boolean);
                if (availableArray.length === 0) break;
                const target = availableArray[Math.floor(Math.random() * availableArray.length)];
                if (!target) break;

                const seekerINT = utils.getEffectiveStat(seeker, 'intelligence') || 0;
                const hiderINT = utils.getEffectiveStat(target, 'intelligence') || 0;
                let spotChance = Math.max(0.05, Math.min(0.95, 0.75 + ((seekerINT - hiderINT) / 50)));

                if (Math.random() < spotChance) {
                    const survived = this.checkSurvivalMechanics(target, "Hide & Seek");
                    if (!survived) {
                        target.eliminated = true;
                        target.eliminationRound = appState.round;
                        target.wasFinalistWhenEliminated = target.isFinalist;
                        eliminatedThisRound.push(target);
                        availableHiders.delete(target.id);
                        seekerSuccess++;
                        seeker.actionLog.push(`${grLabel}: Found P${utils.formatPlayerNumber(target.id)}.`);
                        target.actionLog.push(`${grLabel}: Was found by P${utils.formatPlayerNumber(seeker.id)}.`);
                    }
                }
            }

            if (seekerSuccess === 0) {
                const survived = this.checkSurvivalMechanics(seeker, "Hide & Seek (failure)");
                if (!survived) {
                    seeker.eliminated = true;
                    seeker.eliminationRound = appState.round;
                    seeker.wasFinalistWhenEliminated = seeker.isFinalist;
                    eliminatedThisRound.push(seeker);
                    seeker.actionLog.push(`${grLabel}: Failed to find anyone as a Seeker and was eliminated.`);
                }
            }
        });

        eliminatedThisRound.forEach(p => {
            appState.eliminationOrder.push({ playerId: p.id, round: appState.round, reason: "was eliminated in Hide & Seek.", isHeader: false });
        });

        const eliminatedIds = new Set(eliminatedThisRound.map(p => p.id));
        activePlayers.forEach(p => { if (!eliminatedIds.has(p.id)) { p.actionLog = p.actionLog || []; p.actionLog.push(`${grLabel}: Survived Hide and Seek.`); } });

        log.event(`${grLabel} (Hide & Seek): ${eliminatedThisRound.length} player(s) eliminated.`);
        if (appState.firstEliminationOfGame && eliminatedThisRound.length > 0) appState.firstEliminationOfGame = false;
        this.takeSnapshot(appState.round, 'Hide & Seek');
        ui.updateAllPlayerDivs();
        ui.updateCounters();
        ui.updateEliminationOrderList();
        ui.updateHistorySliderUI();
        this.checkGameOver();
    },

    handleCircleOfTrust() {
        if (!this.preRoundUpdate()) return;
        const activePlayers = utils.getActivePlayers();
        if (activePlayers.length < 2) { log.event("Circle of Trust could not be played (not enough active players)."); return; }

        appState.round++;
        const grLabel = `GR ${appState.round}`;

        let numToEliminate = null;
        const raw = prompt(`Circle of Trust – how many players should be eliminated?\n(2 to ${Math.max(1, activePlayers.length - 1)} recommended)`);
        if (raw === null) { appState.round--; return; }
        numToEliminate = parseInt(raw, 10);
        if (isNaN(numToEliminate) || numToEliminate < 1 || numToEliminate >= activePlayers.length) {
            alert(`Please enter a number between 1 and ${activePlayers.length - 1}.`);
            appState.round--;
            return;
        }

        appState.eliminationOrder.push({ isHeader: true, text: `${grLabel}: Circle of Trust` });

        const eliminatedThisRound = [];
        const eliminatedIds = new Set();
        const detailLines = [];

        const computeAvailablePool = () => activePlayers.filter(p => !p.eliminated && !p.votedOut && !eliminatedIds.has(p.id));

        while (eliminatedThisRound.length < numToEliminate) {
            const pool = computeAvailablePool();
            if (pool.length < 2) break;

            const giver = pool[Math.floor(Math.random() * pool.length)];
            const receiverCandidates = pool.filter(p => p.id !== giver.id);
            if (receiverCandidates.length === 0) break;
            const receiver = receiverCandidates[Math.floor(Math.random() * receiverCandidates.length)];

            giver.actionLog = giver.actionLog || [];
            receiver.actionLog = receiver.actionLog || [];

            const INT = utils.getEffectiveStat(receiver, 'intelligence') || 0;
            const CHA = utils.getEffectiveStat(receiver, 'charisma') || 0;
            let guessChance = Math.max(0.20, Math.min(0.70, 0.20 + ((INT + CHA) / 30) * 0.50));
            const guessedCorrect = Math.random() < guessChance;

            if (guessedCorrect) {
                const survived = this.checkSurvivalMechanics(giver, "Circle of Trust (correct guess)");
                if (!survived) {
                    giver.eliminated = true;
                    giver.eliminationRound = appState.round;
                    giver.wasFinalistWhenEliminated = giver.isFinalist;
                    eliminatedThisRound.push(giver);
                    eliminatedIds.add(giver.id);
                }
                receiver.actionLog.push(`${grLabel}: Received box from P${utils.formatPlayerNumber(giver.id)}. Correctly guessed the giver.`);
                giver.actionLog.push(`${grLabel}: Gave box to P${utils.formatPlayerNumber(receiver.id)}. Was correctly guessed.`);
                detailLines.push(`${utils.createPlayerLink(receiver.id)} correctly guessed ${utils.createPlayerLink(giver.id)}.`);
            } else {
                const survived = this.checkSurvivalMechanics(receiver, "Circle of Trust (wrong guess)");
                if (!survived) {
                    receiver.eliminated = true;
                    receiver.eliminationRound = appState.round;
                    receiver.wasFinalistWhenEliminated = receiver.isFinalist;
                    eliminatedThisRound.push(receiver);
                    eliminatedIds.add(receiver.id);
                }
                receiver.actionLog.push(`${grLabel}: Received box from P${utils.formatPlayerNumber(giver.id)}. Incorrectly guessed.`);
                giver.actionLog.push(`${grLabel}: Gave box to P${utils.formatPlayerNumber(receiver.id)}. Receiver guessed wrong.`);
                detailLines.push(`${utils.createPlayerLink(receiver.id)} incorrectly guessed and was eliminated.`);
            }
        }

        eliminatedThisRound.forEach(p => {
            appState.eliminationOrder.push({ playerId: p.id, round: appState.round, reason: "died in Circle of Trust.", isHeader: false });
        });

        if (eliminatedThisRound.length === 0) {
            log.event(`${grLabel} (Circle of Trust): Few eliminations occurred.`);
        } else {
            log.event(`${grLabel} (Circle of Trust): ${eliminatedThisRound.length} player(s) eliminated.`, detailLines.join('<br>'));
        }
        if (appState.firstEliminationOfGame && eliminatedThisRound.length > 0) appState.firstEliminationOfGame = false;
        this.takeSnapshot(appState.round, 'Circle of Trust');
        ui.updateAllPlayerDivs();
        ui.updateCounters();
        ui.updateEliminationOrderList();
        ui.updateHistorySliderUI();
        this.checkGameOver();
    },

    handlePentathlon() {
        if (!this.preRoundUpdate()) return;
        const activePlayers = utils.getActivePlayers();
        if (activePlayers.length < 2) { log.event("Pentathlon could not be played (not enough active players)."); return; }

        appState.round++;
        const grLabel = `GR ${appState.round}`;
        appState.eliminationOrder.push({ isHeader: true, text: `${grLabel}: Pentathlon` });

        const games = ["Ddakji", "Flying Stone", "Ggongi (Jacks)", "Spinning Top", "Jegi (Kick Sack)"];
        const TARGET_TEAM_SIZE = 5;
        const assigned = new Set();
        const teams = [];
        const idToPlayer = new Map(activePlayers.map(p => [p.id, p]));
        const shuffledPool = activePlayers.slice().sort(() => Math.random() - 0.5);

        // Alliance-based team formation
        shuffledPool.forEach(p => {
            if (assigned.has(p.id)) return;
            const allies = (p.allies || []).map(id => idToPlayer.get(id)).filter(Boolean);
            if (!allies.length) return;
            const team = [p];
            assigned.add(p.id);
            allies.forEach(ally => {
                if (team.length >= TARGET_TEAM_SIZE || assigned.has(ally.id)) return;
                team.push(ally);
                assigned.add(ally.id);
            });
            teams.push(team);
        });

        // Fill remaining players
        let stragglers = shuffledPool.filter(p => !assigned.has(p.id)).sort(() => Math.random() - 0.5);
        teams.forEach(team => {
            while (team.length < TARGET_TEAM_SIZE && stragglers.length > 0) {
                const next = stragglers.pop();
                team.push(next);
                assigned.add(next.id);
            }
        });
        while (stragglers.length > 0) {
            const team = stragglers.splice(0, TARGET_TEAM_SIZE);
            team.forEach(p => assigned.add(p.id));
            teams.push(team);
        }

        // Calculate team scores
        const teamMeta = teams.map((team, teamIndex) => {
            let teamScore = 0;
            team.forEach((p, idx) => {
                p.actionLog = p.actionLog || [];
                const gameName = games[idx % games.length];
                const s = utils.getEffectiveStat(p, 'strength') || 0;
                const a = utils.getEffectiveStat(p, 'agility') || 0;
                const i = utils.getEffectiveStat(p, 'intelligence') || 0;
                p.tempPentathlonScore = s + a + i + Math.random() * 5;
                p._pentathlonGameName = gameName;
                teamScore += p.tempPentathlonScore;
            });
            return { team, teamIndex, teamScore };
        });

        const sortedTeams = teamMeta.slice().sort((a, b) => a.teamScore - b.teamScore);
        const failFraction = 0.35 + Math.random() * 0.10;
        let numFailingTeams = Math.max(1, Math.floor(sortedTeams.length * failFraction));
        const failingTeams = sortedTeams.slice(0, numFailingTeams);
        const passingTeams = sortedTeams.slice(numFailingTeams);

        const eliminatedThisRound = [];

        failingTeams.forEach(meta => {
            const team = meta.team;
            if (team.length === 0) return;
            let weakest = team.reduce((w, p) => (p.tempPentathlonScore || 0) < (w.tempPentathlonScore || 0) ? p : w, team[0]);
            const weakGame = weakest._pentathlonGameName || "their game";

            team.forEach(p => {
                p.eliminated = true;
                p.eliminationRound = appState.round;
                p.wasFinalistWhenEliminated = p.isFinalist;
                p.actionLog = p.actionLog || [];
                if (p.id === weakest.id) {
                    p.actionLog.push(`${grLabel}: ELIMINATED. Failed their entire Pentathlon Team by failing ${weakGame}.`);
                } else {
                    p.actionLog.push(`${grLabel}: ELIMINATED. Failed Pentathlon because P${utils.formatPlayerNumber(weakest.id)} took forever on ${weakGame}.`);
                }
                eliminatedThisRound.push(p);
                appState.eliminationOrder.push({ playerId: p.id, round: appState.round, reason: "failed the Pentathlon.", isHeader: false });
            });
        });

        passingTeams.forEach(meta => {
            meta.team.forEach(p => {
                p.actionLog = p.actionLog || [];
                const teammates = meta.team.filter(o => o.id !== p.id).map(o => `P${utils.formatPlayerNumber(o.id)}`).join(', ') || 'no one';
                p.actionLog.push(`${grLabel}: Formed a Pentathlon team with ${teammates}. Team passed.`);
            });
        });

        if (eliminatedThisRound.length === 0) {
            log.event(`${grLabel} (Pentathlon): Few eliminations occurred.`);
        } else {
            log.event(`${grLabel} (Pentathlon): ${eliminatedThisRound.length} player(s) eliminated across ${teams.length} team(s).`);
        }
        if (appState.firstEliminationOfGame && eliminatedThisRound.length > 0) appState.firstEliminationOfGame = false;
        this.takeSnapshot(appState.round, "Pentathlon");
        ui.updateAllPlayerDivs();
        ui.updateCounters();
        ui.updateEliminationOrderList();
        ui.updateHistorySliderUI();
        this.checkGameOver();
    },

    handleSkySquidGame() {
        if (!this.preRoundUpdate()) return;
        const activePlayers = utils.getActivePlayers();
        const n = activePlayers.length;
        if (n < 2) return;

        appState.round++;
        const grLabel = `GR ${appState.round}`;

        let numToEliminate = 0;
        if (n <= 3) numToEliminate = n - 1;
        else if (n <= 9) numToEliminate = Math.floor(Math.random() * (n - 3)) + 3;
        else numToEliminate = Math.min(n - 1, Math.floor(Math.random() * 8) + 3);

        if (numToEliminate <= 0) {
            activePlayers.forEach(p => { p.actionLog = p.actionLog || []; p.actionLog.push(`${grLabel}: Survived the Sky Squid Game.`); });
            log.event(`${grLabel} (Sky Squid Game): Few eliminations occurred.`);
            this.takeSnapshot(appState.round, "Sky Squid Game");
            ui.updateAllPlayerDivs();
            ui.updateCounters();
            return;
        }

        appState.eliminationOrder.push({ isHeader: true, text: `${grLabel}: Sky Squid Game` });

        const candidatesBase = activePlayers.slice();
        candidatesBase.forEach(p => {
            const cha = utils.getEffectiveStat(p, 'charisma') || 0;
            const str = utils.getEffectiveStat(p, 'strength') || 0;
            const agi = utils.getEffectiveStat(p, 'agility') || 0;
            const lck = utils.getEffectiveStat(p, 'luck') || 0;
            const cow = utils.getEffectiveStat(p, 'cowardice') || 0;
            p._skyRisk = (15 - cha) + (15 - str) + (15 - agi) + (15 - lck) + (cow * 2) + Math.random();
        });

        const sortedByRisk = candidatesBase.slice().sort((a, b) => (b._skyRisk || 0) - (a._skyRisk || 0));
        const eliminationCandidates = sortedByRisk.slice(0, Math.min(numToEliminate, sortedByRisk.length));
        const eliminatedThisRound = [];

        eliminationCandidates.forEach(p => {
            p.actionLog = p.actionLog || [];
            const survived = this.checkSurvivalMechanics(p, "Sky Squid Game");
            if (survived) return;
            p.eliminated = true;
            p.eliminationRound = appState.round;
            p.wasFinalistWhenEliminated = p.isFinalist;
            eliminatedThisRound.push(p);
        });

        const eliminatedIds = new Set(eliminatedThisRound.map(p => p.id));
        const survivors = activePlayers.filter(p => !eliminatedIds.has(p.id));

        eliminatedThisRound.forEach(victim => {
            victim.actionLog.push(`${grLabel}: Fell off the platform during the Sky Squid Game.`);
            appState.eliminationOrder.push({ playerId: victim.id, round: appState.round, reason: "fell from the Sky Squid Game.", isHeader: false });
        });
        survivors.forEach(p => { p.actionLog = p.actionLog || []; p.actionLog.push(`${grLabel}: Survived the Sky Squid Game.`); });

        if (eliminatedThisRound.length === 0) {
            log.event(`${grLabel} (Sky Squid Game): Few eliminations occurred.`);
        } else {
            log.event(`${grLabel} (Sky Squid Game): ${eliminatedThisRound.length} player(s) eliminated.`);
        }
        if (appState.firstEliminationOfGame && eliminatedThisRound.length > 0) appState.firstEliminationOfGame = false;
        this.takeSnapshot(appState.round, "Sky Squid Game");
        ui.updateAllPlayerDivs();
        ui.updateCounters();
        ui.updateEliminationOrderList();
        ui.updateHistorySliderUI();
        this.checkGameOver();
    },

    handleConfirmFinalists() {
        this.confirmFinalists();
    },

    handleSquidGame() {
        this.handleSquidGameFinale();
    },

    handleDodgeball() {
        if (!this.preRoundUpdate()) return;
        const activePlayers = utils.getActivePlayers();
        if (activePlayers.length < 2) return;

        appState.round++;
        const grLabel = `GR ${appState.round}`;
        appState.eliminationOrder.push({ isHeader: true, text: `${grLabel}: Dodgeball` });

        const shuffled = activePlayers.slice().sort(() => Math.random() - 0.5);
        const midpoint = Math.floor(shuffled.length / 2);
        const teamA = shuffled.slice(0, midpoint);
        const teamB = shuffled.slice(midpoint);

        const calcTeamStrength = team => team.reduce((sum, p) => sum + (utils.getEffectiveStat(p, 'agility') || 0) + Math.random() * 3, 0);
        const rawA = calcTeamStrength(teamA);
        const rawB = calcTeamStrength(teamB);

        let losingTeam = rawA >= rawB ? teamB : teamA;
        const eliminatedThisRound = [];

        losingTeam.forEach(p => {
            const survived = this.checkSurvivalMechanics(p, "Dodgeball");
            if (!survived) {
                p.eliminated = true;
                p.eliminationRound = appState.round;
                p.wasFinalistWhenEliminated = p.isFinalist;
                p.actionLog = p.actionLog || [];
                p.actionLog.push(`${grLabel}: Lost Dodgeball.`);
                eliminatedThisRound.push(p);
                appState.eliminationOrder.push({ playerId: p.id, round: appState.round, reason: "lost at Dodgeball.", isHeader: false });
            }
        });

        log.event(`${grLabel} (Dodgeball): ${eliminatedThisRound.length} player(s) eliminated.`);
        if (appState.firstEliminationOfGame && eliminatedThisRound.length > 0) appState.firstEliminationOfGame = false;
        this.takeSnapshot(appState.round, "Dodgeball");
        ui.updateAllPlayerDivs();
        ui.updateCounters();
        ui.updateEliminationOrderList();
        ui.updateHistorySliderUI();
        this.checkGameOver();
    },

    handleCatch() {
        if (!this.preRoundUpdate()) return;
        const activePlayers = utils.getActivePlayers();
        if (activePlayers.length < 2) return;

        appState.round++;
        const grLabel = `GR ${appState.round}`;
        appState.eliminationOrder.push({ isHeader: true, text: `${grLabel}: Catch Game` });

        // Split into catchers and runners
        const shuffled = activePlayers.slice().sort(() => Math.random() - 0.5);
        const midpoint = Math.floor(shuffled.length / 2);
        const catchers = shuffled.slice(0, midpoint);
        const runners = shuffled.slice(midpoint);

        const eliminatedThisRound = [];

        runners.forEach(runner => {
            runner.actionLog = runner.actionLog || [];
            const runnerAgi = utils.getEffectiveStat(runner, 'agility') || 0;
            const runnerLck = utils.getEffectiveStat(runner, 'luck') || 0;
            
            // Find a random catcher to chase this runner
            const catcher = catchers[Math.floor(Math.random() * catchers.length)];
            const catcherAgi = utils.getEffectiveStat(catcher, 'agility') || 0;
            const catcherStr = utils.getEffectiveStat(catcher, 'strength') || 0;
            
            const runnerScore = runnerAgi * 1.5 + runnerLck + Math.random() * 10;
            const catcherScore = catcherAgi + catcherStr + Math.random() * 10;
            
            if (catcherScore > runnerScore) {
                const survived = this.checkSurvivalMechanics(runner, "Catch Game");
                if (!survived) {
                    runner.eliminated = true;
                    runner.eliminationRound = appState.round;
                    runner.wasFinalistWhenEliminated = runner.isFinalist;
                    runner.actionLog.push(`${grLabel}: Was caught by P${utils.formatPlayerNumber(catcher.id)} in the Catch Game.`);
                    eliminatedThisRound.push(runner);
                    this.creditElimination(catcher.id, runner.id);
                }
            } else {
                runner.actionLog.push(`${grLabel}: Escaped capture in the Catch Game.`);
            }
        });

        catchers.forEach(catcher => {
            catcher.actionLog = catcher.actionLog || [];
            catcher.actionLog.push(`${grLabel}: Was a catcher in the Catch Game.`);
        });

        eliminatedThisRound.forEach(p => {
            appState.eliminationOrder.push({ playerId: p.id, round: appState.round, reason: "was caught in the Catch Game.", isHeader: false });
        });

        log.event(`${grLabel} (Catch Game): ${eliminatedThisRound.length} player(s) eliminated.`);
        if (appState.firstEliminationOfGame && eliminatedThisRound.length > 0) appState.firstEliminationOfGame = false;
        this.takeSnapshot(appState.round, "Catch Game");
        ui.updateAllPlayerDivs();
        ui.updateCounters();
        ui.updateEliminationOrderList();
        ui.updateHistorySliderUI();
        this.checkGameOver();
    },

    playTextSimGame(gameName) {
        if (!this.preRoundUpdate()) return;
        const activePlayers = utils.getActivePlayers();
        if (activePlayers.length === 0) return;

        // Route to appropriate handler based on game name
        switch(gameName) {
            case 'Dalgona':
                this.handleDalgona();
                break;
            case 'Marbles':
                this.handleMarbles();
                break;
            case 'Glass Bridge':
                this.handleGlassBridge();
                break;
            case 'Lights Out':
                this.handleLightsOut();
                break;
            case 'Sky Squid Game':
                this.handleSkySquidGame();
                break;
            default:
                log.event(`Unknown game: ${gameName}`);
        }
    },

    handleSkySquidGame() {
        if (!this.preRoundUpdate()) return;
        const activePlayers = utils.getActivePlayers();
        if (activePlayers.length < 3 || activePlayers.length > 9) {
            alert("Sky Squid Game requires 3-9 players.");
            return;
        }

        appState.round++;
        const grLabel = `GR ${appState.round}`;
        appState.eliminationOrder.push({ isHeader: true, text: `${grLabel}: Sky Squid Game` });

        // Calculate risk for each player
        activePlayers.forEach(p => {
            const STR = utils.getEffectiveStat(p, 'strength') || 0;
            const AGI = utils.getEffectiveStat(p, 'agility') || 0;
            const CHA = utils.getEffectiveStat(p, 'charisma') || 0;
            const LCK = utils.getEffectiveStat(p, 'luck') || 0;
            const COW = utils.getEffectiveStat(p, 'cowardice') || 0;
            
            const risk = (15 - CHA) + (15 - STR) + (15 - AGI) + (15 - LCK) + (COW * 2);
            p._skyRisk = risk + Math.random() * 5;
        });

        const sorted = activePlayers.slice().sort((a, b) => b._skyRisk - a._skyRisk);
        const eliminatedThisRound = [];

        // Eliminate the highest risk player(s)
        const toEliminate = Math.max(1, Math.floor(activePlayers.length * 0.3));
        const candidates = sorted.slice(0, toEliminate);

        candidates.forEach(p => {
            p.actionLog = p.actionLog || [];
            const survived = this.checkSurvivalMechanics(p, "Sky Squid Game");
            if (!survived) {
                p.eliminated = true;
                p.eliminationRound = appState.round;
                p.wasFinalistWhenEliminated = p.isFinalist;
                p.actionLog.push(`${grLabel}: Fell from the Sky Squid Game platform.`);
                eliminatedThisRound.push(p);
            }
        });

        const eliminatedIds = new Set(eliminatedThisRound.map(p => p.id));
        activePlayers.forEach(p => {
            if (!eliminatedIds.has(p.id)) {
                p.actionLog = p.actionLog || [];
                p.actionLog.push(`${grLabel}: Survived the Sky Squid Game.`);
            }
        });

        eliminatedThisRound.forEach(p => {
            appState.eliminationOrder.push({ playerId: p.id, round: appState.round, reason: "fell in the Sky Squid Game.", isHeader: false });
        });

        log.event(`${grLabel} (Sky Squid Game): ${eliminatedThisRound.length} player(s) eliminated.`);
        if (appState.firstEliminationOfGame && eliminatedThisRound.length > 0) appState.firstEliminationOfGame = false;
        this.takeSnapshot(appState.round, "Sky Squid Game");
        ui.updateAllPlayerDivs();
        ui.updateCounters();
        ui.updateEliminationOrderList();
        ui.updateHistorySliderUI();
        this.checkGameOver();
    }
});
