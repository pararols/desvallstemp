# 🌊 MEMÒRIA I GUIA DE RESTAURACIÓ: FESTIVAL D'ART LUMÍNIC «MAR MEDITERRÀNIA» 2026

Aquest document preserva la memòria completa del desenvolupament, disseny, contingut i arquitectura de la pàgina pròpia del **Festival d'Art Lumínic «Mar Mediterrània» (Fira Pluja d'Art 2026 de Sant Jordi Desvalls)**.

---

## 📌 1. Estat Actual i Publicació Temporal

Actualment, per decisió de publicació prèvia a la finalització definitiva:
- La pàgina completa existeix i és plenament funcional a: **[`web/art-luminic-2026.html`](file:///c:/Users/parar/OneDrive/Documents/antigravity/Desvalls%20Cultura/web/art-luminic-2026.html)**.
- Els enllaços públics a [`index.html`](file:///c:/Users/parar/OneDrive/Documents/antigravity/Desvalls%20Cultura/web/index.html), [`pluja-art-2026.html`](file:///c:/Users/parar/OneDrive/Documents/antigravity/Desvalls%20Cultura/web/pluja-art-2026.html) i [`mapa3.html`](file:///c:/Users/parar/OneDrive/Documents/antigravity/Desvalls%20Cultura/web/mapa3.html) estan mantinguts visualment però interceptats amb la funció universal `onclick="openArtLuminicPending(event)"` (definida a `web/js/main.js`), la qual mostra un elegant modal emergent que avisa:
  > *"✨ Mar Mediterrània · Festival d'Art Lumínic 2026: Estem enllestint l'experiència immersiva del festival! Properament publicarem el recorregut oficial dels 9 espais, el camí d'espelmes i totes les instal·lacions d'inflables gegants."*

---

## 🚀 2. Com reactivar l'enllaç directe en el futur (1 sol pas)

Quan vulguis fer pública la pàgina del Festival d'Art Lumínic i que els botons obrin directament `art-luminic-2026.html`:
1. **Obre els següents fitxers**:
   - `web/index.html` (línies 47 i 103)
   - `web/pluja-art-2026.html` (línies 423, 454, 891 i 1572)
   - `web/mapa3.html` (línia 960)
2. **Elimina l'atribut**: `onclick="openArtLuminicPending(event)"` de cada etiqueta `<a>`.
3. **Executa el cache buster**: `python update_versions.py` des de la carpeta `web`.

---

## 🎨 3. Concepte Artístic i Recorregut dels 9 Espais

- **Nom del Festival**: *Mar Mediterrània: Festival d'Art Lumínic*
- **Data i Horari**: Dissabte 19 de Setembre de 2026 · De 21:30 h a 01:30 h
- **Camí d'Espelmes**: Milers d'espelmes al terra interconnecten tot el circuit del nucli urbà.
- **Crida al Civisme**: Respecte als inflables, cura del camí d'espelmes, silenci i sostenibilitat.

### 📍 Itinerari Oficial Reordenat:

| # | Espai | Títol Artístic | Contingut i Descripció | Imatge / Actiu |
|---|---|---|---|---|
| **1** | **Plaça 1 d'Octubre** | *El jardí de les meduses* | Gran Medusa 1 inflable gegant. Espectacle Inaugural «Vida i Mort» (21:30h) i Live AV «Ommatidia» (21:45h) de mathr & netz. | Imatge d'1 gran medusa única flotant en la foscor. |
| **2** | **Carrer de Baix** | *Onades Olímpiques* | Instal·lació dinàmica inspirada en el moviment continu de les onades marines i disseny olímpic. | Imatge d'onades en moviment i llum rítmica. |
| **3** | **Carrer Tarongeta** | *El túnel blau* | Passatge de teles lleugeres i llum blava. Inclou la **Medusa 2** (segona medusa ambiental). | Imatge de túnel i atmosfera blau intens. |
| **4** | **Plaça Clos Garriga** | *Profunditats residuals* | Teles suspeses, tirants, raigs de **llum làser** i sol penetrant praderies de **posidònia**. | Fons marí de praderies de posidònia amb feixos de llum. |
| **5** | **Antiga Escola** | *Punt de Llum* | Ressalt arquitectònic i patrimonial. Espai de pau, calma i serenor. | Il·luminació càlida i reflexos patrimonials. |
| **6** | **Església** | *L'abisme i el fum* | Estil industrial, tubs de llum d'alta intensitat i **fum dens** simulant fumaroles i passos de túnels submarins. | Túnels submarins i coves abissals. |
| **7** | **Avinguda Generalitat** | *Corrents marines* | Conjunt de meduses flotants suspeses i filtres cromàtics jugant amb perspectives i alçades. | Imatge d'eixam marí i meduses en corrent. |
| **8** | **Dipòsit de l'Aigua** | *La Reina del Festival (La serp de Sant Jordi)* | **La Reina del Mar**: Serp inflable gegant amb focus de gran potència i ventiladors que s'enfila pel dipòsit/penya-segat i presideix el festival des de les altures. | `img/serp_marina_diposit.jpg` (Generada en 8K). |
| **9** | **Airearte** | *Medusa Lumínica & Exposició d'Artistes Locals* | Punt final amb **Medusa Lumínica Espectacular**, gran exposició col·lectiva d'obres plàstiques dels artistes locals de Pluja d'Art i servei de bar. | `img/medusa_espectacular_art.jpg` (Generada en 8K). |

---

## 💻 4. Actius Gràfics Generals

- **`web/img/fons_mar_corall.jpg`**: Fons marí d'alta resolució amb coralls bioluminescents, anèmones i raigs d'aigua.
- **`web/img/serp_marina_diposit.jpg`**: Serp lluminosa gegant enfilant-se per la torre/penya-segat de nit.
- **`web/img/medusa_espectacular_art.jpg`**: Medusa bioluminescent d'alta definició amb neons cian i magenta.
- **`web/mapa3.html`**: Plànol interactiu Leaflet amb el circuit complet i els 9 nodes sincronitzats a `BASE_LOCATIONS`.

---
*Memòria creada automàticament per Antigravity per a la continuïtat del projecte Desvalls Cultura.*
