(() => {
  const vscode = acquireVsCodeApi();
  const staff = document.getElementById("staff");
  const status = document.getElementById("status");
  const deleteButton = document.getElementById("remove-note");
  const durationButtons = [...document.querySelectorAll(".duration")];
  const staffTop = 100;
  const staffBottom = 200;
  const staffStep = 12.5;
  const noteSpacing = 72;
  let selectedDuration = 4;
  let selectedNoteId;
  let draggingNoteId;
  let previewTimer;
  let score = { notes: [] };

  function announceChange() {
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(() => {
      vscode.postMessage({ type: "scoreChanged", notes: score.notes });
    }, 100);
  }

  function staffPosition(clientY) {
    const bounds = staff.getBoundingClientRect();
    return Math.max(
      -9,
      Math.min(14, Math.round((staffBottom - (clientY - bounds.top)) / staffStep))
    );
  }

  function makeNoteElement(note, index) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `note${note.id === selectedNoteId ? " selected" : ""}`;
    button.dataset.noteId = note.id;
    button.dataset.duration = String(note.duration);
    button.style.left = `${100 + index * noteSpacing}px`;
    button.style.top = `${staffBottom - note.diatonicStep * staffStep - 9}px`;
    button.setAttribute(
      "aria-label",
      `Note ${index + 1}, pitch step ${note.diatonicStep}, duration 1/${note.duration}`
    );
    button.setAttribute("aria-pressed", String(note.id === selectedNoteId));
    button.addEventListener("click", () => {
      selectedNoteId = note.id;
      render();
    });

    const stem = document.createElement("span");
    stem.className = "note-stem";
    stem.setAttribute("aria-hidden", "true");
    button.append(stem);

    const flag = document.createElement("span");
    flag.className = "note-flag";
    flag.setAttribute("aria-hidden", "true");
    button.append(flag);

    for (
      let ledgerStep = 2;
      note.diatonicStep <= -ledgerStep;
      ledgerStep += 2
    ) {
      const line = document.createElement("span");
      line.className = "ledger-line";
      line.style.top = `${(note.diatonicStep + ledgerStep) * staffStep + 7}px`;
      button.append(line);
    }
    for (
      let ledgerStep = 2;
      note.diatonicStep >= 10 + ledgerStep;
      ledgerStep += 2
    ) {
      const line = document.createElement("span");
      line.className = "ledger-line";
      line.style.top = `${(note.diatonicStep - 10 - ledgerStep) * staffStep + 7}px`;
      button.append(line);
    }

    return button;
  }

  function render() {
    const width = Math.max(
      staff.parentElement.clientWidth,
      190 + score.notes.length * noteSpacing
    );
    staff.style.width = `${width}px`;
    staff.replaceChildren();

    const clef = document.createElement("span");
    clef.className = "clef";
    clef.setAttribute("aria-hidden", "true");
    clef.textContent = "𝄞";
    staff.append(clef);

    const lines = document.createElement("div");
    lines.className = "staff-lines";
    lines.setAttribute("aria-hidden", "true");
    staff.append(lines);

    score.notes.forEach((note, index) => {
      staff.append(makeNoteElement(note, index));
    });

    deleteButton.disabled = !selectedNoteId;
    status.textContent = score.notes.length
      ? `${score.notes.length} notes · drag a note vertically to change pitch`
      : "Empty score — click the staff or drag a note value here to begin.";
  }

  function addNote(clientX, clientY, duration) {
    const bounds = staff.getBoundingClientRect();
    const index = Math.max(
      0,
      Math.min(
        score.notes.length,
        Math.round((clientX - bounds.left - 100) / noteSpacing)
      )
    );
    const note = {
      id:
        globalThis.crypto && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`,
      diatonicStep: staffPosition(clientY),
      duration
    };
    score.notes.splice(index, 0, note);
    selectedNoteId = note.id;
    render();
    announceChange();
  }

  durationButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedDuration = Number(button.dataset.duration);
      durationButtons.forEach((item) => {
        item.setAttribute("aria-pressed", String(item === button));
      });
      status.textContent = `Selected note value: 1/${selectedDuration}. Click or drag it onto the staff.`;
    });
    button.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData(
        "application/x-lilypond-duration",
        button.dataset.duration
      );
      event.dataTransfer.effectAllowed = "copy";
    });
  });

  staff.addEventListener("dragover", (event) => event.preventDefault());
  staff.addEventListener("drop", (event) => {
    event.preventDefault();
    const duration = Number(
      event.dataTransfer.getData("application/x-lilypond-duration")
    );
    if ([1, 2, 4, 8, 16].includes(duration)) {
      addNote(event.clientX, event.clientY, duration);
    }
  });

  staff.addEventListener("pointerdown", (event) => {
    const target = event.target;
    const noteElement =
      target instanceof Element ? target.closest("[data-note-id]") : null;
    if (noteElement) {
      draggingNoteId = noteElement.dataset.noteId;
      selectedNoteId = draggingNoteId;
      staff.setPointerCapture(event.pointerId);
      render();
      return;
    }
    addNote(event.clientX, event.clientY, selectedDuration);
  });

  staff.addEventListener("pointermove", (event) => {
    if (!draggingNoteId) {
      return;
    }
    const note = score.notes.find((item) => item.id === draggingNoteId);
    const element = staff.querySelector(`[data-note-id="${draggingNoteId}"]`);
    if (note && element) {
      note.diatonicStep = staffPosition(event.clientY);
      element.style.top = `${staffBottom - note.diatonicStep * staffStep - 9}px`;
      element.setAttribute(
        "aria-label",
        `Selected note, pitch step ${note.diatonicStep}, duration 1/${note.duration}`
      );
    }
  });

  staff.addEventListener("pointerup", () => {
    if (draggingNoteId) {
      draggingNoteId = undefined;
      render();
      announceChange();
    }
  });
  staff.addEventListener("pointercancel", () => {
    if (draggingNoteId) {
      draggingNoteId = undefined;
      render();
    }
  });

  deleteButton.addEventListener("click", () => {
    score.notes = score.notes.filter((note) => note.id !== selectedNoteId);
    selectedNoteId = undefined;
    render();
    announceChange();
  });

  window.addEventListener("keydown", (event) => {
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
      if (note) {
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
  window.addEventListener("message", (event) => {
    if (event.data.type === "scoreSyncError") {
      status.textContent = event.data.message;
    }
  });
  durationButtons.forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(Number(button.dataset.duration) === selectedDuration)
    );
  });
  render();
})();
