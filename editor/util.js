exports.wrap = (text, size, pref) => {
    var pos = 0, str = '';

    while (pos + size < text.length) {
        let i = pos + size;

        while (i > pos && text[i] != ' ')
            i--;

        if (i == pos)
            throw Error('Found a word with more than ' + size + ' characters');

        str += pref + text.slice(pos, i);
        pos = i + 1;
    }

    if (pos < text.length)
        str += pref + text.slice(pos);

    return str;
};
