GlobalFlags = {}

GlobalFlags.Debug = false

//-----------------------------------------------------------------------------
// Writes a text to StdOut if the latter exists.
//-----------------------------------------------------------------------------
function println(s) {
    if (WScript.StdOut)
        WScript.StdOut.WriteLine(s)
}

//-----------------------------------------------------------------------------
// Waits for input.
//-----------------------------------------------------------------------------
function readln(s) {
    if (WScript.StdIn)
        return WScript.StdIn.ReadLine()
}

//-----------------------------------------------------------------------------
// Checks whether the file exists.
//-----------------------------------------------------------------------------
function fileExists(path) {
    var fs = WScript.CreateObject("Scripting.FileSystemObject")
    return fs.FileExists(path)
}

//-----------------------------------------------------------------------------
// Finds a file that corresponds to the given path.
//-----------------------------------------------------------------------------
function resolvePath(path, locations) {
    var fs = WScript.CreateObject("Scripting.FileSystemObject")

    if (fs.FileExists(path))
        return fs.GetAbsolutePathName(path)

    if (locations)
        for (var i = 0; i < locations.length; i++) {
            var newpath = fs.BuildPath(locations[i], path)
            if (fs.FileExists(newpath))
                return fs.GetAbsolutePathName(newpath)
        }

    return null
}

//-----------------------------------------------------------------------------
// This function creates needed folders if they do not exist.
//-----------------------------------------------------------------------------
function createParentFolders(path) {
    var fs = WScript.CreateObject("Scripting.FileSystemObject")
    var abspath = fs.GetAbsolutePathName(path)
    var dirs = []

    for (var dir = fs.GetParentFolderName(abspath); !fs.FolderExists(dir); ) {
        dirs.push(dir)
        dir = fs.GetParentFolderName(dir)
    }

    for (var i = dirs.length - 1; i >= 0; i--)
        fs.CreateFolder(dirs[i])
}

//-----------------------------------------------------------------------------
// Returns a string that contains contents of a text file.
//-----------------------------------------------------------------------------
function getFileContents(file) {
    var fs = WScript.CreateObject("Scripting.FileSystemObject")
    var tf = fs.OpenTextFile(file, 1 /* read only */)

    return tf.ReadAll()
}

//-----------------------------------------------------------------------------
// Constructs a path using the correct path delimiter.
//-----------------------------------------------------------------------------
function buildPath(items) {
    var fs = WScript.CreateObject("Scripting.FileSystemObject")
    var path = items[0]

    for (var i = 1; i < items.length; i++)
        path = fs.BuildPath(path, items[i])

    return path
}

//-----------------------------------------------------------------------------
// Returns an array of paths of subfolders.
//-----------------------------------------------------------------------------
function getSubFolders(dir) {
    var fs = WScript.CreateObject("Scripting.FileSystemObject")

    if (!fs.FolderExists(dir))
        return []

    var items = fs.GetFolder(dir).SubFolders
    var paths = []

    for (var i = new Enumerator(items); !i.atEnd(); i.moveNext())
        paths.push(i.item())

    return paths
}

//-----------------------------------------------------------------------------
// Creates a DOM tree. Optionally loads contents from a xml file.
//-----------------------------------------------------------------------------
function createXML(file) {
    var xml = WScript.CreateObject("Microsoft.XMLDOM")

    xml.async = false

    if (file && !xml.load(file)) {
        var err = xml.parseError
        throw "cannot load xml file: " + file + " " +
            (err ? "\n" + err.line + ":" + err.linepos + " " + err.reason : "")
    }

    return xml
}

//-----------------------------------------------------------------------------
// File
//-----------------------------------------------------------------------------
function File(path, opts) {
    var fso = WScript.CreateObject("Scripting.FileSystemObject")

    if (opts == 'wt') {
        this.stream = new ActiveXObject("ADODB.Stream")
        this.stream.Open()
        this.stream.CharSet = "UTF-8"
        this.path = path
    }
    else
        throw "options '" + opts + "' not supported"
}

