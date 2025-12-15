// ============================================
// VIP BETTING SYSTEM
// ============================================
const vipBetting = {
    /**
     * Calculate the payout multiplier for a given player at the current round.
     * Higher "fear score" (strong player) => lower multiplier; weaker players pay more.
     */
    calculatePayoutMultiplier(player, round) {
        if (!player || !player.baseStats) return 1.1;
        const s = utils.getEffectiveStat(player, 'strength') || 0;
        const a = utils.getEffectiveStat(player, 'agility') || 0;
        const i = utils.getEffectiveStat(player, 'intelligence') || 0;
        const c = utils.getEffectiveStat(player, 'charisma') || 0;
        const l = utils.getEffectiveStat(player, 'luck') || 0;
        const cow = utils.getEffectiveStat(player, 'cowardice') || 0;

        const fearScore = (s + a + i + c + l) - cow;
        let baseMult = 50 / (fearScore + 5);

        const decay = Math.pow(1.25, Math.max(0, round));
        let result = baseMult / decay;

        return Math.max(1.1, result);
    },

    /**
     * Place a VIP bet on a player.
     */
    placeBet(playerId, amount) {
        if (appState.isViewingArchivedGame || appState.isViewingHistory) {
            alert("You cannot place bets while viewing history or an archived game.");
            return;
        }
        if (appState.isGameModified) {
            alert("Betting is disabled for modified games.");
            return;
        }

        const id = parseInt(playerId, 10);
        const amt = parseInt(amount, 10);
        if (isNaN(id) || isNaN(amt) || amt <= 0) {
            alert("Enter a valid player ID and bet amount.");
            return;
        }

        const player = appState.players.find(p => p.id === id);
        if (!player || player.eliminated || player.votedOut) {
            alert("That player is not currently active.");
            return;
        }

        if (amt > appState.bettingBalance) {
            alert("Insufficient funds for this bet.");
            return;
        }

        const multiplier = this.calculatePayoutMultiplier(player, appState.round);
        const potentialPayout = Math.floor(amt * (multiplier - 1));

        appState.bettingBalance -= amt;
        player.hasVipBet = true;

        appState.currentBets.push({
            playerId: id,
            amount: amt,
            initialRound: appState.round,
            potentialPayout,
        });

        achievements.unlock('firstBet');
        log.event(`VIP Bet: You wagered ${utils.formatCurrency(amt)} on ${utils.createPlayerLink(id)} (~${multiplier.toFixed(2)}x).`);
        ui.updateVipTab();
    },

    /**
     * Cancel an existing bet before the player is eliminated or wins.
     * Refund 100% of the stake.
     */
    cancelBet(index) {
        if (index < 0 || index >= appState.currentBets.length) return;
        const bet = appState.currentBets[index];
        const player = appState.players.find(p => p.id === bet.playerId);
        if (player && !player.eliminated && !player.votedOut && !player.isWinner) {
            appState.bettingBalance += bet.amount;
            log.event(`VIP Bet cancelled: Refunded ${utils.formatCurrency(bet.amount)} from ${utils.createPlayerLink(bet.playerId)}.`);
            // Clear vip flag if this was their only bet
            const stillHas = appState.currentBets.some(
                (b, idx) => idx !== index && b.playerId === bet.playerId
            );
            if (!stillHas && player) player.hasVipBet = false;
            appState.currentBets.splice(index, 1);
            ui.updateVipTab();
        }
    },

    /**
     * Handle bet losses or consolation payouts when a player is eliminated.
     */
    handlePlayerEliminated(player) {
        if (!player || !player.hasVipBet || !appState.currentBets.length) return;

        const relevantBets = appState.currentBets.filter(b => b.playerId === player.id);
        if (!relevantBets.length) return;

        relevantBets.forEach(bet => {
            const idx = appState.currentBets.indexOf(bet);
            if (idx === -1) return;

            // Top 10 consolation bonus
            if (player.reachedTop10) {
                const bonus = Math.floor(bet.potentialPayout / 3);
                appState.bettingBalance += bet.amount + bonus;
                log.event(
                    `VIP Bet: Your pick ${utils.createPlayerLink(player.id)} reached the Top 10 but died. Consolation prize: you win ${utils.formatCurrency(bonus)} (stake refunded).`
                );
                achievements.unlock('topTenBet');
            } else {
                const loss = Math.floor(bet.amount / 2);
                const refund = bet.amount - loss;
                appState.bettingBalance += refund;
                log.event(
                    `VIP Bet: Your pick ${utils.createPlayerLink(player.id)} died. You lose ${utils.formatCurrency(loss)}, but ${utils.formatCurrency(refund)} is refunded.`
                );
            }

            appState.currentBets.splice(idx, 1);
        });

        // Clear player flag if no more bets on them
        const stillHas = appState.currentBets.some(b => b.playerId === player.id);
        if (!stillHas) player.hasVipBet = false;

        ui.updateVipTab();
    },

    /**
     * Handle winning bets when a player wins the entire game.
     */
    handleWinner(winner) {
        if (!winner || !winner.hasVipBet || !appState.currentBets.length) return;

        const relevantBets = appState.currentBets.filter(b => b.playerId === winner.id);
        if (!relevantBets.length) return;

        relevantBets.forEach(bet => {
            const idx = appState.currentBets.indexOf(bet);
            if (idx === -1) return;

            const payout = bet.amount + bet.potentialPayout;
            appState.bettingBalance += payout;
            log.event(
                `VIP Bet: YOUR PICK WON! ${utils.createPlayerLink(winner.id)} survived the Squid Game. You receive ${utils.formatCurrency(bet.potentialPayout)} (total ${utils.formatCurrency(payout)}).`
            );

            achievements.unlock('firstWinBet');

            // Early-bird bonus: bet placed on or before Round 3 (unmodified game only)
            if (!appState.isGameModified && bet.initialRound <= 3) {
                achievements.unlock('betEarlyWinner');
            }

            appState.currentBets.splice(idx, 1);
        });

        winner.hasVipBet = false;
        ui.updateVipTab();
    },

    /**
     * Handle joint winners or cancelled games: refund all remaining bets in full.
     */
    handleCancelledOrJointWinners() {
        if (!appState.currentBets.length) return;

        let totalRefund = 0;
        appState.currentBets.forEach(bet => {
            totalRefund += bet.amount;
            const player = appState.players.find(p => p.id === bet.playerId);
            if (player) player.hasVipBet = false;
        });

        appState.bettingBalance += totalRefund;
        appState.currentBets = [];

        if (totalRefund > 0) {
            log.event(
                `VIP Bet: Game ended with joint winners or no winner. All outstanding bets have been fully refunded (${utils.formatCurrency(totalRefund)}).`
            );
        }

        ui.updateVipTab();
    },
};
