/**
 * MOTOR D'ACCESSIBILITAT SONORA, SÍNTESI VOCAL (TTS), RADAR ESPACIAL I RECONEIXEMENT DE VEU
 * Dissenyat específicament per a persones amb diversitat o discapacitat visual.
 */

class AccessibleAudioEngine {
    constructor() {
        // Síntesi de veu (TTS)
        this.synth = window.speechSynthesis || null;
        this.selectedVoice = null;
        this.speechRate = 1.0;
        this.speechPitch = 1.0;
        this.isSpeaking = false;
        this.isMuted = false;
        this.lastSpokenText = "";
        this.onSpeechStateChange = null;

        // Context d'àudio per al radar espacial (Web Audio API)
        this.audioCtx = null;
        this.radarPanner = null;
        this.radarGain = null;
        this.radarOscillator = null;
        this.isRadarActive = false;
        this.radarInterval = null;
        this.radarSoundEnabled = true;

        // Reconeixement de veu
        this.recognition = null;
        this.isListening = false;
        this.onVoiceCommand = null;

        // Inicialització de veus
        this._initVoices();
    }

    /**
     * Inicialitza i detecta veus en català
     */
    _initVoices() {
        if (!this.synth) return;

        const setVoice = () => {
            const voices = this.synth.getVoices();
            if (!voices || voices.length === 0) return;

            // Prioritat 1: Veu en català nativa (ca-ES, ca)
            let catalanVoice = voices.find(v => v.lang.startsWith('ca'));

            // Prioritat 2: Veu en castellà d'alta qualitat si no hi ha català
            if (!catalanVoice) {
                catalanVoice = voices.find(v => v.lang.startsWith('es') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Premium')));
            }
            if (!catalanVoice) {
                catalanVoice = voices.find(v => v.lang.startsWith('es'));
            }

            this.selectedVoice = catalanVoice || voices[0];
        };

        setVoice();
        if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = setVoice;
        }
    }

