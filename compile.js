Logger =
{
    errors: [],
    
    LogError: function(text)
    {
        Logger.errors.push(text + "")
    }
}

//-----------------------------------------------------------------------------
// File
//-----------------------------------------------------------------------------
function File(path, opts)
{
    var fso = WScript.CreateObject("Scripting.FileSystemObject")
    
    if (opts == 'wt')    
    {
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
function File.Write(text)
{
    this.stream.WriteText(text)
}

//-----------------------------------------------------------------------------
// Closes the file.
//-----------------------------------------------------------------------------
function File.Close()
{
    this.stream.SaveToFile(this.path, 2)
}

//-----------------------------------------------------------------------------
// Creates a parent DOM tree. Optionally loads contents from a xml file.
//-----------------------------------------------------------------------------
function CreateXML(file)
{
    var xml = WScript.CreateObject("Microsoft.XMLDOM")
    
    xml.async = false
    
    if (file && !xml.load(file))
    {
        var err = xml.parseError
        throw "cannot load xml file: " + file + " " + 
            (err ? "\n" + err.line + ":" + err.linepos + " " + err.reason : "")
    }

    return xml
}

//-----------------------------------------------------------------------------
// Text
//
//      views: map from string (language) to string (text)
//      style: string (e.g. "footer")
//-----------------------------------------------------------------------------
function Text(XMLNode)
{
    this.style = XMLNode.getAttribute("class")
    this.views = this.LoadViews(XMLNode)
}

Text.prototype = Text

//-----------------------------------------------------------------------------
// Text.GetTranslation
//-----------------------------------------------------------------------------
function Text.GetTranslation(lang)
{
    if (this.views[lang])
        return this.views[lang]
        
    for (var lang in this.views)
        return this.views[lang]
}

//-----------------------------------------------------------------------------
// Text.Preprocess
//-----------------------------------------------------------------------------
function Text.Preprocess(text)
{
    var s = text || ""
    
    s = s.replace(/\s*-+\s*/, " - ")
    
    return s
}

//-----------------------------------------------------------------------------
// Text.LoadViews
//-----------------------------------------------------------------------------
function Text.LoadViews(XMLNode)
{
    var nodes = XMLNode.selectNodes("view")
    var views = {}
    
    for (var i = 0; i < nodes.length; i++)
    try
    {
        var node = nodes[i]
        var lang = node.getAttribute("lang")
        var text = node.text
        
        if (!lang)          throw "lang is missing"
        if (views[lang])    throw "a view for this lang already exists"
        
        views[lang] = text
    }
    catch(e)
    {
        Logger.LogError("<view> " + i + "; " + (e.message || e))
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
//-----------------------------------------------------------------------------
function Text.Load(node, options)
{
    if (!node)
    {
        if (options && options.optional) return null
        throw "the Text node is optional, but does not exist"
    }
    
    var contents = node.getAttribute("contents")
    
    if (contents)
    {
        if (node.firstChild)
            throw 'a Text node with the "contents" attribute may not have any child nodes'

        return new Text(CreateXML(contents).selectSingleNode("text"))
    }
    else
    {
        return new Text(node)
    }
}

//-----------------------------------------------------------------------------
// Chapter
//
//      title:      Text
//      paragraphs: array of Text
//-----------------------------------------------------------------------------
function Chapter(XMLNode)
{
    var external = XMLNode.getAttribute("contents")

    this.Initialize(external ?
        CreateXML(external).selectSingleNode("body") :
        XMLNode)
}

Chapter.prototype = Chapter

//-----------------------------------------------------------------------------
// Chapter.Initialize
//-----------------------------------------------------------------------------
function Chapter.Initialize(parent)
{
    this.title      = new Text(parent.selectSingleNode("title"))
    this.paragraphs = this.LoadParagraphs(parent)
}

//-----------------------------------------------------------------------------
// Chapter.LoadParagraphs
//-----------------------------------------------------------------------------
function Chapter.LoadParagraphs(parent)
{
    var nodes = parent.selectNodes("text")
    var paragraphs = []
    
    for (var i = 0; i < nodes.length; i++)
    try
    {
        paragraphs.push(new Text(nodes[i]))
    }
    catch(e)
    {
        Logger.LogError("<text> " + i + "; " + (e.message || e))
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
//-----------------------------------------------------------------------------
function Book(xmlFile)
{
    var parent = CreateXML(xmlFile)
    var node = parent.selectSingleNode("book")
    
    if (!node) throw "<book> is missing"
    
    this.title      = Text.Load(node.selectSingleNode("title"))
    this.keywords   = Text.Load(node.selectSingleNode("keywords"), {optional:true})
    this.styles     = node.getAttribute("styles")
    this.chapters   = this.LoadChapters(node)
}

Book.prototype = Book

//-----------------------------------------------------------------------------
// Book.LoadChapters
//-----------------------------------------------------------------------------
function Book.LoadChapters(parent)
{
    var nodes = parent.selectNodes("chapter")
    var chapters = []
    
    if (!nodes.length) throw "<chapter> is missing"
    
    for (var i = 0; i < nodes.length; i++)
    try
    {
        chapters.push(new Chapter(nodes[i]))
    }
    catch(e)
    {
        Logger.LogError("<chapter> " + i + "; " + (e.message || e))
    }
    
    return chapters
}

//-----------------------------------------------------------------------------
// Calculates the progress of translations.
//
//  total:int       the number of paragraphs in the book
//  lang[str]:int   the number of paragraphs in this language
//-----------------------------------------------------------------------------
function Book.GetProgressInfo()
{
    var info = { total:0, lang:{} }

    for (var i in this.chapters)
    {
        var paragraphs = this.chapters[i].paragraphs
        
        for (var j in paragraphs)
        {
            var n = 0
            
            for (var lang in paragraphs[j].views)
                if (paragraphs[j].views[lang])
                {
                    info.lang[lang] = (info.lang[lang] || 0) + 1
                    n++
                }
            
            if (n) info.total++
        }
    }
    
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
//  p.subnodes.push('The Text')
//-----------------------------------------------------------------------------
function XMLNode(name, attributes)
{
    if (!name) throw "the name of a parent node cannot be empty"
    
    this.name       = name
    this.attributes = attributes || {}
    this.subnodes   = []
}

XMLNode.prototype = XMLNode

//-----------------------------------------------------------------------------
// Adds a sub node. The sub node can be a string.
//-----------------------------------------------------------------------------
function XMLNode.push(node)
{
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
function XMLDoc()
{
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
function XMLDoc.Serialize(puts, opts)
{
    var opts = opts || {}
    
    opts.indent = opts.indent || 0
    opts.format = opts.format || false
    
    var eoln = '\n'
    
    var putindent = function(n)
    {
        var s = ''
        
        for (var i = 0; i < n; i++)
            s += ' '
            
        puts(s)
    }
    
    var putnode = function(node, indent)
    {
        if (typeof(node) == 'string')
        {
            putindent(indent)
            puts(node)
        }
        else
        {
            putindent(indent)
            puts('<' + node.name)
            
            for (var attr in node.attributes)
            {
                var s = node.attributes[attr].replace('"', '&quot;')
                puts(' ' + attr + '="' + s + '"')
            }
            
            var subnodes = node.subnodes
            
            if (opts.format && subnodes && subnodes.length > 0)
            {
                puts('>')
                puts(eoln)
                
                for (var i in subnodes)
                {
                    putnode(subnodes[i], indent + opts.indent)
                }
                
                putindent(indent)
                puts('</' + node.name + '>')                
            }
            else
            {
                puts('/>')
            }
        }
        
        if (opts.format)
            puts(eoln)
    }
    
    for (var i in this.nodes)
    {
        putnode(this.nodes[i], 0)
    }
}

//-----------------------------------------------------------------------------
// Composer
//
//  book:           Book
//  langs:          (string -> bool) used languaged
//  preferredLang:  the preferred language
//-----------------------------------------------------------------------------
function Composer(book)
{
    this.book = book
}

Composer.prototype = Composer

//-----------------------------------------------------------------------------
// Composer.SaveAs
//-----------------------------------------------------------------------------
function Composer.SaveAs(HTMLFileName)
{
    var doc = new XMLDoc()
    
    var htmlNode = new XMLNode('html')
    var headNode = new XMLNode('head')
    var bodyNode = new XMLNode('body')
    
    doc.nodes.push('<!-- This file is generated by a script -->')
    doc.nodes.push(htmlNode)
    htmlNode.push(headNode)
    htmlNode.push(bodyNode)
 
    this.WriteProgress(bodyNode)
    this.WriteContentTypeTag(headNode)
    this.WriteBookTitle(headNode)
    this.WriteStyleSheet(headNode)
    this.WriteKeywords(headNode)
    this.WriteChapters(bodyNode)
    
    var file = new File(HTMLFileName, 'wt')
    
    doc.Serialize(
        function(s) { file.Write(s) },
        { indent:2, format:true })
    
    file.Close()
}

//-----------------------------------------------------------------------------
// Returns a string with the preferred translation.
//-----------------------------------------------------------------------------
function Composer.GetPreferredTranslation(text)
{
    return text.GetTranslation(this.preferredLang)
}

//-----------------------------------------------------------------------------
// Composer.WriteProgress
//-----------------------------------------------------------------------------
function Composer.WriteProgress(parent)
{
    var info = this.book.GetProgressInfo()
    
    var node = new XMLNode("div", { 'class':'progress' })
    
    parent.push(node)
    
    for (var lang in info.lang)
    {
        var p = new XMLNode('p')
        node.push(p)
        p.push(lang + " " + Math.round(100 * info.lang[lang] / info.total) + "% " + info.lang[lang])
    }
}

//-----------------------------------------------------------------------------
// Composer.WriteKeywords
//-----------------------------------------------------------------------------
function Composer.WriteKeywords(parent)
{
    if (this.book.keywords)
    {
        parent.push(
            new XMLNode("meta",
            {
                "name":     'keywords',
                "content":  this.GetPreferredTranslation(this.book.keywords)
            })
        )
    }
}

//-----------------------------------------------------------------------------
// Composer.WriteStyleSheet
//-----------------------------------------------------------------------------
function Composer.WriteStyleSheet(parent)
{
    parent.push(
        new XMLNode("link",
        {
            "rel":  "stylesheet",
            "type": "text/css",
            "href": this.book.styles
        })
    )
}

//-----------------------------------------------------------------------------
// Composer.WriteContentTypeTag
//-----------------------------------------------------------------------------
function Composer.WriteContentTypeTag(parent)
{
    parent.push(
        new XMLNode('meta',
        {
            "http-equiv":   "Content-Type",
            "content":      "text/html; charset=utf-8"
        })
    )
}

//-----------------------------------------------------------------------------
// Composer.WriteBookTitle
//-----------------------------------------------------------------------------
function Composer.WriteBookTitle(parent)
{
    var node = new XMLNode("title")
    node.push(this.GetPreferredTranslation(this.book.title))
    parent.push(node)
}

//-----------------------------------------------------------------------------
// Composer.WriteChapters
//-----------------------------------------------------------------------------
function Composer.WriteChapters(parent)
{
    for (var i in this.book.chapters)
    {
        var chapter = this.book.chapters[i]
        
        this.WriteChapterTitle(parent, chapter.title)
        this.WriteParagraphs(parent, chapter.paragraphs)
    }
}

//-----------------------------------------------------------------------------
// Composer.WriteChapterTitle
//-----------------------------------------------------------------------------
function Composer.WriteChapterTitle(parent, title)
{
    var node = new XMLNode("h2")
    node.push(this.GetPreferredTranslation(title))
    parent.push(node)
}

//-----------------------------------------------------------------------------
// Composer.WriteParagraphs
//-----------------------------------------------------------------------------
function Composer.WriteParagraphs(parent, paragraphs)
{
    for (var i in paragraphs)
    {
        var text = paragraphs[i]
        var root = new XMLNode("div", text.style ? { 'class':text.style } : {})

        this.WriteLangViews(root, text.views)
        
        parent.push(root)
    }
}

//-----------------------------------------------------------------------------
// Composer.WriteLangViews
//-----------------------------------------------------------------------------
function Composer.WriteLangViews(parent, views)
{
    for (var lang in views)
        if (this.IsLangUsed(lang))
        {
            var text = views[lang]
            var node = new XMLNode("p", { 'class':lang })
            
            node.push(Text.Preprocess(text))
            
            parent.push(node)
        }
}

//-----------------------------------------------------------------------------
// Tells whether a language should be written in the output.
//-----------------------------------------------------------------------------
function Composer.IsLangUsed(lang)
{
    return !this.langs || !!this.langs[lang] || lang == 'any'
}

//-----------------------------------------------------------------------------
// Main
//-----------------------------------------------------------------------------

function Translate()
{
    var book = new Book("book.xml")
    var comp = new Composer(book)
    
    // en only
    comp.langs = {en:true}
    comp.preferredLang = "en"
    comp.SaveAs("book-en.html")    
    
    // all languages
    comp.langs = null
    comp.preferredLang = "ru"
    comp.SaveAs("book-all.html")
    
    // ru only
    comp.langs = {ru:true}
    comp.preferredLang = "ru"
    comp.SaveAs("book-ru.html")
}

Translate()