            handleDalgona() {
                // 1. Round initialization & guard
                if (!this.preRoundUpdate()) return;

                appState.round++;
                const grLabel = `GR ${appState.round}`;

                const activePlayers = utils.getActivePlayers();
                if (!activePlayers.length) return;

                // Add header entry to elimination order
                appState.eliminationOrder.push({
                    isHeader: true,
                    text: `${grLabel}: Dalgona`,
                });

                // 2. Determine number of eliminations (20–45% of active players)
                const randomPercent = 20 + Math.random() * (45 - 20);
                const numToEliminateTarget = Math.floor(
                    activePlayers.length * (randomPercent / 100)
                );

                if (numToEliminateTarget <= 0) {
                    // Few / no eliminations
                    log.event(`${grLabel} (Dalgona): Few eliminations occurred.`);
                    // Everyone passes in dossier
                    activePlayers.forEach((p) => {
                        p.actionLog = p.actionLog || [];
                        // If we never assigned a shape, just log a generic pass
                        if (p.tempShape) {
                            p.actionLog.push(`${grLabel}: Passed Dalgona (shape: ${p.tempShape}).`);
                        } else {
                            p.actionLog.push(`${grLabel}: Passed Dalgona.`);
                        }
                    });
                    // Snapshot & UI
                    this.takeSnapshot(appState.round, "Dalgona");
                    ui.updateAllPlayerDivs();
                    ui.updateCounters();
                    ui.updateEliminationOrderList();
                    ui.updateHistorySliderUI();
                    return;
                }

                // 3. Assign each player a Dalgona shape with weighted probabilities
                const assignShape = () => {
                    const r = Math.random();
                    if (r < 0.4) return "Circle";      // 40%
                    if (r < 0.7) return "Triangle";    // 30%
                    if (r < 0.9) return "Star";        // 20%
                    return "Umbrella";                 // 10%
                };

                const shapeDifficulty = {
                    Circle: 90,
                    Triangle: 70,
                    Star: 50,
                    Umbrella: 30,
                };

                activePlayers.forEach((p) => {
                    const shape = assignShape();
                    p.tempShape = shape;

                    // 4. Compute SUCCESS score
                    const steadiness = utils.getEffectiveStat(p, "steadiness") || 0;
                    const luck = utils.getEffectiveStat(p, "luck") || 0;
                    const dexterity = utils.getEffectiveStat(p, "dexterity") || 0;
                    const baseShape = shapeDifficulty[shape] ?? 50;
                    const rng = Math.random() * 100;

                    const successScore =
                        baseShape +
                        steadiness * 3 +
                        luck * 2 +
                        dexterity * 2 +
                        rng;

                    p._dalgonaSuccessScore = successScore;
                });

                // 5. Sort players by success score DESC (highest safest)
                const sortedByScore = activePlayers
                    .slice()
                    .sort(
                        (a, b) =>
                            b._dalgonaSuccessScore - a._dalgonaSuccessScore
                    );

                // 6. Bottom N are candidates for elimination
                const playersToEliminateCandidates = sortedByScore.slice(
                    sortedByScore.length - numToEliminateTarget
                );

                // 7. Assign cause of failure
                const REASON_CRACKED =
                    "GR_PLACEHOLDER: Cracked the cookie.";
                const REASON_SNAPPED =
                    "GR_PLACEHOLDER: Snapped the cookie.";
                const REASON_TIME =
                    "GR_PLACEHOLDER: Ran out of time while doing Dalgona.";

                const crackedElims = [];
                const snappedElims = [];
                const timeElims = [];
                const eliminatedThisRound = [];

                playersToEliminateCandidates.forEach((p) => {
                    const r = Math.random();
                    let reasonKey = "cracked";
                    if (r < 0.6) {
                        reasonKey = "cracked";
                    } else if (r < 0.85) {
                        reasonKey = "snapped";
                    } else {
                        reasonKey = "time";
                    }
                    p.tempEliminationReason = reasonKey;
                });

                // 8. Survival mechanics check & finalize eliminations
                playersToEliminateCandidates.forEach((p) => {
                    const survived = this.checkSurvivalMechanics(
                        p,
                        "Dalgona"
                    );
                    p.actionLog = p.actionLog || [];

                    if (survived) {
                        // Dossier entry handled in checkSurvivalMechanics
                        return;
                    }

                    // Not protected: eliminate for real
                    p.eliminated = true;
                    p.eliminationRound = appState.round;
                    p.wasFinalistWhenEliminated = p.isFinalist;

                    let line = "";
                    const shapeLabel = p.tempShape ? ` (shape: ${p.tempShape})` : "";
                    if (p.tempEliminationReason === "cracked") {
                        line = `${grLabel}: Cracked the cookie${shapeLabel}.`;
                        crackedElims.push(p);
                    } else if (p.tempEliminationReason === "snapped") {
                        line = `${grLabel}: Snapped the cookie${shapeLabel}.`;
                        snappedElims.push(p);
                    } else {
                        line = `${grLabel}: Ran out of time while doing Dalgona${shapeLabel}.`;
                        timeElims.push(p);
                    }
                    p.actionLog.push(line);
                    eliminatedThisRound.push(p);
                });

                // If everyone was protected, treat as "few eliminations"
                if (eliminatedThisRound.length === 0) {
                    activePlayers.forEach((p) => {
                        p.actionLog = p.actionLog || [];
                        if (p.tempShape) {
                            p.actionLog.push(`${grLabel}: Passed Dalgona (shape: ${p.tempShape}).`);
                        } else {
                            p.actionLog.push(`${grLabel}: Passed Dalgona.`);
                        }
                    });
                    log.event(`${grLabel} (Dalgona): Few eliminations occurred.`);
                    this.takeSnapshot(appState.round, "Dalgona");
                    ui.updateAllPlayerDivs();
                    ui.updateCounters();
                    ui.updateEliminationOrderList();
                    ui.updateHistorySliderUI();
                    return;
                }

                // 9. Survivors (not eliminated) get "Passed Dalgona."
                const eliminatedIds = new Set(
                    eliminatedThisRound.map((p) => p.id)
                );
                activePlayers.forEach((p) => {
                    if (!eliminatedIds.has(p.id)) {
                        p.actionLog = p.actionLog || [];
                        if (p.tempShape) {
                            p.actionLog.push(`${grLabel}: Passed Dalgona (shape: ${p.tempShape}).`);
                        } else {
                            p.actionLog.push(`${grLabel}: Passed Dalgona.`);
                        }
                    }
                });

                // 10. Build eliminationOrder in the same sequence as the Game Log breakdown
                const fmtList = (playersArr) =>
                    playersArr
                        .map(
                            (p) =>
                                `${utils.createPlayerLink(
                                    p.id
                                )} (${p.name || "Unknown"})`
                        )
                        .join(", ");

                const orderedForElim = [
                    ...crackedElims,
                    ...snappedElims,
                    ...timeElims,
                ];

                // Push eliminationOrder entries in that order
                orderedForElim.forEach((p) => {
                    appState.eliminationOrder.push({
                        playerId: p.id,
                        round: appState.round,
                        reason: "failed Dalgona",
                        isHeader: false,
                    });
                });

                // 11. Build detailed game log breakdown
                let detailsHtml =
                    "<b>Dalgona Elimination Breakdown:</b><br>----------------------------------------<br>";

                detailsHtml += `<h4>Cracked the Cookie (${crackedElims.length})</h4>`;
                detailsHtml += crackedElims.length
                    ? fmtList(crackedElims)
                    : "None";
                detailsHtml += "<br><br>";

                detailsHtml += `<h4>Snapped the Cookie (${snappedElims.length})</h4>`;
                detailsHtml += snappedElims.length
                    ? fmtList(snappedElims)
                    : "None";
                detailsHtml += "<br><br>";

                detailsHtml += `<h4>Ran Out of Time (${timeElims.length})</h4>`;
                detailsHtml += timeElims.length
                    ? fmtList(timeElims)
                    : "None";

                // 12. Top-level log entry
                log.event(
                    `${grLabel} (Dalgona): ${eliminatedThisRound.length} player(s) eliminated.`,
                    detailsHtml
                );

                // 13. Animation mode behavior
                if (
                    this.animationModeEnabled &&
                    eliminatedThisRound.length > 0
                ) {
                    this.playersToEliminateInAnimation =
                        eliminatedThisRound.slice();
                    this.animatedEliminationIndex = 0;
                    this.animateElimination("failed Dalgona");
                }

                // Prize pot initialization
                if (appState.firstEliminationOfGame) {
                    appState.currentPrizePot =
                        appState.originalRosterSize * 100000000;
                    appState.firstEliminationOfGame = false;
                }

                // Snapshot, UI updates, game over check
                this.takeSnapshot(appState.round, "Dalgona");
                ui.updateAllPlayerDivs();
                ui.updateCounters();
                ui.updateEliminationOrderList();
                ui.updateHistorySliderUI();
                this.checkGameOver();
            },

