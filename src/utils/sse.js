// A network chunk can end in the middle of a server-sent event line, so the unfinished tail is kept.
function createLineSplitter() {
    let pending = '';
    return function push(chunk) {
        const lines = (pending + chunk).split('\n');
        pending = lines.pop();
        return lines.map(line => line.replace(/\r$/, '')).filter(line => line.trim() !== '');
    };
}

module.exports = { createLineSplitter };
