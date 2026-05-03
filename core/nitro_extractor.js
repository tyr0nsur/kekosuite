const fs = require('fs');
const zlib = require('zlib');

/**
 * Extrae las físicas de un archivo .nitro convertido
 * @param {string} nitroPath Ruta al archivo .nitro
 * @returns {object} { stackHeight, modesCount }
 */
function extractPhysics(nitroPath) {
    if (!fs.existsSync(nitroPath)) {
        return { stackHeight: 1.0, modesCount: 1 };
    }

    try {
        const buffer = fs.readFileSync(nitroPath);
        let offset = 0;

        const fileCount = buffer.readUInt16BE(offset);
        offset += 2;

        for (let i = 0; i < fileCount; i++) {
            const nameLen = buffer.readUInt16BE(offset);
            offset += 2;
            const name = buffer.toString('utf8', offset, offset + nameLen);
            offset += nameLen;

            const fileLen = buffer.readUInt32BE(offset);
            offset += 4;

            const compressed = buffer.slice(offset, offset + fileLen);
            offset += fileLen;

            if (name.endsWith('.json')) {
                let decompressed;
                try {
                    decompressed = zlib.inflateSync(compressed);
                } catch (e) {
                    decompressed = zlib.inflateRawSync(compressed);
                }
                const data = JSON.parse(decompressed.toString('utf8'));
                
                let stackHeight = 1.0;
                let modesCount = 1;

                if (data.logic && data.logic.model && data.logic.model.dimensions) {
                    stackHeight = data.logic.model.dimensions.z !== undefined ? data.logic.model.dimensions.z : 1.0;
                }

                if (data.animations) {
                    modesCount = Object.keys(data.animations).length;
                    if (modesCount === 0) modesCount = 1;
                }

                return { stackHeight, modesCount };
            }
        }
    } catch (err) {
        console.error(`Error extrayendo físicas de ${nitroPath}: ${err.message}`);
    }

    return { stackHeight: 1.0, modesCount: 1 };
}

/**
 * Detecta el interaction_type correcto basándose en los datos de la API y el classname.
 * También determina los vending_ids para máquinas expendedoras.
 * @param {string} classname Nombre del furni
 * @param {object} apiData Datos de la API de HabboFurni
 * @returns {object} { interactionType, vendingIds, isClothing, clothingSetId }
 */
