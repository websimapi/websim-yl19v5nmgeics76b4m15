// ============================================
// INJURY SYSTEM
// ============================================
const injurySystem = {
    /**
     * Map a game name to an injury multiplier.
     * x1: mental (e.g., Dalgona, Marbles)
     * x2: physical (e.g., Tug of War, Squid Game, Sky Squid Game, Pentathlon, Hide & Seek, Hot Potato, Hopscotch, Mingle, Sky Squid Game)
     * x5: combat events (e.g., Lights Out, X vs O Brawl, Bathroom Fight, Escape Attempt)
     */
    getGameMultiplier(lastGameName) {
        if (!lastGameName) return 1;
        const name = String(lastGameName).toLowerCase();

        // Combat-heavy events
        if (name.includes('lights out') || name.includes('x vs o') || name.includes('bathroom fight')) {
            return 5;
        }

        // Physical games
        if (
            name.includes('tug of war') ||
            name.includes('squid game') ||
            name.includes('sky squid game') ||
            name.includes('pentathlon') ||
            name.includes('hide & seek') ||
            name.includes('hot potato') ||
            name.includes('hopscotch') ||
            name.includes('mingle')
        ) {
            return 2;
        }

        // Mostly mental / precision / puzzle style
        if (
            name.includes('dalgona') ||
            name.includes('marbles') ||
            name.includes('glass bridge') ||
            name.includes('red light green light')
        ) {
            return 1;
        }

        // Fallback
        return 1;
    },

    /**
     * Post-round automatic injury assignment.
     * Called after each game resolution.
     */
    checkForNewInjuries() {
        const snapshots = appState.gameHistorySnapshots || [];
        const lastSnap = snapshots[snapshots.length - 1] || null;
        const lastGameName = lastSnap ? lastSnap.name : null;
        const multiplier = this.getGameMultiplier(lastGameName);

        const active = utils.getActivePlayers();
        if (!active.length) return;

        const grLabel = appState.round > 0 ? `GR ${appState.round}` : 'Event';

        active.forEach(p => {
            // Skip if already injured (we don't stack auto injuries)
            if (p.injury) return;

            const strength = utils.getEffectiveStat(p, 'strength') || 0;
            // Base probability: 0.0015 + ((10 - STR)/1500)
            let baseProb = 0.0015 + ((10 - strength) / 1500);
            // Clamp to minimal sensible positive value
            if (baseProb < 0.0005) baseProb = 0.0005;

            const finalProb = baseProb * multiplier;
            if (Math.random() >= finalProb) return;

            // Pick severity: Minor (60%), Regular (30%), Major (10%)
            const r = Math.random();
            let type = 'Minor';
            let roundsRemaining = 1;
            let cowardiceDebuff = 1;
            if (r >= 0.9) {
                type = 'Major';
                roundsRemaining = 3;
                cowardiceDebuff = 2;
            } else if (r >= 0.6) {
                type = 'Regular';
                roundsRemaining = 2;
                cowardiceDebuff = 1;
            }

            p.injury = {
                type,
                roundsRemaining,
                cowardiceDebuff,
                reason: `Wounded in ${lastGameName || 'a previous game'}`,
            };

            p.actionLog = p.actionLog || [];
            p.actionLog.push(
                `${grLabel}: Sustained a ${type.toLowerCase()} injury (${p.injury.reason}).`
            );
        });
    },

    /**
     * Decrement injury timers at end of round and clear healed injuries.
     */
    updateInjuryTimers() {
        appState.players.forEach(p => {
            if (!p.injury) return;

            // Decrement remaining rounds
            p.injury.roundsRemaining = (p.injury.roundsRemaining ?? 0) - 1;

            // Check expiry
            if (p.injury.roundsRemaining <= 0) {
                const typeLabel = p.injury.type || 'injury';
                log.event(
                    `P${utils.formatPlayerNumber(p.id)} has recovered from their ${typeLabel} injury.`
                );
                p.actionLog = p.actionLog || [];
                p.actionLog.push(`GR ${appState.round}: Recovered from injury.`);
                p.injury = null; // Clear the object
            }
        });

        // Refresh grid so injury visuals (like red glow) are removed when healed
        ui.updateAllPlayerDivs();
    },
};
