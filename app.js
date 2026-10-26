/**
 * ANAT'PASS POLY — Application d'Apprentissage des Schémas d'Anatomie
 * Polycopié Tutorats Mineure Santé / PASS UE5
 *
 * Moteur complet :
 * - Navigation par Chapitre & Section
 * - Mode Schéma Quiz (masqué avec badges numérotés) vs Schéma Original (légendes d'origine)
 * - Moteur de tolérance orthographique & lexicale (accents, articles, abréviations médicales)
 * - Mode Strict PASS vs Mode Tolérant + Rappel
 * - Synthèse sonore Web Audio API
 * - Zoom & Pan fluide (souris + gestes tactiles iPad / Android)
 * - Persistance LocalStorage & Tableau de bord statistique
 */

class AnatPassApp {
  constructor() {
    this.planches = (typeof EMBEDDED_PLANCHES !== 'undefined' && Array.isArray(EMBEDDED_PLANCHES)) ? EMBEDDED_PLANCHES : [];
    this.currentIndex = 0;
    this.currentChapterFilter = 'all';
    this.viewingOriginal = false;
    this.userProgress = this.loadProgress();
    this.soundEnabled = localStorage.getItem('anatpass_poly_sound') !== 'false';
    this.rigorMode = localStorage.getItem('anatpass_poly_rigor_mode') || 'strict';
    this.audioCtx = null;

    // État du zoom & pan
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this.startX = 0;
    this.startY = 0;

    this.initDOM();
    this.initEvents();
    this.loadPlancheData();
  }

  /* ------------------------------------------------------------------------
     INITIALISATION DU DOM & SÉLECTEURS
     ------------------------------------------------------------------------ */
  initDOM() {
    // Header
    this.headerPlancheNum = document.getElementById('header-planche-num');
    this.headerPlancheTitle = document.getElementById('header-planche-title');
    this.plancheDropdownBtn = document.getElementById('planche-dropdown-btn');
    this.plancheDropdownMenu = document.getElementById('planche-dropdown-menu');
    this.dropdownSearchInput = document.getElementById('dropdown-search-input');
    this.chapterChipsBar = document.getElementById('chapter-chips-bar');
    this.plancheList = document.getElementById('planche-list');

    this.viewModeBtns = document.querySelectorAll('.view-mode-btn');
    this.workspaceContainer = document.getElementById('workspace-container');

    this.globalRingFill = document.getElementById('global-ring-fill');
    this.globalPercentText = document.getElementById('global-percent-text');
    this.globalMasteredText = document.getElementById('global-mastered-text');
    this.openStatsBtn = document.getElementById('open-stats-btn');

    this.toggleSoundBtn = document.getElementById('toggle-sound-btn');
    this.soundIconOn = document.getElementById('sound-icon-on');
    this.soundIconOff = document.getElementById('sound-icon-off');
    this.toggleHelpBtn = document.getElementById('toggle-help-btn');
    this.prevPlancheHeaderBtn = document.getElementById('prev-planche-header-btn');
    this.nextPlancheHeaderBtn = document.getElementById('next-planche-header-btn');

    // Panneau Schéma
    this.diagramChapterBadge = document.getElementById('diagram-chapter-badge');
    this.diagramPageBadge = document.getElementById('diagram-page-badge');
    this.diagramTitle = document.getElementById('diagram-title');
    this.diagramSubtitle = document.getElementById('diagram-subtitle');
    this.toggleOrigSchemaBtn = document.getElementById('toggle-orig-schema-btn');
    this.origSchemaBtnText = document.getElementById('orig-schema-btn-text');

    this.diagramViewport = document.getElementById('diagram-viewport');
    this.diagramCanvas = document.getElementById('diagram-canvas');
    this.diagramImg = document.getElementById('diagram-img');
    this.zoomLevelText = document.getElementById('zoom-level-text');
    this.zoomInBtn = document.getElementById('zoom-in-btn');
    this.zoomOutBtn = document.getElementById('zoom-out-btn');
    this.zoomResetBtn = document.getElementById('zoom-reset-btn');
    this.fullscreenBtn = document.getElementById('fullscreen-btn');

    // Panneau Quiz
    this.plancheScoreVal = document.getElementById('planche-score-val');
    this.plancheTotalVal = document.getElementById('planche-total-val');
    this.plancheStatusBadge = document.getElementById('planche-status-badge');
    this.plancheProgressFill = document.getElementById('planche-progress-fill');
    this.revealAllBtn = document.getElementById('reveal-all-btn');
    this.resetPlancheBtn = document.getElementById('reset-planche-btn');
    this.quizFormContainer = document.getElementById('quiz-form-container');
    this.prevPlancheBtn = document.getElementById('prev-planche-btn');
    this.nextPlancheBtn = document.getElementById('next-planche-btn');

    // Modes de Rigueur
    this.btnModeStrict = document.getElementById('btn-mode-strict');
    this.btnModeTolerant = document.getElementById('btn-mode-tolerant');
    this.rigorHelpBanner = document.getElementById('rigor-help-banner');
    this.updateRigorUI();

    // Modales
    this.statsModal = document.getElementById('stats-modal');
    this.closeStatsBtn = document.getElementById('close-stats-btn');
    this.statsTotalPlanches = document.getElementById('stats-total-planches');
    this.statsMasteredPlanches = document.getElementById('stats-mastered-planches');
    this.statsInProgressPlanches = document.getElementById('stats-in-progress-planches');
    this.statsTotalTermsFound = document.getElementById('stats-total-terms-found');
    this.chapterStatsBreakdown = document.getElementById('chapter-stats-breakdown');

    this.helpModal = document.getElementById('help-modal');
    this.closeHelpBtn = document.getElementById('close-help-btn');

    this.updateSoundUI();
  }

