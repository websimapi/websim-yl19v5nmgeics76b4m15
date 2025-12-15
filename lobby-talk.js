// ============================================
// LOBBY TALK (Dialogue Engine)
// ============================================

// Note: lobbyChatHistory is declared in state.js

// Game explanations for context
const GAME_EXPLANATIONS = {
    "Red Light Green Light": "Players must freeze when the doll turns around. Anyone caught moving is shot.",
    "Dalgona": "Players must carve a shape from honeycomb candy without breaking it.",
    "Tug of War": "Two teams pull a rope over a platform. The losing team falls to their death.",
    "Marbles": "Players pair up and play marbles. The loser of each pair is eliminated.",
    "Glass Bridge": "Players cross a bridge of glass panels, some of which shatter.",
    "Squid Game Finale": "The final two players fight to the death in the squid game arena.",
    "Lights Out": "A brutal nighttime massacre where players attack each other.",
    "Hide & Seek": "Seekers hunt hiders. Failed seekers and found hiders are eliminated.",
    "Circle of Trust": "A social deduction game where players must guess who gave them a box.",
    "Pentathlon": "Teams compete in five mini-games. Losing teams are eliminated.",
    "Mingle": "Players must form groups of a called number. Those left out are eliminated.",
};

// Simple long-term memory store
const lobbyMemory = {
    load() {
        try {
            const raw = localStorage.getItem('npc_lobby_memory');
            if (!raw) return {};
            return JSON.parse(raw) || {};
        } catch (e) {
            return {};
        }
    },
    save(updated) {
        try {
            if (updated && typeof updated === 'object') {
                localStorage.setItem('npc_lobby_memory', JSON.stringify(updated));
            }
        } catch (e) {}
    },
};

