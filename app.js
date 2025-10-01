// Basic host logic: service worker, file input, and stubs for FS mounting.
// The template now includes the PPSSPP Web binaries and the loader will
// automatically select whichever core (standard or libretro) is present in
// the `ppsspp/` directory.

(function(){
  const $ = (id) => document.getElementById(id);
  // Improve the log helper: append messages with a literal newline and guard
  // against a missing log element.  The original implementation concatenated
  // a newline across lines, which introduced a syntax error.
  const log = (msg) => {
    const logElem = $("log");
    if (logElem) {
      logElem.textContent += msg + "\n";
    }
  };

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

      // If the module was configured with noInitialRun, manually invoke the
      // application's main function now that we've provided the ROM
      // argument.  Prefer Module.callMain if present (the Emscripten
      // convenience wrapper), otherwise fall back to the underlying `_main`
      // export.  Surround with try/catch to log any errors.
      try {
        if (typeof Module.callMain === 'function') {
          Module.callMain(Module.arguments);
          log("Called Module.callMain() with arguments.");
        } else if (typeof Module._main === 'function') {
          // _main expects (argc, argv) so we just pass 0 for argv pointer
          Module._main(Module.arguments.length, 0);
          log("Called Module._main() manually.");
        }
      } catch (e) {
        log("Error calling main: " + e);
      }

    } catch (err) {
      log("Could not initialize PPSSPP Module: " + err.message);
      log("Make sure /ppsspp contains the JS/WASM/DATA of a PPSSPP web build.");
    }
  });
})();
