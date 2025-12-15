// ============================================
// UTILITY FUNCTIONS
// ============================================
const utils = {
    getPhotoRecord(playerId) {
        const rec = appState.customPlayerPhotos[playerId];
        if (!rec) return null;
        if (typeof rec === 'string') return { original: rec };
        return rec;
    },

    getActivePlayers() {
        return appState.players.filter(p => !p.eliminated && !p.votedOut && !p.isBaby);
    },

    getEffectiveStat(player, stat) {
        const baseValue = player.baseStats[stat] || 0;
        const boostValue = (player.allianceBoost && player.allianceBoost[stat]) || 0;
        let effectiveStat = baseValue + boostValue;
        if (player.injury) {
            if (stat === 'strength' || stat === 'agility') return Math.max(0, effectiveStat - 2);
            if (stat === 'cowardice') return effectiveStat + (player.injury.cowardiceDebuff || 0);
        }
        if (stat === 'cowardice' || stat === 'greed' || stat === 'debt') return effectiveStat;
        return Math.max(1, effectiveStat);
    },

    formatStatWithBoost(player, statKey) {
        if (!player || !player.baseStats) return '';
        const base = player.baseStats[statKey] ?? 0;
        const boost = (player.allianceBoost && player.allianceBoost[statKey]) ? player.allianceBoost[statKey] : 0;
        return boost > 0 ? (base + ' (+' + boost + ')') : String(base);
    },

    formatPlayerNumber(num) {
        return num.toString().padStart(3, '0');
    },

    formatCurrency(amount) {
        return '$' + String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },

    createPlayerLink(playerId) {
        return '<span class="player-link" onclick="ui.showPlayerCard(' + playerId + ')">P' + this.formatPlayerNumber(playerId) + '</span>';
    },

    linkifyPlayerNumbers(text) {
        if (!text) return '';
        var self = this;
        return text.replace(/Player (\d+)/g, function(match, num) {
            return self.createPlayerLink(parseInt(num));
        }).replace(/\bP(\d{1,3})\b/g, function(match, num) {
            return self.createPlayerLink(parseInt(num));
        });
    },

    calculateSurvivalScore(player, weights) {
        var strength = this.getEffectiveStat(player, 'strength');
        var agility = this.getEffectiveStat(player, 'agility');
        var intelligence = this.getEffectiveStat(player, 'intelligence');
        var charisma = this.getEffectiveStat(player, 'charisma');
        var luck = this.getEffectiveStat(player, 'luck');
        var cowardice = this.getEffectiveStat(player, 'cowardice');
        var greed = this.getEffectiveStat(player, 'greed');
        return (
            strength * (weights.str || 0) +
            agility * (weights.agi || 0) +
            intelligence * (weights.int || 0) +
            charisma * (weights.cha || 0) +
            luck * (weights.lck || 0) -
            cowardice * (weights.cow || 0) +
            greed * (weights.grd || 0)
        );
    },

    getPlayerFearScore(player) {
        if (!player || !player.baseStats) return 0;
        var str = this.getEffectiveStat(player, 'strength') || 0;
        var luck = this.getEffectiveStat(player, 'luck') || 0;
        var cow = this.getEffectiveStat(player, 'cowardice') || 0;
        var kills = player.eliminationsByPlayer || 0;
        var enemiesCount = (player.enemies || []).length;
        return str * 2 + kills * 3 + enemiesCount * 1.5 + luck * 0.5 - cow;
    },

    createGenderPool(total, isAdvanced) {
        var numFemales = 0, numMales = 0;
        var advFemaleEl = document.getElementById('advFemaleCount');
        var advMaleEl = document.getElementById('advMaleCount');
        var advFemaleCount = advFemaleEl ? advFemaleEl.value : '';
        var advMaleCount = advMaleEl ? advMaleEl.value : '';

        if ((advFemaleCount !== '' && !isNaN(advFemaleCount)) || (advMaleCount !== '' && !isNaN(advMaleCount))) {
            numFemales = (advFemaleCount !== '' && !isNaN(advFemaleCount)) ? parseInt(advFemaleCount) : 0;
            numMales = (advMaleCount !== '' && !isNaN(advMaleCount)) ? parseInt(advMaleCount) : 0;
            var totalSpecified = numFemales + numMales;
            if (totalSpecified > total) {
                var ratio = total / totalSpecified;
                numFemales = Math.floor(numFemales * ratio);
                numMales = total - numFemales;
            } else if (totalSpecified < total) {
                var remaining = total - totalSpecified;
                numMales += Math.ceil(remaining / 2);
                numFemales = total - numMales;
            }
        } else {
            var maxFemales = Math.floor(total / 2);
            numFemales = Math.floor(Math.random() * (maxFemales + 1));
            numMales = total - numFemales;
        }

        var genderPool = [];
        for (var i = 0; i < numFemales; i++) genderPool.push('Female');
        for (var j = 0; j < numMales; j++) genderPool.push('Male');
        for (var k = genderPool.length - 1; k > 0; k--) {
            var r = Math.floor(Math.random() * (k + 1));
            var temp = genderPool[k];
            genderPool[k] = genderPool[r];
            genderPool[r] = temp;
        }
        return genderPool;
    },

    createPlayer(id, gender, isAdvanced) {
        var firstName = gender === 'Male' 
            ? constants.firstNamesMale[Math.floor(Math.random() * constants.firstNamesMale.length)]
            : constants.firstNamesFemale[Math.floor(Math.random() * constants.firstNamesFemale.length)];
        var lastName = constants.lastNames[Math.floor(Math.random() * constants.lastNames.length)];

        var getVal = function(elemId) {
            var el = document.getElementById(elemId);
            return el ? el.value : '';
        };

        var getRandomInRange = function(advMin, advMax, defaultMin, defaultMax) {
            var min = advMin !== '' && !isNaN(advMin) ? parseInt(advMin) : defaultMin;
            var max = advMax !== '' && !isNaN(advMax) ? parseInt(advMax) : defaultMax;
            return Math.floor(Math.random() * (max - min + 1)) + min;
        };

        return {
            id: id,
            eliminated: false,
            photoAlbum: [],
            eliminationRound: null,
            votedOut: false,
            roundVotedOut: null,
            wasFinalistWhenEliminated: false,
            isWinner: false,
            isFinalist: false,
            confirmedFinalist: false,
            isEasterEgg: false,
            isPreviousWinner: false,
            isFavorite: false,
            age: getRandomInRange(getVal('advAgeMin'), getVal('advAgeMax'), 18, 80),
            country: getVal('advCountry').trim() || constants.countries[Math.floor(Math.random() * constants.countries.length)],
            occupation: constants.occupations[Math.floor(Math.random() * constants.occupations.length)],
            gender: gender,
            debt: this.getDebt(),
            protection: 0,
            hasHint: false,
            firstName: firstName,
            lastName: lastName,
            name: firstName + ' ' + lastName,
            nickname: null,
            relation: null,
            specialCondition: null,
            baseStats: {
                strength: getRandomInRange(getVal('advStrMin'), getVal('advStrMax'), 1, 10),
                agility: getRandomInRange(getVal('advAgiMin'), getVal('advAgiMax'), 1, 10),
                intelligence: getRandomInRange(getVal('advIntMin'), getVal('advIntMax'), 1, 10),
                charisma: getRandomInRange(getVal('advChaMin'), getVal('advChaMax'), 1, 10),
                luck: getRandomInRange(getVal('advLckMin'), getVal('advLckMax'), 1, 10),
                cowardice: getRandomInRange(getVal('advCowMin'), getVal('advCowMax'), 1, 10),
                greed: getRandomInRange(getVal('advGrdMin'), getVal('advGrdMax'), 1, 10),
                steadiness: Math.floor(Math.random() * 10) + 1,
                dexterity: Math.floor(Math.random() * 10) + 1
            },
            allianceBoost: { strength: 0, agility: 0, intelligence: 0, charisma: 0, luck: 0 },
            voteHistory: [],
            currentVote: null,
            allies: [],
            enemies: [],
            injury: null,
            actionLog: [],
            hasVipBet: false,
            reachedTop10: false,
            eliminationsByPlayer: 0,
            highestAllyCount: 0,
            isPregnant: false,
            hasBaby: null,
            isBaby: false,
            hasCaretaker: null,
            caretakerFor: null
        };
    },

    getDebt() {
        var ranges = [
            { max: 100000, w: 50 },
            { max: 500000, w: 30 },
            { max: 2000000, w: 15 },
            { max: 10000000, w: 5 }
        ];
        var range = this.getWeightedRandom(ranges, ranges.map(function(r) { return r.w; }));
        return Math.floor(Math.random() * (range.max - 1000)) + 1000;
    },

    getWeightedRandom(array, weights) {
        if (array.length === 0) return null;
        var sum = 0;
        var cumulativeWeights = weights.map(function(w) { return sum += w; });
        var random = Math.random() * sum;
        var index = cumulativeWeights.findIndex(function(weight) { return weight > random; });
        return array[index];
    },

    clearAdvancedSettings() {
        var setVal = function(elemId, val) {
            var el = document.getElementById(elemId);
            if (el) el.value = val;
        };
        setVal('advCountry', '');
        setVal('advFemaleCount', '');
        setVal('advMaleCount', '');
        setVal('advAgeMin', '');
        setVal('advAgeMax', '');
        ['Str', 'Agi', 'Int', 'Cha', 'Lck', 'Cow', 'Grd'].forEach(function(trait) {
            setVal('adv' + trait + 'Min', '');
            setVal('adv' + trait + 'Max', '');
        });
    },

    processNewEliminations() {
        if (!appState.players || appState.players.length === 0) return;

        var active = this.getActivePlayers();
        if (active.length <= 10) {
            active.forEach(function(p) { p.reachedTop10 = true; });
        }

        var grLabel = appState.round > 0 ? ('GR ' + appState.round) : 'Event';
        var self = this;

        appState.players.forEach(function(victim) {
            if (!victim.eliminated || victim.deathProcessed) return;

            victim.deathProcessed = true;

            if (appState.firstEliminationOfGame) {
                appState.firstEliminationOfGame = false;
            }

            appState.currentPrizePot = (appState.currentPrizePot || 0) + 100000;

            var victimNum = self.formatPlayerNumber(victim.id);

            appState.players.forEach(function(other) {
                if (other.id === victim.id) return;
                if (!Array.isArray(other.allies) || other.allies.length === 0) return;

                if (other.allies.includes(victim.id)) {
                    other.allies = other.allies.filter(function(aid) { return aid !== victim.id; });
                    other.actionLog = other.actionLog || [];
                    other.actionLog.push(grLabel + ': Ally P' + victimNum + ' was eliminated.');
                }
            });

            if (typeof vipBetting !== 'undefined') {
                vipBetting.handlePlayerEliminated(victim);
            }
        });
    }
};