const lobbyTalk = {
    init() {
        this.refreshPreviousGameOptions();
        this.render();
    },

    refreshPreviousGameOptions() {
        const select = document.getElementById('lobbyPreviousGameSelect');
        if (!select) return;
        select.innerHTML = '';

        let added = false;
        if (Array.isArray(appState.allGamesHistory) && appState.allGamesHistory.length > 0) {
            appState.allGamesHistory.forEach(record => {
                const opt = document.createElement('option');
                opt.value = `game-${record.gameNumber}`;
                opt.textContent = `Game #${record.gameNumber} – Winner: ${record.winnerName || 'Unknown'}`;
                select.appendChild(opt);
                added = true;
            });
        }

        if (!added && Array.isArray(appState.gameHistorySnapshots) && appState.gameHistorySnapshots.length > 0) {
            appState.gameHistorySnapshots.forEach((snap, idx) => {
                const opt = document.createElement('option');
                opt.value = `snap-${idx}`;
                opt.textContent = `GR ${snap.round}: ${snap.name}`;
                select.appendChild(opt);
                added = true;
            });
        }

        if (!added) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'No previous games yet';
            select.appendChild(opt);
        }
    },

    onTopicChange() {
        const topicSel = document.getElementById('lobbyTopicSelect');
        if (!topicSel) return;
        const topic = topicSel.value;

        const prevGameWrap = document.getElementById('lobbyPrevGameWrapper');
        const specificPlayerWrap = document.getElementById('lobbySpecificPlayerWrapper');
        const customTopicWrap = document.getElementById('lobbyCustomTopicWrapper');

        if (prevGameWrap) prevGameWrap.style.display = (topic === 'previousGame') ? 'inline-flex' : 'none';
        if (specificPlayerWrap) specificPlayerWrap.style.display = (topic === 'specificPlayer') ? 'inline-flex' : 'none';
        if (customTopicWrap) customTopicWrap.style.display = (topic === 'custom') ? 'flex' : 'none';
    },

    async generateRandomConversation() {
        await this.forceConversation(true);
    },

    async forceConversation(isRandom = false) {
        const display = document.getElementById('lobbyChatDisplay');
        if (!display) return;

        const numInput = document.getElementById('lobbyNumParticipants');
        const idsInput = document.getElementById('lobbySpecificIds');
        const topicSel = document.getElementById('lobbyTopicSelect');
        const topicPlayerInput = document.getElementById('lobbyTopicPlayerId');
        const customTopicInput = document.getElementById('lobbyCustomTopicInput');

        let numParticipants = parseInt(numInput?.value || '3', 10);
        if (isNaN(numParticipants) || numParticipants < 2) numParticipants = 2;
        if (numParticipants > 4) numParticipants = 4;

        let ids = [];
        if (idsInput && idsInput.value.trim()) {
            ids = idsInput.value.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
        }

        const active = utils.getActivePlayers();
        if (active.length < 2) return;

        const participants = [];
        const usedIds = new Set();

        ids.forEach(id => {
            if (participants.length >= numParticipants) return;
            const p = active.find(pl => pl.id === id);
            if (p && !usedIds.has(p.id)) {
                participants.push(p);
                usedIds.add(p.id);
            }
        });

        while (participants.length < numParticipants && active.length > participants.length) {
            const p = active[Math.floor(Math.random() * active.length)];
            if (!usedIds.has(p.id)) {
                participants.push(p);
                usedIds.add(p.id);
            }
        }

        if (participants.length < 2) return;

        const topicVal = topicSel ? topicSel.value : 'random';
        let topicText = 'random thoughts about the games';

        if (topicVal === 'personalDebt') {
            topicText = 'their personal lives and crushing debt';
        } else if (topicVal === 'strategy') {
            topicText = 'strategy for surviving the next game';
        } else if (topicVal === 'custom' && customTopicInput && customTopicInput.value.trim()) {
            topicText = customTopicInput.value.trim();
        } else if (topicVal === 'specificPlayer' && topicPlayerInput && topicPlayerInput.value) {
            const tId = parseInt(topicPlayerInput.value, 10);
            if (!isNaN(tId)) {
                topicText = `what they think about Player ${utils.formatPlayerNumber(tId)}`;
            }
        }

        // Generate fallback conversation
        const lines = [];
        lines.push({
            type: 'divider',
            text: `New Lobby Talk (${participants.length} players, topic: ${topicText})`,
        });

        const [p1, p2, p3, p4] = participants;

        const say = (speaker, text) => {
            lines.push({
                type: 'line',
                speakerId: speaker.id,
                speakerName: speaker.name,
                text,
            });
        };

        say(p1, `So... what do you all think about ${topicText}?`);
        if (p2) say(p2, `I can't stop thinking about it. Feels like this place is designed to break us.`);
        if (p3) say(p3, `We should focus on staying alive. Talking won't change the rules.`);
        if (p4) say(p4, `Easy for you to say. Some of us are barely holding it together.`);
        if (p2 && p3) say(p2, `Both of you are right. We need a plan, and we need to keep our heads.`);
        say(p1, `Either way, once we're back in that arena, all of this just becomes noise.`);

        lobbyChatHistory.push({
            timestamp: Date.now(),
            round: appState.round,
            topic: topicText,
            participants: participants.map(p => p.id),
            lines,
        });

        this.render();
    },

    render() {
        const display = document.getElementById('lobbyChatDisplay');
        if (!display) return;
        display.innerHTML = '';

        if (!Array.isArray(lobbyChatHistory) || lobbyChatHistory.length === 0) {
            display.innerHTML = '<div class="lobby-chat-divider">No Lobby Talk yet. Generate a random conversation to get started.</div>';
            return;
        }

        lobbyChatHistory.forEach(entry => {
            if (entry.divider) {
                const div = document.createElement('div');
                div.className = 'lobby-chat-divider';
                div.textContent = entry.round ? `Between GR ${entry.round} and GR ${entry.round + 1}` : 'Round Divider';
                display.appendChild(div);
                return;
            }

            if (!entry.lines) return;

            entry.lines.forEach(line => {
                const div = document.createElement('div');
                if (line.type === 'divider') {
                    div.className = 'lobby-chat-divider';
                    div.textContent = line.text;
                } else {
                    div.className = 'lobby-chat-line';
                    const speakerLabel = `P${utils.formatPlayerNumber(line.speakerId)} (${line.speakerName})`;
                    div.innerHTML = `<strong>${speakerLabel}:</strong> ${line.text}`;
                }
                display.appendChild(div);
            });
        });

        // Scroll to bottom
        display.scrollTop = display.scrollHeight;
    },

    clearHistory() {
        lobbyChatHistory = [];
        this.render();
    },
};
