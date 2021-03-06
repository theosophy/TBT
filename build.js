'use strict';

if (process.argv.length < 3) {
    console.log('example: node build --book src/loa --lang ru en');
    process.exit(0);
}

var fs = require('fs');
var path = require('path');
var xmldom = require('xmldom');

setTimeout(function () {
    const args = parseArgs();

    if (args.help)
        return printHelp();

    if (typeof args.lang == typeof '')
        args.lang = [args.lang];

    if (!args.lang.length)
        throw new Error('--lang is required');

    if (!args.book.length)
        throw new Error('--book is required');

    const node = parseXmlFile(path.join(args.book, 'book.xml'));
    const book = new Book(node, args.book);

    if (args.format == 'md')
        console.log(book.toMarkdown(args.lang));
    else
        console.log(book.toHTML(args.lang));
});

function parseArgs() {
    var name, named = [];

    process.argv.slice(2).forEach(function (value) {
        var p = /^--(.+)$/.exec(value);

        if (p)
            named[name = p[1]] = true;
        else if (!name)
            named.push(value);
        else if (named[name] === true)
            named[name] = value;
        else if (named[name] instanceof Array)
            named[name].push(value);
        else
            named[name] = [named[name], value];
    });

    return named;
}

function printHelp() {
    var usage =
        'Usage: {self} ...args\r\n' +
        '   \r\n' +
        '   {self} --book /src/loa\r\n' +
        '   \r\n' +
        '       Specifies the path to the book.\r\n' +
        '       The folder must contain book.xml file.\r\n' +
        '   \r\n' +
        '   {self} --lang en ru\r\n' +
        '   \r\n' +
        '       Specifies languages to take.\r\n' +
        '       At least one language must be taken.\r\n' +
        '       The first language is primary.\r\n' +
        '   \r\n';

    console.log(usage.replace(/{self}/gm, 'node build'));
}


function resolvePath(file, dirs) {
    var i, full;

    for (i = 0; i < dirs.length; i++) {
        full = path.join(dirs[i], file);
        if (fs.existsSync(full))
            return full;
    }

    throw new Error(file + ' cannot be resolved against ' + dirs);
}

/**
 * @param {string} file 
 */
function getFileContents(file) {
    return fs.readFileSync(file, 'utf8');
}

/**
 * @param {string} file 
 */
function parseXmlFile(file) {
    const text = getFileContents(file);
    const parser = new xmldom.DOMParser();
    const document = parser.parseFromString(text);
    return document.documentElement;
}

class Book {
    constructor(root, dir) {
        this.path = dir;
        this.title = new Text(root.getElementsByTagName('title')[0], dir);
        this.keywords = new Text(root.getElementsByTagName('keywords')[0], dir);
        this.styles = getFileContents(resolvePath(root.getAttribute('styles'), [dir])).replace(/[\x00-\x1F]/g, '');
        this.chapters = [].map.call(root.getElementsByTagName('chapter'), node => new Chapter(node, dir));
    }

    /**
     * @param {string[]} langs e.g. ["en", "ru"]
     */
    toHTML(langs) {
        return '<!doctype html>'
            + '<html>'
            + '<head>'
            + '<meta http-equiv="Content-Type" content="text/html" charset="utf-8">'
            + '<title>' + this.title.views[langs[0]] + '</title>'
            + '<style>' + this.styles + '</style>'
            + '<style>.timestamp { font-size:9pt; position:absolute; right:1em; top:1em; color:lightgray; }</style>'
            + '<style>table { width: 100% }</style>'
            + '<style>td.done { background-color: #efe }</style>'
            + '<style>td.fail { background-color: #fee }</style>'
            + '<style>td { width: ' + (100 / langs.length) + '% }</style>'
            + '</head>'
            + `<body data-path="${this.path}" data-lang="${langs.join(' ')}">`
            + '<div class="timestamp">' + new Date().toJSON() + '</div>'
            + '<table>'
            + '<tr>' + langs.map(lang => '<td><h1>' + this.title.views[lang] + '</h1>')
            + '</table>'
            + this.chapters.map(ch => ch.toHTML(langs)).join('')
            + '<script src="../editor/edit.js"></script>'
            + '</body>'
            + '</html>';
    }

    /**
     * @param {string[]} langs e.g. ["en", "ru"]
     */
    toMarkdown(langs) {
        return this.title.toMarkdown(langs, 1) + '\n'
            + this.chapters.map(ch => ch.toMarkdown(langs)).join('\n');
    }
}

class Chapter {
    constructor(xml, dir) {
        const rel = xml.getAttribute('contents');
        const ref = resolvePath(rel, [dir]);

        const root = parseXmlFile(ref);
        const dirname = path.dirname(ref);
        const href = path.basename(ref, '.xml');

        this.path = rel;
        this.title = new Text(root.getElementsByTagName('title')[0], dirname, href);
        this.paragraphs = [].map.call(root.getElementsByTagName('text'), node => new Text(node, dirname));
    }

    /**
     * @param {string[]} langs e.g. ["en", "ru"]
     */
    toHTML(langs) {
        return `<table data-path="${this.path}">`
            + this.title.toHTML(langs, 2)
            + this.paragraphs.map(p => p.toHTML(langs)).join('')
            + '</table>';
    }

    /**
     * @param {string[]} langs e.g. ["en", "ru"]
     */
    toMarkdown(langs) {
        return this.title.toMarkdown(langs, 2)
            + '\n' + this.paragraphs.map(p => p.toMarkdown(langs)).join('\n');
    }
}

class Text {
    constructor(root, dir, href) {
        var ref = root.getAttribute('contents');

        if (ref) {
            ref = resolvePath(ref, [dir]);
            return new Text(parseXmlFile(ref), path.dirname(ref));
        }

        this.href = href;
        this.style = root.getAttribute('class');
        this.views = new function () {
            [].forEach.call(root.getElementsByTagName('view'), node => {
                this[node.getAttribute('lang')] = node.textContent.trim();
            });
        };
    }

    /**
     * @param {string[]} langs e.g. ["en", "ru"]
     * @param {number} level e.g. 1 for "h1" or 2 for "h2"
     */
    toHTML(langs, level) {
        var html = '';

        for (const lang of langs) {
            let text = this.views[lang] || '';

            text = text.replace(/\s+[�-]+\s+/g, "&nbsp;&mdash;&nbsp;");

            if (this.href)
                text = '<a href="#' + this.href + '">' + text + '</a>';

            if (level)
                text = '<h' + level + '>' + text + '</h' + level + '>';

            html += '<td>' + text + '</td>';
        }

        return '<tr' + (this.style ? ' class="' + this.style + '"' : '') + '>' + html + '</tr>';
    }

    /**
     * @param {string[]} langs e.g. ["en", "ru"]
     * @param {number} level e.g. 1 for "h1" or 2 for "h2"
     */
    toMarkdown(langs, level) {
        if (!level && this.style == 'subtitle')
            level = 3;

        // pick the first available lang
        for (const lang of langs) {
            const text = this.views[lang];

            if (!text)
                continue;

            return '#'.repeat(level || 0) + ' '
                + (text || '').replace(/[\r\n]/gm, ' ').replace(/\s+/gm, ' ')
                + '\n';
        }
    }
}
