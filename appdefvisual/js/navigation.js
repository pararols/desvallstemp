/**
 * MOTOR DE GEOLOCALITZACIÓ I GUIATGE ESPACIAL RELATIU (DRETA / ESQUERRA / DISTÀNCIA)
 * Per a usuaris amb discapacitat visual o baixa visió.
 */

class SpatialNavigationEngine {
    constructor(festivalItems) {
        this.items = festivalItems || [];
        this.userLocation = {
            lat: 42.0724,      // Posició per defecte: Plaça Major Sant Jordi Desvalls
            lng: 2.9537,
            accuracy: 5,
            altitude: 65,
            heading: 0,        // 0° = Nord, 90° = Est, 180° = Sud, 270° = Oest
            isRealGPS: false,
            lastUpdate: null
        };
        
        this.selectedItemId = null;
        this.watchId = null;
        this.orientationSupported = false;
        this.compassHeading = 0;
        this.useCompassForOrientation = true;
        
        // Geofencing i estats de proximitat
        this.visitedItems = new Set();
        this.lastAnnouncedItemId = null;
        this.proximityThresholdMeters = 8;
        this.approachThresholdMeters = 20;

        // Callbacks per a la UI i l'Àudio
        this.onLocationUpdate = null;
        this.onCompassUpdate = null;
        this.onProximityAlert = null;
        this.onArrival = null;
        this.onError = null;
    }

    /**
     * Iniciar seguiment GPS real amb màxima precisió
     */
    startGPS() {
        if (!('geolocation' in navigator)) {
            if (this.onError) this.onError("El teu dispositiu o navegador no suporta Geolocalització.");
            return false;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 1000
        };

        this.watchId = navigator.geolocation.watchPosition(
            (pos) => {
                this.userLocation.lat = pos.coords.latitude;
                this.userLocation.lng = pos.coords.longitude;
                this.userLocation.accuracy = Math.round(pos.coords.accuracy || 5);
                this.userLocation.altitude = pos.coords.altitude || 65;
                if (pos.coords.heading !== null && !isNaN(pos.coords.heading)) {
                    this.userLocation.heading = pos.coords.heading;
                }
                this.userLocation.isRealGPS = true;
                this.userLocation.lastUpdate = new Date();

                this._processNavigationStep();
            },
            (err) => {
                console.warn("GPS Error:", err);
                if (this.onError) {
                    let msg = "No s'ha pogut obtenir la ubicació GPS. Pots fer servir el mode simulador.";
                    if (err.code === 1) msg = "Permís de geolocalització denegat. Habilita el GPS per a guiatge automàtic.";
                    this.onError(msg);
                }
            },
            options
        );

        this.startCompass();
        return true;
    }

