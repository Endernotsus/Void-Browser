async function getVersion() {
    const response = await fetch(chrome.runtime.getURL("manifest.json"));
    const data = await response.json();

    document.getElementById("Version").textContent = data.version;
}

getVersion();
// ==========================================
// VOID SETTINGS - SETTINGS.JS
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    // ==========================================
    // DATABASE CONFIGURATION
    // ==========================================

    const DB_NAME = "VoidDatabase";
    const DB_VERSION = 1;
    const STORE_NAME = "backgrounds";

    let db;

    // ==========================================
    // HTML ELEMENTS
    // ==========================================

    const backgroundUpload = document.getElementById("backgroundUpload");
    const backgroundMode = document.getElementById("backgroundMode");
    const fixedBackground = document.getElementById("fixedBackground");
    const fixedBackgroundRow = document.getElementById("fixedBackgroundRow");

    const speedSlider = document.getElementById("speedSlider");
    const speedValue = document.getElementById("speedValue");

    const backgroundList = document.getElementById("backgroundList");
    const backgroundCount = document.getElementById("backgroundCount");
    // Debug output disabled.
    function debugLog() {}

    // ==========================================
    // OPEN INDEXEDDB
    // ==========================================

    function openDatabase() {

        return new Promise((resolve, reject) => {

            const request = indexedDB.open(
                DB_NAME,
                DB_VERSION
            );

            request.onupgradeneeded = (event) => {

                const database = event.target.result;

                if (!database.objectStoreNames.contains(STORE_NAME)) {

                    database.createObjectStore(STORE_NAME, {
                        keyPath: "id",
                        autoIncrement: true
                    });

                }

            };

            request.onsuccess = () => {

                db = request.result;

                debugLog("Database connected.", "success");

                resolve(db);

            };

            request.onerror = () => {

                debugLog("Database connection failed.", "error");

                reject(request.error);

            };

        });

    }


    // ==========================================
    // GET ALL BACKGROUNDS
    // ==========================================

    function getAllBackgrounds() {

        return new Promise((resolve, reject) => {

            if (!db) {
                reject(new Error("Database is not connected."));
                return;
            }

            const transaction = db.transaction(
                STORE_NAME,
                "readonly"
            );

            const store = transaction.objectStore(STORE_NAME);

            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                reject(request.error);
            };

        });

    }


    // ==========================================
    // ADD BACKGROUND
    // ==========================================

    function addBackground(file) {

        return new Promise((resolve, reject) => {

            if (!db) {
                reject(new Error("Database is not connected."));
                return;
            }

            const transaction = db.transaction(
                STORE_NAME,
                "readwrite"
            );

            const store = transaction.objectStore(STORE_NAME);

            const background = {
                name: file.name,
                image: file,
                added: Date.now()
            };

            const request = store.add(background);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };

        });

    }


    // ==========================================
    // DELETE BACKGROUND
    // ==========================================

    function deleteBackground(id) {

        return new Promise((resolve, reject) => {

            if (!db) {
                reject(new Error("Database is not connected."));
                return;
            }

            const transaction = db.transaction(
                STORE_NAME,
                "readwrite"
            );

            const store = transaction.objectStore(STORE_NAME);

            const request = store.delete(Number(id));

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(request.error);
            };

        });

    }


    // ==========================================
    // UPDATE FIXED BACKGROUND OPTIONS
    // ==========================================

    function updateFixedBackgroundOptions(backgrounds) {

        if (!fixedBackground) return;

        const savedID =
            localStorage.getItem("voidFixedBackgroundId") || "";

        fixedBackground.innerHTML = "";

        const placeholder = document.createElement("option");

        placeholder.value = "";
        placeholder.textContent = "Select a background";

        fixedBackground.appendChild(placeholder);

        backgrounds.forEach((background) => {

            const option = document.createElement("option");

            option.value = String(background.id);
            option.textContent = background.name;

            fixedBackground.appendChild(option);

        });

        const savedExists = backgrounds.some(
            background => String(background.id) === savedID
        );

        if (savedExists) {

            fixedBackground.value = savedID;

        } else if (savedID) {

            localStorage.removeItem("voidFixedBackgroundId");

            debugLog(
                "Saved fixed background no longer exists.",
                "warning"
            );

        }

    }


    // ==========================================
    // RENDER BACKGROUND GALLERY
    // ==========================================

    async function renderBackgrounds() {

        if (!backgroundList) return;

        try {

            const backgrounds = await getAllBackgrounds();

            backgroundList.innerHTML = "";

            if (backgroundCount) {

                backgroundCount.textContent =
                    `${backgrounds.length} ${backgrounds.length === 1 ? "image" : "images"}`;

            }

            updateFixedBackgroundOptions(backgrounds);

            if (backgrounds.length === 0) {

                const empty = document.createElement("div");

                empty.className = "empty-background-message";

                empty.innerHTML = `
                    <span class="empty-icon">▧</span>
                    <h3>No backgrounds yet</h3>
                    <p>Upload an image to get started.</p>
                `;

                backgroundList.appendChild(empty);

                return;

            }

            backgrounds.forEach((background) => {

                const card = document.createElement("div");

                card.className = "background-card";

                const image = document.createElement("img");

                image.className = "background-thumbnail";

                const imageURL = URL.createObjectURL(
                    background.image
                );

                image.src = imageURL;
                image.alt = background.name;

                image.addEventListener("load", () => {
                    URL.revokeObjectURL(imageURL);
                }, { once: true });

                const details = document.createElement("div");

                details.className = "background-details";

                const name = document.createElement("span");

                name.className = "background-name";
                name.textContent = background.name;

                const deleteButton = document.createElement("button");

                deleteButton.type = "button";
                deleteButton.className = "delete-background";
                deleteButton.textContent = "Delete";

                deleteButton.addEventListener("click", async () => {

                    const confirmed = confirm(
                        `Delete "${background.name}"?`
                    );

                    if (!confirmed) return;

                    try {

                        await deleteBackground(background.id);

                        const selectedID =
                            localStorage.getItem("voidFixedBackgroundId");

                        if (String(background.id) === selectedID) {

                            localStorage.removeItem(
                                "voidFixedBackgroundId"
                            );

                        }

                        debugLog(
                            `Deleted background: ${background.name}`,
                            "success"
                        );

                        await renderBackgrounds();

                    } catch (error) {

                        debugLog(
                            `Could not delete background: ${error.message}`,
                            "error"
                        );

                    }

                });

                details.appendChild(name);
                details.appendChild(deleteButton);

                card.appendChild(image);
                card.appendChild(details);

                backgroundList.appendChild(card);

            });

            debugLog(
                `Loaded ${backgrounds.length} background(s).`,
                "success"
            );

        } catch (error) {

            debugLog(
                `Gallery error: ${error.message}`,
                "error"
            );

        }

    }


    // ==========================================
    // UPLOAD BACKGROUND IMAGES
    // ==========================================

    if (backgroundUpload) {

        backgroundUpload.addEventListener("change", async () => {

            const files = Array.from(backgroundUpload.files || []);

            if (files.length === 0) return;

            let uploaded = 0;

            for (const file of files) {

                if (!file.type.startsWith("image/")) {

                    debugLog(
                        `Skipped unsupported file: ${file.name}`,
                        "warning"
                    );

                    continue;

                }

                try {

                    await addBackground(file);

                    uploaded++;

                    debugLog(
                        `Uploaded: ${file.name}`,
                        "success"
                    );

                } catch (error) {

                    debugLog(
                        `Upload failed: ${file.name} - ${error.message}`,
                        "error"
                    );

                }

            }

            await renderBackgrounds();

            debugLog(
                `Upload complete. ${uploaded} image(s) added.`,
                "success"
            );

            backgroundUpload.value = "";

        });

    }


    // ==========================================
    // BACKGROUND MODE
    // ==========================================

    if (backgroundMode) {

        const savedMode =
            localStorage.getItem("voidBackgroundMode") || "random";

        backgroundMode.value = savedMode;

        function updateFixedRow() {

            if (!fixedBackgroundRow) return;

            fixedBackgroundRow.style.display =
                backgroundMode.value === "fixed" ? "flex" : "none";

        }

        updateFixedRow();

        backgroundMode.addEventListener("change", () => {

            localStorage.setItem(
                "voidBackgroundMode",
                backgroundMode.value
            );

            updateFixedRow();

            debugLog(
                `Background mode changed to ${backgroundMode.value}.`,
                "success"
            );

        });

    }


    // ==========================================
    // FIXED BACKGROUND SELECTION
    // ==========================================

    if (fixedBackground) {

        fixedBackground.addEventListener("change", () => {

            const selectedID = fixedBackground.value;

            if (selectedID) {

                localStorage.setItem(
                    "voidFixedBackgroundId",
                    selectedID
                );

                debugLog(
                    "Fixed background selection saved.",
                    "success"
                );

            } else {

                localStorage.removeItem(
                    "voidFixedBackgroundId"
                );

                debugLog(
                    "Fixed background selection cleared.",
                    "warning"
                );

            }

        });

    }


    // ==========================================
    // SLIDESHOW SPEED
    // ==========================================

    if (speedSlider && speedValue) {

        const savedSpeed =
            localStorage.getItem("voidBackgroundSpeed") || "10";

        speedSlider.value = savedSpeed;

        speedValue.textContent =
            `${savedSpeed} seconds`;

        speedSlider.addEventListener("input", () => {

            const speed = speedSlider.value;

            speedValue.textContent =
                `${speed} seconds`;

            localStorage.setItem(
                "voidBackgroundSpeed",
                speed
            );

        });

        speedSlider.addEventListener("change", () => {

            debugLog(
                `Slideshow speed set to ${speedSlider.value} seconds.`,
                "success"
            );

        });

    }


    // ==========================================
    // CUSTOM TAB FAVICON + MIDDLE IMAGE
    // ==========================================

    const faviconUpload = document.getElementById("faviconUpload");
    const middleImageUpload = document.getElementById("middleImageUpload");
    const faviconPreview = document.getElementById("faviconPreview");
    const middleImagePreview = document.getElementById("middleImagePreview");
    const resetFavicon = document.getElementById("resetFavicon");
    const resetMiddleImage = document.getElementById("resetMiddleImage");
    const settingsFavicon = document.getElementById("voidSettingsFavicon");

    const DEFAULT_FAVICON = "../defaltIcons/defaltIcon.png";
    const DEFAULT_MIDDLE_IMAGE = "../defaltIcons/defaltMidIcon.gif";

    function applySavedImageSettings() {
        const savedFavicon = localStorage.getItem("voidCustomFavicon");
        const savedMiddleImage = localStorage.getItem("voidCustomMiddleImage");

        if (savedFavicon) {
            if (faviconPreview) faviconPreview.src = savedFavicon;
            if (settingsFavicon) settingsFavicon.href = savedFavicon;
        }

        if (savedMiddleImage && middleImagePreview) {
            middleImagePreview.src = savedMiddleImage;
        }
    }

    function saveImageAsDataUrl(file, storageKey, preview, faviconMode) {
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            debugLog("Please choose a valid image file.", "error");
            return;
        }

        // Avoid filling localStorage with unusually large images.
        if (file.size > 3 * 1024 * 1024) {
            debugLog("That image is over 3 MB. Please choose a smaller image.", "error");
            return;
        }

        const reader = new FileReader();

        reader.onload = () => {
            try {
                const dataUrl = reader.result;
                localStorage.setItem(storageKey, dataUrl);

                if (preview) preview.src = dataUrl;
                if (faviconMode && settingsFavicon) settingsFavicon.href = dataUrl;

                debugLog(
                    faviconMode ? "Browser tab icon saved." : "Middle image saved.",
                    "success"
                );
            } catch (error) {
                debugLog("Could not save this image. Try a smaller file.", "error");
            }
        };

        reader.onerror = () => debugLog("Could not read the selected image.", "error");
        reader.readAsDataURL(file);
    }

    if (faviconUpload) {
        faviconUpload.addEventListener("change", () => {
            saveImageAsDataUrl(
                faviconUpload.files[0],
                "voidCustomFavicon",
                faviconPreview,
                true
            );
            faviconUpload.value = "";
        });
    }

    if (middleImageUpload) {
        middleImageUpload.addEventListener("change", () => {
            saveImageAsDataUrl(
                middleImageUpload.files[0],
                "voidCustomMiddleImage",
                middleImagePreview,
                false
            );
            middleImageUpload.value = "";
        });
    }

    if (resetFavicon) {
        resetFavicon.addEventListener("click", () => {
            localStorage.removeItem("voidCustomFavicon");
            if (faviconPreview) faviconPreview.src = DEFAULT_FAVICON;
            if (settingsFavicon) settingsFavicon.href = DEFAULT_FAVICON;
            debugLog("Browser tab icon reset to default.", "success");
        });
    }

    if (resetMiddleImage) {
        resetMiddleImage.addEventListener("click", () => {
            localStorage.removeItem("voidCustomMiddleImage");
            if (middleImagePreview) middleImagePreview.src = DEFAULT_MIDDLE_IMAGE;
            debugLog("Middle image reset to default.", "success");
        });
    }

    applySavedImageSettings();
    // ==========================================
    // INITIALIZE SETTINGS
    // ==========================================

    async function initializeSettings() {

        try {

            await openDatabase();

            await renderBackgrounds();

            debugLog(
                "All settings initialized successfully.",
                "success"
            );

        } catch (error) {

            debugLog(
                `Initialization failed: ${error.message}`,
                "error"
            );

        }

    }

    initializeSettings();

});
// ======================================
// VOID NEW TAB AUDIO SETTINGS
// ======================================

