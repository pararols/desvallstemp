/**
 * SIMULADOR DE PASSEIG VIRTUAL I PROVES
 * Permet testejar tota l'experiència sonora de guiatge dreta/esquerra, distància
 * i audiodescripció sense necessitat de moure's físicament pels carrers de Sant Jordi Desvalls.
 */

class RouteSimulator {
    constructor(navEngine, festivalItems) {
        this.nav = navEngine;
        this.items = festivalItems;
        this.isActive = false;
        this.stepSizeMeters = 3.5; // Pas per pulsació
        this.turnAngleDegrees = 20; // Gir per pulsació
        
        // Punts estratègics de Sant Jordi Desvalls per a teletransport ràpid
        this.presetLocations = [
            { name: "Plaça Major (Punt Inici)", lat: 42.0724, lng: 2.9537, heading: 0 },
            { name: "Can Batlle (Entrada)", lat: 42.0720, lng: 2.9535, heading: 180 },
            { name: "Can Burcet (Planta Baixa)", lat: 42.0723, lng: 2.9533, heading: 270 },
            { name: "El Castell (Balcó Històric)", lat: 42.0726, lng: 2.9535, heading: 45 },
            { name: "Sala Nova / Ajuntament", lat: 42.0722, lng: 2.9542, heading: 90 },
            { name: "Can Ministral (Pati)", lat: 42.0725, lng: 2.9551, heading: 90 },
            { name: "Zona Foodtrucks & Gastronomia", lat: 42.0714, lng: 2.9546, heading: 135 },
            { name: "Escola de Sant Jordi", lat: 42.0734, lng: 2.9556, heading: 30 }
        ];

        this.onSimulatorUpdate = null;
    }

    /**
     * Activa el mode simulador
     */
    enable() {
        this.isActive = true;
        this.nav.stopGPS(); // Desactiva GPS real per evitar sobrescriure
        if (this.onSimulatorUpdate) this.onSimulatorUpdate(true);
    }

    /**
     * Desactiva el simulador i reprèn GPS si es vol
     */
    disable() {
        this.isActive = false;
        if (this.onSimulatorUpdate) this.onSimulatorUpdate(false);
    }

    /**
     * Mou l'usuari un pas endavant en la direcció que està mirant
     */
    walkForward() {
        this._moveStep(1);
    }

    /**
     * Mou l'usuari un pas enrere
     */
    walkBackward() {
        this._moveStep(-1);
    }

    /**
     * Gira el rumb de l'usuari a l'esquerra
     */
    turnLeft() {
        const newHeading = (this.nav.userLocation.heading - this.turnAngleDegrees + 360) % 360;
        this.nav.setManualHeading(newHeading);
    }

    /**
     * Gira el rumb de l'usuari a la dreta
     */
    turnRight() {
        const newHeading = (this.nav.userLocation.heading + this.turnAngleDegrees) % 360;
        this.nav.setManualHeading(newHeading);
    }

    /**
     * Teletransporta la posició a un punt conegut o a una obra concreta
     */
    teleportTo(lat, lng, heading = null) {
        this.nav.setManualPosition(lat, lng, heading);
    }

    /**
     * Càlcul intern de desplaçament geogràfic en funció del rumb
     */
    _moveStep(direction = 1) {
        const headingRad = (this.nav.userLocation.heading * Math.PI) / 180;
        const distance = this.stepSizeMeters * direction;

        // Constants d'aproximació geogràfica a la latitud de Sant Jordi Desvalls (~42° N)
        const metersPerDegreeLat = 111132;
        const metersPerDegreeLng = 111132 * Math.cos((this.nav.userLocation.lat * Math.PI) / 180);

        const deltaLat = (distance * Math.cos(headingRad)) / metersPerDegreeLat;
        const deltaLng = (distance * Math.sin(headingRad)) / metersPerDegreeLng;

        const newLat = this.nav.userLocation.lat + deltaLat;
        const newLng = this.nav.userLocation.lng + deltaLng;

        this.nav.setManualPosition(newLat, newLng, this.nav.userLocation.heading);
    }
}

// Exportació
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RouteSimulator };
}