File.prototype = File

//-----------------------------------------------------------------------------
// Writes a string to the file.
//-----------------------------------------------------------------------------
function File.write(text) {
    this.stream.WriteText(text)
}

//-----------------------------------------------------------------------------
// Closes the file.
//-----------------------------------------------------------------------------
function File.close() {
    this.stream.SaveToFile(this.path, 2)
}

//-----------------------------------------------------------------------------
// Picture
//
//      relsrc: the relative path to the picture file
//      path:   path to a folder where the xml file with this object is located
//-----------------------------------------------------------------------------
function Picture(node, path) {
    if (!path) throw "path not specified"

    this.path = path
    this.relsrc = node.getAttribute('src')
}

Picture.prototype = Picture

//-----------------------------------------------------------------------------
// Text
//
//      views:  <language, text>
//      style:  string (e.g. "footer")
//      path:   path to a folder where the xml file with this object is located
//-----------------------------------------------------------------------------
function Text(node, path) {
    if (!path) throw "path is not specified"

    this.style = node.getAttribute("class")
    this.views = this.loadViews(node)
    this.path = path
}

Text.prototype = Text

//-----------------------------------------------------------------------------
// Text.GetTranslation
//-----------------------------------------------------------------------------
function Text.getTranslation(lang) {
    if (this.views[lang])
        return this.views[lang]

    for (var lang in this.views)
        return this.views[lang]
}

//-----------------------------------------------------------------------------
// Text.Preprocess
//-----------------------------------------------------------------------------
function Text.preprocess(text) {
    var s = text || ""

    s = s.replace(/\s+[—-]+\s+/g, "&nbsp;&mdash;&nbsp;")

    return s
}

//-----------------------------------------------------------------------------
// Text.LoadViews
//-----------------------------------------------------------------------------
function Text.loadViews(XMLNode) {
    var nodes = XMLNode.selectNodes("view")
    var views = {}

    for (var i = 0; i < nodes.length; i++)
        try {
            var node = nodes[i]
            var lang = node.getAttribute("lang")
            var text = node.text

            if (!lang) throw "lang is missing"
            if (views[lang]) throw "a view for this lang already exists"

            views[lang] = text
        }
        catch (e) {
            throw "<view> " + i + "; " + (e.message || e)
        }

    return views
}

//-----------------------------------------------------------------------------
// Returns a Text loaded from a parent node.
// If the node is written in form
//
//      <thenode contents="thefile.xml"/>
//
// then the Text will be loaded from "thefile.xml".
// If the node is written in form
//
//      <thenode>
//          <view lang="en">some text</view>
//          <view lang="it">un testo</view>
//      <thenode>
//
// then the Text will be loaded from the contents of the node and the node
// may not have the "contents" attribute.
//
//  node:   an xml node that represents this Text object
//  path:   path to a folder where the xml file with this object is located
//-----------------------------------------------------------------------------
function Text.load(node, path, options) {
    if (!node) {
        if (options && options.optional) return null
        throw "the Text node is optional, but does not exist"
    }

    var contents = node.getAttribute("contents")

    if (contents) {
        if (node.firstChild)
            throw 'a Text node with the "contents" attribute may not have any child nodes'

        var resolvedPath = resolvePath(contents, [path])
        var textNode = createXML(resolvedPath).selectSingleNode("text")

        return new Text(textNode, resolvedPath)
    }
    else {
        return new Text(node, path)
    }
}

//-----------------------------------------------------------------------------
// Chapter
//
//      title:      Text
//      paragraphs: array of Text
//      path:       path to a folder where the xml file with this object is located
//-----------------------------------------------------------------------------
function Chapter(XMLNode, path) {
    var external = XMLNode.getAttribute("contents")

    if (!external)
        this.initialize(XMLNode, path)
    else {
        var resolvedPath = resolvePath(external, [path])
        var chapterNode = createXML(resolvedPath).selectSingleNode("body")

        this.initialize(chapterNode, resolvedPath)
    }
}

