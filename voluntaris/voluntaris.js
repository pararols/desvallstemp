/**
 * voluntaris.js
 * Lògica del sistema de voluntaris v2 per al festival Pluja d'Art 2026
 * Associació Desvalls Cultura
 */

// ==========================================
// 1. CONFIGURACIÓ SUPABASE
// ==========================================
const SUPABASE_URL = 'https://ojqhexrqbfwcubyactuj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_eV7n7kB-tnt00ScrveNm-A_gsFBqJtG';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// 2. ESTAT GLOBAL DE L'APLICACIÓ
// ==========================================
let currentVoluntari = JSON.parse(localStorage.getItem('voluntari_session')) || null;
let isAdmin = false;
let currentDay = 'Divendres';

let allVoluntaris = [];
let allEspais = [];
let allTorns = [];
let allAssignacions = [];
let currentColumnWidth = parseInt(localStorage.getItem('pluja_col_width')) || 320;
let currentViewMode = localStorage.getItem('pluja_view_mode') || (window.innerWidth <= 768 ? 'global' : 'detailed');

// ==========================================
// 3. INICIALITZACIÓ
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    setColumnWidth(currentColumnWidth);
    setViewMode(currentViewMode);
    initEventListeners();
    updateUserUI();
    
    await fetchData();
    renderAll();

    // Comprovar si hi ha sessió admin activa a Supabase
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            setAdminMode(true);
        }
    } catch (e) {
        console.warn("No s'ha pogut verificar la sessió admin:", e);
    }
});

let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        renderAll();
    }, 250);
});

function setColumnWidth(width) {
    currentColumnWidth = Math.max(200, Math.min(650, width));
    document.documentElement.style.setProperty('--col-width', `${currentColumnWidth}px`);
    localStorage.setItem('pluja_col_width', currentColumnWidth);
    const display = document.getElementById('zoom-val-display');
    if (display) display.textContent = `${currentColumnWidth}px`;
}

window.adjustColumnWidth = function(delta) {
    setColumnWidth(currentColumnWidth + delta);
};

function setViewMode(mode) {
    currentViewMode = mode;
    localStorage.setItem('pluja_view_mode', mode);

    document.querySelectorAll('.view-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.id === `btn-view-${mode}`);
    });

    const zoomCtrl = document.getElementById('zoom-controls');
    if (zoomCtrl) {
        zoomCtrl.style.display = mode === 'detailed' ? 'inline-flex' : 'none';
    }

    renderAll();
}

window.setViewMode = setViewMode;

function initEventListeners() {
    // 1. Navegació de dies
    document.querySelectorAll('.day-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const button = e.currentTarget;
            document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
            button.classList.add('active');
            currentDay = button.dataset.day;
            renderAll();
        });
    });

    // 2. Autenticació de voluntaris
    document.getElementById('select-voluntari-existent').addEventListener('change', (e) => {
        const id = e.target.value;
        if (id) {
            const vol = allVoluntaris.find(v => v.id === id);
            if (vol) loginVoluntari(vol);
        }
    });

    document.getElementById('btn-registre-voluntari').addEventListener('click', handleRegistreVoluntari);
    document.getElementById('btn-logout-vol').addEventListener('click', logoutVoluntari);

    // 3. Autenticació Admin
    document.getElementById('btn-admin-login-toggle').addEventListener('click', () => {
        if (isAdmin) {
            supabaseClient.auth.signOut();
            setAdminMode(false);
        } else {
            document.getElementById('admin-email').value = '';
            document.getElementById('admin-pass').value = '';
            document.getElementById('admin-auth-error').style.display = 'none';
            document.getElementById('modal-admin').style.display = 'flex';
        }
    });

    document.getElementById('btn-cancel-admin').addEventListener('click', () => {
        document.getElementById('modal-admin').style.display = 'none';
    });

    document.getElementById('btn-do-admin-login').addEventListener('click', handleAdminLogin);

    // 4. Gestió d'Espais (Admin)
    document.getElementById('btn-open-espais-modal').addEventListener('click', openEspaisModal);
    document.getElementById('btn-add-espai').addEventListener('click', handleAddEspai);
    document.getElementById('new-espai-nom').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddEspai();
        }
    });
    document.getElementById('btn-close-espais').addEventListener('click', () => {
        document.getElementById('modal-espais').style.display = 'none';
        renderAll();
    });

    // 5. Gestió de Torns (Admin)
    document.getElementById('btn-new-torn-global').addEventListener('click', () => openTornModal(null));
    document.getElementById('btn-save-torn').addEventListener('click', handleSaveTorn);
    document.getElementById('btn-cancel-torn').addEventListener('click', closeTornModal);
    document.getElementById('btn-delete-torn').addEventListener('click', handleDeleteTorn);
    document.getElementById('btn-duplicate-torn').addEventListener('click', handleDuplicateTorn);
    document.getElementById('btn-split-from-edit').addEventListener('click', () => {
        const editId = document.getElementById('torn-edit-id').value;
        if (editId) {
            closeTornModal();
            openDividirTornModal(editId);
        }
    });

    // 6. Modal Dividir Torns en Trams (Admin)
    document.querySelectorAll('#modal-dividir-torn .btn-preset').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#modal-dividir-torn .btn-preset').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const mins = e.currentTarget.dataset.mins;
            const customRow = document.getElementById('custom-mins-row');
            if (mins === 'custom') {
                customRow.style.display = 'block';
            } else {
                customRow.style.display = 'none';
            }
            updateSplitPreview();
        });
    });
    document.getElementById('split-custom-mins').addEventListener('input', updateSplitPreview);
    document.getElementById('btn-cancel-dividir').addEventListener('click', closeDividirTornModal);
    document.getElementById('btn-do-dividir').addEventListener('click', handleDoDividirTorn);

    // 7. Exportacions i Impressió
    document.getElementById('btn-export-csv').addEventListener('click', handleExportCSV);
    document.getElementById('btn-print-pdf').addEventListener('click', handlePrintPDF);
}

// ==========================================
// 4. CARREGA DE DADES (SUPABASE)
// ==========================================
async function fetchData() {
    try {
        const [volsRes, espaisRes, tornsRes, assignRes] = await Promise.all([
            supabaseClient.from('vol_voluntaris').select('*').order('nom'),
            supabaseClient.from('vol_espais').select('*').order('ordre', { ascending: true }).order('created_at'),
            supabaseClient.from('vol_torns').select('*'),
            supabaseClient.from('vol_assignacions').select('*')
        ]);

        allVoluntaris = volsRes.data || [];
        allEspais = espaisRes.data || [];
        allTorns = tornsRes.data || [];
        allAssignacions = assignRes.data || [];

        populateVoluntarisSelect();
        populateEspaisSelectInModal();
    } catch (err) {
        console.error("Error carregant dades de Supabase:", err);
    }
}

function populateVoluntarisSelect() {
    const select = document.getElementById('select-voluntari-existent');
    if (!select) return;
    const prevValue = select.value;
    select.innerHTML = '<option value="">-- Tria el teu nom --</option>';
    
    // Ordenar alfabèticament
    const sorted = [...allVoluntaris].sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
    sorted.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = `${v.nom} ${v.cognom}`;
        select.appendChild(opt);
    });
    
    select.value = prevValue;
}

