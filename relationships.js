// ============================================
// RELATIONSHIPS (Alliances, Enemies, Family)
// ============================================
const relationships = {
    // Alliance visualization colors
    allianceColors: [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
        '#F8B500', '#00CED1', '#FF69B4', '#32CD32', '#FFD700'
    ],
    persistentGroupColors: {},
    nextGroupColorIndex: 0,

    /**
     * Merge two players' alliance groups into one super-group.
     * All members of both groups become allies of each other.
     */
    mergeAlliances(p1, p2) {
        const idToPlayer = new Map(appState.players.map(p => [p.id, p]));

        // Gather all IDs in p1's group
        const group1 = new Set([p1.id, ...(p1.allies || [])]);
        // Gather all IDs in p2's group
        const group2 = new Set([p2.id, ...(p2.allies || [])]);

        // Merge into one super-group
        const superGroup = new Set([...group1, ...group2]);

        // Update each member's allies to include everyone else in the super-group
        superGroup.forEach(id => {
            const player = idToPlayer.get(id);
            if (!player) return;
            player.allies = player.allies || [];
            superGroup.forEach(otherId => {
                if (otherId !== id && !player.allies.includes(otherId)) {
                    player.allies.push(otherId);
                }
            });
        });

        this.updateAllianceStatBoosts();
    },

    /**
     * Recompute alliance-based stat buffs.
     * Each active ally grants +2 to Str/Agi/Int/Cha/Luck (applied via allianceBoost).
     */
    updateAllianceStatBoosts() {
        const activeIds = new Set(
            appState.players
                .filter(p => !p.eliminated && !p.votedOut)
                .map(p => p.id)
        );

        appState.players.forEach(p => {
            const allies = Array.isArray(p.allies) ? p.allies : [];
            const activeAllyCount = allies.filter(id => activeIds.has(id)).length;
            const bonus = 2 * activeAllyCount;

            p.allianceBoost = {
                strength: bonus,
                agility: bonus,
                intelligence: bonus,
                charisma: bonus,
                luck: bonus
            };
            p.highestAllyCount = Math.max(p.highestAllyCount || 0, allies.length);
        });
    },

    /**
     * Backwards-compatible wrapper used by older calls.
     */
    updateAllianceBoosts(player) {
        this.updateAllianceStatBoosts();
    },

    /**
     * Grief mechanic: players who had 3+ allies and now lost ALL allies may self-eliminate.
     */
    checkAllianceWipe() {
        const grLabel = appState.round > 0 ? `GR ${appState.round}` : 'Event';
        const idToPlayer = new Map(appState.players.map(pl => [pl.id, pl]));

        // --- Special Relation Grief: spouse/child/parent/friend ---
        appState.players.forEach(p => {
            if (p.eliminated || p.votedOut || !p.relation) return;
            const rel = p.relation;
            const target = idToPlayer.get(rel.targetId);
            if (!target || !target.eliminated) return;
            // Only trigger when the relation target died this round
            if (target.eliminationRound !== appState.round) return;
            // Forced Winner never self-eliminates from grief
            if (appState.forcedWinnerId && appState.forcedWinnerId === p.id) return;

            const relType = rel.type;
            const griefEligible = [
                'Mother', 'Father', 'Son', 'Daughter', 'Wife', 'Husband', 'Friend'
            ];
            if (!griefEligible.includes(relType)) return;

            if (Math.random() < 0.20) {
                p.eliminated = true;
                p.eliminationRound = appState.round;
                p.actionLog = p.actionLog || [];
                p.actionLog.push(
                    `${grLabel}: Could not live after losing their ${relType.toLowerCase()} and self-eliminated out of grief.`
                );
                achievements.unlock('tragedy');
            }
        });

        // --- Alliance Wipe Grief: 100% of allies died this round ---
        appState.players.forEach(p => {
            if (p.eliminated || p.votedOut) return;
            // Forced Winner is immune to alliance-wipe suicides
            if (appState.forcedWinnerId && appState.forcedWinnerId === p.id) return;
            const allies = Array.isArray(p.allies) ? p.allies : [];
            if (allies.length === 0) return;

            const allAlliesDiedThisRound = allies.every(id => {
                const ally = idToPlayer.get(id);
                return ally && ally.eliminated && ally.eliminationRound === appState.round;
            });

            if (!allAlliesDiedThisRound) return;

            if (Math.random() < 0.25) {
                p.eliminated = true;
                p.eliminationRound = appState.round;
                p.actionLog = p.actionLog || [];
                p.actionLog.push(
                    `${grLabel}: Could not cope with losing their entire alliance this round and self-eliminated out of grief.`
                );
                achievements.unlock('tragedy');
            }
        });
    },

    /**
     * Create a shared rivalry between two players and their alliance groups.
     * All members of group A become enemies with all members of group B.
     */
    createSharedRivalry(p1, p2) {
        const idToPlayer = new Map(appState.players.map(p => [p.id, p]));

        const groupA = new Set([p1.id, ...(p1.allies || [])]);
        const groupB = new Set([p2.id, ...(p2.allies || [])]);

        // Make everyone in group A enemies with everyone in group B
        groupA.forEach(idA => {
            const plA = idToPlayer.get(idA);
            if (!plA) return;
            plA.enemies = plA.enemies || [];
            groupB.forEach(idB => {
                if (idB === idA) return;
                if (!plA.enemies.includes(idB)) plA.enemies.push(idB);
            });
        });

        groupB.forEach(idB => {
            const plB = idToPlayer.get(idB);
            if (!plB) return;
            plB.enemies = plB.enemies || [];
            groupA.forEach(idA => {
                if (idA === idB) return;
                if (!plB.enemies.includes(idA)) plB.enemies.push(idA);
            });
        });

        // Alliances may have changed; recompute buffs
        this.updateAllianceStatBoosts();
    },

    /**
     * Automatic relationship updates at end of rounds:
     * - Rare betrayals (1%) turning allies into enemies
     * - New friendships for lonely but charismatic players
     * - New rivalries for greedy/cowardly players
     */
    updateRelationships() {
        const players = appState.players;
        const idToPlayer = new Map(players.map(p => [p.id, p]));
        const grLabel = appState.round > 0 ? `GR ${appState.round}` : 'Event';

        // A. Betrayal (Breaking Alliances)
        players.forEach(p => {
            if (p.eliminated || p.votedOut) return;
            const allies = (p.allies || []).slice();

            allies.forEach(allyId => {
                const ally = idToPlayer.get(allyId);
                if (!ally || ally.eliminated || ally.votedOut) return;

                // Flat 1% chance this pair breaks and becomes enemies
                if (Math.random() < 0.01) {
                    p.allies = (p.allies || []).filter(id => id !== ally.id);
                    ally.allies = (ally.allies || []).filter(id => id !== p.id);

                    this.createSharedRivalry(p, ally);

                    p.actionLog = p.actionLog || [];
                    ally.actionLog = ally.actionLog || [];
                    p.actionLog.push(`${grLabel}: Event: Betrayed by ally P${utils.formatPlayerNumber(ally.id)}.`);
                    ally.actionLog.push(`${grLabel}: Event: Betrayed by ally P${utils.formatPlayerNumber(p.id)}.`);
                }
            });
        });

        const activePlayers = players.filter(p => !p.eliminated && !p.votedOut);

        // B. Alliance Formation (Making Friends)
        activePlayers.forEach(p => {
            const allies = p.allies || [];
            const cha = utils.getEffectiveStat(p, 'charisma') || 0;

            if (allies.length >= 2) return;

            let chance = cha / 80;
            if (chance < 0) chance = 0;
            if (chance > 1) chance = 1;

            if (Math.random() < chance) {
                const currentAllies = new Set(allies);
                currentAllies.add(p.id);

                const candidates = activePlayers.filter(other =>
                    other.id !== p.id &&
                    !currentAllies.has(other.id) &&
                    !(p.enemies || []).includes(other.id)
                );
                if (candidates.length === 0) return;

                const partner = candidates[Math.floor(Math.random() * candidates.length)];
                this.mergeAlliances(p, partner);

                p.actionLog = p.actionLog || [];
                partner.actionLog = partner.actionLog || [];
                p.actionLog.push(`${grLabel}: Formed a new friendship with P${utils.formatPlayerNumber(partner.id)}.`);
                partner.actionLog.push(`${grLabel}: Formed a new friendship with P${utils.formatPlayerNumber(p.id)}.`);
            }
        });

        // C. Enemy Formation (Starting Beef)
        activePlayers.forEach(p => {
            const greed = utils.getEffectiveStat(p, 'greed') || 0;
            const cow = utils.getEffectiveStat(p, 'cowardice') || 0;
            const cha = utils.getEffectiveStat(p, 'charisma') || 0;

            let chance = (greed - cha + cow) / 100;
            if (chance < 0) chance = 0;
            if (chance > 1) chance = 1;
            if (chance === 0) return;

            if (Math.random() < chance) {
                const currentAllies = new Set(p.allies || []);
                currentAllies.add(p.id);

                const candidates = activePlayers.filter(other =>
                    other.id !== p.id &&
                    !currentAllies.has(other.id) &&
                    !(p.enemies || []).includes(other.id)
                );
                if (candidates.length === 0) return;

                const target = candidates[Math.floor(Math.random() * candidates.length)];
                this.createSharedRivalry(p, target);

                p.actionLog = p.actionLog || [];
                target.actionLog = target.actionLog || [];
                p.actionLog.push(`${grLabel}: Developed a rivalry with P${utils.formatPlayerNumber(target.id)}.`);
                target.actionLog.push(`${grLabel}: Became a target of P${utils.formatPlayerNumber(p.id)}'s rivalry.`);
            }
        });
    },

    // Generate a stable group key for alliance visualization
    getGroupKeyForPlayer(player) {
        const ids = new Set([player.id, ...(player.allies || [])]);
        if (ids.size <= 1) return null;
        return Array.from(ids).sort((a, b) => a - b).join('-');
    },

    getGroupColor(groupKey) {
        if (!groupKey) return null;
        if (!this.persistentGroupColors[groupKey]) {
            const color = this.allianceColors[
                this.nextGroupColorIndex % this.allianceColors.length
            ];
            this.persistentGroupColors[groupKey] = color;
            this.nextGroupColorIndex++;
        }
        return this.persistentGroupColors[groupKey];
    },

    createAlliance() {
        const p1Id = parseInt(document.getElementById('allianceP1').value);
        const p2Id = parseInt(document.getElementById('allianceP2').value);

        const p1 = appState.players.find(p => p.id === p1Id);
        const p2 = appState.players.find(p => p.id === p2Id);

        if (!p1 || !p2) {
            alert("One or both players not found.");
            return;
        }

        appState.isGameModified = true;
        this.mergeAlliances(p1, p2);

        const grLabel = appState.round > 0 ? `GR ${appState.round}` : 'Event';
        p1.actionLog = p1.actionLog || [];
        p2.actionLog = p2.actionLog || [];
        p1.actionLog.push(`${grLabel}: Formed alliance with P${utils.formatPlayerNumber(p2Id)}.`);
        p2.actionLog.push(`${grLabel}: Formed alliance with P${utils.formatPlayerNumber(p1Id)}.`);

        log.event(`${utils.createPlayerLink(p1Id)} and ${utils.createPlayerLink(p2Id)} formed an alliance.`);
        ui.updateAllPlayerDivs();
    },

    removeAlliance() {
        const p1Id = parseInt(document.getElementById('allianceP1').value);
        const p2Id = parseInt(document.getElementById('allianceP2').value);

        const p1 = appState.players.find(p => p.id === p1Id);
        const p2 = appState.players.find(p => p.id === p2Id);

        if (!p1 || !p2) {
            alert("One or both players not found.");
            return;
        }

        p1.allies = p1.allies.filter(id => id !== p2Id);
        p2.allies = p2.allies.filter(id => id !== p1Id);

        this.updateAllianceStatBoosts();

        log.event(`${utils.createPlayerLink(p1Id)} and ${utils.createPlayerLink(p2Id)} alliance removed.`);
        ui.updateAllPlayerDivs();
    },

    createEnemy() {
        const p1Id = parseInt(document.getElementById('enemyP1').value);
        const p2Id = parseInt(document.getElementById('enemyP2').value);

        const p1 = appState.players.find(p => p.id === p1Id);
        const p2 = appState.players.find(p => p.id === p2Id);

        if (!p1 || !p2) {
            alert("One or both players not found.");
            return;
        }

        appState.isGameModified = true;
        this.createSharedRivalry(p1, p2);

        const grLabel = appState.round > 0 ? `GR ${appState.round}` : 'Event';
        p1.actionLog = p1.actionLog || [];
        p2.actionLog = p2.actionLog || [];
        p1.actionLog.push(`${grLabel}: Declared P${utils.formatPlayerNumber(p2Id)} as an enemy.`);
        p2.actionLog.push(`${grLabel}: Declared P${utils.formatPlayerNumber(p1Id)} as an enemy.`);

        log.event(`${utils.createPlayerLink(p1Id)} and ${utils.createPlayerLink(p2Id)} are now enemies (viral rivalry).`);
        ui.updateAllPlayerDivs();
    },

    removeEnemy() {
        const p1Id = parseInt(document.getElementById('enemyP1').value);
        const p2Id = parseInt(document.getElementById('enemyP2').value);

        const p1 = appState.players.find(p => p.id === p1Id);
        const p2 = appState.players.find(p => p.id === p2Id);

        if (!p1 || !p2) {
            alert("One or both players not found.");
            return;
        }

        p1.enemies = p1.enemies.filter(id => id !== p2Id);
        p2.enemies = p2.enemies.filter(id => id !== p1Id);

        log.event(`${utils.createPlayerLink(p1Id)} and ${utils.createPlayerLink(p2Id)} are no longer enemies.`);
        ui.updateAllPlayerDivs();
    },

    createRelation() {
        const p1Id = parseInt(document.getElementById('relationP1').value);
        const p2Id = parseInt(document.getElementById('relationP2').value);
        const relationType = document.getElementById('relationType').value;

        const p1 = appState.players.find(p => p.id === p1Id);
        const p2 = appState.players.find(p => p.id === p2Id);

        if (!p1 || !p2) {
            alert("One or both players not found.");
            return;
        }

        appState.isGameModified = true;

        if (p1.relation || p2.relation) {
            alert("One or both players already have a special relation.");
            return;
        }

        const err = this.validateManualRelation(p1, p2, relationType);
        if (err) {
            alert(err);
            return;
        }

        const reciprocalType = this.getReciprocalRelationType(p1, p2, relationType);

        p1.relation = { type: relationType, targetId: p2.id };
        p2.relation = { type: reciprocalType, targetId: p1.id };

        this.mergeAlliances(p1, p2);

        log.event(`${utils.createPlayerLink(p1Id)} is now "${relationType}" to ${utils.createPlayerLink(p2Id)}.`);
    },

    removeRelation() {
        const p1Id = parseInt(document.getElementById('removeRelationP1').value);
        const p1 = appState.players.find(p => p.id === p1Id);

        if (!p1) {
            alert("Player not found.");
            return;
        }

        if (!p1.relation) {
            alert("This player has no special relation.");
            return;
        }

        const targetId = p1.relation.targetId;
        const p2 = appState.players.find(p => p.id === targetId);

        p1.relation = null;
        if (p2 && p2.relation && p2.relation.targetId === p1.id) {
            p2.relation = null;
        }

        log.event(`${utils.createPlayerLink(p1Id)} special relations removed.`);
    },

    establishRelations() {
        const players = appState.players.filter(
            p => !p.isEasterEgg && !p.isPreviousWinner && !p.relation
        );

        players.forEach(p1 => {
            if (Math.random() >= 1 / 250) return;
            if (p1.relation) return;

            const candidates = [];
            const byId = (id) => appState.players.find(p => p.id === id);

            if (Math.random() < 0.5) {
                const left = byId(p1.id - 1);
                const right = byId(p1.id + 1);
                if (left && !left.relation) candidates.push(left);
                if (right && !right.relation) candidates.push(right);
            } else {
                const others = appState.players.filter(
                    p => p.id !== p1.id && !p.relation && !p.isEasterEgg && !p.isPreviousWinner
                );
                if (others.length) {
                    candidates.push(others[Math.floor(Math.random() * others.length)]);
                }
            }

            if (!candidates.length) return;
            const p2 = candidates[Math.floor(Math.random() * candidates.length)];
            if (!p2 || p2.relation) return;

            const possibleTypes = this.getAutoRelationTypes(p1, p2);
            if (!possibleTypes.length) return;
            const chosenType = possibleTypes[Math.floor(Math.random() * possibleTypes.length)];

            const err = this.validateManualRelation(p1, p2, chosenType);
            if (err) return;

            const reciprocalType = this.getReciprocalRelationType(p1, p2, chosenType);

            p1.relation = { type: chosenType, targetId: p2.id };
            p2.relation = { type: reciprocalType, targetId: p1.id };

            this.mergeAlliances(p1, p2);

            const isFamilyType = !['Friend'].includes(chosenType) && !['Friend'].includes(reciprocalType);
            if (isFamilyType && p1.lastName && p2.lastName && p1.lastName !== p2.lastName) {
                p2.lastName = p1.lastName;
                p2.name = `${p2.firstName} ${p2.lastName}`;
            }
        });

        appState.players.forEach(p => {
            (p.allies || []).forEach(allyId => {
                const ally = appState.players.find(pl => pl.id === allyId);
                if (ally) this.mergeAlliances(p, ally);
            });
        });
        this.updateAllianceStatBoosts();
    },

    validateManualRelation(p1, p2, relationType) {
        const age1 = p1.age || 0;
        const age2 = p2.age || 0;
        const g1 = p1.gender;
        const g2 = p2.gender;
        const olderBy = age1 - age2;
        const youngerBy = age2 - age1;

        switch (relationType) {
            case 'Mother':
                if (g1 !== 'Female') return "Mother relation requires Player 1 to be female.";
                if (olderBy <= 16) return "Mother must be at least 17 years older than the child.";
                break;
            case 'Father':
                if (g1 !== 'Male') return "Father relation requires Player 1 to be male.";
                if (olderBy <= 16) return "Father must be at least 17 years older than the child.";
                break;
            case 'Son':
                if (g1 !== 'Male') return "Son relation requires Player 1 to be male.";
                if (youngerBy <= 16) return "Son must be at least 17 years younger than the parent.";
                break;
            case 'Daughter':
                if (g1 !== 'Female') return "Daughter relation requires Player 1 to be female.";
                if (youngerBy <= 16) return "Daughter must be at least 17 years younger than the parent.";
                break;
            case 'Wife':
                if (g1 !== 'Female' || g2 !== 'Male') return "Wife relation requires P1 Female and P2 Male.";
                break;
            case 'Husband':
                if (g1 !== 'Male' || g2 !== 'Female') return "Husband relation requires P1 Male and P2 Female.";
                break;
            case 'Friend':
                if (p1.id === p2.id) return "A player cannot be their own friend.";
                break;
            default:
                return "Unsupported relation type.";
        }
        return null;
    },

    getReciprocalRelationType(p1, p2, relationType) {
        switch (relationType) {
            case 'Mother':
            case 'Father':
                return p2.gender === 'Male' ? 'Son' : 'Daughter';
            case 'Son':
            case 'Daughter':
                return p2.gender === 'Male' ? 'Father' : 'Mother';
            case 'Husband':
                return 'Wife';
            case 'Wife':
                return 'Husband';
            case 'Friend':
            default:
                return 'Friend';
        }
    },

    getAutoRelationTypes(p1, p2) {
        const results = [];
        const age1 = p1.age || 0;
        const age2 = p2.age || 0;
        const g1 = p1.gender;
        const g2 = p2.gender;
        const olderBy = age1 - age2;
        const youngerBy = age2 - age1;

        if (g1 === 'Female' && olderBy > 16) results.push('Mother');
        if (g1 === 'Male' && olderBy > 16) results.push('Father');
        if (g1 === 'Male' && youngerBy > 16) results.push('Son');
        if (g1 === 'Female' && youngerBy > 16) results.push('Daughter');

        if (age1 >= 18 && age2 >= 18) {
            if (g1 === 'Female' && g2 === 'Male') results.push('Wife');
            if (g1 === 'Male' && g2 === 'Female') results.push('Husband');
        }

        if (!results.length && p1.id !== p2.id) {
            results.push('Friend');
        }

        return results;
    },

    getDisplayRelationLabel(p1, p2, storedType) {
        if (!storedType) return 'Relation';
        const p2Gender = p2 && p2.gender;

        switch (storedType) {
            case 'Mother':
            case 'Father':
                return p2Gender === 'Male' ? 'Son' : 'Daughter';
            case 'Son':
            case 'Daughter':
                return p2Gender === 'Male' ? 'Father' : 'Mother';
            case 'Husband':
                return 'Wife';
            case 'Wife':
                return 'Husband';
            case 'Friend':
            default:
                return storedType;
        }
    },
};
