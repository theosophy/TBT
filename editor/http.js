const express = require('express');
const path = require('path');
const fs = require('fs');
const {wrap} = require('./util');

const app = express();

const basedir = path.resolve(process.argv[2] || '..');
const port = process.argv[3] || 80;

console.log(`serving ${basedir} at port ${port}`);

app.use(express.static(basedir));

app.use((req, res, next) => {
    console.log(req.method, req.url);
    next();
});

app.post('/src/*', (req, res) => {
    const file = path.join(basedir, req.path);
    const lang = req.query.lang;
    const para = req.query.para;
    const text = fs.readFileSync(file, 'utf8');

    console.log('updating', file, lang, para);

    var offset = 0, match = '';

    for (let i = 0; i < para; i++) {
        offset += match.length;

        const m = text.slice(offset).match(/<text>[^\x00]*?<\/text>/);

        if (!m) {
            res.status(404).end();
            return;
        }

        offset += m.index;
        match = m[0];
    }

    const pattern = new RegExp(`<view lang="${lang}">([^\\x00]*?)</view>`);

    if (pattern.test(match) && pattern.exec(match)[1].trim()) {
        res.status(409).end();
        return;
    }

    var body = '';

    req.on('data', data => {
        body += data;
    });

    req.on('end', () => {
        const para = wrap(body, 100, '\r\n      ');

        var pos, len, str;

        if (pattern.test(match)) {
            // there is an empty <view> for this lang
            const m = pattern.exec(match);

            pos = offset + m.index;
            len = m[0].length;

            str = `<view lang="${lang}">${para}\r\n    </view>`;
        } else {
            // there is no <view> for this lang yet
            pos = offset + match.length - '</text>'.length;
            len = 0;

            str = `  <view lang="${lang}">${para}\r\n    </view>\r\n  `;
        }

        fs.writeFileSync(file, text.slice(0, pos) + str + text.slice(pos + len), 'utf8');
        res.status(201).end();
    });
});

app.listen(port);