function populateEspaisSelectInModal() {
    const select = document.getElementById('torn-espai-id');
    if (!select) return;
    select.innerHTML = '';
    allEspais.forEach(espai => {
        const opt = document.createElement('option');
        opt.value = espai.id;
        opt.textContent = espai.nom;
        select.appendChild(opt);
    });
}

// ==========================================
// 5. GESTIÓ D'USUARIS (VOLUNTARIS)
// ==========================================
async function handleRegistreVoluntari() {
    const nom = document.getElementById('new-vol-nom').value.trim();
    const cognom = document.getElementById('new-vol-cognom').value.trim();
    const tel = document.getElementById('new-vol-tel').value.trim();

    if (!nom || !cognom || !tel) {
        alert("Si us plau, omple el teu nom, cognoms i telèfon.");
        return;
    }

    const { data, error } = await supabaseClient
        .from('vol_voluntaris')
        .upsert({ nom, cognom, telefon: tel }, { onConflict: 'telefon' })
        .select()
        .single();

    if (error) {
        alert("Error en registrar el voluntari: " + error.message);
    } else {
        document.getElementById('new-vol-nom').value = '';
        document.getElementById('new-vol-cognom').value = '';
        document.getElementById('new-vol-tel').value = '';
        
        loginVoluntari(data);
        await fetchData();
        renderAll();
    }
}

function loginVoluntari(vol) {
    currentVoluntari = vol;
    localStorage.setItem('voluntari_session', JSON.stringify(vol));
    updateUserUI();
    renderAll();
}

function logoutVoluntari() {
    currentVoluntari = null;
    localStorage.removeItem('voluntari_session');
    document.getElementById('select-voluntari-existent').value = '';
    updateUserUI();
    renderAll();
}

function updateUserUI() {
    const authSection = document.getElementById('auth-section');
    const welcome = document.getElementById('welcome-message');
    const authBox = document.querySelector('.auth-box');

    if (currentVoluntari) {
        document.getElementById('current-user-name').innerText = `${currentVoluntari.nom} ${currentVoluntari.cognom}`;
        welcome.style.display = 'block';
        authBox.style.display = 'none';
        authSection.classList.add('user-active');
    } else {
        welcome.style.display = 'none';
        authBox.style.display = 'grid';
        authSection.classList.remove('user-active');
    }
}

// ==========================================
// 6. RENDERITZAT DEL CALENDARI TIMELINE (EIX VERTICAL D'HORES)
// ==========================================
const FESTIVAL_HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5];
const HOUR_HEIGHT = 150;

