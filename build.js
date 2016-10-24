'use strict';

if (process.argv.length < 3) {
    console.log('example: node build --book src/loa --lang ru en');
    process.exit(0);
}

var fs = require('fs');
var path = require('path');
var xmldom = require('xmldom');

setTimeout(function () {
    var html, book, args = parseArgs();

    if (args.help)
        return printHelp();

    if (typeof args.lang == typeof '')
        args.lang = [args.lang];

    if (!args.lang.length)
        throw new Error('--lang is required');

    if (!args.book.length)
        throw new Error('--book is required');

    book = new Book(parseXmlFile(path.join(args.book, 'book.xml')), args.book);
    html = book.toString(args.lang);

    console.log(html);
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

function getFileContents(file) {
    return fs.readFileSync(file, 'utf8');
}

function arrayToMap(array, cb) {
    var map = {};
    [].forEach.call(array, function () {
        cb.apply(map, arguments);
    });
    return map;
}

function joinItems(array) {
    var args = [].slice.call(arguments, 1);
    return array.map(function (v) {
        return v.toString.apply(v, args);
    }).join('');
}

function parseXmlFile(file) {
    var document = new xmldom.DOMParser().parseFromString(getFileContents(file));
    return document.documentElement;
}

function Book(root, dir) {
    this.title = new Text(root.getElementsByTagName('title')[0], dir);
    this.keywords = new Text(root.getElementsByTagName('keywords')[0], dir);
    this.styles = getFileContents(resolvePath(root.getAttribute('styles'), [dir])).replace(/[\x00-\x1F]/g, '');
    this.chapters = [].map.call(root.getElementsByTagName('chapter'), function (node) {
        return new Chapter(node, dir);
    });
}

Book.prototype.toString = function (langs) {
    var self = this;

    return '<!doctype html>' +
        '<html>' +
        '<head>' +
        '<meta http-equiv="Content-Type" content="text/html" charset="utf-8">' +
        '<title>' + this.title.views[langs[0]] + '</title>' +
        '<style>' + this.styles + '</style>' +
        '<style>.timestamp { font-size:9pt; position:absolute; right:1em; top:1em; color:lightgray; }</style>' +
        '<style>td { width: ' + (100 / langs.length) + '% }</style>' +
        '</head>' +
        '<body>' +
        '<div class="timestamp">' + new Date + '</div>' +
        '<table>' +
        '<tr>' + langs.map(lang => '<td><h1>' + this.title.views[lang] + '</h1>') +
        joinItems(self.chapters, langs) +
        '</table>' +
        '</body>' +
        '</html>';
};

function Chapter(root, dir, href) {
    var ref = root.getAttribute('contents');

    if (ref) {
        ref = resolvePath(ref, [dir]);
        Chapter.call(this, parseXmlFile(ref), path.dirname(ref), path.basename(ref, '.xml'));
    } else {
        this.title = new Text(root.getElementsByTagName('title')[0], dir, href);
        this.paragraphs = [].map.call(root.getElementsByTagName('text'), function (node) {
            return new Text(node, dir);
        });
    }
}

Chapter.prototype.toString = function (langs) {
    return this.title.toString(langs, 'h2') + joinItems(this.paragraphs, langs);
};

function Text(root, dir, href) {
    var ref = root.getAttribute('contents');

    if (ref) {
        ref = resolvePath(ref, [dir]);
        Text.call(this, parseXmlFile(ref), path.dirname(ref));
    } else {
        this.href = href;
        this.style = root.getAttribute('class');
        this.views = arrayToMap(root.getElementsByTagName('view'), function (node) {
            this[node.getAttribute('lang')] = node.textContent
                .trim()
                .replace(/\s+[�-]+\s+/g, "&nbsp;&mdash;&nbsp;");
        });
    }
}

Text.prototype.toString = function (langs, tag) {
    var lang, text, html = '', self = this;

    langs.forEach(function (lang) {
        text = self.views[lang] || '';

        if (self.href)
            text = '<a href="#' + self.href + '">' + text + '</a>';

        if (tag)
            text = '<' + tag + '>' + text + '</' + tag + '>';

        html += '<td>' + text + '</td>';
    });

    return '<tr' + (self.style ? ' class="' + self.style + '"' : '') + '>' + html + '</tr>';
};
