// Basic host logic: service worker, file input, and stubs for FS mounting.
// This template does NOT include PPSSPP binaries.

(function(){
  const $ = (id) => document.getElementById(id);
  const log = (msg) => { $("log").textContent += msg + "
"; };

  // Register SW
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").then(() => log("Service worker registered."))
      .catch(err => log("SW error: " + err));
  }

  // Wire file input
  let selectedFile = null;
  $("romInput").addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const buf = await f.arrayBuffer();
    selectedFile = { name: f.name, data: new Uint8Array(buf) };
    log("Selected ROM: " + f.name + " (" + f.size + " bytes)");
    $("startBtn").disabled = false;
  });

  // Start button: if PPSSPP Module exists, attempt to place the ROM into FS.
  $("startBtn").addEventListener("click", async () => {
    if (!selectedFile) { log("Pick a ROM first."); return; }

    // Wait for PPSSPP to attach its Module (Emscripten usually exposes global 'Module')
    const ensureModule = () => new Promise((resolve, reject) => {
      let tries = 0;
      const t = setInterval(() => {
        tries++;
        if (window.Module && Module.FS && Module.FS_createDataFile) {
          clearInterval(t); resolve(window.Module);
        }
        if (tries > 200) { clearInterval(t); reject(new Error("PPSSPP Module not detected.")); }
      }, 50);
    });

    try {
      const Module = await ensureModule();
      log("PPSSPP Module is live; mounting ROM...");

      const targetName = "/game/" + selectedFile.name;
      try { Module.FS.mkdir("/game"); } catch(e){ /* already exists */ }

      Module.FS_createDataFile("/game", selectedFile.name, selectedFile.data, true, true);
      log("Placed ROM at " + targetName);

      // Many Emscripten apps check location/hash/args; we try a generic approach:
      Module.arguments = [targetName];
      log("Set Module.arguments = ['" + targetName + "']");

    } catch (err) {
      log("Could not initialize PPSSPP Module: " + err.message);
      log("Make sure /ppsspp contains the JS/WASM/DATA of a PPSSPP web build.");
    }
  });
})();