function computeTrackLayout(shifts) {
    if (!shifts || shifts.length === 0) return [];

    // 1. Prepare items with festival start/end minutes
    const items = shifts.map(torn => {
        const start = timeToFestivalMinutes(torn.hora_inici);
        let end = timeToFestivalMinutes(torn.hora_fi);
        if (end <= start) end += 24 * 60;
        return {
            torn,
            start,
            end,
            col: 0,
            maxCols: 1
        };
    });

    // 2. Sort by start time, then by longest duration first
    items.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

    // 3. Find connected overlapping clusters
    const clusters = [];
    let currentCluster = [];
    let clusterEnd = -1;

    for (const item of items) {
        if (currentCluster.length === 0) {
            currentCluster.push(item);
            clusterEnd = item.end;
        } else {
            if (item.start < clusterEnd) {
                // Overlaps with the current cluster
                currentCluster.push(item);
                clusterEnd = Math.max(clusterEnd, item.end);
            } else {
                // New disconnected cluster
                clusters.push(currentCluster);
                currentCluster = [item];
                clusterEnd = item.end;
            }
        }
    }
    if (currentCluster.length > 0) {
        clusters.push(currentCluster);
    }

    // 4. For each cluster, greedily assign column indices (lanes)
    for (const cluster of clusters) {
        const lanes = []; // stores end time of the last item in each sub-column lane

        for (const item of cluster) {
            let placed = false;
            for (let i = 0; i < lanes.length; i++) {
                if (lanes[i] <= item.start) {
                    item.col = i;
                    lanes[i] = item.end;
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                item.col = lanes.length;
                lanes.push(item.end);
            }
        }

        const totalLanes = lanes.length;
        for (const item of cluster) {
            item.maxCols = totalLanes;
        }
    }

    return items;
}

function renderAll() {
    const container = document.getElementById('timeline-container');
    if (!container) return;
    container.innerHTML = '';

    if (currentViewMode === 'global') {
        container.classList.add('view-global');
        container.classList.remove('view-detailed');
    } else {
        container.classList.add('view-detailed');
        container.classList.remove('view-global');
    }

    const isMobile = window.innerWidth <= 768;
    const hourHeight = currentViewMode === 'global' ? (isMobile ? 65 : 70) : (isMobile ? 110 : 150);

    if (allEspais.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 4rem 2rem; color: var(--text-muted);">
                <p style="font-size: 1.2rem; margin-bottom: 1rem;">Encara no hi ha cap espai creat.</p>
                ${isAdmin ? '<button class="btn-primary" onclick="openEspaisModal()">+ Crear el primer espai</button>' : ''}
            </div>
        `;
        return;
    }

    const schedule = document.createElement('div');
    schedule.className = 'timeline-schedule';

    // 1. Capçalera superior fixa (Header Row)
    const headerRow = document.createElement('div');
    headerRow.className = 'timeline-header-row';

    const timeCorner = document.createElement('div');
    timeCorner.className = 'timeline-time-corner';
    timeCorner.textContent = 'HORARI';
    headerRow.appendChild(timeCorner);

    const spacesHeaders = document.createElement('div');
    spacesHeaders.className = 'timeline-spaces-headers';

    allEspais.forEach(espai => {
        const espaiTorns = allTorns.filter(t => t.dia === currentDay && t.espai_id === espai.id);
        const th = document.createElement('div');
        th.className = 'space-col-header';
        th.innerHTML = `
            <div class="space-title-box">
                <span class="space-title" title="${espai.nom}">${espai.nom}</span>
                ${isAdmin ? `<button class="btn-edit-title" title="Canviar nom de l'espai" onclick="promptEditEspaiName('${espai.id}')">✏️</button>` : ''}
                <span class="space-badge">${espaiTorns.length} torn${espaiTorns.length === 1 ? '' : 's'}</span>
            </div>
            ${isAdmin ? `<button class="btn-small" onclick="openTornModal(null, '${espai.id}')" style="margin: 0; background: var(--primary-light); color: var(--primary); border-color: var(--primary); font-weight: 600; white-space: nowrap;">+ Torn</button>` : ''}
        `;
        spacesHeaders.appendChild(th);
    });

    headerRow.appendChild(spacesHeaders);
    schedule.appendChild(headerRow);

    // 2. Cos del calendari: Eix d'hores + Pistes per espai
    const bodyRow = document.createElement('div');
    bodyRow.className = 'timeline-body-row';

    // Eix d'hores (Esquerra)
    const timeAxis = document.createElement('div');
    timeAxis.className = 'timeline-time-axis';

    FESTIVAL_HOURS.forEach(h => {
        const marker = document.createElement('div');
        marker.className = 'time-marker';
        marker.innerHTML = `<span class="time-label">${h.toString().padStart(2, '0')}:00</span>`;
        timeAxis.appendChild(marker);
    });
    bodyRow.appendChild(timeAxis);

    // Pistes de cada espai
    const spacesTracks = document.createElement('div');
    spacesTracks.className = 'timeline-spaces-tracks';

    let earliestFestMin = null;

    allEspais.forEach(espai => {
        const espaiTorns = allTorns
            .filter(t => t.dia === currentDay && t.espai_id === espai.id)
            .sort((a, b) => timeToFestivalMinutes(a.hora_inici) - timeToFestivalMinutes(b.hora_inici));

        const track = document.createElement('div');
        track.className = 'space-track';

        // Línies de graella de fons per hora
        const gridLines = document.createElement('div');
        gridLines.className = 'track-grid-lines';

        FESTIVAL_HOURS.forEach(h => {
            const cell = document.createElement('div');
            cell.className = 'track-hour-cell';
            if (isAdmin) {
                cell.title = `Fes clic per crear un torn a les ${h.toString().padStart(2, '0')}:00 a ${espai.nom}`;
                cell.onclick = (ev) => handleTrackHourClick(ev, espai.id, h);
            }
            gridLines.appendChild(cell);
        });
        track.appendChild(gridLines);

        // Capa de torns posicionats en el temps
        const shiftsLayer = document.createElement('div');
        shiftsLayer.className = 'track-shifts-layer';

        const layoutItems = computeTrackLayout(espaiTorns);

        layoutItems.forEach(item => {
            const torn = item.torn;
            const card = renderShiftCard(torn, espai);

            const festStart = item.start;
            const festEnd = item.end;
            const durationMins = festEnd - festStart;

            if (earliestFestMin === null || festStart < earliestFestMin) {
                earliestFestMin = festStart;
            }

            const topPx = (festStart / 60) * hourHeight;
            const minH = currentViewMode === 'global' ? 36 : 54;
            const heightPx = Math.max(minH, (durationMins / 60) * hourHeight - 4);

            card.style.top = `${topPx}px`;
            card.style.height = `${heightPx}px`;

            if (item.maxCols > 1) {
                const colWidthPct = 100 / item.maxCols;
                card.style.width = `calc(${colWidthPct}% - 6px)`;
                card.style.left = `calc(${item.col * colWidthPct}% + 3px)`;
            } else {
                card.style.left = '4px';
                card.style.right = '4px';
                card.style.width = 'auto';
            }

            shiftsLayer.appendChild(card);
        });

        track.appendChild(shiftsLayer);
        spacesTracks.appendChild(track);
    });

    bodyRow.appendChild(spacesTracks);
    schedule.appendChild(bodyRow);
    container.appendChild(schedule);

    // Auto-scroll suau al primer torn del dia
    setTimeout(() => {
        const wrapper = document.getElementById('spaces-grid-wrapper');
        if (wrapper && wrapper.scrollTop === 0) {
            const targetMin = earliestFestMin !== null ? earliestFestMin : timeToFestivalMinutes('16:00');
            const targetTop = (targetMin / 60) * hourHeight;
            wrapper.scrollTo({ top: Math.max(0, targetTop - 30), behavior: 'smooth' });
        }
    }, 150);
}

window.handleTrackHourClick = function(e, espaiId, startHour) {
    if (!isAdmin) return;
    if (e.target.closest('.shift-card')) return;

    const hInici = `${startHour.toString().padStart(2, '0')}:00`;
    const nextHour = (startHour + 1) % 24;
    const hFi = `${nextHour.toString().padStart(2, '0')}:00`;

    openTornModal(null, espaiId, hInici, hFi);
};

function renderShiftCard(torn, espai) {
    const card = document.createElement('div');
    card.className = 'shift-card';

    const assignats = allAssignacions.filter(a => a.torn_id === torn.id);
    const isMeIn = currentVoluntari && assignats.some(a => a.voluntari_id === currentVoluntari.id);
    const placesLeft = Math.max(0, torn.necessaris - assignats.length);
    const isFull = placesLeft === 0;

    if (isMeIn) card.classList.add('my-shift');
    if (isFull) card.classList.add('shift-full');

    const durationStr = calculateDuration(torn.hora_inici, torn.hora_fi);

    // Tooltip complet
    const tooltipText = `Horari: ${torn.hora_inici} – ${torn.hora_fi} (${durationStr})\nTasca: ${torn.tasca || 'Sense tasca'}\nLloc: ${torn.lloc || espai.nom}\nPlaces: ${assignats.length}/${torn.necessaris}`;
    card.title = tooltipText;

    if (currentViewMode === 'global') {
        // ==========================================
        // VISTA GLOBAL / CALENDARI (PANORÀMICA)
        // ==========================================
        card.classList.add('shift-card-global');

        // 1. Horari compacte
        const timeRow = document.createElement('div');
        timeRow.className = 'shift-time-row';
        timeRow.innerHTML = `
            <div class="shift-time">
                <span>⏰ ${torn.hora_inici}–${torn.hora_fi}</span>
            </div>
            <div class="shift-duration">${durationStr}</div>
        `;
        card.appendChild(timeRow);

        // 2. Estat i Places (0/2, 1/2, Complet)
        const statusRow = document.createElement('div');
        statusRow.className = 'shift-status-row';

        let badgeClass = 'status-free';
        let badgeText = `${assignats.length}/${torn.necessaris} places`;

        if (isMeIn) {
            badgeClass = 'status-me';
            badgeText = `✓ Inscrit/a (${assignats.length}/${torn.necessaris})`;
        } else if (isFull) {
            badgeClass = 'status-full';
            badgeText = `Complet (${assignats.length}/${torn.necessaris})`;
        } else {
            badgeText = `${placesLeft} lliure${placesLeft === 1 ? '' : 's'} (${assignats.length}/${torn.necessaris})`;
        }

        statusRow.innerHTML = `<span class="places-badge ${badgeClass}">${badgeText}</span>`;
        card.appendChild(statusRow);

        // 3. Lloc específic (si està definit)
        if (torn.lloc && torn.lloc.trim()) {
            const locEl = document.createElement('div');
            locEl.className = 'shift-location';
            locEl.innerHTML = `<span class="shift-location-icon">📍</span> <span>${torn.lloc.trim()}</span>`;
            card.appendChild(locEl);
        }

        // 4. Botó d'apuntar-se / desapuntar-se per als voluntaris
        if (currentVoluntari && !isAdmin) {
            const actionsBox = document.createElement('div');
            actionsBox.className = 'shift-actions';

            if (isMeIn) {
                const btnWithdraw = document.createElement('button');
                btnWithdraw.className = 'btn-withdraw';
                btnWithdraw.textContent = '✕ Desapuntar-me';
                btnWithdraw.onclick = () => handleToggleAssignacio(torn, isMeIn, placesLeft);
                actionsBox.appendChild(btnWithdraw);
            } else if (!isFull) {
                const btnSignup = document.createElement('button');
                btnSignup.className = 'btn-signup';
                btnSignup.textContent = 'Apuntar-m\'hi';
                btnSignup.onclick = () => handleToggleAssignacio(torn, isMeIn, placesLeft);
                actionsBox.appendChild(btnSignup);
            }

            if (actionsBox.children.length > 0) {
                card.appendChild(actionsBox);
            }
        }

        // 5. Botons admin
        if (isAdmin) {
            const adminBar = document.createElement('div');
            adminBar.className = 'admin-card-bar';
            adminBar.innerHTML = `
                <button class="btn-icon-admin" title="Editar torn" onclick="openTornModal('${torn.id}')">✏️</button>
                <button class="btn-icon-admin delete" title="Eliminar torn" onclick="quickDeleteTorn('${torn.id}')">🗑️</button>
            `;
            card.appendChild(adminBar);
        }

        return card;
    }

    // ==========================================
    // VISTA DETALLADA
    // ==========================================
    // 1. Fila d'hora i durada
    const timeRow = document.createElement('div');
    timeRow.className = 'shift-time-row';
    timeRow.innerHTML = `
        <div class="shift-time">
            <span>⏰ ${torn.hora_inici} – ${torn.hora_fi}</span>
        </div>
        <div class="shift-duration">${durationStr}</div>
    `;
    card.appendChild(timeRow);

    // 2. Tasca concreta (només si està definida)
    if (torn.tasca && torn.tasca.trim()) {
        const taskEl = document.createElement('div');
        taskEl.className = 'shift-task';
        taskEl.textContent = torn.tasca.trim();
        card.appendChild(taskEl);
    }

    // 3. Lloc específic / punt de trobada
    if (torn.lloc && torn.lloc.trim()) {
        const locEl = document.createElement('div');
        locEl.className = 'shift-location';
        locEl.innerHTML = `<span class="shift-location-icon">📍</span> <span>${torn.lloc.trim()}</span>`;
        card.appendChild(locEl);
    }

    // 4. Llista de voluntaris assignats
    if (assignats.length > 0) {
        const volsList = document.createElement('div');
        volsList.className = 'shift-vols-list';
        assignats.forEach(a => {
            const vol = allVoluntaris.find(v => v.id === a.voluntari_id);
            if (vol) {
                const tag = document.createElement('span');
                tag.className = 'vol-tag' + (currentVoluntari && vol.id === currentVoluntari.id ? ' me' : '');
                tag.textContent = `${vol.nom} ${vol.cognom.charAt(0)}.`;
                volsList.appendChild(tag);
            }
        });
        card.appendChild(volsList);
    }

    // 5. Fila d'estat de places
    const statusRow = document.createElement('div');
    statusRow.className = 'shift-status-row';

    let badgeClass = 'status-free';
    let badgeText = `${placesLeft} lliure${placesLeft === 1 ? '' : 's'} (${assignats.length}/${torn.necessaris})`;

    if (isMeIn) {
        badgeClass = 'status-me';
        badgeText = `✓ Inscrit/a (${assignats.length}/${torn.necessaris})`;
    } else if (isFull) {
        badgeClass = 'status-full';
        badgeText = `Complet (${assignats.length}/${torn.necessaris})`;
    }

    statusRow.innerHTML = `<span class="places-badge ${badgeClass}">${badgeText}</span>`;
    card.appendChild(statusRow);

    // 6. Botó d'apuntar-se / desapuntar-se per als voluntaris
    if (currentVoluntari && !isAdmin) {
        const actionsBox = document.createElement('div');
        actionsBox.className = 'shift-actions';

        if (isMeIn) {
            const btnWithdraw = document.createElement('button');
            btnWithdraw.className = 'btn-withdraw';
            btnWithdraw.textContent = '✕ Desapuntar-me';
            btnWithdraw.onclick = () => handleToggleAssignacio(torn, isMeIn, placesLeft);
            actionsBox.appendChild(btnWithdraw);
        } else if (!isFull) {
            const btnSignup = document.createElement('button');
            btnSignup.className = 'btn-signup';
            btnSignup.textContent = 'Apuntar-m\'hi';
            btnSignup.onclick = () => handleToggleAssignacio(torn, isMeIn, placesLeft);
            actionsBox.appendChild(btnSignup);
        }

        if (actionsBox.children.length > 0) {
            card.appendChild(actionsBox);
        }
    }

    // 7. Botons d'administració (Editar, Duplicar, Eliminar)
    if (isAdmin) {
        const adminBar = document.createElement('div');
        adminBar.className = 'admin-card-bar';
        adminBar.innerHTML = `
            <button class="btn-icon-admin" title="Dividir en trams horaris" onclick="openDividirTornModal('${torn.id}')">✂️</button>
            <button class="btn-icon-admin" title="Editar torn" onclick="openTornModal('${torn.id}')">✏️</button>
            <button class="btn-icon-admin" title="Duplicar torn" onclick="quickDuplicateTorn('${torn.id}')">📋</button>
            <button class="btn-icon-admin delete" title="Eliminar torn" onclick="quickDeleteTorn('${torn.id}')">🗑️</button>
        `;
        card.appendChild(adminBar);
    }

    return card;
}

// ==========================================
// 7. COMPROVACIÓ DE SOLAPAMENTS I INSCRIPCIÓ
// ==========================================
function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    const hours = parts[0] || 0;
    const minutes = parts[1] || 0;
    return hours * 60 + minutes;
}

/**
 * Converteix una hora (HH:MM) a minuts dins de la lògica del festival:
 * De 06:00 a 23:59 van primer (minuts relatius 0 .. 1079).
 * De 00:00 a 05:59 van després (minuts relatius 1080 .. 1439).
 */
function timeToFestivalMinutes(timeStr) {
    const rawMinutes = timeToMinutes(timeStr);
    return ((rawMinutes - 360) % 1440 + 1440) % 1440;
}

function festivalMinutesToTime(festMins) {
    const rawMins = ((festMins + 360) % 1440 + 1440) % 1440;
    const h = Math.floor(rawMins / 60).toString().padStart(2, '0');
    const m = (rawMins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
}

function calculateDuration(iniciStr, fiStr) {
    let startMin = timeToFestivalMinutes(iniciStr);
    let endMin = timeToFestivalMinutes(fiStr);

    // Si el torn acaba passada la durada relativa (ex: creua el límit de 24h)
    if (endMin <= startMin) {
        endMin += 24 * 60;
    }

    const diffMin = endMin - startMin;
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;

    if (hours > 0 && mins > 0) {
        return `${hours}h ${mins}m`;
    } else if (hours > 0) {
        return `${hours}h`;
    } else {
        return `${mins}m`;
    }
}

/**
 * Comprova si el voluntari ja té un torn assignat al mateix dia que se solapi en el temps
 */
function checkVolunteerOverlap(voluntariId, targetTorn) {
    // 1. Obtenir tots els torns on ja està apuntat aquest voluntari
    const myAssignations = allAssignacions.filter(a => a.voluntari_id === voluntariId);
    const myTornIds = myAssignations.map(a => a.torn_id);
    
    // Torns del mateix dia on està apuntat (excloent el mateix torn si ja hi fos)
    const mySameDayTorns = allTorns.filter(t => t.dia === targetTorn.dia && myTornIds.includes(t.id) && t.id !== targetTorn.id);

    let targetStart = timeToFestivalMinutes(targetTorn.hora_inici);
    let targetEnd = timeToFestivalMinutes(targetTorn.hora_fi);
    if (targetEnd <= targetStart) targetEnd += 24 * 60;

    for (const otherTorn of mySameDayTorns) {
        let otherStart = timeToFestivalMinutes(otherTorn.hora_inici);
        let otherEnd = timeToFestivalMinutes(otherTorn.hora_fi);
        if (otherEnd <= otherStart) otherEnd += 24 * 60;

        // Condició de solapament temporal: (StartA < EndB) && (EndA > StartB)
        const isOverlapping = (targetStart < otherEnd) && (targetEnd > otherStart);

        if (isOverlapping) {
            const otherEspai = allEspais.find(e => e.id === otherTorn.espai_id);
            return {
                overlap: true,
                conflictingTorn: otherTorn,
                conflictingEspai: otherEspai ? otherEspai.nom : 'un altre espai'
            };
        }
    }

    return { overlap: false };
}

async function handleToggleAssignacio(torn, isMeIn, placesLeft) {
    if (!currentVoluntari) {
        alert("Si us plau, identifica't o registra't a dalt per apuntar-te.");
        return;
    }

    if (isMeIn) {
        // Desapuntar-se
        const { error } = await supabaseClient
            .from('vol_assignacions')
            .delete()
            .match({ torn_id: torn.id, voluntari_id: currentVoluntari.id });

        if (error) {
            alert("Error en desapuntar-se: " + error.message);
        }
    } else {
        // Apuntar-se: comprovar places
        if (placesLeft <= 0) {
            alert("Aquest torn ja està complet!");
            return;
        }

        // Comprovar solapaments d'horaris amb altres espais/tasques
        const overlapResult = checkVolunteerOverlap(currentVoluntari.id, torn);
        if (overlapResult.overlap) {
            const confTorn = overlapResult.conflictingTorn;
            alert(
                `⚠️ No et pots apuntar a aquest torn perquè coincideix en horari amb un altre torn on ja estàs inscrit/a:\n\n` +
                `• Espai: ${overlapResult.conflictingEspai}\n` +
                `• Horari: ${confTorn.hora_inici} – ${confTorn.hora_fi}\n` +
                `• Tasca: ${confTorn.tasca || 'Sense especificar'}\n\n` +
                `Si vols fer aquest nou torn, desapunta't primer de l'altre.`
            );
            return;
        }

        const insertPayload = {
            torn_id: torn.id,
            voluntari_id: currentVoluntari.id,
            dia: torn.dia,
            espai_id: torn.espai_id,
            hora: parseInt(torn.hora_inici) || 0
        };

        const { error } = await supabaseClient
            .from('vol_assignacions')
            .insert(insertPayload);

        if (error) {
            if (error.code === '23505') {
                alert("Ja estàs apuntat/da a aquest torn.");
            } else {
                alert("Error en apuntar-se: " + error.message);
            }
        }
    }

    await fetchData();
    renderAll();
}

// ==========================================
// 8. GESTIÓ DE TORNS PER A L'ADMIN (MODAL)
// ==========================================
function openTornModal(tornId = null, defaultEspaiId = null, defaultHInici = null, defaultHFi = null) {
    const modal = document.getElementById('modal-torn');
    const title = document.getElementById('modal-torn-title');
    const err = document.getElementById('torn-form-error');
    err.style.display = 'none';

    populateEspaisSelectInModal();

    const editIdInput = document.getElementById('torn-edit-id');
    const btnDelete = document.getElementById('btn-delete-torn');
    const btnDuplicate = document.getElementById('btn-duplicate-torn');
    const btnSplit = document.getElementById('btn-split-from-edit');

    if (tornId) {
        // Mode edició
        const torn = allTorns.find(t => t.id === tornId);
        if (!torn) return;

        title.textContent = "Editar Torn de Voluntariat";
        editIdInput.value = torn.id;
        document.getElementById('torn-dia').value = torn.dia;
        document.getElementById('torn-espai-id').value = torn.espai_id;
        document.getElementById('torn-hora-inici').value = torn.hora_inici;
        document.getElementById('torn-hora-fi').value = torn.hora_fi;
        document.getElementById('torn-tasca').value = torn.tasca || '';
        document.getElementById('torn-lloc').value = torn.lloc || '';
        document.getElementById('torn-necessaris').value = torn.necessaris || 1;

        btnDelete.style.display = 'block';
        btnDuplicate.style.display = 'block';
        if (btnSplit) btnSplit.style.display = 'block';
    } else {
        // Mode creació
        title.textContent = "Nou Torn de Voluntariat";
        editIdInput.value = '';
        document.getElementById('torn-dia').value = currentDay;
        if (defaultEspaiId) {
            document.getElementById('torn-espai-id').value = defaultEspaiId;
        }
        document.getElementById('torn-hora-inici').value = defaultHInici || '17:00';
        document.getElementById('torn-hora-fi').value = defaultHFi || '18:30';
        document.getElementById('torn-tasca').value = '';
        document.getElementById('torn-lloc').value = '';
        document.getElementById('torn-necessaris').value = 2;

        btnDelete.style.display = 'none';
        btnDuplicate.style.display = 'none';
        if (btnSplit) btnSplit.style.display = 'none';
    }

    modal.style.display = 'flex';
}

function closeTornModal() {
    document.getElementById('modal-torn').style.display = 'none';
}

async function handleSaveTorn() {
    const editId = document.getElementById('torn-edit-id').value;
    const dia = document.getElementById('torn-dia').value;
    const espai_id = document.getElementById('torn-espai-id').value;
    const hora_inici = document.getElementById('torn-hora-inici').value;
    const hora_fi = document.getElementById('torn-hora-fi').value;
    const tasca = document.getElementById('torn-tasca').value.trim();
    const lloc = document.getElementById('torn-lloc').value.trim();
    const necessaris = parseInt(document.getElementById('torn-necessaris').value) || 1;
    const err = document.getElementById('torn-form-error');

    if (!dia || !espai_id || !hora_inici || !hora_fi) {
        err.textContent = "Si us plau, especifica l'espai, el dia i les hores d'inici i fi.";
        err.style.display = 'block';
        return;
    }

    const payload = {
        dia,
        espai_id,
        hora_inici,
        hora_fi,
        tasca,
        lloc,
        necessaris
    };

    let error = null;
    if (editId) {
        const res = await supabaseClient.from('vol_torns').update(payload).eq('id', editId);
        error = res.error;
    } else {
        const res = await supabaseClient.from('vol_torns').insert(payload);
        error = res.error;
    }

    if (error) {
        err.textContent = "Error guardant el torn: " + error.message;
        err.style.display = 'block';
    } else {
        closeTornModal();
        await fetchData();
        renderAll();
    }
}

async function handleDeleteTorn() {
    const editId = document.getElementById('torn-edit-id').value;
    if (!editId) return;
    if (!confirm("Segur que vols eliminar aquest torn? S'esborraran també les inscripcions de voluntaris associades.")) return;

    const { error } = await supabaseClient.from('vol_torns').delete().eq('id', editId);
    if (error) {
        alert("Error eliminant el torn: " + error.message);
    } else {
        closeTornModal();
        await fetchData();
        renderAll();
    }
}

async function handleDuplicateTorn() {
    const dia = document.getElementById('torn-dia').value;
    const espai_id = document.getElementById('torn-espai-id').value;
    const hora_inici = document.getElementById('torn-hora-inici').value;
    const hora_fi = document.getElementById('torn-hora-fi').value;
    const tasca = document.getElementById('torn-tasca').value.trim();
    const lloc = document.getElementById('torn-lloc').value.trim();
    const necessaris = parseInt(document.getElementById('torn-necessaris').value) || 1;

    const payload = {
        dia,
        espai_id,
        hora_inici,
        hora_fi,
        tasca,
        lloc,
        necessaris
    };

    const { error } = await supabaseClient.from('vol_torns').insert(payload);
    if (error) {
        alert("Error duplicant el torn: " + error.message);
    } else {
        closeTornModal();
        await fetchData();
        renderAll();
    }
}

window.quickDuplicateTorn = async function(tornId) {
    const torn = allTorns.find(t => t.id === tornId);
    if (!torn) return;

    const payload = {
        dia: torn.dia,
        espai_id: torn.espai_id,
        hora_inici: torn.hora_inici,
        hora_fi: torn.hora_fi,
        tasca: torn.tasca,
        lloc: torn.lloc,
        necessaris: torn.necessaris
    };

    const { error } = await supabaseClient.from('vol_torns').insert(payload);
    if (error) {
        alert("Error duplicant el torn: " + error.message);
    } else {
        await fetchData();
        renderAll();
    }
};

window.quickDeleteTorn = async function(tornId) {
    if (!confirm("Segur que vols eliminar aquest torn?")) return;
    const { error } = await supabaseClient.from('vol_torns').delete().eq('id', tornId);
    if (error) {
        alert("Error eliminant el torn: " + error.message);
    } else {
        await fetchData();
        renderAll();
    }
};

// ==========================================
// 8.1. DIVIDIR TORNS EN TRAMS (ADMIN)
// ==========================================
function minutesToTime(mins) {
    const normalized = ((mins % 1440) + 1440) % 1440;
    const h = Math.floor(normalized / 60).toString().padStart(2, '0');
    const m = (normalized % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
}

function calculateSplitSlots(iniciStr, fiStr, chunkMins) {
    let startMin = timeToFestivalMinutes(iniciStr);
    let endMin = timeToFestivalMinutes(fiStr);
    if (endMin <= startMin) endMin += 24 * 60;

    const slots = [];
    let cur = startMin;
    while (cur < endMin) {
        let next = Math.min(cur + chunkMins, endMin);
        const hInici = festivalMinutesToTime(cur);
        const hFi = festivalMinutesToTime(next);
        const durada = calculateDuration(hInici, hFi);
        slots.push({ hora_inici: hInici, hora_fi: hFi, durada });
        cur = next;
    }
    return slots;
}

function getSelectedSplitMins() {
    const activeBtn = document.querySelector('#modal-dividir-torn .btn-preset.active');
    if (!activeBtn) return 60;
    const val = activeBtn.dataset.mins;
    if (val === 'custom') {
        return parseInt(document.getElementById('split-custom-mins').value) || 60;
    }
    return parseInt(val) || 60;
}

function openDividirTornModal(tornId) {
    const torn = allTorns.find(t => t.id === tornId);
    if (!torn) return;

    const espai = allEspais.find(e => e.id === torn.espai_id);

    document.getElementById('dividir-torn-id').value = torn.id;
    document.getElementById('dividir-info-espai-dia').textContent = `${espai ? espai.nom : 'Espai'} • ${torn.dia}`;
    document.getElementById('dividir-info-horari').textContent = `${torn.hora_inici} – ${torn.hora_fi}`;
    document.getElementById('dividir-info-durada').textContent = calculateDuration(torn.hora_inici, torn.hora_fi);
    document.getElementById('dividir-info-tasca').textContent = torn.tasca || 'Sense tasca especificada';
    document.getElementById('dividir-info-places').textContent = `${torn.necessaris} places requerides`;

    // Reset presets a 60 min
    document.querySelectorAll('#modal-dividir-torn .btn-preset').forEach(b => {
        b.classList.toggle('active', b.dataset.mins === '60');
    });
    document.getElementById('custom-mins-row').style.display = 'none';
    document.getElementById('split-form-error').style.display = 'none';

    updateSplitPreview();
    document.getElementById('modal-dividir-torn').style.display = 'flex';
}

function closeDividirTornModal() {
    document.getElementById('modal-dividir-torn').style.display = 'none';
}

function updateSplitPreview() {
    const tornId = document.getElementById('dividir-torn-id').value;
    const torn = allTorns.find(t => t.id === tornId);
    if (!torn) return;

    const chunkMins = getSelectedSplitMins();
    const slots = calculateSplitSlots(torn.hora_inici, torn.hora_fi, chunkMins);
    const list = document.getElementById('split-preview-list');
    const countEl = document.getElementById('split-preview-count');
    const btnDo = document.getElementById('btn-do-dividir');

    countEl.textContent = slots.length;
    list.innerHTML = '';

    if (slots.length <= 1) {
        list.innerHTML = `<p style="color: #fbbf24; font-size: 0.85rem; padding: 0.4rem;">⚠️ La durada triada (${chunkMins} min) és igual o superior a la durada total del torn. Tria una durada inferior per poder dividir-lo en trams.</p>`;
        btnDo.disabled = true;
        return;
    }

    btnDo.disabled = false;

    slots.forEach((s, idx) => {
        const item = document.createElement('div');
        item.className = 'split-preview-item';
        item.innerHTML = `
            <div>
                <strong>Tram ${idx + 1}:</strong> <span class="split-preview-time">${s.hora_inici} – ${s.hora_fi}</span>
            </div>
            <span class="shift-duration">${s.durada}</span>
        `;
        list.appendChild(item);
    });
}

async function handleDoDividirTorn() {
    const tornId = document.getElementById('dividir-torn-id').value;
    const torn = allTorns.find(t => t.id === tornId);
    const err = document.getElementById('split-form-error');
    const btn = document.getElementById('btn-do-dividir');
    if (!torn) return;

    const chunkMins = getSelectedSplitMins();
    const slots = calculateSplitSlots(torn.hora_inici, torn.hora_fi, chunkMins);

    if (slots.length <= 1) {
        err.textContent = "Cal dividir en almenys 2 trams horaris.";
        err.style.display = 'block';
        return;
    }

    const assignats = allAssignacions.filter(a => a.torn_id === torn.id);
    if (assignats.length > 0) {
        const proceed = confirm(
            `⚠️ Aquest torn té ${assignats.length} voluntari(s) assignat(s).\n\n` +
            `Si el divideixes, el torn original s'esborrarà i es crearan els ${slots.length} trams nous buits perquè els voluntaris tornin a triar el seu horari.\n\n` +
            `Vols continuar?`
        );
        if (!proceed) return;
    }

    btn.disabled = true;
    btn.textContent = 'Dividint torn...';
    if (err) err.style.display = 'none';

    try {
        const newShiftsPayload = slots.map(s => ({
            dia: torn.dia,
            espai_id: torn.espai_id,
            hora_inici: s.hora_inici,
            hora_fi: s.hora_fi,
            tasca: torn.tasca || '',
            lloc: torn.lloc || '',
            necessaris: torn.necessaris || 1
        }));

        // 1. Eliminar torn original
        const delRes = await supabaseClient.from('vol_torns').delete().eq('id', torn.id);
        if (delRes.error) throw delRes.error;

        // 2. Inserir nous torns
        const insRes = await supabaseClient.from('vol_torns').insert(newShiftsPayload);
        if (insRes.error) throw insRes.error;

        closeDividirTornModal();
        await fetchData();
        renderAll();
    } catch (e) {
        console.error("Error dividint el torn:", e);
        err.textContent = "Error: " + e.message;
        err.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = '✂️ Aplicar i Crear Trams';
    }
}

