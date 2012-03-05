Logger =
{
    errors: {},
    
    LogError: function(text)
    {
        errors.push(text + "")
    }
}

//-----------------------------------------------------------------------------
// Creates a XML DOM tree. Optionally loads contents from a xml file.
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
// Returns a Text loaded from a XML node.
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
function Chapter.Initialize(XML)
{
    this.title      = new Text(XML.selectSingleNode("title"))
    this.paragraphs = this.LoadParagraphs(XML)
}

//-----------------------------------------------------------------------------
// Chapter.LoadParagraphs
//-----------------------------------------------------------------------------
function Chapter.LoadParagraphs(XML)
{
    var nodes = XML.selectNodes("text")
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
    var XML = CreateXML(xmlFile)
    var node = XML.selectSingleNode("book")
    
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
function Book.LoadChapters(XML)
{
    var nodes = XML.selectNodes("chapter")
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
// Composer
//
//  book:           Book
//  XMLDoc:         XML document
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
function Composer.SaveAs(HtmlFilePath)
{
    this.XMLDoc = CreateXML()
    
    var XML = this.XMLDoc
    
    var htmlNode = XML.createElement("html")
    var headNode = XML.createElement("head")
    var bodyNode = XML.createElement("body")
    var commNode = XML.createComment("This file is generated by a script")
    
    XML.appendChild(commNode)
    XML.appendChild(htmlNode)
    htmlNode.appendChild(headNode)
    htmlNode.appendChild(bodyNode)
 
    this.WriteGIT(bodyNode)
    this.WriteProgress(bodyNode)
    this.WriteContentTypeTag(headNode)
    this.WriteBookTitle(headNode)
    this.WriteStyleSheet(headNode)
    this.WriteKeywords(headNode)
    this.WriteChapters(bodyNode)
    
    XML.save(HtmlFilePath)
    
    this.XMLDoc = null
}

//-----------------------------------------------------------------------------
// Composer.CreateNode
//-----------------------------------------------------------------------------
function Composer.CreateNode(name)
{
    return this.XMLDoc.createElement(name)
}

//-----------------------------------------------------------------------------
// Returns a string with the preferred translation.
//-----------------------------------------------------------------------------
function Composer.GetPreferredTranslation(text)
{
    return text.GetTranslation(this.preferredLang)
}

//-----------------------------------------------------------------------------
// Add a link to the GIT repo, where the sources of this book can be modified.
//-----------------------------------------------------------------------------
function Composer.WriteGIT(parent)
{
    var node = this.CreateNode("a")
    
    node.setAttribute("class", "git")
    node.setAttribute("href", "https://github.com/theosophy/lives-of-alcyone")
    
    node.text = "github"
    
    parent.appendChild(node)
}

//-----------------------------------------------------------------------------
// Composer.WriteProgress
//-----------------------------------------------------------------------------
function Composer.WriteProgress(parent)
{
    var info = this.book.GetProgressInfo()
    
    var node = this.CreateNode("div")
    parent.appendChild(node)
    
    node.setAttribute("class", "progress")
    
    var addp = function(dom, text)
    {
        var n = dom.CreateNode("p")
        n.text = text
        node.appendChild(n)
    }
    
    for (var lang in info.lang)
        addp(this, lang + " " + Math.round(100 * info.lang[lang] / info.total) +
            "% " + info.lang[lang])
}

//-----------------------------------------------------------------------------
// Composer.WriteKeywords
//-----------------------------------------------------------------------------
function Composer.WriteKeywords(XML)
{
    if (this.book.keywords)
    {
        var node = this.CreateNode("meta")
        
        node.setAttribute("name", "keywords")
        node.setAttribute("content", this.GetPreferredTranslation(this.book.keywords))
        
        XML.appendChild(node)
    }
}

//-----------------------------------------------------------------------------
// Composer.WriteStyleSheet
//-----------------------------------------------------------------------------
function Composer.WriteStyleSheet(XML)
{
    var node = this.CreateNode("link")
    
    node.setAttribute("rel", "stylesheet")
    node.setAttribute("type", "text/css")
    node.setAttribute("href", this.book.styles)
    
    XML.appendChild(node)
}

//-----------------------------------------------------------------------------
// Composer.WriteContentTypeTag
//-----------------------------------------------------------------------------
function Composer.WriteContentTypeTag(XML)
{
    var node = this.CreateNode("meta")
    
    node.setAttribute("http-equiv", "Content-Type")
    node.setAttribute("content", "text/html; charset=utf-8")
    
    XML.appendChild(node)
}

//-----------------------------------------------------------------------------
// Composer.WriteBookTitle
//-----------------------------------------------------------------------------
function Composer.WriteBookTitle(XML)
{
    var node = this.CreateNode("title")
    node.text = this.GetPreferredTranslation(this.book.title)
    XML.appendChild(node)
}

//-----------------------------------------------------------------------------
// Composer.WriteChapters
//-----------------------------------------------------------------------------
function Composer.WriteChapters(XML)
{
    for (var i in this.book.chapters)
    {
        var chapter = this.book.chapters[i]
        
        this.WriteChapterTitle(XML, chapter.title)
        this.WriteParagraphs(XML, chapter.paragraphs)
    }
}

//-----------------------------------------------------------------------------
// Composer.WriteChapterTitle
//-----------------------------------------------------------------------------
function Composer.WriteChapterTitle(XML, title)
{
    var node = this.CreateNode("h2")
    node.text = this.GetPreferredTranslation(title)
    XML.appendChild(node)
}

//-----------------------------------------------------------------------------
// Composer.WriteParagraphs
//-----------------------------------------------------------------------------
function Composer.WriteParagraphs(XML, paragraphs)
{
    for (var i in paragraphs)
    {
        var text = paragraphs[i]
        var root = this.CreateNode("div")
        
        if (text.style)
            root.setAttribute("class", text.style)

        this.WriteLangViews(root, text.views)
        
        XML.appendChild(root)
    }
}

//-----------------------------------------------------------------------------
// Composer.WriteLangViews
//-----------------------------------------------------------------------------
function Composer.WriteLangViews(XML, views)
{
    for (var lang in views)
    if (this.IsLangUsed(lang))
    {
        var text = views[lang]
        var node = this.CreateNode("p")
        
        node.text = Text.Preprocess(text)
        node.setAttribute("class", lang)
        
        XML.appendChild(node)
    }
}

//-----------------------------------------------------------------------------
// Tells whether a language should be written in the output.
//-----------------------------------------------------------------------------
function Composer.IsLangUsed(lang)
{
    return !this.langs || !!this.langs[lang]
}

//-----------------------------------------------------------------------------
// Main
//-----------------------------------------------------------------------------

function Translate()
{
    var book = new Book("book.xml")
    var comp = new Composer(book)
    
    // all languages
    comp.langs = null
    comp.preferredLang = "ru"
    comp.SaveAs("book-all.html")
    
    // en only
    comp.langs = {en:true}
    comp.preferredLang = "en"
    comp.SaveAs("book-en.html")
    
    // ru only
    comp.langs = {ru:true}
    comp.preferredLang = "ru"
    comp.SaveAs("book-ru.html")
}

Translate()