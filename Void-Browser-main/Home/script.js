document.addEventListener("DOMContentLoaded", () => {

    // ========================================
    // VOID CONFIGURATION
    // ========================================

    const DB_NAME = "VoidDatabase";
    const DB_VERSION = 1;
    const STORE_NAME = "backgrounds";
    const FADE_DURATION = 500;

    let db = null;
    


    // ========================================
    // CUSTOM TAB FAVICON + MIDDLE IMAGE
    // These values are saved by the Settings page.
    // ========================================

    const voidFavicon = document.getElementById("voidFavicon");
    const midImg = document.getElementById("midImg");

    const savedFavicon = localStorage.getItem("voidCustomFavicon");
    const savedMiddleImage = localStorage.getItem("voidCustomMiddleImage");

    if (voidFavicon && savedFavicon) {
        voidFavicon.href = savedFavicon;
    }

    if (midImg && savedMiddleImage) {
        midImg.src = savedMiddleImage;
    }
    // Debug output disabled.
    function debugLog() {}

    // ========================================
    // INDEXEDDB CONNECTION
    // ========================================

    function openDatabase() {

        return new Promise((resolve, reject) => {

            const request = indexedDB.open(
                DB_NAME,
                DB_VERSION
            );

            request.onupgradeneeded = () => {

                const database = request.result;

                if (!database.objectStoreNames.contains(STORE_NAME)) {

                    database.createObjectStore(STORE_NAME, {
                        keyPath: "id",
                        autoIncrement: true
                    });

                }

            };

            request.onsuccess = () => {
                db = request.result;
                resolve(db);
            };

            request.onerror = () => {
                reject(request.error);
            };

        });

    }

    // ========================================
    // GET SAVED BACKGROUNDS
    // ========================================

    function getBackgrounds() {

        return new Promise((resolve, reject) => {

            if (!db || !db.objectStoreNames.contains(STORE_NAME)) {
                reject(new Error("Background store not found."));
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

    // ========================================
    // BACKGROUND LAYERS
    // ========================================

    let backgrounds = [];
    let currentIndex = -1;
    let activeLayer = 0;
    let backgroundTimer = null;

    const layers = [];

    function createBackgroundLayers() {

        for (let i = 0; i < 2; i++) {

            const layer = document.createElement("div");

            layer.className = "void-bg-layer";
            layer.style.opacity = "0";

            document.body.appendChild(layer);

            layers.push(layer);

        }

    }

    // ========================================
    // CLEAR BACKGROUND LAYERS
    // ========================================

    function clearBackgroundLayers() {

        if (backgroundTimer) {
            clearInterval(backgroundTimer);
            backgroundTimer = null;
        }

        layers.forEach((layer) => {

            const oldURL = layer.dataset.imageUrl;

            if (oldURL) {
                URL.revokeObjectURL(oldURL);
            }

            layer.remove();

        });

        layers.length = 0;

        activeLayer = 0;
        currentIndex = -1;

        document.body.style.backgroundImage = "none";
        document.body.style.backgroundColor = "#111318";

    }

    // ========================================
    // DISPLAY BACKGROUND
    // ========================================

    function showBackground(index) {

        const background = backgrounds[index];

        if (!background || !background.image) {
            debugLog("Invalid background image.", "error");
            return;
        }

        const nextLayerIndex = activeLayer === 0 ? 1 : 0;

        const nextLayer = layers[nextLayerIndex];
        const previousLayer = layers[activeLayer];

        if (!nextLayer) {
            debugLog("Background layer not found.", "error");
            return;
        }

        const imageURL = URL.createObjectURL(
            background.image
        );

        const image = new Image();

        image.onload = () => {

            const oldURL = nextLayer.dataset.imageUrl;

            nextLayer.style.backgroundImage =
                `url("${imageURL}")`;

            nextLayer.dataset.imageUrl = imageURL;

            nextLayer.style.opacity = "1";

            if (previousLayer) {
                previousLayer.style.opacity = "0";
            }

            activeLayer = nextLayerIndex;

            if (oldURL) {

                setTimeout(() => {
                    URL.revokeObjectURL(oldURL);
                }, FADE_DURATION + 1000);

            }

            debugLog(
                `Showing ${background.name} (${index + 1}/${backgrounds.length}).`,
                "success"
            );

        };

        image.onerror = () => {

            URL.revokeObjectURL(imageURL);

            debugLog(
                `Could not load ${background.name}.`,
                "error"
            );

        };

        image.src = imageURL;

    }

    // ========================================
    // RANDOM BACKGROUND SELECTION
    // ========================================

    function getNextBackgroundIndex() {

        if (backgrounds.length <= 1) {
            return 0;
        }

        let nextIndex = currentIndex;

        while (nextIndex === currentIndex) {

            nextIndex = Math.floor(
                Math.random() * backgrounds.length
            );

        }

        return nextIndex;

    }

    // ========================================
    // SLIDESHOW SPEED
    // ========================================

    function getBackgroundSpeed() {

        const savedSpeed = Number(
            localStorage.getItem("voidBackgroundSpeed") || 10
        );

        const speed = Math.max(
            3,
            Math.min(60, savedSpeed)
        );

        return speed * 1000;

    }

    // ========================================
    // NEXT BACKGROUND
    // ========================================

    function nextBackground() {

        if (backgrounds.length < 2) {
            return;
        }

        currentIndex = getNextBackgroundIndex();

        showBackground(currentIndex);

    }

    // ========================================
    // START RANDOM OR FIXED BACKGROUND
    // ========================================

    async function startVoidSlideshow() {

        try {

            debugLog("Connecting to background database...");

            await openDatabase();

            backgrounds = await getBackgrounds();

            debugLog(
                `Found ${backgrounds.length} saved backgrounds.`,
                "success"
            );

            // Remove any old background layers.

            clearBackgroundLayers();

            if (backgrounds.length === 0) {

                debugLog(
                    "No backgrounds uploaded. Using default background.",
                    "warning"
                );

                return;

            }

            // Create background layers.

            createBackgroundLayers();

            // Read saved background mode.

            const mode =
                localStorage.getItem("voidBackgroundMode") || "random";

            // ========================================
            // FIXED BACKGROUND MODE
            // ========================================

            if (mode === "fixed") {

                const fixedID =
                    localStorage.getItem("voidFixedBackgroundId");

                const fixedIndex = backgrounds.findIndex(
                    background => String(background.id) === fixedID
                );

                if (fixedIndex !== -1) {

                    currentIndex = fixedIndex;

                    showBackground(currentIndex);

                    debugLog(
                        `Fixed background selected: ${backgrounds[fixedIndex].name}`,
                        "success"
                    );

                    return;

                }

                debugLog(
                    "Saved fixed background not found. Switching to random mode.",
                    "warning"
                );

            }

            // ========================================
            // RANDOM SLIDESHOW MODE
            // ========================================

            currentIndex = Math.floor(
                Math.random() * backgrounds.length
            );

            showBackground(currentIndex);

            if (backgrounds.length > 1) {

                backgroundTimer = setInterval(
                    nextBackground,
                    getBackgroundSpeed()
                );

                debugLog(
                    `Random slideshow started. Changing every ${getBackgroundSpeed() / 1000} seconds.`,
                    "success"
                );

            } else {

                debugLog(
                    "Only one background available.",
                    "warning"
                );

            }

        } catch (error) {

            debugLog(
                `Background error: ${error.message}`,
                "error"
            );

        }

    }

    startVoidSlideshow();

    // ========================================
    // SETTINGS NAVIGATION
    // ========================================

    const settingsBtn =
        document.getElementById("settingsBtn");

    if (settingsBtn) {

        settingsBtn.addEventListener("click", () => {

            window.location.href = "../Settings/settings.html";

        });

    }

    // ========================================
    // SHORTCUT ELEMENTS
    // ========================================

    const shortcuts = document.getElementById("shortcuts");
    const addBtn = document.getElementById("addBtn");
    const popup = document.getElementById("popup");

    const siteName = document.getElementById("siteName");
    const siteLink = document.getElementById("siteLink");
    const siteIcon = document.getElementById("siteIcon");

    const siteImage = document.getElementById("siteImage");
    const imagePreview = document.getElementById("imagePreview");

    const saveBtn = document.getElementById("saveBtn");
    const cancelBtn = document.getElementById("cancelBtn");

    // ========================================
    // LOAD SAVED SHORTCUTS
    // ========================================

    let sites = [];

    try {

        sites = JSON.parse(
            localStorage.getItem("myShortcuts") || "[]"
        );

        if (!Array.isArray(sites)) {
            sites = [];
        }

    } catch (error) {

        sites = [];

        debugLog(
            "Could not read saved shortcuts.",
            "error"
        );

    }

    let uploadedImage = "";

    // ========================================
    // SAVE SHORTCUTS
    // ========================================

    function saveStorage() {

        localStorage.setItem(
            "myShortcuts",
            JSON.stringify(sites)
        );

    }

    // ========================================
    // DEFAULT ICON
    // ========================================

    function makeDefaultIcon() {

        const icon = document.createElement("span");

        icon.className = "default-icon";
        icon.textContent = "🌐";

        return icon;

    }

    // ========================================
    // CREATE SHORTCUT
    // ========================================

    function createShortcut(site, index) {

    const card = document.createElement("div");
    card.className = "shortcut";

    // DELETE BUTTON
    const deleteBtn = document.createElement("button");

    deleteBtn.className = "delete";
    deleteBtn.textContent = "×";
    deleteBtn.title = "Delete shortcut";

    deleteBtn.addEventListener("click", (event) => {

        event.preventDefault();
        event.stopPropagation();

        sites.splice(index, 1);

        try {
            saveStorage();
            renderShortcuts();

            debugLog(`Deleted ${site.name}.`, "warning");

        } catch (error) {
            debugLog("Could not save deletion.", "error");
        }

    });

    // ICON
    let icon;

    if (site.icon && typeof site.icon === "string") {

        icon = document.createElement("img");
        icon.className = "shortcut-icon";
        icon.alt = site.name || "Shortcut icon";
        icon.src = site.icon;

        icon.onerror = () => {
            debugLog(`Icon failed to load for ${site.name}.`, "error");
            icon.replaceWith(makeDefaultIcon());
        };

    } else {
        icon = makeDefaultIcon();
    }

    // WEBSITE NAME
    const link = document.createElement("a");

    link.href = site.link;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = site.name;

    // MAKE ENTIRE CARD CLICKABLE
    card.style.cursor = "pointer";

    card.addEventListener("click", (event) => {

        if (event.target.closest(".delete")) return;

        window.open(site.link, "_blank", "noopener,noreferrer");

    });

    // ACCESSIBILITY
    card.setAttribute("role", "link");
    card.setAttribute("tabindex", "0");

    card.addEventListener("keydown", (event) => {

        if (event.key === "Enter") {
            window.open(site.link, "_blank", "noopener,noreferrer");
        }

    });

    // ADD ELEMENTS
    card.appendChild(deleteBtn);
    card.appendChild(icon);
    card.appendChild(link);

    return card;
    }
    // ========================================
    // RENDER SHORTCUTS
    // ========================================

    function renderShortcuts() {

        if (!shortcuts) {

            debugLog(
                "Shortcuts container not found.",
                "error"
            );

            return;

        }

        shortcuts.innerHTML = "";

        sites.forEach((site, index) => {

            shortcuts.appendChild(
                createShortcut(site, index)
            );

        });

        debugLog(
            `${sites.length} shortcuts loaded.`,
            "success"
        );

    }

    // ========================================
    // PROCESS UPLOADED SHORTCUT IMAGE
    // ========================================

    function processImage(file) {

        return new Promise((resolve, reject) => {

            if (!file || !file.type.startsWith("image/")) {

                reject(
                    new Error("Please select a valid image.")
                );

                return;

            }

            const reader = new FileReader();

            reader.onload = () => {

                const image = new Image();

                image.onload = () => {

                    const maxSize = 256;

                    let width = image.width;
                    let height = image.height;

                    const scale = Math.min(
                        1,
                        maxSize / Math.max(width, height)
                    );

                    width = Math.round(width * scale);
                    height = Math.round(height * scale);

                    const canvas = document.createElement("canvas");

                    canvas.width = width;
                    canvas.height = height;

                    const context = canvas.getContext("2d");

                    if (!context) {

                        reject(
                            new Error("Could not process image.")
                        );

                        return;

                    }

                    context.drawImage(
                        image,
                        0,
                        0,
                        width,
                        height
                    );

                    const isPng = file.type === "image/png";

                    const format = isPng
                        ? "image/png"
                        : "image/jpeg";

                    const compressedImage = canvas.toDataURL(
                        format,
                        0.8
                    );

                    resolve(compressedImage);

                };

                image.onerror = () => {
                    reject(new Error("Could not read image file."));
                };

                image.src = reader.result;

            };

            reader.onerror = () => {
                reject(new Error("File reading failed."));
            };

            reader.readAsDataURL(file);

        });

    }

    // ========================================
    // SHORTCUT IMAGE UPLOAD
    // ========================================

    if (siteImage) {

        siteImage.addEventListener("change", async () => {

            const file = siteImage.files[0];

            uploadedImage = "";

            if (imagePreview) {
                imagePreview.innerHTML = "";
            }

            if (!file) return;

            try {

                uploadedImage = await processImage(file);

                if (imagePreview) {

                    const preview = document.createElement("img");

                    preview.src = uploadedImage;
                    preview.alt = "Image preview";

                    imagePreview.appendChild(preview);

                }

                debugLog(
                    "Shortcut image uploaded successfully.",
                    "success"
                );

            } catch (error) {

                uploadedImage = "";

                debugLog(error.message, "error");

            }

        });

    }

    // ========================================
    // OPEN ADD SHORTCUT POPUP
    // ========================================

    if (addBtn && popup) {

        addBtn.addEventListener("click", () => {

            if (siteName) siteName.value = "";
            if (siteLink) siteLink.value = "";
            if (siteIcon) siteIcon.value = "";
            if (siteImage) siteImage.value = "";

            if (imagePreview) {
                imagePreview.innerHTML = "";
            }

            uploadedImage = "";

            popup.style.display = "flex";

        });

    }

    // ========================================
    // CLOSE POPUP
    // ========================================

    if (cancelBtn && popup) {

        cancelBtn.addEventListener("click", () => {

            popup.style.display = "none";

        });

    }

    // ========================================
    // SAVE NEW SHORTCUT
    // ========================================

    if (saveBtn) {

        saveBtn.addEventListener("click", () => {

            const name = siteName?.value.trim() || "";

            let link = siteLink?.value.trim() || "";

            const iconURL = siteIcon?.value.trim() || "";

            if (!name || !link) {

                debugLog(
                    "Please enter a name and website link.",
                    "warning"
                );

                return;

            }

            // VALIDATE URL

            try {

                const url = new URL(
                    link.includes("://") ? link : `https://${link}`
                );

                if (
                    url.protocol !== "http:" &&
                    url.protocol !== "https:"
                ) {

                    throw new Error("Invalid URL");

                }

                link = url.href;

            } catch {

                debugLog(
                    "Please enter a valid website URL.",
                    "error"
                );

                return;

            }

            // UPLOADED IMAGE TAKES PRIORITY

            const icon = uploadedImage || iconURL;

            const newSite = {
                name: name,
                link: link,
                icon: icon,
                x: null,
                y: null
            };

            sites.push(newSite);

            try {

                saveStorage();

            } catch (error) {

                sites.pop();

                debugLog(
                    "Storage full. Try a smaller image.",
                    "error"
                );

                return;

            }

            renderShortcuts();

            if (popup) {
                popup.style.display = "none";
            }

            uploadedImage = "";

            if (siteImage) {
                siteImage.value = "";
            }

            if (imagePreview) {
                imagePreview.innerHTML = "";
            }

            debugLog(
                `Created shortcut: ${name}`,
                "success"
            );

        });

    }

    // ========================================
    // INITIALIZE DASHBOARD
    // ========================================

    renderShortcuts();

    debugLog("Void dashboard initialized.", "success");

});
const midImg = document.getElementById("midImg");

if (midImg) {
    function checkDefaultMidImage() {
        const isDefault = midImg.getAttribute("src")?.includes("defaltMidIcon.gif");

        midImg.classList.toggle("default-mid-animation", isDefault);
    }

    // Check the initial image
    checkDefaultMidImage();

    // Check whenever the image source changes
    const midImgObserver = new MutationObserver(checkDefaultMidImage);

    midImgObserver.observe(midImg, {
        attributes: true,
        attributeFilter: ["src"]
    });
}
function updateTime() {
    const clock = document.getElementById("clock");
    let AP="";

    if (!clock) {
        console.error("Clock element not found!");
        return;
    }

    const time = new Date();
    let H = String(time.getHours()).padStart(2, "0");
    const M = String(time.getMinutes()).padStart(2, "0");
    if(H>12){H-=12;AP="PM"}else{AP="AM"}
    clock.textContent = `${H}:${M} `+AP;
}

document.addEventListener("DOMContentLoaded", () => {
    updateTime();
    setInterval(updateTime, 1000);
});
// ======================================
// VOID NEW TAB AUDIO PLAYER
// ======================================

const AUDIO_DB_NAME = "VoidAudioDatabase";
const AUDIO_STORE_NAME = "audio";

function openNewTabAudioDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(AUDIO_DB_NAME, 1);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getNewTabAudio(key) {
    const db = await openNewTabAudioDB();

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

document.addEventListener("DOMContentLoaded", async () => {
    const mode = localStorage.getItem("voidAudioMode") || "none";

    if (mode === "none") return;

    const audio = document.createElement("audio");

    audio.id = "voidBackgroundAudio";
    audio.loop = true;
    audio.preload = "auto";

    if (mode === "default") {
        audio.src = chrome.runtime.getURL("audio/default.mp3");
    }

    if (mode === "custom") {
        try {
            const savedAudio = await getNewTabAudio("customAudio");

            if (!savedAudio) return;

            audio.src = URL.createObjectURL(savedAudio);
        } catch (error) {
            console.error("Could not load saved audio:", error);
            return;
        }
    }

    document.body.appendChild(audio);

    // Browsers may block autoplay until the user interacts.
    const startAudio = () => {
        audio.play().catch(error => {
            console.log("Audio autoplay was blocked:", error);
        });
    };

    startAudio();

    document.addEventListener("click", startAudio, { once: true });
    document.addEventListener("keydown", startAudio, { once: true });
});