window.openDividirTornModal = openDividirTornModal;
window.openTornModal = openTornModal;

// ==========================================
// 9. GESTIÓ D'ESPAIS (ADMIN)
// ==========================================
let editingEspaiId = null;

function openEspaisModal() {
    editingEspaiId = null;
    const input = document.getElementById('new-espai-nom');
    if (input) input.value = '';
    const err = document.getElementById('espais-form-error');
    if (err) err.style.display = 'none';

    renderEspaisAdminList();
    document.getElementById('modal-espais').style.display = 'flex';
    if (input) setTimeout(() => input.focus(), 100);
}

function renderEspaisAdminList() {
    const list = document.getElementById('espais-admin-list');
    list.innerHTML = '';

    if (allEspais.length === 0) {
        list.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">No hi ha cap espai creat.</p>';
        return;
    }

    allEspais.forEach(e => {
        const row = document.createElement('div');
        row.className = 'espai-item-row';

        if (editingEspaiId === e.id) {
            // Mode edició inline
            row.innerHTML = `
                <div style="display: flex; gap: 0.5rem; width: 100%; align-items: center;">
                    <input type="text" id="input-edit-espai-${e.id}" value="${e.nom.replace(/"/g, '&quot;')}" style="padding: 0.4rem 0.6rem; font-size: 0.9rem; flex: 1;">
                    <button class="btn-primary" onclick="saveEspaiName('${e.id}')" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">✓</button>
                    <button class="btn-ghost" onclick="cancelEditEspaiName()" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">✕</button>
                </div>
            `;
            setTimeout(() => {
                const inp = document.getElementById(`input-edit-espai-${e.id}`);
                if (inp) {
                    inp.focus();
                    inp.select();
                    inp.addEventListener('keydown', (ev) => {
                        if (ev.key === 'Enter') saveEspaiName(e.id);
                        if (ev.key === 'Escape') cancelEditEspaiName();
                    });
                }
            }, 50);
        } else {
            // Mode normal
            row.innerHTML = `
                <span style="font-weight: 600; color: white;">${e.nom}</span>
                <div style="display: flex; gap: 0.4rem;">
                    <button class="btn-small" onclick="startEditEspaiName('${e.id}')" style="margin: 0; color: var(--primary); border-color: var(--primary);">✏️ Renombrar</button>
                    <button class="btn-small" onclick="deleteEspai('${e.id}')" style="margin: 0; color: var(--danger); border-color: var(--danger);">🗑️ Eliminar</button>
                </div>
            `;
        }

        list.appendChild(row);
    });
}

