const test = require('node:test');
const assert = require('node:assert/strict');

const { sessionToMarkdown, suggestExportFileName } = require('../src/utils/session-export');

const session = {
    sessionId: '1700000000000',
    createdAt: Date.UTC(2026, 10, 23, 15, 2),
    profile: 'exam',
    customPrompt: 'My CV: John Doe, phone 123',
    conversationHistory: [
        {
            timestamp: Date.UTC(2026, 10, 23, 15, 3),
            transcription: 'What is a thread?\nExplain briefly.',
            ai_response: '**A thread** shares memory.',
        },
    ],
    screenAnalysisHistory: [{ timestamp: Date.UTC(2026, 10, 23, 15, 5), prompt: 'Analyze screen', response: 'It is a quiz.' }],
};

test('sessionToMarkdown renders the conversation and screen analysis', () => {
    const markdown = sessionToMarkdown(session, { presetLabel: 'Exam Assistant' });

    assert.ok(markdown.startsWith('# Cheating Daddy session\n'));
    assert.ok(markdown.includes('**Date:** 2026-11-23 15:02'));
    assert.ok(markdown.includes('**Preset:** Exam Assistant'));
    assert.ok(markdown.includes('## Conversation'));
    assert.ok(markdown.includes('> What is a thread?\n> Explain briefly.'));
    assert.ok(markdown.includes('**A thread** shares memory.'));
    assert.ok(markdown.includes('## Screen analysis'));
    assert.ok(markdown.includes('It is a quiz.'));
    assert.ok(markdown.endsWith('\n'));
});

test('sessionToMarkdown never exports the custom prompt', () => {
    const markdown = sessionToMarkdown(session);
    assert.ok(!markdown.includes('John Doe'));
    assert.ok(!markdown.includes('phone 123'));
    assert.ok(markdown.includes('**Preset:** exam'), 'falls back to the preset id when no label is given');
});

test('sessionToMarkdown supports a custom date formatter and handles empty sessions', () => {
    const markdown = sessionToMarkdown(session, { formatDate: () => 'DATE' });
    assert.ok(markdown.includes('**Date:** DATE'));

    const empty = sessionToMarkdown({ createdAt: Date.UTC(2026, 0, 1), conversationHistory: [], screenAnalysisHistory: [] });
    assert.ok(empty.includes('_This session has no saved messages._'));

    assert.equal(sessionToMarkdown(null), '');
    assert.equal(sessionToMarkdown('text'), '');
});

test('suggestExportFileName builds a safe file name', () => {
    assert.equal(suggestExportFileName({ createdAt: Date.UTC(2026, 10, 23, 15, 2) }), 'cheating-daddy-20261123-1502.md');
    assert.equal(suggestExportFileName({}), 'cheating-daddy-session.md');
    assert.equal(suggestExportFileName(null), 'cheating-daddy-session.md');
});
