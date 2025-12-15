// ============================================
// TEXT-BASED SIMULATION ENGINE (Formula-Driven)
// ============================================
const textSimEngine = {
    _randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    _shuffle(array) {
        const arr = array.slice();
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    },

    _applyElimination(player, reason, events) {
        if (player.protection && player.protection > 0) {
            player.protection -= 1;
            events.push({
                type: "protection",
                text: `P${utils.formatPlayerNumber(player.id)} survived due to Protection (${reason}).`
            });
            return;
        }
        if (!player.eliminated && !player.votedOut) {
            player.eliminated = true;
            events.push({
                type: "death",
                text: `P${utils.formatPlayerNumber(player.id)} ${reason}.`
            });
        }
    },

    simulateRedLightGreenLight(players) {
        const active = players.filter(p => !p.eliminated && !p.votedOut);
        const events = [];

        active.forEach(p => {
            const COW = p.baseStats.cowardice ?? 0;
            const score = (15 - COW) * 5 + this._randInt(0, 100);
            p._tmp_rlglScore = score;
        });

        const sorted = active.slice().sort((a, b) => a._tmp_rlglScore - b._tmp_rlglScore);
        const cutoff = Math.floor(sorted.length / 2);
        const eliminated = sorted.slice(0, cutoff);

        eliminated.forEach(p => {
            this._applyElimination(p, "was shot in Red Light, Green Light", events);
        });

        const deaths = events.filter(e => e.type === "death").length;
        events.push({
            type: "summary",
            text: `${deaths} players died in Red Light, Green Light.`
        });

        return events;
    },

    simulateDalgona(players) {
        const active = players.filter(p => !p.eliminated && !p.votedOut);
        const events = [];
        const shapes = ["Circle", "Triangle", "Star", "Umbrella"];
        const baseByShape = {
            Circle: 0.55,
            Triangle: 0.45,
            Star: 0.30,
            Umbrella: 0.15
        };

        active.forEach(p => {
            const shape = shapes[this._randInt(0, shapes.length - 1)];
            p._tmp_shape = shape;

            const STR = p.baseStats.strength ?? 0;
            const AGI = p.baseStats.agility ?? 0;
            const INT = p.baseStats.intelligence ?? 0;
            const LCK = p.baseStats.luck ?? 0;

            const alliesCount = (p.allies || []).length;
            const allyBoost = alliesCount * 2;
            const aAGI = AGI + allyBoost;
            const aINT = INT + allyBoost;
            const aLCK = LCK + allyBoost;

            const base = baseByShape[shape] ?? 0.3;
            const passChance = base + (aAGI * 1.5 + aINT + aLCK / 2) / 110;

            const roll = Math.random();
            if (roll > passChance) {
                this._applyElimination(
                    p,
                    `failed the ${shape} Dalgona candy (roll ${(roll * 100).toFixed(1)}% vs pass ${(passChance * 100).toFixed(1)}%)`,
                    events
                );
                // Record shape in the player's dossier if they actually died
                if (p.eliminated || p.votedOut) {
                    p.actionLog = p.actionLog || [];
                    p.actionLog.push(`Dalgona: Failed while trying to carve the ${shape} shape.`);
                }
            } else {
                events.push({
                    type: "survival",
                    text: `P${utils.formatPlayerNumber(p.id)} carefully cleared the ${shape} and survived.`
                });
                // Record shape in the player's dossier on survival
                p.actionLog = p.actionLog || [];
                p.actionLog.push(`Dalgona: Successfully cleared the ${shape} shape.`);
            }
        });

        const deaths = events.filter(e => e.type === "death").length;
        events.push({
            type: "summary",
            text: `${deaths} players died in Dalgona.`
        });

        return events;
    },

    simulateTugOfWar(players) {
        // Deprecated: Tug of War is now handled by gameEngine.handleTugOfWar
        return [];
    },

    simulateMarbles(players) {
        const active = players.filter(p => !p.eliminated && !p.votedOut);
        const events = [];
        const unpaired = new Set(active.map(p => p.id));
        const pairs = [];

        // Pair allies first
        active.forEach(p => {
            if (!unpaired.has(p.id)) return;
            const allies = (p.allies || []).filter(id => unpaired.has(id));
            if (allies.length > 0) {
                const partnerId = allies[0];
                const partner = active.find(x => x.id === partnerId);
                if (partner) {
                    pairs.push([p, partner]);
                    unpaired.delete(p.id);
                    unpaired.delete(partner.id);
                }
            }
        });

        // Pair remaining randomly
        const remainingIds = Array.from(unpaired);
        const shuffledIds = this._shuffle(remainingIds);
        for (let i = 0; i < shuffledIds.length - 1; i += 2) {
            const a = active.find(p => p.id === shuffledIds[i]);
            const b = active.find(p => p.id === shuffledIds[i + 1]);
            if (a && b) pairs.push([a, b]);
        }

        const isAllyPair = (p1, p2) =>
            (p1.allies || []).includes(p2.id) || (p2.allies || []).includes(p1.id);

        pairs.forEach(([a, b]) => {
            const aGRD = a.baseStats.greed ?? 0;
            const bGRD = b.baseStats.greed ?? 0;
            const allies = isAllyPair(a, b);
            let winner = null;
            let loser = null;

            if (allies && aGRD > bGRD + 3) {
                winner = a;
                loser = b;
                events.push({
                    type: "betrayal",
                    text: `Betrayal: P${utils.formatPlayerNumber(a.id)} turned on ally P${utils.formatPlayerNumber(b.id)} and stole all the marbles.`
                });
            } else if (allies && bGRD > aGRD + 3) {
                winner = b;
                loser = a;
                events.push({
                    type: "betrayal",
                    text: `Betrayal: P${utils.formatPlayerNumber(b.id)} turned on ally P${utils.formatPlayerNumber(a.id)} and stole all the marbles.`
                });
            } else {
                const aINT = a.baseStats.intelligence ?? 0;
                const aLCK = a.baseStats.luck ?? 0;
                const bINT = b.baseStats.intelligence ?? 0;
                const bLCK = b.baseStats.luck ?? 0;

                const aScore = aINT + aLCK * 1.5 + this._randInt(0, 5);
                const bScore = bINT + bLCK * 1.5 + this._randInt(0, 5);

                if (aScore >= bScore) {
                    winner = a;
                    loser = b;
                } else {
                    winner = b;
                    loser = a;
                }

                events.push({
                    type: "duel",
                    text: `Marbles match: P${utils.formatPlayerNumber(winner.id)} outplayed P${utils.formatPlayerNumber(loser.id)} (${aScore.toFixed(1)} vs ${bScore.toFixed(1)}).`
                });
            }

            this._applyElimination(
                loser,
                "lost their marbles game and was eliminated",
                events
            );
        });

        const deaths = events.filter(e => e.type === "death").length;
        events.push({
            type: "summary",
            text: `${deaths} players died in Marbles.`
        });

        return events;
    },

    simulateGlassBridge(players) {
        const active = players.filter(p => !p.eliminated && !p.votedOut);
        const events = [];
        const ordered = this._shuffle(active); // randomize order
        const panels = ordered.length; // simple N panels approximation

        for (let i = 0; i < ordered.length; i++) {
            const p = ordered[i];
            if (p.eliminated || p.votedOut) continue;

            const enemiesBehind = (p.enemies || []).filter(id =>
                ordered.slice(i + 1).some(x => x.id === id)
            );

            if (enemiesBehind.length > 0 && Math.random() < 0.4) {
                const enemyId = enemiesBehind[0];
                events.push({
                    type: "betrayal",
                    text: `On the bridge, P${utils.formatPlayerNumber(enemyId)} pushed P${utils.formatPlayerNumber(p.id)} to their death.`
                });
                this._applyElimination(p, "was pushed off the Glass Bridge", events);
                continue;
            }

            const LCK = p.baseStats.luck ?? 0;
            const fallChance = 0.5 - (LCK - 5) / 200;
            const roll = Math.random();

            if (roll < fallChance) {
                this._applyElimination(
                    p,
                    "stepped on a fragile panel and fell from the Glass Bridge",
                    events
                );
            } else {
                events.push({
                    type: "survival",
                    text: `P${utils.formatPlayerNumber(p.id)} managed to cross another panel safely.`
                });
            }
        }

        const deaths = events.filter(e => e.type === "death").length;
        events.push({
            type: "summary",
            text: `${deaths} players died on the Glass Bridge.`
        });

        return events;
    },

    simulateLightsOut(players) {
        const active = players.filter(p => !p.eliminated && !p.votedOut);
        const events = [];
        const killers = active.filter(p => {
            const GRD = p.baseStats.greed ?? 0;
            const COW = p.baseStats.cowardice ?? 0;
            return GRD >= 8 && COW <= 5;
        });
        const victims = new Set();

        killers.forEach(killer => {
            const potentialTargets = active.filter(
                t => t.id !== killer.id && !t.eliminated && !t.votedOut && !victims.has(t.id)
            );
            if (potentialTargets.length === 0) return;

            const target = potentialTargets[this._randInt(0, potentialTargets.length - 1)];
            const kSTR = killer.baseStats.strength ?? 0;
            const kAGI = killer.baseStats.agility ?? 0;
            const tSTR = target.baseStats.strength ?? 0;
            const tAGI = target.baseStats.agility ?? 0;

            const killerScore = kSTR * 1.5 + kAGI;
            const targetScore = tSTR * 1.5 + tAGI;

            let winner = killer;
            let loser = target;
            if (targetScore > killerScore) {
                winner = target;
                loser = killer;
            }

            events.push({
                type: "duel",
                text: `Lights Out fight: P${utils.formatPlayerNumber(winner.id)} overpowered P${utils.formatPlayerNumber(loser.id)} (${killerScore.toFixed(1)} vs ${targetScore.toFixed(1)}).`
            });

            this._applyElimination(loser, "was killed during Lights Out", events);
            victims.add(loser.id);
        });

        // Accidents from panic
        active.forEach(p => {
            if (p.eliminated || p.votedOut) return;
            const COW = p.baseStats.cowardice ?? 0;
            if (COW <= 0) return;
            const panicChance = COW / 200; // small chance
            if (Math.random() < panicChance) {
                this._applyElimination(
                    p,
                    "panicked in the dark and died in an accident",
                    events
                );
            }
        });

        const deaths = events.filter(e => e.type === "death").length;
        events.push({
            type: "summary",
            text: `${deaths} players died during the Lights Out massacre.`
        });

        return events;
    },

    simulateSquidGameFinale(playerA, playerB) {
        const events = [];

        const calcScore = (p, enemyId) => {
            const STR = p.baseStats.strength ?? 0;
            const AGI = p.baseStats.agility ?? 0;
            let score = STR * 1.5 + AGI;
            if ((p.enemies || []).includes(enemyId)) {
                score *= 1.5;
            }
            return score;
        };

        const aScore = calcScore(playerA, playerB.id);
        const bScore = calcScore(playerB, playerA.id);

        let favored = playerA;
        let underdog = playerB;
        let favoredScore = aScore;
        let underdogScore = bScore;

        if (bScore > aScore) {
            favored = playerB;
            underdog = playerA;
            favoredScore = bScore;
            underdogScore = aScore;
        }

        let winner = favored;
        let loser = underdog;
        let upset = false;

        if (Math.random() < 0.1) {
            winner = underdog;
            loser = favored;
            upset = true;
        }

        if (upset) {
            events.push({
                type: "upset",
                text: `UPSET: P${utils.formatPlayerNumber(winner.id)} defeated favored P${utils.formatPlayerNumber(loser.id)} (${favoredScore.toFixed(1)} vs ${underdogScore.toFixed(1)}).`
            });
        } else {
            events.push({
                type: "duel",
                text: `Finale: P${utils.formatPlayerNumber(winner.id)} bested P${utils.formatPlayerNumber(loser.id)} (${favoredScore.toFixed(1)} vs ${underdogScore.toFixed(1)}).`
            });
        }

        this._applyElimination(loser, "was killed in the Squid Game finale", events);

        events.push({
            type: "summary",
            text: `P${utils.formatPlayerNumber(winner.id)} wins the Squid Game.`
        });

        return events;
    },

    simulateCircleOfTrust(giver, receiver) {
        const events = [];

        const isEnemy = (giver.enemies || []).includes(receiver.id) ||
                        (receiver.enemies || []).includes(giver.id);
        const isAlly = (giver.allies || []).includes(receiver.id) ||
                       (receiver.allies || []).includes(giver.id);

        let guessProb;
        if (isEnemy) {
            guessProb = 0.5;
        } else if (isAlly) {
            guessProb = 0.01;
        } else {
            const INT = receiver.baseStats.intelligence ?? 0;
            const CHA = receiver.baseStats.charisma ?? 0;
            guessProb = 0.2 + (INT + CHA) / 30;
        }

        const roll = Math.random();
        const correct = roll < guessProb;

        if (correct) {
            events.push({
                type: "guess",
                text: `P${utils.formatPlayerNumber(receiver.id)} correctly guessed that P${utils.formatPlayerNumber(giver.id)} gave the box (roll ${(roll * 100).toFixed(1)}% vs ${(guessProb * 100).toFixed(1)}%).`
            });
            this._applyElimination(
                giver,
                "was correctly identified in Circle of Trust and died",
                events
            );
        } else {
            events.push({
                type: "guess",
                text: `P${utils.formatPlayerNumber(receiver.id)} guessed wrong about P${utils.formatPlayerNumber(giver.id)} (roll ${(roll * 100).toFixed(1)}% vs ${(guessProb * 100).toFixed(1)}%).`
            });
            this._applyElimination(
                receiver,
                "misjudged the Circle of Trust and died",
                events
            );
        }

        const deaths = events.filter(e => e.type === "death").length;
        events.push({
            type: "summary",
            text: `${deaths} player died in Circle of Trust.`
        });

        return events;
    },

    simulateSkySquidGame(players) {
        const active = players.filter(p => !p.eliminated && !p.votedOut);
        const events = [];

        active.forEach(p => {
            const STR = p.baseStats.strength ?? 0;
            const AGI = p.baseStats.agility ?? 0;
            const CHA = p.baseStats.charisma ?? 0;
            const LCK = p.baseStats.luck ?? 0;
            const COW = p.baseStats.cowardice ?? 0;

            const risk = (15 - CHA) + (15 - STR) + (15 - AGI) + (15 - LCK) + (COW * 2);
            p._tmp_risk = risk;
        });

        const sorted = active.slice().sort((a, b) => b._tmp_risk - a._tmp_risk);
        const thresholdRisk = sorted.length > 0 ? sorted[0]._tmp_risk : null;
        const toEliminate = sorted.filter(p => p._tmp_risk === thresholdRisk);

        toEliminate.forEach(p => {
            this._applyElimination(
                p,
                "had the highest risk profile and fell in the Sky Squid Game",
                events
            );
        });

        const deaths = events.filter(e => e.type === "death").length;
        events.push({
            type: "summary",
            text: `${deaths} players died in the Sky Squid Game.`
        });

        return events;
    }
};