window.startEditEspaiName = function(id) {
    editingEspaiId = id;
    renderEspaisAdminList();
};

window.cancelEditEspaiName = function() {
    editingEspaiId = null;
    renderEspaisAdminList();
};

window.saveEspaiName = async function(id) {
    const inp = document.getElementById(`input-edit-espai-${id}`);
    const newNom = inp ? inp.value.trim() : '';
    if (!newNom) {
        alert("El nom de l'espai no pot estar buit.");
        return;
    }

    const { error } = await supabaseClient
        .from('vol_espais')
        .update({ nom: newNom })
        .eq('id', id);

    if (error) {
        alert("Error guardant el nou nom: " + error.message);
    } else {
        editingEspaiId = null;
        await fetchData();
        renderEspaisAdminList();
        renderAll();
    }
};

window.promptEditEspaiName = async function(id) {
    const espai = allEspais.find(e => e.id === id);
    if (!espai) return;

    const newNom = prompt("Canvia el nom d'aquest espai:", espai.nom);
    if (newNom === null) return;
    const trimmed = newNom.trim();
    if (!trimmed || trimmed === espai.nom) return;

    const { error } = await supabaseClient
        .from('vol_espais')
        .update({ nom: trimmed })
        .eq('id', id);

    if (error) {
        alert("Error canviant el nom de l'espai: " + error.message);
    } else {
        await fetchData();
        renderEspaisAdminList();
        renderAll();
    }
};

