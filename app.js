(() => {
  const $ = id => document.getElementById(id);
  const STORAGE = "i-miei-appunti-v1";
  let notes = loadNotes(), editingId = null, recognition = null, listening = false, fontScale = 1;
  const home = $("home"), edit = $("edit"), textarea = $("noteText"), status = $("status");

  function loadNotes() {
    try { const value = JSON.parse(localStorage.getItem(STORAGE) || "[]"); return Array.isArray(value) ? value : []; }
    catch { return []; }
  }
  function persist() {
    try { localStorage.setItem(STORAGE, JSON.stringify(notes)); return true; }
    catch { alert("Non riesco a salvare: lo spazio del browser potrebbe essere pieno."); return false; }
  }
  function dateLabel(iso) {
    try { return new Intl.DateTimeFormat("it-IT", { dateStyle:"full", timeStyle:"short" }).format(new Date(iso)); }
    catch { return ""; }
  }
  function speak(text) {
    if (!("speechSynthesis" in window)) { alert("La lettura vocale non è supportata da questo browser."); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "it-IT"; utterance.rate = 0.88;
    window.speechSynthesis.speak(utterance);
  }
  function stopSpeech() { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); }
  function render() {
    $("count").textContent = notes.length + (notes.length === 1 ? " appunto salvato" : " appunti salvati");
    const list = $("notes"); list.innerHTML = "";
    if (!notes.length) {
      const empty = document.createElement("div"); empty.className = "empty";
      empty.textContent = "Non ci sono ancora appunti. Premi NUOVO APPUNTO per crearne uno.";
      list.appendChild(empty); return;
    }
    notes.slice().sort((a,b) => b.created.localeCompare(a.created)).forEach(note => {
      const card = document.createElement("article"); card.className = "note";
      const date = document.createElement("div"); date.className = "date"; date.textContent = dateLabel(note.created);
      const body = document.createElement("div"); body.className = "note-text"; body.textContent = note.text;
      const actions = document.createElement("div"); actions.className = "actions";
      const read = document.createElement("button"); read.className = "primary"; read.textContent = "🔊  LEGGI"; read.setAttribute("aria-label","Leggi appunto ad alta voce"); read.onclick = () => speak(note.text);
      const change = document.createElement("button"); change.className = "light"; change.textContent = "✎  MODIFICA"; change.onclick = () => openEditor(note.id);
      const del = document.createElement("button"); del.className = "danger"; del.textContent = "⌫  ELIMINA"; del.onclick = () => {
        if (confirm("Vuoi eliminare questo appunto?")) { notes = notes.filter(n => n.id !== note.id); persist(); render(); }
      };
      actions.append(read, change, del); card.append(date, body, actions); list.appendChild(card);
    });
  }
  function show(which) {
    const isHome = which === "home"; home.classList.toggle("hidden", !isHome); edit.classList.toggle("hidden", isHome);
    if (isHome) { stopSpeech(); render(); $("newNote").focus(); }
    else textarea.focus();
  }
  function openEditor(id=null) {
    editingId = id;
    const note = notes.find(n => n.id === id);
    $("editorTitle").textContent = note ? "Modifica appunto" : "Nuovo appunto";
    textarea.value = note ? note.text : ""; status.textContent = "";
    $("dictate").textContent = "🎙　DETTА";
    $("dictate").disabled = false;
    show("edit");
  }
  function save() {
    const text = textarea.value.trim();
    if (!text) { status.textContent = "Scrivi o detta prima un appunto."; textarea.focus(); return; }
    if (editingId) {
      const note = notes.find(n => n.id === editingId);
      if (note) note.text = text;
    } else {
      notes.push({ id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())), text, created: new Date().toISOString() });
    }
    if (persist()) show("home");
  }
  function setupRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      $("dictate").disabled = true;
      $("dictationHelp").textContent = "La dettatura diretta non è disponibile in questo browser. Tocca il campo del testo e usa il microfono della tastiera, se presente.";
      return;
    }
    recognition = new SpeechRecognition();
    recognition.lang = "it-IT"; recognition.continuous = true; recognition.interimResults = true;
    let finalText = "";
    recognition.onstart = () => { listening = true; $("dictate").textContent = "■　FERMA DETTATURA"; status.textContent = "Ti ascolto…"; };
    recognition.onresult = event => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const phrase = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += phrase + " ";
        else interim += phrase;
      }
      textarea.value = (textarea.dataset.before || "") + finalText + interim;
    };
    recognition.onerror = event => { status.textContent = event.error === "not-allowed" ? "Consenti l'accesso al microfono nelle impostazioni del browser." : "Dettatura interrotta. Puoi continuare scrivendo."; };
    recognition.onend = () => {
      listening = false; $("dictate").textContent = "🎙　DETTА";
      textarea.dataset.before = textarea.value.trim() ? textarea.value.trim() + " " : "";
      status.textContent = "Dettatura terminata. Puoi correggere il testo.";
    };
    $("dictate").onclick = () => {
      if (listening) recognition.stop();
      else { finalText = ""; textarea.dataset.before = textarea.value.trim() ? textarea.value.trim() + " " : ""; try { recognition.start(); } catch { status.textContent = "Attendi qualche secondo e riprova."; } }
    };
  }

  $("newNote").onclick = () => openEditor();
  $("back").onclick = $("cancel").onclick = () => { if (listening && recognition) recognition.stop(); show("home"); };
  $("save").onclick = save;
  $("preview").onclick = () => textarea.value.trim() ? speak(textarea.value.trim()) : status.textContent = "Non c'è ancora testo da ascoltare.";
  $("readAll").onclick = () => {
    const ordered = notes.slice().sort((a,b) => a.created.localeCompare(b.created));
    if (!ordered.length) { alert("Non ci sono appunti da leggere."); return; }
    speak(ordered.map((n,i) => "Appunto " + (i+1) + ". " + n.text).join(". "));
  };
  $("larger").onclick = () => { fontScale = Math.min(1.65, fontScale + .1); document.documentElement.style.setProperty("--font", (1.25*fontScale) + "rem"); };
  $("smaller").onclick = () => { fontScale = Math.max(.9, fontScale - .1); document.documentElement.style.setProperty("--font", (1.25*fontScale) + "rem"); };
  setupRecognition(); render();

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
  }
})();