Chapter.prototype = Chapter

//-----------------------------------------------------------------------------
// Chapter.Initialize
//-----------------------------------------------------------------------------
function Chapter.initialize(parent, path) {
    this.path = path
    this.title = new Text(parent.selectSingleNode("title"), path)
    this.paragraphs = this.loadParagraphs(parent)
}

//-----------------------------------------------------------------------------
// Loads paragraphs that make up a chapter. A paragraph can be a <text> node
// with text translations in different languages or a <img> node with a picture.
//-----------------------------------------------------------------------------
function Chapter.loadParagraphs(parent) {
    var nodes = parent.selectNodes("text|img")
    var paragraphs = []

    for (var i = 0; i < nodes.length; i++)
        try {
            var node = nodes[i]

            if (node.nodeName == 'text')
                paragraphs.push(new Text(node, this.path))

            if (node.nodeName == 'img')
                paragraphs.push(new Picture(node, this.path))
        }
        catch (e) {
            throw "<text> " + i + "; " + (e.message || e)
        }

    return paragraphs
}

//-----------------------------------------------------------------------------
// Book
//
//      chapters:   array of Chapter
//      title:      Text
//      keywords:   Text
//      styles:     string (a path to a css file)
//      path:       path to a folder where the xml file with this object is located
//-----------------------------------------------------------------------------
function Book(xmlFile, path) {
    var parent = createXML(xmlFile)
    var node = parent.selectSingleNode("book")

    if (!node) throw "<book> is missing"
    if (!path) throw "path is not specified"

    this.path = path
    this.title = Text.load(node.selectSingleNode("title"), path)
    this.keywords = Text.load(node.selectSingleNode("keywords"), path, { optional: true })
    this.chapters = this.loadChapters(node)
    this.styles = this.loadStyles(node.getAttribute("styles"))
}

Book.prototype = Book

//-----------------------------------------------------------------------------
// Book.LoadStyles
//-----------------------------------------------------------------------------
function Book.loadStyles(cssfile) {
    var path = resolvePath(cssfile, [this.path])
    var text = getFileContents(path)

    return text.replace(/[\x00-\x1F]/g, '')
}

//-----------------------------------------------------------------------------
// Book.LoadChapters
//-----------------------------------------------------------------------------
function Book.loadChapters(parent) {
    var nodes = parent.selectNodes("chapter")
    var chapters = []

    if (!nodes.length) throw "<chapter> is missing"

    for (var i = 0; i < nodes.length; i++)
        try {
            chapters.push(new Chapter(nodes[i], this.path))
        }
        catch (e) {
            var path = nodes[i].getAttribute("contents")
            var chap = path ? path : "<chapter>" + i

            throw chap + "; " + (e.message || e)
        }

    return chapters
}

//-----------------------------------------------------------------------------
// Calculates the progress of translations.
//
//  total:int       the number of paragraphs in the book
//  lang[str]:int   the number of paragraphs in this language
//  nlangs:int      the number of used languages
//  clang[str]:int  the number of characters in this language
//-----------------------------------------------------------------------------
function Book.getProgressInfo() {
    var info = {
        total: 0,
        lang: {},
        nlangs: 0,
        clang: {}
    }

    for (var i in this.chapters) {
        var paragraphs = this.chapters[i].paragraphs

        for (var j in paragraphs) {
            var n = 0

            for (var lang in paragraphs[j].views) {
                var view = paragraphs[j].views[lang]
                if (view) {
                    info.lang[lang] = (info.lang[lang] || 0) + 1
                    info.clang[lang] = (info.clang[lang] || 0) + view.length
                    n++
                }
            }

            if (n) info.total++
        }
    }

    for (var i in info.lang)
        info.nlangs++

    return info
}