async function handleAddEspai() {
    const input = document.getElementById('new-espai-nom');
    const btn = document.getElementById('btn-add-espai');
    const err = document.getElementById('espais-form-error');
    const nom = input ? input.value.trim() : '';

    if (!nom) {
        if (err) {
            err.textContent = "Si us plau, escriu el nom de l'espai.";
            err.style.display = 'block';
        }
        return;
    }

    if (err) err.style.display = 'none';
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Afegint...';
    }

    try {
        const { data, error } = await supabaseClient.from('vol_espais').insert({ nom }).select();
        
        if (error) {
            console.error("Error creant l'espai a Supabase:", error);
            if (err) {
                if (error.code === '42501' || error.message.includes('row-level security')) {
                    err.innerHTML = "<strong>Error de permisos a Supabase (RLS):</strong><br>Cal aplicar l'script <code>schema_voluntaris_v2.sql</code> a la consola SQL de Supabase per permetre la creació d'espais.";
                } else {
                    err.textContent = "Error creant l'espai: " + error.message;
                }
                err.style.display = 'block';
            } else {
                alert("Error creant l'espai: " + error.message);
            }
        } else {
            if (input) input.value = '';
            await fetchData();
            renderEspaisAdminList();
            renderAll();
        }
    } catch (e) {
        console.error("Excepció creant espai:", e);
        if (err) {
            err.textContent = "Excepció: " + e.message;
            err.style.display = 'block';
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '+ Afegir';
        }
    }
}

