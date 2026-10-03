(() => {
  const vscode = acquireVsCodeApi();
  const scoreSheet = document.getElementById("score-sheet");
  const status = document.getElementById("status");
  const deleteButton = document.getElementById("remove-note");
  const previewButton = document.getElementById("preview-score");
  const exportPdfButton = document.getElementById("export-pdf");
  const playButton = document.getElementById("play-score");
  const playIcon = document.getElementById("play-icon");
  const noteTool = document.getElementById("note-tool");
  const restTool = document.getElementById("rest-tool");
  const spacerTool = document.getElementById("spacer-tool");
  const dottedTool = document.getElementById("dotted-tool");
  const accidentalTool = document.getElementById("accidental-tool");
  const timeSignatureTool = document.getElementById("time-signature");
  const keySignatureTool = document.getElementById("key-signature");
  const tempoTool = document.getElementById("tempo");
  const durationButtons = [...document.querySelectorAll(".duration")];
  const staffStep = 10;
  const staffLeft = 58;
  const staffRight = 13;
  const minimumMeasureWidth = 145;
  const pageSystemsHeight = 970;
  const restSymbols = { 1: "𝄻", 2: "𝄼", 4: "𝄽", 8: "𝄾", 16: "𝄿" };
  let selectedDuration = 4;
  let selectedNoteId;
  let draggingNoteId;
  let draggingStaffTop;
  let draggingStaffBottom;
  let selectedTool = "note";
  let selectedDotted = false;
  let selectedAccidental;
  let previewTimer;
  let playbackContext;
  let playbackOscillators = [];
  let playbackTimer;
  let playbackAnimationFrame;
  let playbackTimeline = [];
  let activePlaybackEventId;
  let loaded = false;
  let score = {
    schemaVersion: 1,
    title: "",
    tempo: 100,
    timeSignature: "4/4",
    keySignature: "C major",
    notes: []
  };

  function announceChange() {
    if (playbackContext) {
      stopPlayback("乐谱已更改，播放已停止");
    }
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(() => {
      vscode.postMessage({ type: "scoreChanged", score });
    }, 100);
  }

  function getPitchRange(measures) {
    const pitches = measures
      .flatMap((measure) => measure.events)
      .filter((event) => !event.type || event.type === "note")
      .map((event) => event.diatonicStep);
    return pitches.length
      ? { lowest: Math.min(...pitches), highest: Math.max(...pitches) }
      : { lowest: 0, highest: 0 };
  }

  function getSystemGeometry(measures) {
    const { lowest, highest } = getPitchRange(measures);
    const upperOffset = Math.max(98, highest * staffStep + 32);
    const lowerOffset = Math.max(0, -lowest * staffStep + 22);
    const height = Math.max(180, 10 + upperOffset + lowerOffset + 10);
    return { staffBottom: 10 + upperOffset, height };
  }

  function keyAlterations() {
    const alterations = {
      "C major": {},
      "G major": { f: 1 },
      "D major": { f: 1, c: 1 },
      "F major": { b: -1 },
      "Bb major": { b: -1, e: -1 },
      "A minor": {},
      "E minor": { f: 1 },
      "D minor": { b: -1 }
    };
    return alterations[score.keySignature] ?? {};
  }

  function getMidiPitch(note, measureAccidentals) {
    const diatonicIndex = 30 + note.diatonicStep;
    const octave = Math.floor(diatonicIndex / 7);
    const letter = ["c", "d", "e", "f", "g", "a", "b"][
      ((diatonicIndex % 7) + 7) % 7
    ];
    const naturalSemitones = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
    const pitchKey = `${letter}${octave}`;
    if (note.accidental !== undefined) {
      measureAccidentals.set(pitchKey, note.accidental);
    }
    const accidental =
      measureAccidentals.get(pitchKey) ?? keyAlterations()[letter] ?? 0;
    return 12 * (octave + 1) + naturalSemitones[letter] + accidental;
  }

  function playPianoNote(midiPitch, startTime, duration) {
    const context = playbackContext;
    if (!context) {
      return;
    }
    const fundamental = 440 * 2 ** ((midiPitch - 69) / 12);
    const partials = [1, 0.52, 0.28, 0.16, 0.1, 0.065, 0.04, 0.025];
    partials.forEach((strength, index) => {
      const harmonic = index + 1;
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value =
        fundamental * harmonic * (1 + 0.00008 * harmonic * harmonic);
      envelope.gain.setValueAtTime(0.0001, startTime);
      envelope.gain.exponentialRampToValueAtTime(
        strength * 0.09,
        startTime + 0.009
      );
      const decayEnd =
        startTime + Math.max(0.08, Math.min(2.4, duration * (0.92 / harmonic ** 0.42)));
      envelope.gain.exponentialRampToValueAtTime(0.0001, decayEnd);
      oscillator.connect(envelope);
      envelope.connect(context.destination);
      oscillator.onended = () => {
        playbackOscillators = playbackOscillators.filter(
          (item) => item !== oscillator
        );
        oscillator.disconnect();
        envelope.disconnect();
      };
      playbackOscillators.push(oscillator);
      oscillator.start(startTime);
      oscillator.stop(decayEnd + 0.03);
    });
  }

  function stopPlayback(message = "") {
    window.clearTimeout(playbackTimer);
    window.cancelAnimationFrame(playbackAnimationFrame);
    playbackTimer = undefined;
    playbackAnimationFrame = undefined;
    playbackTimeline = [];
    setActivePlaybackEvent(undefined);
    const context = playbackContext;
    playbackContext = undefined;
    playbackOscillators.forEach((oscillator) => oscillator.stop());
    playbackOscillators = [];
    if (context && context.state !== "closed") {
      void context.close().catch((error) => {
        status.textContent = `关闭音频设备失败：${error.message}`;
      });
    }
    playIcon.textContent = "▶";
    playButton.setAttribute("aria-label", "播放当前乐谱");
    playButton.title = "播放当前乐谱";
    playButton.setAttribute("aria-pressed", "false");
    if (message) {
      status.textContent = message;
    }
  }

  function setActivePlaybackEvent(id) {
    if (activePlaybackEventId === id) {
      return;
    }
    activePlaybackEventId = id;
    scoreSheet.querySelectorAll(".score-item.playing").forEach((item) => {
      item.classList.remove("playing");
    });
    if (!id) {
      return;
    }
    const item = scoreSheet.querySelector(
      `[data-note-id="${CSS.escape(id)}"]`
    );
    if (!item) {
      return;
    }
    item.classList.add("playing");
    const bounds = item.getBoundingClientRect();
    if (bounds.top < 0 || bounds.bottom > window.innerHeight) {
      item.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function updatePlaybackProgress() {
    const context = playbackContext;
    if (!context || playbackTimeline.length === 0) {
      return;
    }
    const now = context.currentTime;
    const currentIndex = playbackTimeline.findIndex(
      (event) => now >= event.start && now < event.end
    );
    if (currentIndex >= 0) {
      const current = playbackTimeline[currentIndex];
      setActivePlaybackEvent(current.id);
      const percent = Math.min(
        100,
        Math.floor(((now - current.start) / (current.end - current.start)) * 100)
      );
      status.textContent = `正在播放 · 第 ${current.index + 1}/${playbackTimeline.length} 个音符/休止符/空白符 · ${percent}% · ${score.tempo} BPM`;
    } else if (now >= playbackTimeline[playbackTimeline.length - 1].end) {
      setActivePlaybackEvent(undefined);
      status.textContent = "乐谱播放完毕，钢琴音色尾音仍在延续…";
    } else {
      status.textContent = "乐谱即将开始…";
    }
    playbackAnimationFrame = window.requestAnimationFrame(
      updatePlaybackProgress
    );
  }

  async function startPlayback() {
    if (!score.notes.length) {
      return;
    }
    const AudioContextConstructor =
      window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextConstructor) {
      status.textContent = "当前 VS Code 不支持 Web Audio，无法播放乐谱。";
      return;
    }

    try {
      const context = new AudioContextConstructor();
      playbackContext = context;
      playIcon.textContent = "…";
      playButton.setAttribute("aria-label", "正在启动播放");
      playButton.setAttribute("aria-pressed", "true");
      await context.resume();
      if (playbackContext !== context) {
        return;
      }
      let cursor = context.currentTime + 0.06;
      const timeline = [];
      let eventIndex = 0;
      for (const measure of groupMeasures()) {
        const measureAccidentals = new Map();
        for (const event of measure.events) {
          const duration = (eventTicks(event) / 4) * (60 / score.tempo);
          const start = cursor;
          const end = start + duration;
          if (!event.type || event.type === "note") {
            playPianoNote(
              getMidiPitch(event, measureAccidentals),
              start,
              duration
            );
          }
          timeline.push({ id: event.id, index: eventIndex, start, end });
          eventIndex += 1;
          cursor += duration;
        }
      }
      playbackTimeline = timeline;
      playbackAnimationFrame = window.requestAnimationFrame(
        updatePlaybackProgress
      );
      playIcon.textContent = "■";
      playButton.setAttribute("aria-label", "停止播放");
      playButton.title = "停止播放";
      playButton.setAttribute("aria-pressed", "true");
      playbackTimer = window.setTimeout(
        () => stopPlayback("播放完成"),
        (cursor - context.currentTime + 2.5) * 1000
      );
    } catch (error) {
      stopPlayback();
      status.textContent = `无法播放乐谱：${
        error instanceof Error ? error.message : "音频设备不可用。"
      }`;
    }
  }

  function selectScoreEvent(id) {
    const selected = score.notes.find((event) => event.id === id);
    if (!selected) {
      return;
    }
    selectedNoteId = selected.id;
    selectedDuration = selected.duration;
    selectedDotted = Boolean(selected.dotted);
    selectedAccidental = selected.accidental;
    setSelectedTool(
      selected.type === "rest"
        ? "rest"
        : selected.type === "spacer"
          ? "spacer"
          : "note"
    );
    durationButtons.forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(Number(button.dataset.duration) === selectedDuration)
      );
    });
  }

  function eventTicks(event) {
    const ticks = 16 / event.duration;
    return event.dotted ? ticks * 1.5 : ticks;
  }

  function getMeasureCapacity() {
    const [numerator, denominator] = score.timeSignature.split("/").map(Number);
    return numerator * (16 / denominator);
  }

  function groupMeasures() {
    const capacity = getMeasureCapacity();
    const measures = [{ events: [], startIndex: 0 }];
    let elapsed = 0;

    score.notes.forEach((event, index) => {
      const ticks = eventTicks(event);
      if (elapsed > 0 && elapsed + ticks > capacity) {
        measures.push({ events: [], startIndex: index });
        elapsed = 0;
      }
      measures[measures.length - 1].events.push(event);
      elapsed += ticks;
      if (elapsed >= capacity && index < score.notes.length - 1) {
        measures.push({ events: [], startIndex: index + 1 });
        elapsed = 0;
      }
    });
    return measures;
  }

  function staffPosition(clientY, bounds, staffBottom) {
    return Math.max(
      -9,
      Math.min(
        14,
        Math.round((staffBottom - (clientY - bounds.top)) / staffStep)
      )
    );
  }

  function makeScoreItem(event, index) {
    const isRest = event.type === "rest";
    const isSpacer = event.type === "spacer";
    const button = document.createElement("button");
    button.type = "button";
    button.className = `score-item${isRest ? " rest" : ""}${
      isSpacer ? " spacer" : ""
    }${
      event.id === selectedNoteId ? " selected" : ""
    }`;
    button.dataset.noteId = event.id;
    button.dataset.duration = String(event.duration);
    button.dataset.eventIndex = String(index);
    if (event.dotted) {
      button.dataset.dotted = "true";
    }
    button.setAttribute("aria-pressed", String(event.id === selectedNoteId));

    if (isSpacer) {
      button.setAttribute(
        "aria-label",
        `空白符，时值 1/${event.duration}${event.dotted ? " 附点" : ""}`
      );
      const marker = document.createElement("span");
      marker.className = "spacer-mark";
      marker.textContent = "·";
      marker.setAttribute("aria-hidden", "true");
      button.append(marker);
    } else if (isRest) {
      button.setAttribute(
        "aria-label",
        `休止符，时值 1/${event.duration}${event.dotted ? " 附点" : ""}`
      );
      const symbol = document.createElement("span");
      symbol.className = "note-rest";
      symbol.textContent = restSymbols[event.duration];
      button.append(symbol);
    } else {
      button.setAttribute(
        "aria-label",
        `音符 ${index + 1}，音高位置 ${event.diatonicStep}，时值 1/${
          event.duration
        }${event.dotted ? " 附点" : ""}`
      );
      const notehead = document.createElement("span");
      notehead.className = "notehead";
      button.append(notehead);

      const stem = document.createElement("span");
      stem.className = "note-stem";
      stem.setAttribute("aria-hidden", "true");
      button.append(stem);

      const flag = document.createElement("span");
      flag.className = "note-flag";
      flag.setAttribute("aria-hidden", "true");
      button.append(flag);

      if (event.accidental !== undefined) {
        const accidental = document.createElement("span");
        accidental.className = "note-accidental";
        accidental.textContent =
          event.accidental === 1
            ? "♯"
            : event.accidental === -1
              ? "♭"
              : "♮";
        accidental.setAttribute("aria-hidden", "true");
        button.append(accidental);
      }

      for (
        let ledgerStep = 2;
        event.diatonicStep <= -ledgerStep;
        ledgerStep += 2
      ) {
        const line = document.createElement("span");
        line.className = "ledger-line";
        line.style.top = `${
          (event.diatonicStep + ledgerStep) * staffStep + 6
        }px`;
        button.append(line);
      }
      for (
        let ledgerStep = 2;
        event.diatonicStep >= 10 + ledgerStep;
        ledgerStep += 2
      ) {
        const line = document.createElement("span");
        line.className = "ledger-line";
        line.style.top = `${
          (event.diatonicStep - 10 - ledgerStep) * staffStep + 6
        }px`;
        button.append(line);
      }
    }

    if (event.dotted) {
      const dot = document.createElement("span");
      dot.className = "note-dot";
      dot.textContent = "·";
      dot.setAttribute("aria-hidden", "true");
      button.append(dot);
    }
    return button;
  }

  function renderSystem(
    measures,
    firstEventIndex,
    firstMeasureIndex,
    systemIndex,
    showSignature,
    availableWidth
  ) {
    const { staffBottom, height } = getSystemGeometry(measures);
    const system = document.createElement("div");
    system.className = "staff-system";
    system.style.height = `${height}px`;
    system.dataset.staffBottom = String(staffBottom);
    system.dataset.startIndex = String(firstEventIndex);
    system.dataset.measureStart = String(firstMeasureIndex);
    system.dataset.measureCount = String(measures.length);
    system.setAttribute("aria-label", `第 ${systemIndex + 1} 行乐谱`);

    const clef = document.createElement("span");
    clef.className = "clef";
    clef.style.top = `${staffBottom - 55}px`;
    clef.setAttribute("aria-hidden", "true");
    clef.textContent = "𝄞";
    system.append(clef);

    const lines = document.createElement("div");
    lines.className = "staff-lines";
    lines.style.top = `${staffBottom - 80}px`;
    lines.setAttribute("aria-hidden", "true");
    system.append(lines);

    if (showSignature) {
      const signature = document.createElement("div");
      signature.className = "measure-signature";
      signature.textContent = `${score.keySignature} · ${score.timeSignature}`;
      system.append(signature);
    }

    const staffWidth = Math.max(200, availableWidth - staffLeft - staffRight);
    const widthPerMeasure = staffWidth / measures.length;
    let localStart = firstEventIndex;

    measures.forEach((measure, measureIndex) => {
      if (measureIndex > 0) {
        const barline = document.createElement("span");
        barline.className = "barline";
        barline.style.top = `${staffBottom - 80}px`;
        barline.style.height = "81px";
        barline.style.left = `${staffLeft + widthPerMeasure * measureIndex}px`;
        barline.setAttribute("aria-hidden", "true");
        system.append(barline);
      }

      measure.events.forEach((event, eventIndex) => {
        const noteCenter =
          staffLeft +
          widthPerMeasure * measureIndex +
          widthPerMeasure * ((eventIndex + 0.5) / measure.events.length);
        const element = makeScoreItem(event, localStart + eventIndex);
        element.style.left = `${noteCenter - 13}px`;
        element.style.top = `${
          event.type === "rest" || event.type === "spacer"
          ? Number(system.dataset.staffBottom) - 47
          : Number(system.dataset.staffBottom) -
            event.diatonicStep * staffStep -
            8
        }px`;
        system.append(element);
      });
      localStart += measure.events.length;
    });
    return system;
  }

  function render() {
    scoreSheet.replaceChildren();
    timeSignatureTool.value = score.timeSignature;
    keySignatureTool.value = score.keySignature;
    tempoTool.value = String(score.tempo);
    const selected = score.notes.find((event) => event.id === selectedNoteId);
    accidentalTool.value = String(
      selected?.accidental ?? selectedAccidental ?? "none"
    );
    dottedTool.setAttribute("aria-pressed", String(selectedDotted));

    const measures = groupMeasures();
    const page = document.createElement("div");
    page.className = "score-page";
    scoreSheet.append(page);
    const pageTitle = document.createElement("input");
    pageTitle.className = "score-title";
    pageTitle.type = "text";
    pageTitle.maxLength = 200;
    pageTitle.value = score.title;
    pageTitle.placeholder = "点击输入乐谱标题";
    pageTitle.setAttribute("aria-label", "乐谱标题");
    pageTitle.addEventListener("input", () => {
      score.title = pageTitle.value;
    });
    pageTitle.addEventListener("change", () => {
      score.title = pageTitle.value;
      announceChange();
    });
    pageTitle.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        pageTitle.blur();
      }
    });
    page.append(pageTitle);
    const systemsContainer = document.createElement("div");
    systemsContainer.className = "page-systems";
    page.append(systemsContainer);
    const availableWidth = systemsContainer.clientWidth;
    const measuresPerSystem = Math.max(
      1,
      Math.floor(
        Math.max(200, availableWidth - staffLeft - staffRight) /
          minimumMeasureWidth
      )
    );
    const systems = [];
    for (let start = 0; start < measures.length; start += measuresPerSystem) {
      const systemMeasures = measures.slice(start, start + measuresPerSystem);
      while (systemMeasures.length < measuresPerSystem) {
        systemMeasures.push({ events: [], startIndex: score.notes.length });
      }
      systems.push({
        start,
        measures: systemMeasures,
        geometry: getSystemGeometry(systemMeasures)
      });
    }
    const pages = [{ page, systemsContainer, systems: [], height: 0 }];
    systems.forEach((systemData) => {
      let currentPage = pages[pages.length - 1];
      let nextHeight =
        systemData.geometry.height + (currentPage.systems.length > 0 ? 8 : 0);
      if (
        currentPage.height + nextHeight > pageSystemsHeight &&
        currentPage.systems.length > 0
      ) {
        const nextPage = document.createElement("div");
        nextPage.className = "score-page";
        const nextSystems = document.createElement("div");
        nextSystems.className = "page-systems";
        nextPage.append(nextSystems);
        scoreSheet.append(nextPage);
        currentPage = {
          page: nextPage,
          systemsContainer: nextSystems,
          systems: [],
          height: 0
        };
        pages.push(currentPage);
        nextHeight = systemData.geometry.height;
      }
      currentPage.systems.push(systemData);
      currentPage.height += nextHeight;
    });

    const blankMeasure = { events: [], startIndex: score.notes.length };
    const blankGeometry = getSystemGeometry([blankMeasure]);
    let nextFillerMeasureStart = systems.length * measuresPerSystem;
    pages.forEach((currentPage, pageIndex) => {
      while (
        currentPage.height +
          blankGeometry.height +
          (currentPage.systems.length > 0 ? 8 : 0) <=
        pageSystemsHeight
      ) {
        currentPage.systems.push({
          start: nextFillerMeasureStart,
          measures: Array.from({ length: measuresPerSystem }, () => ({
            ...blankMeasure
          })),
          geometry: blankGeometry,
          editable: pageIndex === pages.length - 1
        });
        nextFillerMeasureStart += measuresPerSystem;
        currentPage.height +=
          blankGeometry.height + (currentPage.systems.length > 1 ? 8 : 0);
      }
    });

    pages.forEach((currentPage) => {
      currentPage.systems.forEach((systemData, index) => {
        const firstEventIndex = systemData.measures[0]?.startIndex ?? 0;
        const system = renderSystem(
          systemData.measures,
          firstEventIndex,
          systemData.start,
          index,
          index === 0,
          currentPage.systemsContainer.clientWidth
        );
        if (systemData.editable === false) {
          system.dataset.editable = "false";
        }
        currentPage.systemsContainer.append(system);
      });
    });

    scoreSheet.querySelectorAll(".score-page").forEach((scorePage, index) => {
      const pageNumber = document.createElement("div");
      pageNumber.className = "page-number";
      pageNumber.textContent = `${index + 1}`;
      pageNumber.setAttribute("aria-label", `第 ${index + 1} 页`);
      scorePage.append(pageNumber);
    });

    const actualSystems = scoreSheet.querySelectorAll(".staff-system");
    if (actualSystems.length === 0) {
      playButton.disabled = true;
    }

    const measureCount = measures.length;
    const pageCount = scoreSheet.querySelectorAll(".score-page").length;
    const restCount = score.notes.filter((event) => event.type === "rest").length;
    const spacerCount = score.notes.filter((event) => event.type === "spacer").length;
    const noteCount = score.notes.length - restCount - spacerCount;
    deleteButton.disabled = !selectedNoteId;
    playButton.disabled = !loaded || score.notes.length === 0;
    status.textContent = !loaded
      ? "正在载入乐谱…"
      : `${noteCount} 个音符 · ${restCount} 个休止符 · ${spacerCount} 个空白符 · ${measureCount} 小节 · ${pageCount} 页`;
  }

  function addEvent(clientX, clientY, system) {
    const systemBounds = system.getBoundingClientRect();
    const systemMeasures = Number(system.dataset.measureCount);
    const measureStart = Number(system.dataset.measureStart);
    const availableWidth = Math.max(200, system.clientWidth - staffLeft - staffRight);
    const widthPerMeasure = availableWidth / systemMeasures;
    const localX = clientX - systemBounds.left - staffLeft;
    const measureIndex = Math.max(
      0,
      Math.min(systemMeasures - 1, Math.floor(localX / widthPerMeasure))
    );
    const targetMeasureIndex = measureStart + measureIndex;
    let measures = groupMeasures();
    const originalMeasureCount = measures.length;
    while (measures.length <= targetMeasureIndex) {
      const lastMeasure = measures[measures.length - 1];
      const elapsed = lastMeasure.events.reduce(
        (ticks, event) => ticks + eventTicks(event),
        0
      );
      const ticksToAdd =
        elapsed < getMeasureCapacity()
          ? getMeasureCapacity() - elapsed
          : Math.min(16, getMeasureCapacity());
      appendSpacerEvents(ticksToAdd);
      measures = groupMeasures();
    }
    let measure = measures[targetMeasureIndex];
    if (targetMeasureIndex >= originalMeasureCount) {
      const placeholderIds = new Set(
        measure.events
          .filter((event) => event.type === "spacer")
          .map((event) => event.id)
      );
      score.notes = score.notes.filter((event) => !placeholderIds.has(event.id));
      measures = groupMeasures();
      measure = measures[targetMeasureIndex] ?? {
        events: [],
        startIndex: score.notes.length
      };
    }
    const withinMeasure =
      (localX - measureIndex * widthPerMeasure) / widthPerMeasure;
    const localIndex = Math.max(
      0,
      Math.min(
        measure.events.length,
        Math.round(withinMeasure * measure.events.length)
      )
    );
    const event =
      selectedTool === "rest"
        ? {
            id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
            type: "rest",
            duration: selectedDuration,
            ...(selectedDotted ? { dotted: true } : {})
          }
        : selectedTool === "spacer"
          ? {
              id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
              type: "spacer",
              duration: selectedDuration,
              ...(selectedDotted ? { dotted: true } : {})
            }
        : {
            id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
            diatonicStep: staffPosition(
              clientY,
              systemBounds,
              Number(system.dataset.staffBottom)
            ),
            duration: selectedDuration,
            ...(selectedAccidental === undefined
              ? {}
              : { accidental: selectedAccidental }),
            ...(selectedDotted ? { dotted: true } : {})
          };
    const insertAt = Math.min(
      score.notes.length,
      measure.startIndex + localIndex
    );
    score.notes.splice(insertAt, 0, event);
    selectedNoteId = event.id;
    render();
    announceChange();
  }

  function appendSpacerEvents(ticks) {
    const durationTicks = [
      [16, 1],
      [8, 2],
      [4, 4],
      [2, 8],
      [1, 16]
    ];
    let remaining = ticks;
    for (const [value, duration] of durationTicks) {
      while (remaining >= value) {
        score.notes.push({
          id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
          type: "spacer",
          duration
        });
        remaining -= value;
      }
    }
  }

  function setSelectedTool(tool) {
    selectedTool = tool;
    noteTool.setAttribute("aria-pressed", String(tool === "note"));
    restTool.setAttribute("aria-pressed", String(tool === "rest"));
    spacerTool.setAttribute("aria-pressed", String(tool === "spacer"));
  }

  durationButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedDuration = Number(button.dataset.duration);
      durationButtons.forEach((item) => {
        item.setAttribute("aria-pressed", String(item === button));
      });
    });
  });

  noteTool.addEventListener("click", () => setSelectedTool("note"));
  restTool.addEventListener("click", () => setSelectedTool("rest"));
  spacerTool.addEventListener("click", () => setSelectedTool("spacer"));

  dottedTool.addEventListener("click", () => {
    selectedDotted = !selectedDotted;
    dottedTool.setAttribute("aria-pressed", String(selectedDotted));
    const selected = score.notes.find((event) => event.id === selectedNoteId);
    if (selected) {
      if (selectedDotted) {
        selected.dotted = true;
      } else {
        delete selected.dotted;
      }
      render();
      announceChange();
    }
  });

  accidentalTool.addEventListener("change", () => {
    selectedAccidental =
      accidentalTool.value === "none" ? undefined : Number(accidentalTool.value);
    const selected = score.notes.find((event) => event.id === selectedNoteId);
    if (
      !selected ||
      selected.type === "rest" ||
      selected.type === "spacer"
    ) {
      return;
    }
    if (selectedAccidental === undefined) {
      delete selected.accidental;
    } else {
      selected.accidental = selectedAccidental;
    }
    render();
    announceChange();
  });

  timeSignatureTool.addEventListener("change", () => {
    score.timeSignature = timeSignatureTool.value;
    render();
    announceChange();
  });

  keySignatureTool.addEventListener("change", () => {
    score.keySignature = keySignatureTool.value;
    render();
    announceChange();
  });

  tempoTool.addEventListener("change", () => {
    const tempo = Number(tempoTool.value);
    if (!Number.isInteger(tempo) || tempo < 40 || tempo > 240) {
      status.textContent = "速度必须是 40–240 BPM 之间的整数。";
      tempoTool.value = String(score.tempo);
      return;
    }
    const wasPlaying = Boolean(playbackContext);
    if (wasPlaying) {
      stopPlayback("速度已更改，请重新播放");
    }
    score.tempo = tempo;
    render();
    announceChange();
  });

  scoreSheet.addEventListener("pointerdown", (event) => {
    if (!loaded) {
      return;
    }
    const target = event.target;
    const item =
      target instanceof Element ? target.closest("[data-note-id]") : null;
    if (item) {
      draggingNoteId = item.dataset.noteId;
      const system = item.closest(".staff-system");
      draggingStaffTop = system.getBoundingClientRect().top;
      draggingStaffBottom = Number(system.dataset.staffBottom);
      selectScoreEvent(draggingNoteId);
      scoreSheet.setPointerCapture(event.pointerId);
      render();
      return;
    }
    const system =
      target instanceof Element ? target.closest(".staff-system") : null;
    if (
      system &&
      system.dataset.editable !== "false" &&
      event.clientY - system.getBoundingClientRect().top >=
        Number(system.dataset.staffBottom) - 124 &&
      event.clientY - system.getBoundingClientRect().top <=
        Number(system.dataset.staffBottom) + 130
    ) {
      addEvent(event.clientX, event.clientY, system);
    }
  });

  scoreSheet.addEventListener("pointermove", (event) => {
    if (!draggingNoteId) {
      return;
    }
    const note = score.notes.find((item) => item.id === draggingNoteId);
    if (note && (!note.type || note.type === "note")) {
      note.diatonicStep = staffPosition(
        event.clientY,
        { top: draggingStaffTop },
        draggingStaffBottom
      );
      const element = scoreSheet.querySelector(
        `[data-note-id="${draggingNoteId}"]`
      );
      if (element) {
        element.style.top = `${
          draggingStaffBottom - note.diatonicStep * staffStep - 8
        }px`;
      }
    }
  });

  scoreSheet.addEventListener("pointerup", () => {
    if (draggingNoteId) {
      draggingNoteId = undefined;
      draggingStaffTop = undefined;
      draggingStaffBottom = undefined;
      render();
      announceChange();
    }
  });
  scoreSheet.addEventListener("pointercancel", () => {
    if (draggingNoteId) {
      draggingNoteId = undefined;
      draggingStaffTop = undefined;
      draggingStaffBottom = undefined;
      render();
    }
  });

  deleteButton.addEventListener("click", () => {
    if (!loaded || !selectedNoteId) {
      return;
    }
    score.notes = score.notes.filter((event) => event.id !== selectedNoteId);
    selectedNoteId = undefined;
    render();
    announceChange();
  });

  previewButton.addEventListener("click", () => {
    if (loaded) {
      vscode.postMessage({ type: "previewRequested" });
    }
  });

  exportPdfButton.addEventListener("click", () => {
    if (loaded) {
      window.clearTimeout(previewTimer);
      vscode.postMessage({ type: "scoreChanged", score });
      vscode.postMessage({ type: "exportPdfRequested" });
    }
  });

  playButton.addEventListener("click", () => {
    if (playbackContext) {
      stopPlayback();
    } else {
      void startPlayback();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (
      event.target instanceof Element &&
      event.target.closest("button, select, input, textarea") &&
      !event.target.closest(".score-item")
    ) {
      return;
    }
    if ((event.key === "Delete" || event.key === "Backspace") && selectedNoteId) {
      event.preventDefault();
      deleteButton.click();
      return;
    }
    if (
      selectedNoteId &&
      (event.key === "ArrowUp" || event.key === "ArrowDown")
    ) {
      const note = score.notes.find((item) => item.id === selectedNoteId);
      if (note && (!note.type || note.type === "note")) {
        note.diatonicStep = Math.max(
          -9,
          Math.min(14, note.diatonicStep + (event.key === "ArrowUp" ? 1 : -1))
        );
        render();
        announceChange();
      }
    }
  });

  window.addEventListener("resize", render);
  window.addEventListener("beforeunload", () => stopPlayback());
  window.addEventListener("message", (event) => {
    if (event.data.type === "scoreSyncError") {
      status.textContent = event.data.message;
      return;
    }
    if (event.data.type === "loadScore") {
      if (event.data.error) {
        loaded = false;
        status.textContent = event.data.error;
        return;
      }
      score = event.data.score;
      selectedNoteId = undefined;
      selectedAccidental = undefined;
      selectedDotted = false;
      loaded = true;
      render();
    }
  });

  durationButtons.forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(Number(button.dataset.duration) === selectedDuration)
    );
  });
  render();
  vscode.postMessage({ type: "ready" });
})();