//-----------------------------------------------------------------------------
// XMLNode
//
//  name            string
//  attributes      map <string, string>
//  subnodes        array <XMLNode or string>
//
// Example:
//
//  <p style="some-css-style">The Text</p>
//
//  var p = new XMLNode('p')
//  p.attributes['style'] = 'some-css-style'
//  p.push('The Text')
//-----------------------------------------------------------------------------
function XMLNode(name, attributes) {
    if (!name) throw "the name of a parent node cannot be empty"

    this.name = name
    this.attributes = attributes || {}
    this.subnodes = []
}

XMLNode.prototype = XMLNode

//-----------------------------------------------------------------------------
// Adds a sub node. The sub node can be a string.
//-----------------------------------------------------------------------------
function XMLNode.push(node) {
    if (this.subnodes)
        this.subnodes.push(node)
    else
        this.subnodes = [node]
}

//-----------------------------------------------------------------------------
// XMLDoc
//
//  nodes           array <XMLNode>
//-----------------------------------------------------------------------------
function XMLDoc() {
    this.nodes = []
}

XMLDoc.prototype = XMLDoc

//-----------------------------------------------------------------------------
// Serializes itself using a function that prints a string:
//
//  puts(text)
//
//
//  opts.format     bool (false)
//  opts.indent     int (0)
//-----------------------------------------------------------------------------
function XMLDoc.serialize(puts, opts) {
    var opts = opts || {}

    opts.indent = opts.indent || 0
    opts.format = opts.format || false

    var eoln = '\n'

    var putindent = function (n) {
        var s = ''

        for (var i = 0; i < n; i++)
            s += ' '

        puts(s)
    }

    var putnode = function (node, indent) {
        if (typeof node == 'string') {
            if (opts.format)
                putindent(indent)

            puts(node)
        }
        else {
            if (opts.format)
                putindent(indent)

            puts('<' + node.name)

            for (var attr in node.attributes) {
                var s = node.attributes[attr].replace('"', '&quot;')
                puts(' ' + attr + '="' + s + '"')
            }

            var subnodes = node.subnodes || []

            if (subnodes.length == 0) {
                puts('/>')

                if (opts.format)
                    puts(eoln)
            }
            else {
                puts('>')

                if (opts.format)
                    puts(eoln)

                for (var i in subnodes) {
                    putnode(subnodes[i], indent + opts.indent)
                }

                if (opts.format)
                    putindent(indent)

                puts('</' + node.name + '>')
            }
        }

        if (opts.format)
            puts(eoln)
    }

    for (var i in this.nodes) {
        putnode(this.nodes[i], 0)
    }
}

//-----------------------------------------------------------------------------
// Composer
//
//  book:           Book
//  langs:          (string -> bool) used languaged
//  preferredLang:  the preferred language
//  info            the result of Book.GetProgressInfo
//-----------------------------------------------------------------------------
function Composer(book) {
    this.book = book
}

Composer.prototype = Composer

//-----------------------------------------------------------------------------
// Composer.SaveAs
//-----------------------------------------------------------------------------
function Composer.saveAs(HTMLFileName) {
    this.targethtml = HTMLFileName

    var doc = new XMLDoc()

    var htmlNode = new XMLNode('html')
    var headNode = new XMLNode('head')
    var bodyNode = new XMLNode('body')

    doc.nodes.push('<!doctype html>')
    doc.nodes.push(htmlNode)
    htmlNode.push(headNode)
    htmlNode.push(bodyNode)

    this.info = this.book.getProgressInfo()

    if (GlobalFlags.Debug)
        this.writeProgress(bodyNode)

    this.writeContentTypeTag(headNode)
    this.writeBookTitle(headNode)
    this.writeStyleSheet(headNode)
    this.writeKeywords(headNode)
    this.writeChapters(bodyNode)

    var file = new File(HTMLFileName, 'wt')

    try {
        doc.serialize(
            function (s) { file.write(s) },
            { indent: 2, format: true })
    } finally {
        file.close()
    }
}