    /**
     * Iniciar seguiment de brúixola digital
     */
    async startCompass() {
        const handleOrientation = (e) => {
            let heading = 0;
            if (e.webkitCompassHeading) {
                // Dispositius iOS (Safari)
                heading = e.webkitCompassHeading;
            } else if (e.alpha !== null) {
                // Dispositius Android / estàndard W3C
                // Nota: e.alpha és anti-horari, el convertim a brúixola 0=N, 90=E
                heading = (360 - e.alpha) % 360;
                if (e.absolute === false && e.webkitCompassHeading === undefined) {
                    heading = (360 - e.alpha) % 360;
                }
            }
            this.compassHeading = Math.round(heading);
            this.userLocation.heading = this.compassHeading;
            
            if (this.onCompassUpdate) {
                this.onCompassUpdate(this.compassHeading);
            }
            this._processNavigationStep();
        };

        // Permisos per a iOS 13+
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const permission = await DeviceOrientationEvent.requestPermission();
                if (permission === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation, true);
                    this.orientationSupported = true;
                }
            } catch (err) {
                console.warn("Error sol·licitant permís de brúixola:", err);
            }
        } else {
            // Android i navegadors que no requereixen permís explícit
            if ('ondeviceorientationabsolute' in window) {
                window.addEventListener('deviceorientationabsolute', handleOrientation, true);
            } else if ('ondeviceorientation' in window) {
                window.addEventListener('deviceorientation', handleOrientation, true);
            }
            this.orientationSupported = true;
        }
    }

    /**
     * Aturar GPS
     */
    stopGPS() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
    }

    /**
     * Fixar posició manualment (per a mode simulador / proves)
     */
    setManualPosition(lat, lng, heading = null) {
        this.userLocation.lat = lat;
        this.userLocation.lng = lng;
        this.userLocation.accuracy = 2;
        this.userLocation.isRealGPS = false;
        this.userLocation.lastUpdate = new Date();
        if (heading !== null) {
            this.compassHeading = heading;
            this.userLocation.heading = heading;
        }
        this._processNavigationStep();
    }

    /**
     * Fixar rumb manualment (en graus de 0 a 359)
     */
    setManualHeading(degrees) {
        this.compassHeading = (degrees + 360) % 360;
        this.userLocation.heading = this.compassHeading;
        if (this.onCompassUpdate) this.onCompassUpdate(this.compassHeading);
        this._processNavigationStep();
    }

    /**
     * Seleccionar l'obra objectiu a la qual es vol arribar
     */
    selectTargetItem(itemId) {
        this.selectedItemId = itemId;
        this._processNavigationStep();
    }

    /**
     * Obtenir l'objecte de l'obra seleccionada o la més propera
     */
    getTargetItem() {
        if (this.selectedItemId) {
            const found = this.items.find(it => it.id === this.selectedItemId);
            if (found) return found;
        }
        // Si no hi ha selecció expressa, retorna la més propera
        const nearest = this.getNearestItem();
        return nearest ? nearest.item : this.items[0];
    }

    /**
     * Calcula la distància en metres entre dues coordenades (Fórmula Haversine)
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Radi de la Terra en metres
        const phi1 = (lat1 * Math.PI) / 180;
        const phi2 = (lat2 * Math.PI) / 180;
        const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
        const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

        const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
                  Math.cos(phi1) * Math.cos(phi2) *
                  Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // en metres
    }

    /**
     * Calcula el rumb absolut (bearing de 0° a 360°) cap a una coordenada
     */
    calculateBearing(lat1, lon1, lat2, lon2) {
        const phi1 = (lat1 * Math.PI) / 180;
        const phi2 = (lat2 * Math.PI) / 180;
        const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

        const y = Math.sin(deltaLambda) * Math.cos(phi2);
        const x = Math.cos(phi1) * Math.sin(phi2) -
                  Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

        const theta = Math.atan2(y, x);
        const bearing = (theta * 180 / Math.PI + 360) % 360;
        return bearing;
    }

    /**
     * Càlcul clau: Direcció relativa en funció d'on mira l'usuari (Dreta, Esquerra, Davant, Rellotge)
     */
    calculateRelativeDirection(targetLat, targetLng) {
        const distance = this.calculateDistance(
            this.userLocation.lat,
            this.userLocation.lng,
            targetLat,
            targetLng
        );

        const targetBearing = this.calculateBearing(
            this.userLocation.lat,
            this.userLocation.lng,
            targetLat,
            targetLng
        );

        const userHeading = this.userLocation.heading || 0;

        // Angle relatiu de 0° a 360° en sentit horari
        let relativeAngle = (targetBearing - userHeading + 360) % 360;
        
        // Diferència d'angle amb signe (-180° = esquerra, +180° = dreta)
        let diffAngle = relativeAngle;
        if (diffAngle > 180) diffAngle -= 360;

        // Posició del rellotge (1 a 12)
        let clockPosition = Math.round(relativeAngle / 30);
        if (clockPosition === 0) clockPosition = 12;
        if (clockPosition > 12) clockPosition = 1;

        // Text descriptiu en llenguatge natural català
        let simpleDirection = "al davant";
        let detailedInstruction = "";
        let audioPannerValue = 0; // -1 (esquerra total) a +1 (dreta total)

        if (relativeAngle >= 340 || relativeAngle <= 20) {
            simpleDirection = "just al davant teu";
            detailedInstruction = "Camina recte endavant";
            audioPannerValue = 0;
        } else if (relativeAngle > 20 && relativeAngle <= 70) {
            simpleDirection = "lleugerament a la teva dreta";
            detailedInstruction = "Gira una mica a la dreta";
            audioPannerValue = 0.5;
        } else if (relativeAngle > 70 && relativeAngle <= 110) {
            simpleDirection = "a la teva dreta";
            detailedInstruction = "Gira completament a la dreta";
            audioPannerValue = 1.0;
        } else if (relativeAngle > 110 && relativeAngle <= 160) {
            simpleDirection = "darrere a la teva dreta";
            detailedInstruction = "Gira cap enrere a la dreta";
            audioPannerValue = 0.7;
        } else if (relativeAngle > 160 && relativeAngle <= 200) {
            simpleDirection = "just darrere teu";
            detailedInstruction = "Fes mitja volta";
            audioPannerValue = 0;
        } else if (relativeAngle > 200 && relativeAngle <= 250) {
            simpleDirection = "darrere a la teva esquerra";
            detailedInstruction = "Gira cap enrere a l'esquerra";
            audioPannerValue = -0.7;
        } else if (relativeAngle > 250 && relativeAngle <= 290) {
            simpleDirection = "a la teva esquerra";
            detailedInstruction = "Gira completament a l'esquerra";
            audioPannerValue = -1.0;
        } else {
            simpleDirection = "lleugerament a la teva esquerra";
            detailedInstruction = "Gira una mica a l'esquerra";
            audioPannerValue = -0.5;
        }

        const distRound = Math.round(distance);

        return {
            distanceMeters: distRound,
            targetBearing: Math.round(targetBearing),
            userHeading: Math.round(userHeading),
            relativeAngle: Math.round(relativeAngle),
            diffAngle: Math.round(diffAngle),
            clockPosition: clockPosition,
            simpleDirection: simpleDirection,
            detailedInstruction: detailedInstruction,
            audioPannerValue: audioPannerValue,
            isFacingDirectly: (Math.abs(diffAngle) <= 15),
            spokenSentence: `${simpleDirection}, a ${distRound} metres (posició de rellotge: a les ${clockPosition}).`
        };
    }

    /**
     * Retorna l'obra o servei més proper a l'usuari
     */
    getNearestItem(filterType = null) {
        let itemsToSearch = this.items;
        if (filterType) {
            itemsToSearch = this.items.filter(it => it.type === filterType);
        }

        let closest = null;
        let minDistance = Infinity;

        itemsToSearch.forEach(item => {
            const dist = this.calculateDistance(
                this.userLocation.lat,
                this.userLocation.lng,
                item.lat,
                item.lng
            );
            if (dist < minDistance) {
                minDistance = dist;
                closest = { item, distance: dist };
            }
        });

        return closest;
    }

    /**
     * Retorna totes les obres ordenades per distància respecte l'usuari
     */
    getItemsSortedByDistance() {
        return this.items.map(item => {
            const nav = this.calculateRelativeDirection(item.lat, item.lng);
            return {
                item: item,
                nav: nav
            };
        }).sort((a, b) => a.nav.distanceMeters - b.nav.distanceMeters);
    }

    /**
     * Processa el pas de navegació, geofencing i alertes
     */
    _processNavigationStep() {
        const target = this.getTargetItem();
        if (!target) return;

        const navInfo = this.calculateRelativeDirection(target.lat, target.lng);

        // Notificar actualització
        if (this.onLocationUpdate) {
            this.onLocationUpdate({
                user: this.userLocation,
                target: target,
                nav: navInfo,
                allNearby: this.getItemsSortedByDistance()
            });
        }

        // Comprovació de proximitat
        if (navInfo.distanceMeters <= this.proximityThresholdMeters) {
            if (this.lastAnnouncedItemId !== target.id) {
                this.lastAnnouncedItemId = target.id;
                this.visitedItems.add(target.id);
                if (this.onArrival) {
                    this.onArrival(target, navInfo);
                }
            }
        } else if (navInfo.distanceMeters <= this.approachThresholdMeters) {
            if (this.lastAnnouncedItemId !== 'approaching_' + target.id) {
                this.lastAnnouncedItemId = 'approaching_' + target.id;
                if (this.onProximityAlert) {
                    this.onProximityAlert(target, navInfo);
                }
            }
        }
    }
}

// Exportació
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SpatialNavigationEngine };
}