const AUDIO_DB_NAME = "VoidAudioDatabase";
const AUDIO_STORE_NAME = "audio";

function openAudioDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(AUDIO_DB_NAME, 1);

        request.onupgradeneeded = () => {
            const db = request.result;

            if (!db.objectStoreNames.contains(AUDIO_STORE_NAME)) {
                db.createObjectStore(AUDIO_STORE_NAME);
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveAudio(key, value) {
    const db = await openAudioDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(AUDIO_STORE_NAME, "readwrite");

        transaction.objectStore(AUDIO_STORE_NAME).put(value, key);

        transaction.oncomplete = () => {
            db.close();
            resolve();
        };

        transaction.onerror = () => reject(transaction.error);
    });
}

async function getAudio(key) {
    const db = await openAudioDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(AUDIO_STORE_NAME, "readonly");
        const request = transaction.objectStore(AUDIO_STORE_NAME).get(key);

        request.onsuccess = () => {
            db.close();
            resolve(request.result);
        };

        request.onerror = () => reject(request.error);
    });
}

async function deleteAudio(key) {
    const db = await openAudioDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(AUDIO_STORE_NAME, "readwrite");
        transaction.objectStore(AUDIO_STORE_NAME).delete(key);

        transaction.oncomplete = () => {
            db.close();
            resolve();
        };

        transaction.onerror = () => reject(transaction.error);
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    const audioSelect = document.getElementById("audioSelect");
    const audioUpload = document.getElementById("audioUpload");
    const audioPreview = document.getElementById("audioPreview");
    const resetAudio = document.getElementById("resetAudio");

    if (!audioSelect || !audioUpload || !audioPreview || !resetAudio) {
        console.error("Void audio settings elements not found.");
        return;
    }

    let previewURL = null;

    function updatePreview(blob) {
        if (previewURL) {
            URL.revokeObjectURL(previewURL);
        }

        previewURL = URL.createObjectURL(blob);
        audioPreview.src = previewURL;
        audioPreview.style.display = "block";
    }

    // Load saved selection
    const savedMode = localStorage.getItem("voidAudioMode") || "none";
    audioSelect.value = savedMode;

    if (savedMode === "custom") {
        const savedAudio = await getAudio("customAudio");

        if (savedAudio) {
            updatePreview(savedAudio);
        }
    }

    if (savedMode === "default") {
        audioPreview.style.display = "block";
        audioPreview.src = "../audio/default.mp3";
    }

    // Selection changed
    audioSelect.addEventListener("change", async () => {
        const mode = audioSelect.value;

        if (mode === "none") {
            localStorage.setItem("voidAudioMode", "none");
            audioPreview.pause();
            audioPreview.style.display = "none";
        }

        if (mode === "default") {
            localStorage.setItem("voidAudioMode", "default");
            audioPreview.src = "../audio/default.mp3";
            audioPreview.style.display = "block";
        }

        if (mode === "custom") {
            audioUpload.click();
        }
    });

    // Upload custom audio
    audioUpload.addEventListener("change", async () => {
        const file = audioUpload.files[0];

        if (!file) return;

        if (!file.type.startsWith("audio/")) {
            alert("Please select an audio file.");
            return;
        }

        await saveAudio("customAudio", file);

        localStorage.setItem("voidAudioMode", "custom");
        updatePreview(file);
        audioUpload.value = "";
    });

    // Disable audio
    resetAudio.addEventListener("click", async () => {
        audioSelect.value = "none";
        localStorage.setItem("voidAudioMode", "none");

        audioPreview.pause();
        audioPreview.removeAttribute("src");
        audioPreview.style.display = "none";
    });
});