function detectInteractionType(classname, apiData) {
    const lowerClass = classname.toLowerCase();
    const category = (apiData.category || '').toLowerCase();
    const specialType = apiData.special_type;
    const furniLine = (apiData.furni_line || '').toLowerCase();

    let interactionType = 'default';
    let vendingIds = '0';
    let isClothing = false;
    let clothingSetId = '';

    // --- Wired: se detecta por classname directamente ---
    if (lowerClass.startsWith('wf_trg_') || lowerClass.startsWith('wf_act_') ||
        lowerClass.startsWith('wf_cnd_') || lowerClass.startsWith('wf_xtra_') ||
        lowerClass.startsWith('wf_blob')) {
        interactionType = lowerClass;
        return { interactionType, vendingIds, isClothing, clothingSetId };
    }

    // --- Ropa comprable ---
    if (lowerClass.includes('clothing_') || specialType === 23 || furniLine === 'clothing') {
        interactionType = 'clothing';
        isClothing = true;
        if (apiData.custom_params) {
            clothingSetId = apiData.custom_params.replace(/"/g, '');
        }
        return { interactionType, vendingIds, isClothing, clothingSetId };
    }

    // --- Vending machines (heladeras, barras, cafeteras...) ---
    if (category === 'vending_machine') {
        interactionType = 'vendingmachine';
        vendingIds = guessVendingIds(lowerClass);
        return { interactionType, vendingIds, isClothing, clothingSetId };
    }

    // --- Teleportes ---
    if (category === 'teleport' || lowerClass.includes('teleport')) {
        interactionType = 'teleport';
        return { interactionType, vendingIds, isClothing, clothingSetId };
    }

    // --- Trofeos ---
    if (lowerClass.includes('trophy') || lowerClass.includes('trofeo')) {
        interactionType = 'trophy';
        return { interactionType, vendingIds, isClothing, clothingSetId };
    }

    // --- Expositores de Placas ---
    if (lowerClass.includes('badge_display')) {
        interactionType = 'badge_display';
        return { interactionType, vendingIds, isClothing, clothingSetId };
    }

    // --- Rollers ---
    if (lowerClass.startsWith('roller') || category === 'roller') {
        interactionType = 'roller';
        return { interactionType, vendingIds, isClothing, clothingSetId };
    }

    // --- Dados ---
    if (lowerClass.startsWith('edice') || lowerClass.startsWith('dice') || category === 'dice') {
        interactionType = 'dice';
        return { interactionType, vendingIds, isClothing, clothingSetId };
    }

    // --- Gates / Puertas ---
    if (category === 'gate' || (lowerClass.includes('_gate') && !lowerClass.startsWith('wf_'))) {
        interactionType = 'gate';
        return { interactionType, vendingIds, isClothing, clothingSetId };
    }

    // --- Maniquíes ---
    if (lowerClass.includes('mannequin') || lowerClass.includes('maniqui')) {
        interactionType = 'mannequin';
        return { interactionType, vendingIds, isClothing, clothingSetId };
    }

    // --- Tono de Fondo (Background Toner) ---
    if (lowerClass.includes('background') && lowerClass.includes('toner')) {
        interactionType = 'background_toner';
        return { interactionType, vendingIds, isClothing, clothingSetId };
    }

    // --- Piñatas y Crackeables ---
    if (lowerClass.includes('crackable') || lowerClass.includes('pinata') || lowerClass.includes('huevo_')) {
        interactionType = 'crackable';
        return { interactionType, vendingIds, isClothing, clothingSetId };
    }

    // --- Mascotas (Nidos, comida, juguetes) ---
    if (lowerClass.includes('pet') || category.includes('pet') || lowerClass.includes('nest')) {
        if (lowerClass.includes('food') || lowerClass.includes('cabbage') || lowerClass.includes('meat')) interactionType = 'pet_food';
        else if (lowerClass.includes('drink') || lowerClass.includes('water')) interactionType = 'pet_drink';
        else if (lowerClass.includes('toy') || lowerClass.includes('ball')) interactionType = 'pet_toy';
        else if (lowerClass.includes('nest') || lowerClass.includes('cama')) interactionType = 'nest';
        if (interactionType !== 'default') return { interactionType, vendingIds, isClothing, clothingSetId };
    }

    // --- Grupos (Guilds) ---
    if (lowerClass.includes('guild_') || category === 'guild') {
        if (lowerClass.includes('gate') || lowerClass.includes('puerta')) interactionType = 'guild_gate';
        else interactionType = 'guild_furni';
        return { interactionType, vendingIds, isClothing, clothingSetId };
    }

    return { interactionType, vendingIds, isClothing, clothingSetId };
}

/**
 * Adivina los vending_ids basándose en patrones del nombre del furni.
 * @param {string} lowerClass nombre del furni en minúsculas
 * @returns {string} IDs separados por comas
 */
function guessVendingIds(lowerClass) {
    if (lowerClass.includes('fridge') || lowerClass.includes('minibar') || lowerClass.includes('nevera')) {
        return '2,3,4,5,6,36,37,38';
    }
    if (lowerClass.includes('bar_') || lowerClass.includes('_bar')) {
        return '6,5,2,1';
    }
    if (lowerClass.includes('icecream') || lowerClass.includes('ice_cream') || lowerClass.includes('helado')) {
        return '4';
    }
    if (lowerClass.includes('coffee') || lowerClass.includes('moccha') || lowerClass.includes('cafe')) {
        return '11,12,13';
    }
    if (lowerClass.includes('sink') || lowerClass.includes('water') || lowerClass.includes('grifo')) {
        return '100';
    }
    if (lowerClass.includes('flower') || lowerClass.includes('plant') || lowerClass.includes('rose') || lowerClass.includes('sunflower')) {
        return '1000,1002,1019';
    }
    if (lowerClass.includes('gum') || lowerClass.includes('candy') || lowerClass.includes('sweet')) {
        return '67,68,69';
    }
    if (lowerClass.includes('samovar') || lowerClass.includes('tea')) {
        return '1';
    }
    // Default: mix de bebidas estándar
    return '1,2,5,6';
}

module.exports = { extractPhysics, detectInteractionType };
