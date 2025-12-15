// ============================================
// GAME ENGINE (Games, Elimination Logic)
// ============================================
const gameEngine = {
    // Animation state
    animationModeEnabled: false,
    animationPaused: false,
    animationTimeoutId: null,
    playersToEliminateInAnimation: [],
    animatedEliminationIndex: 0,
    animationReason: '',
    animationFinalizer: null,

    /**
     * Pre-round guard: returns false if the round should not proceed.
     */
    preRoundUpdate() {
        if (appState.isViewingArchivedGame || appState.isViewingHistory) return false;
        const active = utils.getActivePlayers();
        if (!active || active.length === 0) return false;
        
        if (typeof lobbyChatHistory !== 'undefined') {
            lobbyChatHistory.push({
                round: appState.round + 1,
                divider: true
            });
        }

        if (appState.round === 0 && appState.personalityPlayers && appState.personalityPlayers.size >= 10) {
            achievements.unlock('dramatisPersonae');
        }

        // Pregnancy System: check for births
        const grLabel = `GR ${appState.round + 1}`;
        let anyBirths = false;
        appState.players.forEach(p => {
            if (p.eliminated || p.votedOut) return;
            if (!p.isPregnant) return;
            if (Math.random() < 1 / 3) {
                p.isPregnant = false;
                p.hasBaby = true;
                p.actionLog = p.actionLog || [];
                p.actionLog.push(`${grLabel}: Gave birth at the start of this round in the dorms.`);
                anyBirths = true;
            }
        });
        if (anyBirths) {
            log.event(`A baby has been born in the dorms at the start of ${grLabel}!`);
            ui.updateAllPlayerDivs();
        }

        return true;
    },

    /**
     * Survival mechanics check for protection, hints, and forced winner.
     */
    checkSurvivalMechanics(player, contextLabel) {
        const grLabel = `GR ${appState.round}`;
        player.actionLog = player.actionLog || [];

        if (appState.forcedWinnerId && appState.forcedWinnerId === player.id) {
            player.actionLog.push(`${grLabel}: Miraculously survived ${contextLabel}, defying all odds.`);
            return true;
        }

        if (player.protection && player.protection > 0) {
            player.protection -= 1;
            player.actionLog.push(`${grLabel}: Failed ${contextLabel}, but was protected.`);
            return true;
        }

        if (player.hasHint) {
            player.hasHint = false;
            player.actionLog.push(`${grLabel}: Survived ${contextLabel} thanks to a crucial hint.`);
            return true;
        }

        return false;
    },

    /**
     * Credits an elimination from killer -> victim for statistics.
     */
    creditElimination(killerId, victimId) {
        if (!killerId || !victimId) return;
        const killer = appState.players.find(p => p.id === killerId);
        if (!killer) return;
        killer.eliminationsByPlayer = (killer.eliminationsByPlayer || 0) + 1;
    },

    /**
     * Red Light Green Light round
     */
    handleRedLightGreenLight() {
        if (!this.preRoundUpdate()) return;

        appState.round++;
        const grLabel = `GR ${appState.round}`;
        const activePlayers = utils.getActivePlayers();
        if (!activePlayers.length) return;

        appState.eliminationOrder.push({
            isHeader: true,
            text: `${grLabel}: Red Light Green Light`
        });

        const randomPercent = 30 + Math.random() * (65 - 30);
        const numToEliminateTarget = Math.floor(activePlayers.length * (randomPercent / 100));

        if (numToEliminateTarget <= 0) {
            log.event(`${grLabel} (Red Light Green Light): Few eliminations occurred.`);
            activePlayers.forEach(p => {
                p.actionLog = p.actionLog || [];
                p.actionLog.push(`${grLabel}: Passed Red Light Green Light.`);
            });
            this.takeSnapshot(appState.round, "Red Light Green Light");
            ui.updateAllPlayerDivs();
            ui.updateCounters();
            ui.updateEliminationOrderList();
            ui.updateHistorySliderUI();
            return;
        }

        activePlayers.forEach(p => {
            const cowardice = utils.getEffectiveStat(p, "cowardice") || 0;
            const baseScore = (15 - cowardice) * 5;
            const roll = Math.random() * 100;
            p._rlglSurvivalScore = baseScore + roll;
            p.tempEliminationReason = null;
        });

        const sortedByScore = activePlayers.slice().sort((a, b) => a._rlglSurvivalScore - b._rlglSurvivalScore);
        const candidateElims = sortedByScore.slice(0, Math.min(numToEliminateTarget, sortedByScore.length));

        const eliminatedThisRound = [];
        const chaosEliminations = [];
        const movementEliminations = [];
        const timeEliminations = [];

        candidateElims.forEach(p => {
            const r = Math.random();
            let reasonKey = "chaos";
            let reasonText = "Failed Red Light Green Light during the initial chaos.";

            if (r >= 0.85) {
                reasonKey = "time";
                reasonText = "Because they ran out of time.";
            } else if (r >= 0.7) {
                reasonKey = "movement";
                reasonText = "Failed Red Light Green Light because they were caught moving.";
            }

            p.tempEliminationReason = reasonKey;

            const survived = this.checkSurvivalMechanics(p, "Red Light Green Light");
            if (survived) return;

            p.eliminated = true;
            p.eliminationRound = appState.round;
            p.wasFinalistWhenEliminated = p.isFinalist;
            p.actionLog = p.actionLog || [];
            p.actionLog.push(`${grLabel}: ${reasonText}`);

            eliminatedThisRound.push(p);
            if (reasonKey === "chaos") chaosEliminations.push(p);
            else if (reasonKey === "movement") movementEliminations.push(p);
            else if (reasonKey === "time") timeEliminations.push(p);
        });

        const eliminatedIds = new Set(eliminatedThisRound.map(p => p.id));
        activePlayers.forEach(p => {
            if (!eliminatedIds.has(p.id)) {
                p.actionLog = p.actionLog || [];
                p.actionLog.push(`${grLabel}: Passed Red Light Green Light.`);
            }
        });

        if (eliminatedThisRound.length === 0) {
            log.event(`${grLabel} (Red Light Green Light): Few eliminations occurred.`);
            this.takeSnapshot(appState.round, "Red Light Green Light");
            ui.updateAllPlayerDivs();
            ui.updateCounters();
            ui.updateEliminationOrderList();
            ui.updateHistorySliderUI();
            return;
        }

        const fmtList = (playersArr) => playersArr.map(p => `${utils.createPlayerLink(p.id)} (${p.name || "Unknown"})`).join(", ");
        const orderedForElim = [...chaosEliminations, ...movementEliminations, ...timeEliminations];

        orderedForElim.forEach(p => {
            appState.eliminationOrder.push({
                playerId: p.id,
                round: appState.round,
                reason: "failed Red Light Green Light",
                isHeader: false,
            });
        });

        let detailsHtml = "<b>Red Light Green Light Eliminations Breakdown:</b><br>----------------------------------------<br>";
        detailsHtml += `<h4>Initial Chaos (${chaosEliminations.length})</h4>${chaosEliminations.length ? fmtList(chaosEliminations) : "None"}<br><br>`;
        detailsHtml += `<h4>Caught Moving (${movementEliminations.length})</h4>${movementEliminations.length ? fmtList(movementEliminations) : "None"}<br><br>`;
        detailsHtml += `<h4>Ran Out of Time (${timeEliminations.length})</h4>${timeEliminations.length ? fmtList(timeEliminations) : "None"}`;

        log.event(`${grLabel} (Red Light Green Light): ${eliminatedThisRound.length} player(s) eliminated.`, detailsHtml);

        if (this.animationModeEnabled && eliminatedThisRound.length > 0) {
            this.playersToEliminateInAnimation = eliminatedThisRound.slice();
            this.animatedEliminationIndex = 0;
            this.animateElimination("failed Red Light Green Light");
        }

        if (appState.firstEliminationOfGame) {
            appState.currentPrizePot = appState.originalRosterSize * 100000000;
            appState.firstEliminationOfGame = false;
        }

        this.takeSnapshot(appState.round, "Red Light Green Light");
        ui.updateAllPlayerDivs();
        ui.updateCounters();
        ui.updateEliminationOrderList();
        ui.updateHistorySliderUI();
        this.checkGameOver();
    },

    playRound() {
        if (appState.isViewingArchivedGame || appState.isViewingHistory) return;
        const numToEliminate = parseInt(document.getElementById('numEliminated').value);
        const reason = document.getElementById('roundDescription').value;
        
        if (isNaN(numToEliminate) || numToEliminate < 1) {
            alert("Please enter a valid number of players to eliminate.");
            return;
        }

        const activePlayers = utils.getActivePlayers();
        if (numToEliminate > activePlayers.length) {
            alert("Not enough active players.");
            return;
        }

        this.eliminatePlayers(numToEliminate, reason, []);
    },

    eliminatePlayers(numToEliminate, reason, requiredTraits, isAnimated = false) {
        const activePlayers = utils.getActivePlayers();
        if (numToEliminate <= 0 || activePlayers.length === 0) return;

        appState.round++;
        
        let eligiblePlayers = activePlayers.filter(p => p.protection === 0);
        let protectedPlayers = activePlayers.filter(p => p.protection > 0);

        let candidatePool = eligiblePlayers.length > 0 ? eligiblePlayers.slice() : activePlayers.slice();

        const computeScore = (player) => {
            if (!requiredTraits || requiredTraits.length === 0) {
                return Math.random();
            }
            let sum = 0;
            requiredTraits.forEach(traitKey => {
                const val = utils.getEffectiveStat(player, traitKey) || 0;
                sum += val;
            });
            return sum + Math.random();
        };

        candidatePool.forEach(p => { p._elimScore = computeScore(p); });
        candidatePool.sort((a, b) => (a._elimScore || 0) - (b._elimScore || 0));
        const toEliminate = candidatePool.slice(0, Math.min(numToEliminate, candidatePool.length));

        const eliminatedNames = toEliminate.map(p => utils.createPlayerLink(p.id)).join(', ');
        log.event(`Round ${appState.round}: ${toEliminate.length} player(s) ${reason}`, `Eliminated: ${eliminatedNames}`);

        if (this.animationModeEnabled && isAnimated && toEliminate.length > 0) {
            this.playersToEliminateInAnimation = toEliminate.slice();
            this.animatedEliminationIndex = 0;
            this.animationReason = reason;
            this.animationFinalizer = () => {
                this.handleEliminationProcessing(toEliminate, protectedPlayers, reason, true);
            };
            ui.lockForAnimation(true);
            this.processNextAnimatedElimination();
        } else {
            toEliminate.forEach(p => {
                p.eliminated = true;
                p.eliminationRound = appState.round;
                p.wasFinalistWhenEliminated = p.isFinalist;
            });
            this.handleEliminationProcessing(toEliminate, protectedPlayers, reason, false);
        }
    },

    handleEliminationProcessing(eliminatedPlayers, protectedPlayers, reason, wasAnimated) {
        const players = appState.players;
        let actualEliminations = [];
        const babyTransformations = new Map();

        eliminatedPlayers.forEach(p => {
            if (!p) return;

            if (p.hasBaby && !p.isBaby) {
                p.name = "Unnamed Baby";
                p.isBaby = true;
                p.age = 0;
                p.occupation = "Infant";
                p.debt = 0;
                p.baseStats = { strength: 1, agility: 1, intelligence: 1, charisma: 1, luck: 1, cowardice: 1, greed: 1 };
                p.eliminated = false;
                babyTransformations.set(p.id, p);
                log.event(`The eliminated P${utils.formatPlayerNumber(p.id)}'s baby has taken their place in the game!`);
            } else if (p.caretakerFor) {
                const baby = players.find(b => b.id === p.caretakerFor);
                actualEliminations.push(p);
                if (baby && !baby.eliminated && !actualEliminations.includes(baby)) {
                    log.event(`The caretaker P${utils.formatPlayerNumber(p.id)} has died. The baby P${utils.formatPlayerNumber(baby.id)} has also been eliminated.`);
                    actualEliminations.push(baby);
                }
            } else {
                actualEliminations.push(p);
            }
        });

        babyTransformations.forEach(baby => {
            let candidates = players.filter(p =>
                !p.eliminated && !p.votedOut && !p.caretakerFor && p.id !== baby.id && !actualEliminations.includes(p)
            );
            candidates.sort((a, b) =>
                ((b.baseStats.charisma || 0) - (b.baseStats.greed || 0)) -
                ((a.baseStats.charisma || 0) - (a.baseStats.greed || 0))
            );

            if (candidates.length > 0) {
                const caretaker = candidates[0];
                caretaker.caretakerFor = baby.id;
                baby.hasCaretaker = caretaker.id;
                caretaker.protection = (caretaker.protection || 0) + 1;
                caretaker.specialCondition = `Careholder for P${utils.formatPlayerNumber(baby.id)}`;
                log.event(`${utils.createPlayerLink(caretaker.id)} has taken the baby under their care.`);
            } else {
                baby.eliminated = true;
                actualEliminations.push(baby);
                log.event(`No one was willing to care for the new baby. P${utils.formatPlayerNumber(baby.id)} has been eliminated.`);
            }
        });

        (protectedPlayers || []).forEach(p => {
            if (p.protection > 0) p.protection--;
        });

        actualEliminations.forEach(p => {
            appState.eliminationOrder.push({
                playerId: p.id,
                round: appState.round,
                reason: reason,
                isHeader: false
            });
        });

        if (appState.firstEliminationOfGame && actualEliminations.length > 0) {
            appState.currentPrizePot = appState.originalRosterSize * 100000000;
            appState.firstEliminationOfGame = false;
        }

        if (!wasAnimated && actualEliminations.length > 0) {
            sound.play('elimination');
        }

        this.takeSnapshot(appState.round, reason);
        this.checkGameOver();
        ui.updateAllPlayerDivs();
        ui.updateCounters();
        ui.updateEliminationOrderList();
        ui.updateHistorySliderUI();
    },

    processNextAnimatedElimination() {
        if (this.animationPaused) return;

        const list = this.playersToEliminateInAnimation || [];
        if (this.animatedEliminationIndex >= list.length) {
            ui.lockForAnimation(false);
            const finalize = this.animationFinalizer;
            this.animationFinalizer = null;
            this.animationReason = '';
            if (typeof finalize === 'function') finalize();
            return;
        }

        const player = list[this.animatedEliminationIndex];
        if (player && !player.eliminated) {
            player.eliminated = true;
            player.eliminationRound = appState.round;
            player.wasFinalistWhenEliminated = player.isFinalist;

            sound.play('elimination');
            const announcement = document.getElementById('eliminationAnnouncement');
            if (announcement) {
                announcement.innerText = `Player ${utils.formatPlayerNumber(player.id)} eliminated!`;
                announcement.style.display = 'block';
                announcement.style.opacity = '1';
                setTimeout(() => {
                    announcement.style.opacity = '0';
                    setTimeout(() => { if (announcement.style.opacity === '0') announcement.style.display = 'none'; }, 300);
                }, 400);
            }

            ui.updateAllPlayerDivs();
            ui.updateCounters();
        }

        this.animatedEliminationIndex++;
        const delay = 100 + Math.random() * 400;
        this.animationTimeoutId = setTimeout(() => this.processNextAnimatedElimination(), delay);
    },

    animateElimination(reason) {
        if (this.animatedEliminationIndex >= this.playersToEliminateInAnimation.length) {
            this.animationModeEnabled = false;
            const btn = document.getElementById('animationModeBtn');
            if (btn) btn.innerText = 'Disarm Animation Mode';
            const pauseBtn = document.getElementById('pausePlayButton');
            if (pauseBtn) pauseBtn.disabled = true;
            
            if (appState.firstEliminationOfGame) {
                appState.currentPrizePot = appState.originalRosterSize * 100000000;
                appState.firstEliminationOfGame = false;
            }
            
            this.takeSnapshot(appState.round, reason);
            this.checkGameOver();
            ui.updateEliminationOrderList();
            ui.updateHistorySliderUI();
            return;
        }

        if (this.animationPaused) return;

        const player = this.playersToEliminateInAnimation[this.animatedEliminationIndex];
        player.eliminated = true;
        player.eliminationRound = appState.round;
        player.wasFinalistWhenEliminated = player.isFinalist;
        
        appState.eliminationOrder.push({
            playerId: player.id,
            round: appState.round,
            reason: reason,
            isHeader: false
        });

        sound.play('elimination');
        const announcement = document.getElementById('eliminationAnnouncement');
        if (announcement) {
            announcement.innerText = `Player ${utils.formatPlayerNumber(player.id)} eliminated!`;
            announcement.style.display = 'block';
            announcement.style.opacity = '1';
            setTimeout(() => {
                announcement.style.opacity = '0';
                setTimeout(() => { if (announcement.style.opacity === '0') announcement.style.display = 'none'; }, 300);
            }, 400);
        }

        ui.updateAllPlayerDivs();
        ui.updateCounters();

        this.animatedEliminationIndex++;
        const delay = 100 + Math.random() * 400;
        this.animationTimeoutId = setTimeout(() => this.animateElimination(reason), delay);
    },


    handleDalgona() {
        if (!this.preRoundUpdate()) return;
        appState.round++;
        const grLabel = `GR ${appState.round}`;
        const activePlayers = utils.getActivePlayers();
        if (!activePlayers.length) return;

        appState.eliminationOrder.push({ isHeader: true, text: `${grLabel}: Dalgona` });

        const shapes = ["Circle", "Triangle", "Star", "Umbrella"];
        const baseByShape = { Circle: 0.55, Triangle: 0.45, Star: 0.30, Umbrella: 0.15 };
        const eliminatedThisRound = [];

        activePlayers.forEach(p => {
            const shape = shapes[Math.floor(Math.random() * shapes.length)];
            p._dalgonaShape = shape;

            const AGI = utils.getEffectiveStat(p, 'agility') || 0;
            const INT = utils.getEffectiveStat(p, 'intelligence') || 0;
            const LCK = utils.getEffectiveStat(p, 'luck') || 0;
            const alliesCount = (p.allies || []).length;
            const allyBoost = alliesCount * 2;

            const base = baseByShape[shape] ?? 0.3;
            const passChance = base + ((AGI + allyBoost) * 1.5 + (INT + allyBoost) + (LCK + allyBoost) / 2) / 110;

            const roll = Math.random();
            p.actionLog = p.actionLog || [];

            if (roll > passChance) {
                const survived = this.checkSurvivalMechanics(p, `Dalgona (${shape})`);
                if (!survived) {
                    p.eliminated = true;
                    p.eliminationRound = appState.round;
                    p.wasFinalistWhenEliminated = p.isFinalist;
                    p.actionLog.push(`${grLabel}: Failed while trying to carve the ${shape} shape.`);
                    eliminatedThisRound.push(p);
                }
            } else {
                p.actionLog.push(`${grLabel}: Successfully cleared the ${shape} shape.`);
            }
        });

        eliminatedThisRound.forEach(p => {
            appState.eliminationOrder.push({ playerId: p.id, round: appState.round, reason: `failed Dalgona`, isHeader: false });
        });

        if (eliminatedThisRound.length === 0) {
            log.event(`${grLabel} (Dalgona): Few eliminations occurred.`);
        } else {
            log.event(`${grLabel} (Dalgona): ${eliminatedThisRound.length} player(s) eliminated.`);
        }

        if (appState.firstEliminationOfGame && eliminatedThisRound.length > 0) {
            appState.currentPrizePot = appState.originalRosterSize * 100000000;
            appState.firstEliminationOfGame = false;
        }

        this.takeSnapshot(appState.round, "Dalgona");
        ui.updateAllPlayerDivs();
        ui.updateCounters();
        ui.updateEliminationOrderList();
        ui.updateHistorySliderUI();
        this.checkGameOver();
    },

    handleTugOfWar() {
        if (!this.preRoundUpdate()) return;
        appState.round++;
        const grLabel = `GR ${appState.round}`;
        const activePlayers = utils.getActivePlayers();
        if (activePlayers.length < 2) return;

        appState.eliminationOrder.push({ isHeader: true, text: `${grLabel}: Tug of War` });

        const shuffled = activePlayers.slice().sort(() => Math.random() - 0.5);
        const midpoint = Math.floor(shuffled.length / 2);
        const teamA = shuffled.slice(0, midpoint);
        const teamB = shuffled.slice(midpoint);

        const calcTeamStrength = (team) => {
            let total = 0;
            team.forEach(p => {
                const str = utils.getEffectiveStat(p, 'strength') || 0;
                total += str + Math.random() * 3;
            });
            return total;
        };

        const rawA = calcTeamStrength(teamA);
        const rawB = calcTeamStrength(teamB);

        let actualWinner = rawA >= rawB ? teamA : teamB;
        let actualLoser = rawA >= rawB ? teamB : teamA;
        let actualWinnerName = rawA >= rawB ? 'Team A' : 'Team B';
        let actualLoserName = rawA >= rawB ? 'Team B' : 'Team A';

        // Check for hero saves
        const hasLosingHero = actualLoser.some(p => p.protection > 0 || p.hasHint || (appState.forcedWinnerId && appState.forcedWinnerId === p.id));
        const hasWinningHero = actualWinner.some(p => p.protection > 0 || p.hasHint || (appState.forcedWinnerId && appState.forcedWinnerId === p.id));

        if (hasLosingHero && !hasWinningHero) {
            [actualWinner, actualLoser] = [actualLoser, actualWinner];
            [actualWinnerName, actualLoserName] = [actualLoserName, actualWinnerName];
        }

        // Mark teams
        actualWinner.forEach(p => {
            p.actionLog = p.actionLog || [];
            p.actionLog.push(`${grLabel}: Passed Tug of War on ${actualWinnerName}.`);
        });
        actualLoser.forEach(p => {
            p.actionLog = p.actionLog || [];
            p.actionLog.push(`${grLabel}: Failed Tug of War on ${actualLoserName}.`);
        });

        const eliminatedThisRound = [];
        actualLoser.forEach(p => {
            p.eliminated = true;
            p.eliminationRound = appState.round;
            p.wasFinalistWhenEliminated = p.isFinalist;
            eliminatedThisRound.push(p);
            appState.eliminationOrder.push({ playerId: p.id, round: appState.round, reason: "was pulled off the platform in Tug of War.", isHeader: false });
        });

        const fmtTeamList = (team) => team.slice().sort((a, b) => a.id - b.id).map(p => utils.createPlayerLink(p.id)).join(', ') || 'None';
        const detailsHtml = `<b>Team A:</b> ${fmtTeamList(teamA)}<br><b>Team B:</b> ${fmtTeamList(teamB)}<br><br>${actualWinnerName} wins!`;

        log.event(`${grLabel} (Tug of War): ${eliminatedThisRound.length} player(s) eliminated.`, detailsHtml);

        if (appState.firstEliminationOfGame && eliminatedThisRound.length > 0) {
            appState.currentPrizePot = appState.originalRosterSize * 100000000;
            appState.firstEliminationOfGame = false;
        }

        this.takeSnapshot(appState.round, "Tug of War");
        ui.updateAllPlayerDivs();
        ui.updateCounters();
        ui.updateEliminationOrderList();
        ui.updateHistorySliderUI();
        this.checkGameOver();
    },

    handleMarbles() {
        if (!this.preRoundUpdate()) return;
        appState.round++;
        const grLabel = `GR ${appState.round}`;
        const activePlayers = utils.getActivePlayers();
        if (activePlayers.length < 2) return;

        appState.eliminationOrder.push({ isHeader: true, text: `${grLabel}: Marbles` });

        const assignedIds = new Set();
        const pairs = [];

        // Alliance-priority pairing
        const shuffled = activePlayers.slice().sort(() => Math.random() - 0.5);
        shuffled.forEach(p => {
            if (assignedIds.has(p.id)) return;
            const activeAllies = (p.allies || []).filter(aid =>
                !assignedIds.has(aid) && activePlayers.some(ap => ap.id === aid)
            );
            if (activeAllies.length > 0 && Math.random() < 0.80) {
                const allyId = activeAllies[Math.floor(Math.random() * activeAllies.length)];
                const ally = activePlayers.find(ap => ap.id === allyId);
                if (ally) {
                    pairs.push([p, ally]);
                    assignedIds.add(p.id);
                    assignedIds.add(ally.id);
                }
            }
        });

        // Random fill
        const unassigned = activePlayers.filter(p => !assignedIds.has(p.id)).sort(() => Math.random() - 0.5);
        while (unassigned.length >= 2) {
            const p1 = unassigned.pop();
            const p2 = unassigned.pop();
            pairs.push([p1, p2]);
        }

        const oddOneOut = unassigned.length === 1 ? unassigned[0] : null;
        if (oddOneOut) {
            oddOneOut.actionLog = oddOneOut.actionLog || [];
            oddOneOut.actionLog.push(`${grLabel}: Survived Marbles due to no partner.`);
        }

        const eliminatedThisRound = [];
        const pairSummaries = [];

        pairs.forEach(([p1, p2]) => {
            p1.actionLog = p1.actionLog || [];
            p2.actionLog = p2.actionLog || [];

            const int1 = utils.getEffectiveStat(p1, 'intelligence') || 0;
            const lck1 = utils.getEffectiveStat(p1, 'luck') || 0;
            const int2 = utils.getEffectiveStat(p2, 'intelligence') || 0;
            const lck2 = utils.getEffectiveStat(p2, 'luck') || 0;

            const score1 = int1 + lck1 * 1.5 + Math.random() * 5;
            const score2 = int2 + lck2 * 1.5 + Math.random() * 5;

            let winner = score1 >= score2 ? p1 : p2;
            let loser = score1 >= score2 ? p2 : p1;

            // Check for protection
            if (loser.protection > 0 || loser.hasHint || (appState.forcedWinnerId && appState.forcedWinnerId === loser.id)) {
                [winner, loser] = [loser, winner];
            }

            winner.actionLog.push(`${grLabel}: Won Marbles against P${utils.formatPlayerNumber(loser.id)}.`);
            loser.actionLog.push(`${grLabel}: Lost Marbles against P${utils.formatPlayerNumber(winner.id)}.`);

            this.creditElimination(winner.id, loser.id);
            loser.eliminated = true;
            loser.eliminationRound = appState.round;
            loser.wasFinalistWhenEliminated = loser.isFinalist;
            eliminatedThisRound.push(loser);

            pairSummaries.push(`${utils.createPlayerLink(winner.id)} defeated ${utils.createPlayerLink(loser.id)}`);
        });

        eliminatedThisRound.forEach(p => {
            appState.eliminationOrder.push({ playerId: p.id, round: appState.round, reason: "lost at Marbles.", isHeader: false });
        });

        const detailsHtml = pairSummaries.join('<br>') || 'No marbles matches.';
        log.event(`${grLabel} (Marbles): ${eliminatedThisRound.length} player(s) eliminated.`, detailsHtml);

        if (appState.firstEliminationOfGame && eliminatedThisRound.length > 0) {
            appState.currentPrizePot = appState.originalRosterSize * 100000000;
            appState.firstEliminationOfGame = false;
        }

        this.takeSnapshot(appState.round, "Marbles");
        ui.updateAllPlayerDivs();
        ui.updateCounters();
        ui.updateEliminationOrderList();
        ui.updateHistorySliderUI();
        this.checkGameOver();
    },

    handleGlassBridge() {
        if (!this.preRoundUpdate()) return;
        appState.round++;
        const grLabel = `GR ${appState.round}`;
        const activePlayers = utils.getActivePlayers();
        if (activePlayers.length === 0) return;

        appState.eliminationOrder.push({ isHeader: true, text: `${grLabel}: Glass Bridge` });

        // Assign vest numbers based on luck (lower luck = earlier crossing = higher risk)
        const shuffled = activePlayers.slice().sort(() => Math.random() - 0.5);
        shuffled.forEach(p => {
            const luck = utils.getEffectiveStat(p, 'luck') || 0;
            p._glassBridgeRisk = (15 - luck) + Math.random() * 3;
        });
        const riskSorted = shuffled.slice().sort((a, b) => (b._glassBridgeRisk || 0) - (a._glassBridgeRisk || 0));
        riskSorted.forEach((p, idx) => { p.vestNumber = idx + 1; });

        const turnOrder = riskSorted.slice();
        let panelsKnown = 0;
        const totalPanels = activePlayers.length + 2;
        const eliminatedThisRound = [];

        turnOrder.forEach(player => {
            if (player.eliminated || player.votedOut) return;
            player.actionLog = player.actionLog || [];

            let stepsNeeded = totalPanels - panelsKnown;
            if (stepsNeeded <= 0) {
                player.actionLog.push(`${grLabel}: Crossed the Glass Bridge safely (path fully revealed).`);
                return;
            }

            while (stepsNeeded > 0) {
                const luck = utils.getEffectiveStat(player, 'luck') || 0;
                let survivalChance = 0.5 + (luck - 5) / 200;
                if (survivalChance < 0.05) survivalChance = 0.05;
                if (survivalChance > 0.95) survivalChance = 0.95;

                const roll = Math.random();
                if (roll >= survivalChance) {
                    const survived = this.checkSurvivalMechanics(player, "Glass Bridge");
                    if (!survived) {
                        player.eliminated = true;
                        player.eliminationRound = appState.round;
                        player.wasFinalistWhenEliminated = player.isFinalist;
                        player.actionLog.push(`${grLabel}: Stepped on the wrong panel and fell from the Glass Bridge.`);
                        eliminatedThisRound.push(player);
                    }
                    panelsKnown++;
                    break;
                } else {
                    panelsKnown++;
                    stepsNeeded--;
                }
            }
        });

        const eliminatedIds = new Set(eliminatedThisRound.map(p => p.id));
        activePlayers.forEach(p => {
            if (!eliminatedIds.has(p.id) && !p.eliminated) {
                p.actionLog = p.actionLog || [];
                p.actionLog.push(`${grLabel}: Passed Glass Bridge.`);
            }
        });

        eliminatedThisRound.forEach(p => {
            appState.eliminationOrder.push({ playerId: p.id, round: appState.round, reason: "fell from the Glass Bridge.", isHeader: false });
        });

        log.event(`${grLabel} (Glass Bridge): ${eliminatedThisRound.length} player(s) eliminated.`);

        if (appState.firstEliminationOfGame && eliminatedThisRound.length > 0) {
            appState.currentPrizePot = appState.originalRosterSize * 100000000;
            appState.firstEliminationOfGame = false;
        }

        this.takeSnapshot(appState.round, "Glass Bridge");
        ui.updateAllPlayerDivs();
        ui.updateCounters();
        ui.updateEliminationOrderList();
        ui.updateHistorySliderUI();
        this.checkGameOver();
    },

    handleLightsOut() {
        if (appState.isViewingArchivedGame || appState.isViewingHistory) return;
        const activePlayers = utils.getActivePlayers();
        const numToEliminate = Math.floor(activePlayers.length * 0.9);
        appState.round++;
        this.eliminatePlayers(numToEliminate, 'was killed in the Lights Out massacre', [], this.animationModeEnabled);
    },


    handleSquidGameFinale() {
        if (!this.preRoundUpdate()) return;
        const activePlayers = utils.getActivePlayers();
        if (activePlayers.length !== 2) {
            alert("Squid Game Finale requires exactly 2 players.");
            return;
        }

        appState.round++;
        const grLabel = `GR ${appState.round}`;
        const [playerA, playerB] = activePlayers;

        appState.eliminationOrder.push({ isHeader: true, text: `${grLabel}: Squid Game Finale` });

        const calcScore = (p, enemyId) => {
            const STR = utils.getEffectiveStat(p, 'strength') || 0;
            const AGI = utils.getEffectiveStat(p, 'agility') || 0;
            let score = STR * 1.5 + AGI;
            if ((p.enemies || []).includes(enemyId)) score *= 1.5;
            return score;
        };

        const aScore = calcScore(playerA, playerB.id);
        const bScore = calcScore(playerB, playerA.id);

        let winner = aScore >= bScore ? playerA : playerB;
        let loser = aScore >= bScore ? playerB : playerA;

        // Upset chance or forced winner
        if (appState.forcedWinnerId && loser.id === appState.forcedWinnerId) {
            [winner, loser] = [loser, winner];
        } else if (Math.random() < 0.1) {
            [winner, loser] = [loser, winner];
        }

        winner.actionLog = winner.actionLog || [];
        loser.actionLog = loser.actionLog || [];
        winner.actionLog.push(`${grLabel}: Won the Squid Game Finale against P${utils.formatPlayerNumber(loser.id)}.`);
        loser.actionLog.push(`${grLabel}: Lost the Squid Game Finale against P${utils.formatPlayerNumber(winner.id)}.`);

        loser.eliminated = true;
        loser.eliminationRound = appState.round;
        loser.wasFinalistWhenEliminated = loser.isFinalist;

        appState.eliminationOrder.push({ playerId: loser.id, round: appState.round, reason: "was killed in the Squid Game finale.", isHeader: false });

        log.event(`${grLabel} (Squid Game Finale): ${utils.createPlayerLink(winner.id)} defeats ${utils.createPlayerLink(loser.id)}!`);

        this.takeSnapshot(appState.round, "Squid Game Finale");
        ui.updateAllPlayerDivs();
        ui.updateCounters();
        ui.updateEliminationOrderList();
        ui.updateHistorySliderUI();
        this.checkGameOver();
    },

    confirmFinalists() {
        if (appState.isViewingArchivedGame || appState.isViewingHistory) return;
        const activePlayers = utils.getActivePlayers();
        if (activePlayers.length === 0) return;

        activePlayers.forEach(p => {
            p.isFinalist = true;
            p.actionLog = p.actionLog || [];
            p.actionLog.push(`GR ${appState.round}: Confirmed as a FINALIST.`);
        });

        log.event(`Event (Post-GR ${appState.round}): All ${activePlayers.length} remaining players are confirmed as FINALISTS.`);
        ui.updateAllPlayerDivs();
        ui.updateCounters();
        this.takeSnapshot(appState.round, 'Confirm Finalists');
        ui.updateEliminationOrderList();
        ui.updateHistorySliderUI();
    },

    toggleSeason2Mode() {
        if (appState.isViewingArchivedGame) return;
        appState.season2ModeActive = !appState.season2ModeActive;
        const btn = document.getElementById('season2ToggleBtnInTab');
        if (btn) btn.innerText = appState.season2ModeActive ? 'Disable Voting Mode' : 'Enable Voting Mode';
        log.event(appState.season2ModeActive ? "Voting mode enabled." : "Voting mode disabled.");
    },

    startVotingRound() {
        if (appState.isViewingArchivedGame || appState.isViewingHistory) return;
        if (!appState.season2ModeActive) {
            alert("Season 2 mode is not active.");
            return;
        }

        const activePlayers = utils.getActivePlayers();
        if (activePlayers.length === 0) return;

        appState.votingRoundCount++;
        const votingRound = appState.votingRoundCount;
        let oVotes = 0;
        let xVotes = 0;

        activePlayers.forEach(p => {
            p.voteHistory = Array.isArray(p.voteHistory) ? p.voteHistory : [];
            const previousVote = p.voteHistory.length > 0 ? p.voteHistory[p.voteHistory.length - 1].vote : null;

            let voteDecision;
            if (p.id === 1 || (appState.forcedWinnerId && p.id === appState.forcedWinnerId)) {
                voteDecision = "O";
            } else if (!previousVote) {
                voteDecision = Math.random() < 0.55 ? "O" : "X";
            } else {
                voteDecision = Math.random() < 0.9 ? previousVote : (previousVote === "O" ? "X" : "O");
            }

            p.currentVote = voteDecision;
            p.voteHistory.push({ votingRound, vote: voteDecision });

            if (voteDecision === "O") oVotes++;
            else xVotes++;
        });

        const summary = `Voting Round ${votingRound}: X=${xVotes}, O=${oVotes}.`;
        if (xVotes > oVotes) {
            log.event(`${summary} Majority voted to LEAVE.`);
        } else {
            log.event(`${summary} Majority voted to STAY. The game continues.`);
        }

        ui.updateAllPlayerDivs();
        ui.updateCounters();
        ui.updateHistorySliderUI();
    },

    createCustomGame() {
        const name = document.getElementById('customGameName').value.trim();
        const reason = document.getElementById('customGameReason').value.trim();
        const value = parseInt(document.getElementById('customGameValue').value);
        const elimType = document.querySelector('input[name="elimType"]:checked').value;
        
        if (!name || !reason || isNaN(value) || value <= 0) {
            alert("Please fill all fields.");
            return;
        }

        const traits = [];
        document.querySelectorAll('input[name="customTrait"]:checked').forEach(cb => traits.push(cb.value));

        appState.customGames.push({ name, reason, traits, elimType, elimValue: value });
        ui.renderCustomGames();
        alert("Custom game created!");
    },

    playCustomGame(index) {
        if (appState.isViewingArchivedGame || appState.isViewingHistory) return;
        const game = appState.customGames[index];
        if (!game) return;

        const activePlayers = utils.getActivePlayers();
        if (activePlayers.length === 0) return;

        let numToEliminate;
        if (game.elimType === 'percent') {
            numToEliminate = Math.floor(activePlayers.length * (game.elimValue / 100));
        } else {
            numToEliminate = game.elimValue;
        }

        if (numToEliminate <= 0 || numToEliminate >= activePlayers.length) {
            alert("Invalid elimination count for this game.");
            return;
        }

        appState.round++;
        const grLabel = `GR ${appState.round}`;
        appState.eliminationOrder.push({ isHeader: true, text: `${grLabel}: ${game.name}` });

        activePlayers.forEach(p => {
            let score = game.traits.length === 0 ? Math.random() * 100 : 0;
            game.traits.forEach(t => { score += utils.getEffectiveStat(p, t) || 0; });
            p._customGameScore = score + Math.random() * 5;
        });

        const sorted = activePlayers.slice().sort((a, b) => (a._customGameScore || 0) - (b._customGameScore || 0));
        const candidates = sorted.slice(0, numToEliminate);
        const eliminatedThisRound = [];

        candidates.forEach(p => {
            const survived = this.checkSurvivalMechanics(p, game.name);
            p.actionLog = p.actionLog || [];
            if (!survived) {
                p.eliminated = true;
                p.eliminationRound = appState.round;
                p.wasFinalistWhenEliminated = p.isFinalist;
                p.actionLog.push(`${grLabel}: Failed ${game.name} and ${game.reason}`);
                eliminatedThisRound.push(p);
            }
        });

        eliminatedThisRound.forEach(p => {
            appState.eliminationOrder.push({ playerId: p.id, round: appState.round, reason: game.reason, isHeader: false });
        });

        log.event(`${grLabel} (${game.name}): ${eliminatedThisRound.length} player(s) eliminated.`);

        if (appState.firstEliminationOfGame && eliminatedThisRound.length > 0) {
            appState.currentPrizePot = appState.originalRosterSize * 100000000;
            appState.firstEliminationOfGame = false;
        }

        this.takeSnapshot(appState.round, game.name);
        ui.updateAllPlayerDivs();
        ui.updateCounters();
        ui.updateEliminationOrderList();
        ui.updateHistorySliderUI();
        this.checkGameOver();
    },

    checkGameOver() {
        // End-of-round relationship housekeeping
        relationships.updateAllianceStatBoosts();
        relationships.checkAllianceWipe();
        relationships.updateRelationships();

        // Post-round injury processing
        injurySystem.checkForNewInjuries();
        injurySystem.updateInjuryTimers();

        const activePlayers = utils.getActivePlayers();
        const declaredWinners = appState.players.filter(p => p.isWinner);

        if (declaredWinners.length > 1) {
            achievements.unlock('sharedVictory');
            vipBetting.handleCancelledOrJointWinners();
            log.event("Game ended with joint winners. Outstanding bets have been refunded.");
            return;
        }

        if (activePlayers.length === 1) {
            const winner = activePlayers[0];
            winner.isWinner = true;
            
            log.event(`🏆 ${utils.createPlayerLink(winner.id)} (${winner.name}) has won the game!`);
            bgm.playVictoryTheme();
            vipBetting.handleWinner(winner);
            
            achievements.unlock('sharedVictory');
            if (!appState.isGameModified) {
                if (winner.id < 10) achievements.unlock('underdogWinner');
                if (winner.isEasterEgg) achievements.unlock('canonWinner');
            }
            
            const gameRecord = {
                gameNumber: appState.currentGameNumber,
                winnerId: winner.id,
                winnerName: winner.name,
                fullState: appState.createSaveObject()
            };
            appState.allGamesHistory.push(gameRecord);
            achievements.updateProgress('gameVeteran', 1);
            ui.displayWinnerHistory();
        } else if (activePlayers.length === 0) {
            log.event("No players remain. Game over.");
            vipBetting.handleCancelledOrJointWinners();
        }
    },

    takeSnapshot(round, name) {
        appState.gameHistorySnapshots.push({
            round,
            name,
            players: JSON.parse(JSON.stringify(appState.players))
        });
        if (typeof lobbyTalk !== 'undefined' && lobbyTalk.refreshPreviousGameOptions) {
            lobbyTalk.refreshPreviousGameOptions();
        }
    },

    // Event handlers
    handleGiveHint() {
        if (appState.isViewingArchivedGame || appState.usedEvents.has('giveHint')) return;
        const activePlayers = utils.getActivePlayers();
        if (activePlayers.length === 0) return;

        const recipient = activePlayers[Math.floor(Math.random() * activePlayers.length)];
        recipient.hasHint = true;
        recipient.actionLog = recipient.actionLog || [];
        recipient.actionLog.push("Event: Received a crucial hint from a mysterious source.");

        log.event(`${utils.createPlayerLink(recipient.id)} received a mysterious hint that may save their life.`);
        appState.usedEvents.add('giveHint');
        ui.updateAllPlayerDivs();
        ui.updateEventButtons();
    },

    handleEscapeAttempt() {
        if (appState.isViewingArchivedGame || appState.usedEvents.has('escapeAttempt')) return;
        const activePlayers = utils.getActivePlayers();
        if (activePlayers.length < 2) return;

        const escapee = activePlayers[Math.floor(Math.random() * activePlayers.length)];
        const success = Math.random() < 0.1;

        escapee.actionLog = escapee.actionLog || [];

        if (success) {
            escapee.votedOut = true;
            escapee.actionLog.push("Event: Successfully escaped the games!");
            log.event(`${utils.createPlayerLink(escapee.id)} has successfully escaped the games!`);
        } else {
            escapee.eliminated = true;
            escapee.eliminationRound = appState.round;
            escapee.actionLog.push("Event: Was caught trying to escape and eliminated.");
            log.event(`${utils.createPlayerLink(escapee.id)} was caught trying to escape and was eliminated.`);
            appState.eliminationOrder.push({ playerId: escapee.id, round: appState.round, reason: "was caught trying to escape.", isHeader: false });
        }

        appState.usedEvents.add('escapeAttempt');
        ui.updateAllPlayerDivs();
        ui.updateCounters();
        ui.updateEventButtons();
        this.checkGameOver();
    },

    handleRandomSelfElimination() {
        if (appState.isViewingArchivedGame || appState.usedEvents.has('selfElimination')) return;
        if (!appState.season2ModeActive) {
            alert("Self-elimination requires Voting Mode to be enabled.");
            return;
        }

        const xVoters = utils.getActivePlayers().filter(p => p.currentVote === 'X');
        if (xVoters.length === 0) {
            alert("No players currently want to leave.");
            return;
        }

        const victim = xVoters[Math.floor(Math.random() * xVoters.length)];
        victim.eliminated = true;
        victim.eliminationRound = appState.round;
        victim.wasFinalistWhenEliminated = victim.isFinalist;
        victim.actionLog = victim.actionLog || [];
        victim.actionLog.push("Event: Could not handle the pressure and self-eliminated.");

        appState.eliminationOrder.push({ playerId: victim.id, round: appState.round, reason: "self-eliminated due to despair.", isHeader: false });
        log.event(`P${utils.formatPlayerNumber(victim.id)} could not handle the pressure and self-eliminated.`);

        appState.usedEvents.add('selfElimination');
        ui.updateAllPlayerDivs();
        ui.updateCounters();
        ui.updateEliminationOrderList();
        ui.updateEventButtons();
    },

    handleRandomEvent() {
        const candidates = [
            { name: 'escapeAttempt', handler: () => this.handleEscapeAttempt() },
            { name: 'giveHint', handler: () => this.handleGiveHint() },
            { name: 'selfElimination', handler: () => this.handleRandomSelfElimination() },
        ];

        const available = candidates.filter(c => !appState.usedEvents.has(c.name));
        if (available.length === 0) {
            alert("All narrative events have already been triggered this game.");
            return;
        }

        const pick = available[Math.floor(Math.random() * available.length)];
        pick.handler();
    },
};
