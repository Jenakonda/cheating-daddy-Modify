// Presets, HTML safety, data management, export and clipboard helpers exposed to the UI.
const { ipcRenderer, clipboard } = require('electron');
const presetsLib = require('../utils/presets.js');
const DOMPurify = require('../assets/purify-3.4.18.min.js');
const { sessionToMarkdown, suggestExportFileName } = require('../utils/session-export.js');
const { storage } = require('./storage');

// ============ PRESETS ============
// Built-in presets plus the user's custom presets (stored in preferences)
const presets = {
    builtIn: presetsLib.BUILT_IN_PRESETS,
    lib: presetsLib,
    async getCustom() {
        const prefs = await storage.getPreferences();
        return presetsLib.sanitizeCustomPresets(prefs.customPresets);
    },
    async list() {
        return presetsLib.listPresets(await this.getCustom());
    },
    async label(id) {
        return presetsLib.getPresetLabel(id, await this.getCustom());
    },
    async saveCustom(customPresets) {
        const cleaned = presetsLib.sanitizeCustomPresets(customPresets);
        await storage.updatePreference('customPresets', cleaned);
        window.dispatchEvent(new CustomEvent('presets-changed'));
        return cleaned;
    },
};

// ============ HTML SAFETY ============
// AI answers are untrusted text. Everything that is rendered as HTML must go through sanitizeHtml first,
// because this window has Node integration enabled.
function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sanitizeHtml(html) {
    return DOMPurify.sanitize(String(html ?? ''), {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'iframe', 'frame', 'object', 'embed', 'link', 'meta', 'base'],
        FORBID_ATTR: ['style', 'srcset'],
    });
}

// ============ DATA, EXPORT AND CLIPBOARD ============
const dataApi = {
    getUsage: async () => ipcRenderer.invoke('data:get-usage'),
    clearCategory: async categoryId => ipcRenderer.invoke('data:clear-category', categoryId),
    pruneHistory: async () => ipcRenderer.invoke('data:prune-history'),
};

function copyText(text) {
    try {
        clipboard.writeText(String(text ?? ''));
        return true;
    } catch (error) {
        console.warn('Clipboard write failed:', error);
        return false;
    }
}

async function exportSessionMarkdown(session, presetLabel = null, formatDate = undefined) {
    const content = sessionToMarkdown(session, { presetLabel, formatDate });
    return ipcRenderer.invoke('export:save-markdown', { fileName: suggestExportFileName(session), content });
}

function sessionMarkdown(session, presetLabel = null, formatDate = undefined) {
    return sessionToMarkdown(session, { presetLabel, formatDate });
}

module.exports = { presets, dataApi, copyText, escapeHtml, sanitizeHtml, exportSessionMarkdown, sessionMarkdown };