  /* ------------------------------------------------------------------------
     CHARGEMENT DONNÉES & PERSISTANCE
     ------------------------------------------------------------------------ */
  async loadPlancheData() {
    try {
      const resp = await fetch('data/planches.json');
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          this.planches = data;
        }
      }
    } catch (e) {
      console.log('Utilisation du jeu de données embarqué.');
    }

    // Restaurer le dernier index consulté
    const savedIdx = localStorage.getItem('anatpass_poly_current_index');
    if (savedIdx !== null && !isNaN(parseInt(savedIdx))) {
      const idx = parseInt(savedIdx);
      if (idx >= 0 && idx < this.planches.length) {
        this.currentIndex = idx;
      }
    }

    this.renderDropdownList();
    this.renderCurrentPlanche();
    this.updateGlobalStats();
  }

  loadProgress() {
    try {
      const saved = localStorage.getItem('anatpass_poly_saved_answers');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  }

  saveProgress() {
    try {
      localStorage.setItem('anatpass_poly_saved_answers', JSON.stringify(this.userProgress));
      localStorage.setItem('anatpass_poly_current_index', this.currentIndex.toString());
    } catch (e) {}
  }

  /* ------------------------------------------------------------------------
     GESTION DU MODE DE RIGUEUR (Strict PASS vs Tolérant)
     ------------------------------------------------------------------------ */
  setRigorMode(mode) {
    if (this.rigorMode === mode) return;
    this.rigorMode = mode;
    try {
      localStorage.setItem('anatpass_poly_rigor_mode', mode);
    } catch (e) {}
    this.updateRigorUI();
    this.renderCurrentPlanche();
  }

  updateRigorUI() {
    if (this.btnModeStrict && this.btnModeTolerant) {
      if (this.rigorMode === 'strict') {
        this.btnModeStrict.classList.add('active');
        this.btnModeTolerant.classList.remove('active');
        if (this.rigorHelpBanner) {
          this.rigorHelpBanner.innerHTML = '🎯 <strong>Mode Strict PASS actif :</strong> Seules les désignations officielles du polycopié sont validées. Les synonymes sont signalés.';
          this.rigorHelpBanner.className = 'rigor-help-banner banner-strict';
        }
      } else {
        this.btnModeStrict.classList.remove('active');
        this.btnModeTolerant.classList.add('active');
        if (this.rigorHelpBanner) {
          this.rigorHelpBanner.innerHTML = '📖 <strong>Mode Tolérant actif :</strong> Les synonymes anatomiques sont acceptés avec affichage du rappel officiel.';
          this.rigorHelpBanner.className = 'rigor-help-banner banner-tolerant';
        }
      }
    }
  }

  /* ------------------------------------------------------------------------
     ÉVALUATION LEXICALE ET SYNONYMES
     ------------------------------------------------------------------------ */
  normalizeString(str) {
    if (!str) return '';
    let s = str.toLowerCase().trim();
    // Normalisation des espaces et tirets
    s = s.replace(/[\u2010-\u2015]/g, '-');
    // Supprimer accents
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // Supprimer articles de tête
    s = s.replace(/^(le|la|les|l'|l’|un|une|des|du|au|aux)\s+/, '');
    // Nettoyer ponctuations
    s = s.replace(/[.,;:()]/g, ' ').replace(/\s+/g, ' ').trim();
    return s;
  }

  evaluateAnswer(userInput, item) {
    const rawInput = (userInput || '').trim();
    if (!rawInput) return { status: 'empty' };

    const normInput = this.normalizeString(rawInput);
    const normOfficial = this.normalizeString(item.label);

    // 1. Correspondance exacte avec le terme officiel
    if (normInput === normOfficial) {
      return { status: 'exact', official: item.label };
    }

    // 2. Correspondance avec les variantes acceptées
    const accepted = Array.isArray(item.accepted) ? item.accepted : [];
    for (const acc of accepted) {
      if (this.normalizeString(acc) === normInput) {
        return { status: 'synonym', official: item.label, matched: acc };
      }
    }

    return { status: 'incorrect' };
  }

  /* ------------------------------------------------------------------------
     SYNTHÈSE AUDIO WEB AUDIO API
     ------------------------------------------------------------------------ */
  initAudio() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playSuccessSound() {
    if (!this.soundEnabled) return;
    this.initAudio();
    if (!this.audioCtx) return;

    const t = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, t); // D5
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.12); // A5

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  playErrorSound() {
    if (!this.soundEnabled) return;
    this.initAudio();
    if (!this.audioCtx) return;

    const t = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.setValueAtTime(180, t + 0.08);

    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  playMasteredFanfare() {
    if (!this.soundEnabled) return;
    this.initAudio();
    if (!this.audioCtx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const t = this.audioCtx.currentTime + i * 0.09;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    localStorage.setItem('anatpass_poly_sound', this.soundEnabled.toString());
    this.updateSoundUI();
  }

  updateSoundUI() {
    if (this.soundIconOn && this.soundIconOff) {
      this.soundIconOn.hidden = !this.soundEnabled;
      this.soundIconOff.hidden = this.soundEnabled;
    }
  }

  /* ------------------------------------------------------------------------
     RENDU DU SCHÉMA ACTUEL & QUESTIONS
     ------------------------------------------------------------------------ */
  renderCurrentPlanche() {
    if (this.currentIndex < 0 || this.currentIndex >= this.planches.length) return;
    const planche = this.planches[this.currentIndex];

    // Header updates
    this.headerPlancheNum.textContent = planche.number || `Schéma ${planche.id}`;
    this.headerPlancheTitle.textContent = planche.title;

    // Diagram tags
    if (this.diagramChapterBadge) {
      this.diagramChapterBadge.textContent = planche.chapter ? planche.chapter.toUpperCase() : `CHAPITRE ${planche.chapter_id}`;
    }
    if (this.diagramPageBadge) {
      this.diagramPageBadge.textContent = `Page ${planche.page || '—'}`;
    }

    this.diagramTitle.textContent = `${planche.number || 'Schéma'} : ${planche.title}`;
    const subtitleParts = [planche.section, planche.subsection].filter(Boolean);
    this.diagramSubtitle.textContent = subtitleParts.join(' • ') || planche.chapter || '';

    // Image logic (Original vs Quiz)
    this.updateDiagramImageSrc();

    // Rendu des sections & questions
    this.quizFormContainer.innerHTML = '';
    const sections = planche.sections || [];

    sections.forEach((sec, sIdx) => {
      const secEl = document.createElement('div');
      secEl.className = 'quiz-section';

      if (sec.name && sections.length > 1) {
        const secHeader = document.createElement('div');
        secHeader.className = 'section-header';
        secHeader.innerHTML = `<h3>${sec.name}</h3>`;
        secEl.appendChild(secHeader);
      }

      const itemsList = document.createElement('div');
      itemsList.className = 'section-items-list';

      (sec.items || []).forEach(item => {
        const row = this.createItemRow(item);
        itemsList.appendChild(row);
      });

      secEl.appendChild(itemsList);
      this.quizFormContainer.appendChild(secEl);
    });

    this.updatePlancheScore();
    this.updateDropdownActiveState();
    this.resetZoom();
  }

  updateDiagramImageSrc() {
    const planche = this.planches[this.currentIndex];
    if (!planche) return;

    if (this.viewingOriginal && planche.image_original) {
      this.diagramImg.src = planche.image_original;
      if (this.origSchemaBtnText) this.origSchemaBtnText.textContent = 'Voir le test';
      if (this.toggleOrigSchemaBtn) this.toggleOrigSchemaBtn.classList.add('viewing-original');
    } else {
      this.diagramImg.src = planche.image;
      if (this.origSchemaBtnText) this.origSchemaBtnText.textContent = "Voir l'original";
      if (this.toggleOrigSchemaBtn) this.toggleOrigSchemaBtn.classList.remove('viewing-original');
    }
  }

  toggleOriginalSchema() {
    this.viewingOriginal = !this.viewingOriginal;
    this.updateDiagramImageSrc();
  }

  createItemRow(item) {
    const saved = this.userProgress[item.id] || {};
    const row = document.createElement('div');
    row.className = 'quiz-item-row';
    row.id = `row-${item.id}`;

    // Numéro badge
    const badge = document.createElement('div');
    badge.className = 'item-num-badge';
    badge.textContent = item.num;
    row.appendChild(badge);

    // Conteneur input
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'item-input-wrapper';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'item-input';
    input.id = `input-${item.id}`;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = `Numéro ${item.num}...`;
    input.value = saved.val || '';

    inputWrapper.appendChild(input);

    // Bannière de rappel pour synonyme
    const reminder = document.createElement('div');
    reminder.className = 'item-synonym-reminder';
    reminder.id = `reminder-${item.id}`;
    reminder.hidden = true;
    inputWrapper.appendChild(reminder);

    row.appendChild(inputWrapper);

    // Bouton Révéler (Œil)
    const revealBtn = document.createElement('button');
    revealBtn.type = 'button';
    revealBtn.className = 'item-reveal-btn';
    revealBtn.title = saved.revealed ? 'Masquer la réponse pour s’entraîner' : 'Révéler la légende';
    revealBtn.setAttribute('aria-label', `Révéler la légende ${item.num}`);
    revealBtn.innerHTML = this.getEyeIconSvg(saved.revealed);
    row.appendChild(revealBtn);

    // Événements
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.validateItem(item, row, input, true);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.focusNextInput(input);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.focusPrevInput(input);
      }
    });

    input.addEventListener('input', () => {
      // Évaluation progressive
      const val = input.value.trim();
      if (!val) {
        row.classList.remove('is-correct', 'is-incorrect', 'is-revealed', 'is-synonym');
        reminder.hidden = true;
        delete this.userProgress[item.id];
        this.saveProgress();
        this.updatePlancheScore();
        return;
      }
      const res = this.evaluateAnswer(val, item);
      if (res.status === 'exact' || (this.rigorMode === 'tolerant' && res.status === 'synonym')) {
        this.setItemCorrect(item, row, input, res);
      }
    });

    revealBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.revealItem(item, row, input);
    });

    // Appliquer l'état sauvegardé
    if (saved.revealed) {
      this.setItemRevealed(item, row, input, saved.val || item.label);
    } else if (saved.correct) {
      const res = this.evaluateAnswer(saved.val, item);
      if (res.status === 'exact' || (this.rigorMode === 'tolerant' && res.status === 'synonym')) {
        this.setItemCorrect(item, row, input, res, false);
      }
    }

    return row;
  }

  validateItem(item, row, input, advanceOnSuccess = true) {
    const val = input.value.trim();
    if (!val) return;

    const res = this.evaluateAnswer(val, item);
    const reminder = row.querySelector('.item-synonym-reminder');

    if (res.status === 'exact') {
      this.setItemCorrect(item, row, input, res);
      if (advanceOnSuccess) this.focusNextInput(input);
    } else if (res.status === 'synonym') {
      if (this.rigorMode === 'strict') {
        // En mode strict : avertissement
        row.classList.add('is-synonym');
        row.classList.remove('is-correct', 'is-incorrect');
        if (reminder) {
          reminder.hidden = false;
          reminder.innerHTML = `⚠️ Synonyme reconnu. En mode strict, tapez : <strong>${item.label}</strong>`;
        }
        this.playErrorSound();
      } else {
        // En mode tolérant : validation avec rappel
        this.setItemCorrect(item, row, input, res);
        if (advanceOnSuccess) this.focusNextInput(input);
      }
    } else {
      row.classList.add('is-incorrect');
      row.classList.remove('is-correct', 'is-synonym');
      this.playErrorSound();
      row.classList.add('shake');
      setTimeout(() => row.classList.remove('shake'), 400);
    }
  }

  setItemCorrect(item, row, input, res, triggerEffects = true) {
    row.classList.add('is-correct');
    row.classList.remove('is-incorrect', 'is-synonym', 'is-revealed');
    const reminder = row.querySelector('.item-synonym-reminder');

    if (res.status === 'synonym') {
      if (reminder) {
        reminder.hidden = false;
        reminder.innerHTML = `📖 Réponse acceptée. Terme officiel du polycopié : <strong>${item.label}</strong>`;
      }
    } else {
      if (reminder) reminder.hidden = true;
    }

    this.userProgress[item.id] = { val: input.value.trim(), correct: true, revealed: false };
    this.saveProgress();
    this.updatePlancheScore();
    this.updateGlobalStats();

    if (triggerEffects) {
      this.playSuccessSound();
    }
  }

  getEyeIconSvg(isRevealed = false) {
    if (isRevealed) {
      return `
        <svg viewBox="0 0 20 20" fill="currentColor" class="reveal-eye-icon eye-off">
          <path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd"/>
          <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/>
        </svg>
      `;
    }
    return `
      <svg viewBox="0 0 20 20" fill="currentColor" class="reveal-eye-icon eye-open">
        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
        <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
      </svg>
    `;
  }

  setItemRevealed(item, row, input, valToSet) {
    row.classList.add('is-revealed', 'is-correct');
    row.classList.remove('is-incorrect', 'is-synonym');
    input.value = valToSet || item.label;

    const reminder = row.querySelector('.item-synonym-reminder');
    if (reminder) reminder.hidden = true;

    const revealBtn = row.querySelector('.item-reveal-btn');
    if (revealBtn) {
      revealBtn.innerHTML = this.getEyeIconSvg(true);
      revealBtn.title = 'Masquer la réponse pour s’entraîner';
    }

    this.userProgress[item.id] = { val: input.value, correct: true, revealed: true };
    this.saveProgress();
    this.updatePlancheScore();
    this.updateGlobalStats();
  }

  revealItem(item, row, input) {
    const isCurrentlyRevealed = row.classList.contains('is-revealed');
    if (isCurrentlyRevealed) {
      // Masquer pour permettre à l'étudiant de se retester
      row.classList.remove('is-revealed', 'is-correct', 'is-incorrect', 'is-synonym');
      input.value = '';
      const reminder = row.querySelector('.item-synonym-reminder');
      if (reminder) reminder.hidden = true;

      const revealBtn = row.querySelector('.item-reveal-btn');
      if (revealBtn) {
        revealBtn.innerHTML = this.getEyeIconSvg(false);
        revealBtn.title = 'Révéler la légende';
      }

      delete this.userProgress[item.id];
      this.saveProgress();
      this.updatePlancheScore();
      this.updateGlobalStats();
      input.focus();
    } else {
      // Révéler la légende officielle
      this.setItemRevealed(item, row, input, item.label);
      this.focusNextInput(input);
    }
  }

  revealAllCurrentPlanche() {
    const planche = this.planches[this.currentIndex];
    if (!planche) return;

    (planche.sections || []).forEach(sec => {
      (sec.items || []).forEach(item => {
        const row = document.getElementById(`row-${item.id}`);
        const input = document.getElementById(`input-${item.id}`);
        if (row && input) {
          this.setItemRevealed(item, row, input, item.label);
        }
      });
    });
  }

  resetCurrentPlanche() {
    const planche = this.planches[this.currentIndex];
    if (!planche) return;

    (planche.sections || []).forEach(sec => {
      (sec.items || []).forEach(item => {
        const row = document.getElementById(`row-${item.id}`);
        const input = document.getElementById(`input-${item.id}`);
        if (row && input) {
          input.value = '';
          row.classList.remove('is-correct', 'is-incorrect', 'is-revealed', 'is-synonym');
          const reminder = row.querySelector('.item-synonym-reminder');
          if (reminder) reminder.hidden = true;
          const revealBtn = row.querySelector('.item-reveal-btn');
          if (revealBtn) {
            revealBtn.innerHTML = this.getEyeIconSvg(false);
            revealBtn.title = 'Révéler la légende';
          }
          delete this.userProgress[item.id];
        }
      });
    });

    this.saveProgress();
    this.updatePlancheScore();
    this.updateGlobalStats();

    // Focus premier input
    const firstInput = this.quizFormContainer.querySelector('.item-input');
    if (firstInput) firstInput.focus();
  }

  focusNextInput(currInput) {
    const inputs = Array.from(this.quizFormContainer.querySelectorAll('.item-input'));
    const idx = inputs.indexOf(currInput);
    if (idx !== -1) {
      // Chercher le prochain champ non encore validé
      for (let i = idx + 1; i < inputs.length; i++) {
        const row = inputs[i].closest('.quiz-item-row');
        if (row && !row.classList.contains('is-correct')) {
          inputs[i].focus();
          return;
        }
      }
      if (idx + 1 < inputs.length) {
        inputs[idx + 1].focus();
      }
    }
  }

  focusPrevInput(currInput) {
    const inputs = Array.from(this.quizFormContainer.querySelectorAll('.item-input'));
    const idx = inputs.indexOf(currInput);
    if (idx > 0) {
      inputs[idx - 1].focus();
    }
  }

  /* ------------------------------------------------------------------------
     SCORES & STATISTIQUES
     ------------------------------------------------------------------------ */
  updatePlancheScore() {
    const planche = this.planches[this.currentIndex];
    if (!planche) return;

    let total = 0;
    let correct = 0;

    (planche.sections || []).forEach(sec => {
      (sec.items || []).forEach(item => {
        total++;
        if (this.userProgress[item.id]?.correct) {
          correct++;
        }
      });
    });

    this.plancheScoreVal.textContent = correct;
    this.plancheTotalVal.textContent = total;

    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    this.plancheProgressFill.style.width = `${pct}%`;

    // Badge d'état
    this.plancheStatusBadge.className = 'status-badge';
    if (pct === 100) {
      this.plancheStatusBadge.classList.add('status-mastered');
      this.plancheStatusBadge.textContent = 'Maîtrisé 100%';
    } else if (pct > 0) {
      this.plancheStatusBadge.classList.add('status-in-progress');
      this.plancheStatusBadge.textContent = `${pct}%`;
    } else {
      this.plancheStatusBadge.classList.add('status-empty');
      this.plancheStatusBadge.textContent = 'Non commencé';
    }
  }

  updateGlobalStats() {
    let totalPlanches = this.planches.length;
    let masteredPlanches = 0;
    let inProgressPlanches = 0;
    let totalTermsFound = 0;

    const chapterStats = {};

    this.planches.forEach(p => {
      const chName = p.chapter || `Chapitre ${p.chapter_id}`;
      if (!chapterStats[chName]) {
        chapterStats[chName] = { total: 0, mastered: 0, itemsTotal: 0, itemsFound: 0 };
      }
      chapterStats[chName].total++;

      let pTotal = 0;
      let pCorrect = 0;

      (p.sections || []).forEach(sec => {
        (sec.items || []).forEach(item => {
          pTotal++;
          chapterStats[chName].itemsTotal++;
          if (this.userProgress[item.id]?.correct) {
            pCorrect++;
            totalTermsFound++;
            chapterStats[chName].itemsFound++;
          }
        });
      });

      if (pTotal > 0 && pCorrect === pTotal) {
        masteredPlanches++;
        chapterStats[chName].mastered++;
      } else if (pCorrect > 0) {
        inProgressPlanches++;
      }
    });

    const globalPct = totalPlanches > 0 ? Math.round((masteredPlanches / totalPlanches) * 100) : 0;

    if (this.globalPercentText) this.globalPercentText.textContent = `${globalPct}%`;
    if (this.globalMasteredText) this.globalMasteredText.textContent = `${masteredPlanches} / ${totalPlanches} maîtrisés`;
    if (this.globalRingFill) {
      this.globalRingFill.setAttribute('stroke-dasharray', `${globalPct}, 100`);
    }

    // Modal KPIs
    if (this.statsTotalPlanches) this.statsTotalPlanches.textContent = totalPlanches;
    if (this.statsMasteredPlanches) this.statsMasteredPlanches.textContent = masteredPlanches;
    if (this.statsInProgressPlanches) this.statsInProgressPlanches.textContent = inProgressPlanches;
    if (this.statsTotalTermsFound) this.statsTotalTermsFound.textContent = totalTermsFound;

    // Breakdown par chapitre
    if (this.chapterStatsBreakdown) {
      this.chapterStatsBreakdown.innerHTML = '';
      for (const [chName, cData] of Object.entries(chapterStats)) {
        const pct = cData.itemsTotal > 0 ? Math.round((cData.itemsFound / cData.itemsTotal) * 100) : 0;
        const row = document.createElement('div');
        row.className = 'chapter-stat-row';
        row.innerHTML = `
          <div class="chapter-stat-info">
            <span class="chapter-stat-name">${chName}</span>
          </div>
          <div class="chapter-stat-bar-box">
            <div class="chapter-stat-track">
              <div class="chapter-stat-fill" style="width: ${pct}%"></div>
            </div>
            <span class="chapter-stat-pct">${pct}%</span>
          </div>
        `;
        this.chapterStatsBreakdown.appendChild(row);
      }
    }
  }

  /* ------------------------------------------------------------------------
     NAVIGATION & MENU DÉROULANT DES PLANCHES
     ------------------------------------------------------------------------ */
  goToPlanche(idx) {
    if (idx < 0 || idx >= this.planches.length) return;
    this.currentIndex = idx;
    this.saveProgress();
    this.renderCurrentPlanche();
    this.closeDropdown();
  }

  renderDropdownList() {
    this.plancheList.innerHTML = '';
    const q = (this.dropdownSearchInput?.value || '').toLowerCase().trim();

    let filtered = this.planches.filter(p => {
      // Filtre chapitre
      if (this.currentChapterFilter !== 'all') {
        if (p.chapter_id.toString() !== this.currentChapterFilter.toString()) {
          return false;
        }
      }
      // Recherche textuelle
      if (q) {
        const inNum = (p.number || '').toLowerCase().includes(q);
        const inTitle = (p.title || '').toLowerCase().includes(q);
        const inChap = (p.chapter || '').toLowerCase().includes(q);
        const inSec = (p.section || '').toLowerCase().includes(q);
        const inSub = (p.subsection || '').toLowerCase().includes(q);
        const inItems = (p.sections || []).some(s =>
          (s.items || []).some(it => (it.label || '').toLowerCase().includes(q))
        );
        return inNum || inTitle || inChap || inSec || inSub || inItems;
      }
      return true;
    });

    if (filtered.length === 0) {
      this.plancheList.innerHTML = '<div class="dropdown-empty">Aucun schéma correspondant</div>';
      return;
    }

    // Regrouper par chapitre
    let lastChapter = null;

    filtered.forEach(p => {
      if (p.chapter && p.chapter !== lastChapter && this.currentChapterFilter === 'all') {
        const header = document.createElement('div');
        header.className = 'dropdown-chapter-header';
        header.textContent = p.chapter;
        this.plancheList.appendChild(header);
        lastChapter = p.chapter;
      }

      const itemEl = document.createElement('button');
      itemEl.type = 'button';
      itemEl.className = 'planche-list-item';
      if (this.planches.indexOf(p) === this.currentIndex) {
        itemEl.classList.add('active');
      }

      // Calcul état
      let pTotal = 0;
      let pCorrect = 0;
      (p.sections || []).forEach(sec => {
        (sec.items || []).forEach(it => {
          pTotal++;
          if (this.userProgress[it.id]?.correct) pCorrect++;
        });
      });

      let statusIcon = '⚪';
      if (pTotal > 0 && pCorrect === pTotal) statusIcon = '🟢';
      else if (pCorrect > 0) statusIcon = '🟡';

      itemEl.innerHTML = `
        <span class="item-status-icon">${statusIcon}</span>
        <div class="item-meta">
          <strong class="item-num">${p.number || `Schéma ${p.id}`} <span class="item-page-badge">p.${p.page}</span></strong>
          <span class="item-title truncate">${p.title}</span>
        </div>
        <span class="item-score">${pCorrect}/${pTotal}</span>
      `;

      itemEl.addEventListener('click', () => {
        const realIdx = this.planches.indexOf(p);
        this.goToPlanche(realIdx);
      });

      this.plancheList.appendChild(itemEl);
    });
  }

  updateDropdownActiveState() {
    const items = this.plancheList.querySelectorAll('.planche-list-item');
    items.forEach((item, idx) => {
      item.classList.toggle('active', idx === this.currentIndex);
    });
  }

  toggleDropdown() {
    const isOpen = this.plancheDropdownMenu.classList.contains('is-open');
    if (isOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  openDropdown() {
    this.plancheDropdownMenu.classList.add('is-open');
    this.plancheDropdownMenu.hidden = false;
    this.plancheDropdownBtn.setAttribute('aria-expanded', 'true');
    if (this.dropdownSearchInput) {
      setTimeout(() => this.dropdownSearchInput.focus(), 80);
    }
  }

  closeDropdown() {
    if (!this.plancheDropdownMenu) return;
    this.plancheDropdownMenu.classList.remove('is-open');
    this.plancheDropdownMenu.hidden = true;
    this.plancheDropdownBtn.setAttribute('aria-expanded', 'false');
  }

  /* ------------------------------------------------------------------------
     ZOOM & PAN DU SCHÉMA
     ------------------------------------------------------------------------ */
  applyTransform() {
    this.diagramCanvas.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
    if (this.zoomLevelText) {
      this.zoomLevelText.textContent = `${Math.round(this.zoom * 100)}%`;
    }
  }

  zoomAtPoint(delta, clientX, clientY) {
    const rect = this.diagramViewport.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const oldZoom = this.zoom;
    let newZoom = oldZoom * delta;
    newZoom = Math.min(Math.max(newZoom, 0.4), 6.0);

    const ratio = newZoom / oldZoom;
    this.panX = x - (x - this.panX) * ratio;
    this.panY = y - (y - this.panY) * ratio;
    this.zoom = newZoom;

    this.applyTransform();
  }

  resetZoom() {
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.applyTransform();
  }

  /* ------------------------------------------------------------------------
     ÉVÉNEMENTS UTILISATEURS
     ------------------------------------------------------------------------ */
  initEvents() {
    // Menu déroulant des planches
    this.plancheDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDropdown();
    });

    document.addEventListener('click', (e) => {
      if (!this.plancheDropdownMenu.contains(e.target) && !this.plancheDropdownBtn.contains(e.target)) {
        this.closeDropdown();
      }
    });

    this.dropdownSearchInput?.addEventListener('input', () => {
      this.renderDropdownList();
    });

    // Filtres par Chapitre
    const chips = this.chapterChipsBar?.querySelectorAll('.chapter-chip');
    chips?.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.currentChapterFilter = chip.getAttribute('data-chapter');
        this.renderDropdownList();
      });
    });

    // Bascule Schéma Original vs Quiz
    this.toggleOrigSchemaBtn?.addEventListener('click', () => {
      this.toggleOriginalSchema();
    });

    // Contrôles de Rigueur
    this.btnModeStrict?.addEventListener('click', () => this.setRigorMode('strict'));
    this.btnModeTolerant?.addEventListener('click', () => this.setRigorMode('tolerant'));

    // Son & Aide
    this.toggleSoundBtn?.addEventListener('click', () => this.toggleSound());
    this.toggleHelpBtn?.addEventListener('click', () => {
      this.helpModal.hidden = false;
    });
    this.closeHelpBtn?.addEventListener('click', () => {
      this.helpModal.hidden = true;
    });

    // Stats
    this.openStatsBtn?.addEventListener('click', () => {
      this.updateGlobalStats();
      this.statsModal.hidden = false;
    });
    this.closeStatsBtn?.addEventListener('click', () => {
      this.statsModal.hidden = true;
    });

    // Navigation Précédent / Suivant
    const goPrev = () => this.goToPlanche(this.currentIndex - 1);
    const goNext = () => this.goToPlanche(this.currentIndex + 1);

    this.prevPlancheBtn?.addEventListener('click', goPrev);
    this.nextPlancheBtn?.addEventListener('click', goNext);
    this.prevPlancheHeaderBtn?.addEventListener('click', goPrev);
    this.nextPlancheHeaderBtn?.addEventListener('click', goNext);

    // Actions Quiz
    this.revealAllBtn?.addEventListener('click', () => this.revealAllCurrentPlanche());
    this.resetPlancheBtn?.addEventListener('click', () => this.resetCurrentPlanche());

    // Switcher Mode Vue (Schéma / Partagé / Test)
    this.viewModeBtns?.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-view');
        this.viewModeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.workspaceContainer.setAttribute('data-view', mode);
      });
    });

    // Zoom & Pan Souris
    this.zoomInBtn?.addEventListener('click', () => {
      const rect = this.diagramViewport.getBoundingClientRect();
      this.zoomAtPoint(1.25, rect.left + rect.width / 2, rect.top + rect.height / 2);
    });

    this.zoomOutBtn?.addEventListener('click', () => {
      const rect = this.diagramViewport.getBoundingClientRect();
      this.zoomAtPoint(0.8, rect.left + rect.width / 2, rect.top + rect.height / 2);
    });

    this.zoomResetBtn?.addEventListener('click', () => this.resetZoom());

    this.fullscreenBtn?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        this.diagramViewport.requestFullscreen?.() || this.workspaceContainer.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    });

    this.diagramViewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.15 : 0.87;
      this.zoomAtPoint(delta, e.clientX, e.clientY);
    }, { passive: false });

    this.diagramViewport.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isPanning = true;
        this.startX = e.clientX - this.panX;
        this.startY = e.clientY - this.panY;
        this.diagramViewport.classList.add('panning');
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        this.panX = e.clientX - this.startX;
        this.panY = e.clientY - this.startY;
        this.applyTransform();
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isPanning) {
        this.isPanning = false;
        this.diagramViewport.classList.remove('panning');
      }
    });

    // Touch events pour tablettes (Pinch to zoom + Pan)
    let touchDist = 0;
    let initialZoom = 1;
    let touchStartX = 0;
    let touchStartY = 0;
    let initPanX = 0;
    let initPanY = 0;

    this.diagramViewport.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        initPanX = this.panX;
        initPanY = this.panY;
      } else if (e.touches.length === 2) {
        touchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialZoom = this.zoom;
      }
    }, { passive: true });

    this.diagramViewport.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - touchStartX;
        const dy = e.touches[0].clientY - touchStartY;
        this.panX = initPanX + dx;
        this.panY = initPanY + dy;
        this.applyTransform();
      } else if (e.touches.length === 2 && touchDist > 0) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const scale = dist / touchDist;
        this.zoom = Math.min(Math.max(initialZoom * scale, 0.4), 6.0);
        this.applyTransform();
      }
    }, { passive: false });

    // Raccourcis Clavier
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeDropdown();
        this.statsModal.hidden = true;
        this.helpModal.hidden = true;
        return;
      }
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === ' ' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        this.resetZoom();
      }
    });
  }
}

// Initialisation au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
  window.anatPass = new AnatPassApp();
});