window.deleteEspai = async function(id) {
    if (!confirm("Segur que vols eliminar aquest espai? S'esborraran tots els seus torns i assignacions.")) return;
    const { error } = await supabaseClient.from('vol_espais').delete().eq('id', id);
    if (error) {
        alert("Error eliminant l'espai: " + error.message);
    } else {
        await fetchData();
        renderEspaisAdminList();
        renderAll();
    }
};

window.openEspaisModal = openEspaisModal;

// ==========================================
// 10. AUTH ADMIN
// ==========================================
async function handleAdminLogin() {
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-pass').value;
    const err = document.getElementById('admin-auth-error');

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
        err.innerText = "Error: " + error.message;
        err.style.display = 'block';
    } else {
        document.getElementById('modal-admin').style.display = 'none';
        setAdminMode(true);
    }
}

function setAdminMode(active) {
    isAdmin = active;
    document.getElementById('admin-indicator').style.display = active ? 'block' : 'none';
    const topActions = document.getElementById('admin-top-actions');
    if (topActions) topActions.style.display = active ? 'flex' : 'none';
    document.querySelectorAll('.admin-only-btn').forEach(b => {
        b.style.display = active ? 'inline-flex' : 'none';
    });
    document.getElementById('btn-admin-login-toggle').innerText = active ? 'Sortir Admin' : 'Accés Administrador';
    renderAll();
}

