function defaultFormatDate(timestamp) {
    const date = new Date(Number(timestamp));
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().replace('T', ' ').slice(0, 16);
}

function quoteBlock(text) {
    return String(text || '')
        .trim()
        .split(/\r?\n/)
        .map(line => `> ${line}`.trimEnd())
        .join('\n');
}

/**
 * Builds a Markdown document from a saved session.
 * The custom prompt is intentionally left out because it often contains personal data such as a CV.
 */
function sessionToMarkdown(session, { presetLabel = null, formatDate = defaultFormatDate } = {}) {
    if (!session || typeof session !== 'object') {
        return '';
    }

    const lines = ['# Cheating Daddy session', ''];
    const meta = [];
    const created = formatDate(session.createdAt);
    if (created) meta.push(`**Date:** ${created}`);
    const label = presetLabel || session.profile;
    if (label) meta.push(`**Preset:** ${label}`);
    if (meta.length > 0) {
        lines.push(meta.join('  \n'), '');
    }

    const conversation = Array.isArray(session.conversationHistory) ? session.conversationHistory : [];
    if (conversation.length > 0) {
        lines.push('## Conversation', '');
        conversation.forEach((turn, index) => {
            const when = formatDate(turn.timestamp);
            lines.push(`### ${index + 1}.${when ? ` ${when}` : ''}`, '');
            if (turn.transcription) {
                lines.push('**Question**', '', quoteBlock(turn.transcription), '');
            }
            if (turn.ai_response) {
                lines.push('**Answer**', '', String(turn.ai_response).trim(), '');
            }
        });
    }

    const screens = Array.isArray(session.screenAnalysisHistory) ? session.screenAnalysisHistory : [];
    if (screens.length > 0) {
        lines.push('## Screen analysis', '');
        screens.forEach((entry, index) => {
            const when = formatDate(entry.timestamp);
            lines.push(`### ${index + 1}.${when ? ` ${when}` : ''}`, '');
            if (entry.prompt) {
                lines.push('**Prompt**', '', quoteBlock(entry.prompt), '');
            }
            if (entry.response) {
                lines.push('**Answer**', '', String(entry.response).trim(), '');
            }
        });
    }

    if (conversation.length === 0 && screens.length === 0) {
        lines.push('_This session has no saved messages._', '');
    }

    return `${lines.join('\n').trimEnd()}\n`;
}

function suggestExportFileName(session) {
    const date = new Date(Number(session?.createdAt));
    const stamp = Number.isNaN(date.getTime()) ? 'session' : date.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
    return `cheating-daddy-${stamp}.md`;
}

module.exports = {
    sessionToMarkdown,
    suggestExportFileName,
};