//-----------------------------------------------------------------------------
// Returns a string with the preferred translation.
//-----------------------------------------------------------------------------
function Composer.getPreferredTranslation(text) {
    return text.getTranslation(this.preferredLang)
}

//-----------------------------------------------------------------------------
// Composer.writeProgress
//-----------------------------------------------------------------------------
function Composer.writeProgress(parent) {
    var info = this.info
    var node = new XMLNode("div", { 'class': 'progress' })

    parent.push(node)

    for (var lang in info.lang) {
        var p = new XMLNode('p')
        node.push(p)
        var n = Math.round(100 * info.lang[lang] / info.total)
        p.push(lang + " " + n + "% " + info.lang[lang] + "/" + info.clang[lang])
    }
}

//-----------------------------------------------------------------------------
// Composer.WriteKeywords
//-----------------------------------------------------------------------------
function Composer.writeKeywords(parent) {
    if (this.book.keywords) {
        parent.push(
            new XMLNode("meta",
            {
                "name": 'keywords',
                "content": this.getPreferredTranslation(this.book.keywords)
            })
        )
    }
}

//-----------------------------------------------------------------------------
// Composer.writeStyleSheet
//-----------------------------------------------------------------------------
function Composer.writeStyleSheet(parent) {
    var xml = new XMLNode("style")
    xml.push("<!--" + this.book.styles + "-->")
    parent.push(xml)
}

//-----------------------------------------------------------------------------
// Composer.writeContentTypeTag
//-----------------------------------------------------------------------------
function Composer.writeContentTypeTag(parent) {
    parent.push(
        new XMLNode('meta',
        {
            "http-equiv": "Content-Type",
            "content": "text/html; charset=utf-8"
        })
    )
}

//-----------------------------------------------------------------------------
// Composer.writeBookTitle
//-----------------------------------------------------------------------------
function Composer.writeBookTitle(parent) {
    var node = new XMLNode("title")
    node.push(this.getPreferredTranslation(this.book.title))
    parent.push(node)
}

//-----------------------------------------------------------------------------
// Composer.WriteChapters
//-----------------------------------------------------------------------------
function Composer.writeChapters(parent) {
    for (var i in this.book.chapters) {
        var chapter = this.book.chapters[i]

        this.writeChapterTitle(parent, chapter.title)
        this.writeParagraphs(parent, chapter.paragraphs)
    }
}

//-----------------------------------------------------------------------------
// Composer.writeChapterTitle
//-----------------------------------------------------------------------------
function Composer.writeChapterTitle(parent, title) {
    var node = new XMLNode("h2")
    node.push(this.getPreferredTranslation(title))
    parent.push(node)
}

//-----------------------------------------------------------------------------
// Composer.writeParagraphs
//-----------------------------------------------------------------------------
function Composer.writeParagraphs(parent, paragraphs) {
    var table = new XMLNode("table")

    for (var i = 0; i < paragraphs.length; i++) {
        var par = paragraphs[i]
        var row = new XMLNode("tr", par.style ? { 'class': par.style } : {})

        if (GlobalFlags.Debug)
            row.attributes.title = par.path

        if (par instanceof Text)
            this.writeLangViews(row, par.views)
        else if (par instanceof Picture) {
            this.writePicture(row, par)
            this.copyPicture(par)
        }

        table.push(row)
    }

    parent.push(table)
}

//-----------------------------------------------------------------------------
// Composer.writeLangViews
//-----------------------------------------------------------------------------
function Composer.writeLangViews(parent, views) {
    for (var lang in this.langs) {
        var text = this.chooseTranslation(views, lang)
        var str = text ? Text.preprocess(text) : ""
        var node = new XMLNode("td", { 'class': lang })

        if (GlobalFlags.Debug && text == "")
            node.attributes.style = "background:red"

        node.push(str)
        parent.push(node)
    }
}