    /**
     * Inicialitza el context d'àudio en resposta a la primera interacció de l'usuari
     */
    initAudioContext() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.audioCtx = new AudioContext();
            }
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    /**
     * Pronuncia un text amb síntesi vocal
     * @param {string} text - El text a locutar en català
     * @param {boolean} interrupt - Si és cert, interromp qualsevol frase anterior
     * @param {function} onEnd - Callback en finalitzar
     */
    speak(text, interrupt = true, onEnd = null) {
        if (!this.synth || this.isMuted || !text) return;

        if (interrupt) {
            this.synth.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        if (this.selectedVoice) {
            utterance.voice = this.selectedVoice;
        }
        utterance.lang = (this.selectedVoice && this.selectedVoice.lang) || 'ca-ES';
        utterance.rate = this.speechRate;
        utterance.pitch = this.speechPitch;

        utterance.onstart = () => {
            this.isSpeaking = true;
            this.lastSpokenText = text;
            if (this.onSpeechStateChange) this.onSpeechStateChange(true, text);
        };

        utterance.onend = () => {
            this.isSpeaking = false;
            if (this.onSpeechStateChange) this.onSpeechStateChange(false, text);
            if (onEnd) onEnd();
        };

        utterance.onerror = (e) => {
            console.warn("TTS Error:", e);
            this.isSpeaking = false;
            if (this.onSpeechStateChange) this.onSpeechStateChange(false, text);
        };

        this.synth.speak(utterance);
    }

    /**
     * Atura la parla actual
     */
    stopSpeaking() {
        if (this.synth) {
            this.synth.cancel();
            this.isSpeaking = false;
            if (this.onSpeechStateChange) this.onSpeechStateChange(false, "");
        }
    }

    /**
     * Repeteix l'última frase locutada
     */
    repeatLastPhrase() {
        if (this.lastSpokenText) {
            this.speak(this.lastSpokenText, true);
        }
    }

    /**
     * Modifica la velocitat de la veu (0.8x a 1.6x)
     */
    setRate(rate) {
        this.speechRate = Math.max(0.7, Math.min(2.0, rate));
        this.speak(`Velocitat de veu ajustada a ${Math.round(this.speechRate * 100)} per cent.`, true);
    }

    /**
     * Radar Espacial Estèreo: Reprodueix un bip pannejat (esquerra/dreta)
     * @param {number} panValue - Valor de -1.0 (esquerra total) a +1.0 (dreta total)
     * @param {number} distanceMeters - Distància en metres
     * @param {boolean} isFacing - Si està encarat de cara (dins de ±15°)
     */
    playSpatialRadarPing(panValue = 0, distanceMeters = 50, isFacing = false) {
        if (!this.radarSoundEnabled) return;
        this.initAudioContext();
        if (!this.audioCtx) return;

        try {
            const ctx = this.audioCtx;
            const now = ctx.currentTime;

            // Creació de l'oscil·lador i el node de volum
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            // Freqüència: to més alt i brillant quan s'està encarat de cara
            if (isFacing) {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, now); // Nota La5 (so harmònic clar)
                osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.12); // Arpegia cap a Re6
            } else {
                osc.type = 'triangle';
                // Freqüència variable segons distància
                const baseFreq = Math.max(300, 700 - Math.min(distanceMeters, 50) * 8);
                osc.frequency.setValueAtTime(baseFreq, now);
            }

            // Panning Estèreo
            if (ctx.createStereoPanner) {
                const panner = ctx.createStereoPanner();
                panner.pan.setValueAtTime(Math.max(-1, Math.min(1, panValue)), now);
                osc.connect(gain);
                gain.connect(panner);
                panner.connect(ctx.destination);
            } else {
                // Fallback per a navegadors sense StereoPanner
                osc.connect(gain);
                gain.connect(ctx.destination);
            }

            // Envolupant d'amplitud ràpida (bip net i suau)
            const duration = isFacing ? 0.25 : 0.12;
            gain.gain.setValueAtTime(0.001, now);
            gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            osc.start(now);
            osc.stop(now + duration + 0.05);

            // Resposta hàptica lleugera
            if (isFacing && 'vibrate' in navigator) {
                navigator.vibrate(60);
            }
        } catch (err) {
            console.warn("Radar Sound Error:", err);
        }
    }

    /**
     * So d'arribada a l'obra (acord musical festiu)
     */
    playArrivalChime() {
        this.initAudioContext();
        if (!this.audioCtx) return;

        try {
            const ctx = this.audioCtx;
            const now = ctx.currentTime;
            const notes = [523.25, 659.25, 783.99, 1046.50]; // Acord de Do Major radiant (Do, Mi, Sol, Do)

            notes.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + idx * 0.08);

                gain.gain.setValueAtTime(0.001, now + idx * 0.08);
                gain.gain.exponentialRampToValueAtTime(0.25, now + idx * 0.08 + 0.03);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.6);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now + idx * 0.08);
                osc.stop(now + idx * 0.08 + 0.7);
            });

            if ('vibrate' in navigator) {
                navigator.vibrate([200, 100, 200, 100, 400]);
            }
        } catch (e) {
            console.warn("Arrival chime error:", e);
        }
    }

    /**
     * Inicia el bucle continu del radar acústic segons la navegació
     */
    startRadarLoop(getNavCallback) {
        if (this.radarInterval) clearInterval(this.radarInterval);
        this.isRadarActive = true;

        const tick = () => {
            if (!this.isRadarActive || !this.radarSoundEnabled || this.isSpeaking) return;
            const nav = getNavCallback();
            if (!nav) return;

            this.playSpatialRadarPing(nav.audioPannerValue, nav.distanceMeters, nav.isFacingDirectly);
            
            // Interval dinàmic: com més a prop, més ràpids són els bips
            let nextInterval = 2000;
            if (nav.distanceMeters <= 5) nextInterval = 600;
            else if (nav.distanceMeters <= 15) nextInterval = 1000;
            else if (nav.distanceMeters <= 30) nextInterval = 1500;
            
            clearInterval(this.radarInterval);
            this.radarInterval = setInterval(tick, nextInterval);
        };

        this.radarInterval = setInterval(tick, 1800);
    }

    /**
     * Atura el radar sonor
     */
    stopRadarLoop() {
        this.isRadarActive = false;
        if (this.radarInterval) {
            clearInterval(this.radarInterval);
            this.radarInterval = null;
        }
    }

    /**
     * Configura el reconeixement de veu en català
     */
    startVoiceRecognition(onCommand) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            this.speak("El teu navegador no permet el reconeixement de veu. Pots fer servir els botons tàctils gegants de la pantalla.", true);
            return false;
        }

        if (this.recognition) {
            try { this.recognition.stop(); } catch (e) {}
        }

        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'ca-ES';
        this.recognition.continuous = false;
        this.recognition.interimResults = false;

        this.recognition.onstart = () => {
            this.isListening = true;
            this.playTone(440, 0.1);
            if ('vibrate' in navigator) navigator.vibrate(80);
        };

        this.recognition.onresult = (event) => {
            this.isListening = false;
            const text = event.results[0][0].transcript.toLowerCase().trim();
            console.log("Comanda de veu rebuda:", text);
            if (onCommand) onCommand(text);
        };

        this.recognition.onerror = (event) => {
            this.isListening = false;
            console.warn("Reconeixement de veu error:", event.error);
        };

        this.recognition.onend = () => {
            this.isListening = false;
        };

        try {
            this.recognition.start();
            return true;
        } catch (e) {
            console.warn("Error iniciant micròfon:", e);
            return false;
        }
    }

    /**
     * Reprodueix un to simple d'interacció
     */
    playTone(freq, dur) {
        this.initAudioContext();
        if (!this.audioCtx) return;
        try {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.frequency.value = freq;
            gain.gain.value = 0.15;
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start();
            osc.stop(this.audioCtx.currentTime + dur);
        } catch (e) {}
    }
}

// Exportació
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AccessibleAudioEngine };
}
