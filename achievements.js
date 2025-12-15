// ============================================
// ACHIEVEMENTS SYSTEM
// ============================================
const achievements = {
    init() {
        appState.achievements = {
            newGame: { name: "Let the Games Begin", desc: "Start your first game.", unlocked: false },
            fullHouse: { name: "A Full Roster", desc: "Start a game with 456 players.", unlocked: false },
            firstWinBet: { name: "High Roller", desc: "Win your first bet on a game winner.", unlocked: false },
            topTenBet: { name: "Good Eye", desc: "Win a consolation prize by betting on a player who reached the Top 10.", unlocked: false },
            firstBet: { name: "Feeling Lucky?", desc: "Place your first bet on a player.", unlocked: false },
            specialCharacter: { name: "Is That...?", desc: "Encounter a special character.", unlocked: false },
            revolution: { name: "Viva La Revolución", desc: "Witness a successful player rebellion.", unlocked: false },
            tragedy: { name: "Unbearable Loss", desc: "Witness a player self-eliminate out of grief.", unlocked: false },
            handOfGod: { name: "Hand of God", desc: "Manually eliminate a player.", unlocked: false },
            necromancer: { name: "Back From The Dead", desc: "Revive a player.", unlocked: false },
            sharedVictory: { name: "Better Together", desc: "Witness a game end with joint winners.", unlocked: false },
            serialWinner: { name: "Serial Winner", desc: "Have your chosen players win 5 games.", progress: 0, goal: 5, unlocked: false },
            betEarlyWinner: { name: "Early Bird Gets the Worm", desc: "Have a player you bet on within the first 3 rounds win (no modifications).", unlocked: false },
            underdogWinner: { name: "Underdog Victory", desc: "Have a player under ID 010 win (no modifications).", unlocked: false },
            canonWinner: { name: "Canon Winner", desc: "Have an easter egg character win (no modifications).", unlocked: false },
            previousWinnerJoins: { name: "I've Played These Games Before!", desc: "A previous winner has joined the new game.", unlocked: false },
            previousWinnerWins: { name: "Do You Still Have Faith In People?", desc: "A previous winner has won the game again.", unlocked: false },
            dramatisPersonae: { name: "Dramatis Personae", desc: "Play a game with 10+ characters with personalities.", unlocked: false },
            goldenYears: { name: "Golden Years", desc: "Have an 80+ year old win a game (no modifications).", unlocked: false },
            debtFree: { name: "Debt Free", desc: "Have someone with $2,500,000+ debt win a game (no modifications).", unlocked: false },
            megaGame: { name: "Mega-Game", desc: "Play through a game with 1000+ players.", unlocked: false },
            gameVeteran: { name: "Game Veteran", desc: "Play and complete 37 games.", progress: 0, goal: 37, unlocked: false },
            masterOfFate: { name: "Master of Fate", desc: "Unlock all other achievements.", unlocked: false },
        };
    },

    unlock(id) {
        const ach = appState.achievements[id];
        if (ach && !ach.unlocked) {
            ach.unlocked = true;
            this.showToast(id);
            ui.renderAchievements();
            this.checkMasterOfFate();
        }
    },

    updateProgress(id, amount) {
        const ach = appState.achievements[id];
        if (ach && !ach.unlocked) {
            ach.progress += amount;
            if (ach.progress >= ach.goal) {
                ach.progress = ach.goal;
                this.unlock(id);
            }
            ui.renderAchievements();
        }
    },

    showToast(id) {
        const ach = appState.achievements[id];
        const toast = document.getElementById('achievement-toast');
        if (!toast) return;
        toast.innerHTML = `<h4>🏆 Achievement Unlocked!</h4><h5>${ach.name}</h5><p>${ach.desc}</p>`;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 5000);
    },

    checkMasterOfFate() {
        let allUnlocked = true;
        for (const id in appState.achievements) {
            if (id === 'masterOfFate') continue;
            if (!appState.achievements[id] || !appState.achievements[id].unlocked) {
                allUnlocked = false;
                break;
            }
        }
        if (allUnlocked) this.unlock('masterOfFate');
    },
};