//-----------------------------------------------------------------------------
// Chooses views[lang] as the translation if there are several languages to
// present, or finds the first non empty translation if a single translation is
// shown.
//-----------------------------------------------------------------------------
function Composer.chooseTranslation(views, lang) {
    if (typeof this.nlangs == 'undefined') {
        this.nlangs = 0
        for (var i in this.langs)
            if (this.langs[i])
                this.nlangs++
    }

    var text = views[lang]
    
    if (!text && this.nlangs == 1)
        for (var anylang in views) {
            text = views[anylang]
            if (text) break
        }
        
    return text
}

//-----------------------------------------------------------------------------
// Creates a <img> html tag.
//
//      tr      a <tr> tag inside <table>
//      pic     a Picture object
//-----------------------------------------------------------------------------
function Composer.writePicture(tr, pic) {
    var img = new XMLNode("img", { src: pic.relsrc })
    var td = new XMLNode("td")

    td.push(img)
    tr.push(td)
}

//-----------------------------------------------------------------------------
// Copies a picture to the folder with the generated html file.
//-----------------------------------------------------------------------------
function Composer.copyPicture(pic) {
    var fs = WScript.CreateObject("Scripting.FileSystemObject")

    var srcpicpath = buildPath([fs.GetParentFolderName(pic.path), pic.relsrc])
    var dstpicpath = buildPath([fs.GetParentFolderName(this.targethtml), pic.relsrc])

    fs.CopyFile(srcpicpath, dstpicpath)
}

//-----------------------------------------------------------------------------
// Tells whether a language should be written in the output.
//-----------------------------------------------------------------------------
function Composer.isLangUsed(lang) {
    return !this.langs || !!this.langs[lang] || lang == 'any'
}

//-----------------------------------------------------------------------------
// Translates a xml into a html book.
//-----------------------------------------------------------------------------
function translate(bookxml, bookhtml, options) {
    var fs = WScript.CreateObject("Scripting.FileSystemObject")
    var path = fs.GetParentFolderName(bookxml)

    var book = new Book(bookxml, path)
    var comp = new Composer(book)

    var options = options || {}

    comp.langs = options.langs
    comp.preferredLang = options.preferredLang

    createParentFolders(bookhtml)
    comp.saveAs(bookhtml)
}

//-----------------------------------------------------------------------------
// BuildBookName
//-----------------------------------------------------------------------------
function buildBookName(t) {
    var name = ""

    for (var i in t.langs)
        name = name + "-" + i

    return name.substr(1)
}

//-----------------------------------------------------------------------------
// Translates all books in a folder.
//-----------------------------------------------------------------------------
function translateAll(srcdir, resdir, translations) {
    var bookdirs = getSubFolders(srcdir)

    for (var i in bookdirs) {
        var bookxml = buildPath([bookdirs[i].Path, "book.xml"])

        // if the folder has no "book.xml" file, then it's not a book's translation
        if (!fileExists(bookxml))
            continue

        var htmldir = buildPath([resdir, bookdirs[i].Name])

        for (var t in translations) {
            var bookhtml = buildPath([htmldir, buildBookName(translations[t]) + ".html"])
            translate(bookxml, bookhtml, translations[t])
            println('created: ' + resolvePath(bookhtml))
        }
    }
}

function main() {
    var translations =
    [
        { langs: { en: true }, preferredLang: "en" },
        { langs: { ru: true }, preferredLang: "ru" },
        { langs: { en: true, ru: true }, preferredLang: "ru" }
    ]

    translateAll("src/", "res/", translations)
}

(function () {
    var args = {
        notrycatch: WScript.Arguments.Named('notrycatch')
    }

    if (args.notrycatch)
        main()
    else try {
        main()
    } catch (e) {
        println(e)
    }

    println("Press Enter to exit...")
    readln()
})()