// ==========================================
// 11. EXPORTACIÓ CSV
// ==========================================
async function handleExportCSV() {
    // 1. CSV Voluntaris
    let csvVol = "\uFEFF"; // UTF-8 BOM
    csvVol += "Nom;Cognoms;Telèfon\n";
    const sortedVols = [...allVoluntaris].sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
    sortedVols.forEach(v => {
        csvVol += `"${v.nom}";"${v.cognom}";"${v.telefon}"\n`;
    });
    downloadCSV("voluntaris_contactes_pluja_2026.csv", csvVol);

    // 2. CSV Torns i Assignacions
    let csvTorns = "\uFEFF"; // UTF-8 BOM
    csvTorns += "Dia;Espai;Hora Inici;Hora Fi;Durada;Tasca;Lloc;Places Necessàries;Inscrits;Voluntaris Assignats\n";

    const dies = ['Divendres', 'Dissabte', 'Diumenge'];
    dies.forEach(dia => {
        allEspais.forEach(espai => {
            const torns = allTorns
                .filter(t => t.dia === dia && t.espai_id === espai.id)
                .sort((a, b) => timeToFestivalMinutes(a.hora_inici) - timeToFestivalMinutes(b.hora_inici));

            torns.forEach(t => {
                const assignats = allAssignacions.filter(a => a.torn_id === t.id);
                const nombresVols = assignats.map(a => {
                    const v = allVoluntaris.find(vol => vol.id === a.voluntari_id);
                    return v ? `${v.nom} ${v.cognom}` : '';
                }).filter(Boolean).join(", ");

                const durada = calculateDuration(t.hora_inici, t.hora_fi);

                csvTorns += `"${dia}";"${espai.nom}";"${t.hora_inici}";"${t.hora_fi}";"${durada}";"${(t.tasca || '').replace(/"/g, '""')}";"${(t.lloc || '').replace(/"/g, '""')}";${t.necessaris};${assignats.length};"${nombresVols.replace(/"/g, '""')}"\n`;
            });
        });
    });

    downloadCSV("torns_horaris_pluja_2026.csv", csvTorns);
}

function downloadCSV(filename, content) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================
// 12. IMPRESSIÓ PDF
// ==========================================
async function handlePrintPDF() {
    try {
        const dies = ['Divendres', 'Dissabte', 'Diumenge'];
        const diesMap = {
            'Divendres': 'Divendres 26 de setembre',
            'Dissabte': 'Dissabte 27 de setembre',
            'Diumenge': 'Diumenge 28 de setembre'
        };

        let printHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Pluja d'Art 2026 - Torns de Voluntariat</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #111; background: white; padding: 25px; }
                h1 { border-bottom: 2px solid #111; padding-bottom: 8px; font-size: 22px; margin-bottom: 20px; }
                h2 { border-bottom: 1.5px solid #444; padding-bottom: 4px; font-size: 16px; margin-top: 25px; margin-bottom: 12px; color: #111; }
                h3 { font-size: 14px; margin-top: 15px; margin-bottom: 6px; color: #0284c7; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
                th, td { border: 1px solid #bbb; padding: 6px 8px; text-align: left; vertical-align: top; }
                th { background: #f1f5f9; font-weight: bold; }
                .time-col { width: 100px; font-weight: bold; white-space: nowrap; }
                .task-col { font-weight: 600; color: #0f172a; }
                .loc-col { color: #475569; font-size: 10.5px; }
                .places-col { width: 65px; text-align: center; font-weight: bold; }
                .vols-col { color: #334155; }
                @media print {
                    .page-break { page-break-after: always; }
                }
            </style>
        </head>
        <body>
            <h1>Festival Pluja d'Art 2026 — Graella de Torns de Voluntariat</h1>
        `;

        dies.forEach((dia, idx) => {
            printHtml += `<h2>${diesMap[dia]}</h2>`;

            allEspais.forEach(espai => {
                const torns = allTorns
                    .filter(t => t.dia === dia && t.espai_id === espai.id)
                    .sort((a, b) => timeToFestivalMinutes(a.hora_inici) - timeToFestivalMinutes(b.hora_inici));

                if (torns.length > 0) {
                    printHtml += `<h3>Espai: ${espai.nom}</h3>`;
                    printHtml += `
                        <table>
                            <thead>
                                <tr>
                                    <th class="time-col">Horari</th>
                                    <th>Tasca</th>
                                    <th>Lloc / Punt de Trobada</th>
                                    <th class="places-col">Places</th>
                                    <th class="vols-col">Voluntaris Assignats</th>
                                </tr>
                            </thead>
                            <tbody>
                    `;

                    torns.forEach(t => {
                        const assignats = allAssignacions.filter(a => a.torn_id === t.id);
                        const names = assignats.map(a => {
                            const v = allVoluntaris.find(vol => vol.id === a.voluntari_id);
                            return v ? `${v.nom} ${v.cognom}` : '';
                        }).filter(Boolean).join(", ") || "<em>(Sense voluntaris)</em>";

                        printHtml += `
                            <tr>
                                <td class="time-col">${t.hora_inici} – ${t.hora_fi}</td>
                                <td class="task-col">${t.tasca || '-'}</td>
                                <td class="loc-col">${t.lloc || '-'}</td>
                                <td class="places-col">${assignats.length} / ${t.necessaris}</td>
                                <td class="vols-col">${names}</td>
                            </tr>
                        `;
                    });

                    printHtml += `</tbody></table>`;
                }
            });

            if (idx < dies.length - 1) {
                printHtml += `<div class="page-break"></div>`;
            }
        });

        // Llistat de contactes
        printHtml += `<div class="page-break"></div>`;
        printHtml += `<h2>Directori de Contactes de Voluntaris</h2>`;
        printHtml += `
            <table>
                <thead>
                    <tr>
                        <th style="width: 50%;">Nom i Cognoms</th>
                        <th style="width: 50%;">Telèfon de Contacte</th>
                    </tr>
                </thead>
                <tbody>
        `;

        const sortedVoluntaris = [...allVoluntaris].sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
        sortedVoluntaris.forEach(v => {
            printHtml += `
                <tr>
                    <td>${v.nom} ${v.cognom}</td>
                    <td>${v.telefon}</td>
                </tr>
            `;
        });

        printHtml += `</tbody></table></body></html>`;

        // Generar a través d'un iframe ocult
        let iframe = document.getElementById('print-iframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'print-iframe';
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
        }

        const pri = iframe.contentWindow;
        pri.document.open();
        pri.document.write(printHtml);
        pri.document.close();

        setTimeout(() => {
            pri.focus();
            pri.print();
        }, 500);
    } catch (err) {
        console.error("Error en imprimir PDF:", err);
        alert("S'ha produït un error generant la vista d'impressió.");
    }
}
