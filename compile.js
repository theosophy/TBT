function println(s)
{
    WScript.StdOut.WriteLine(s)
}

function assert(f, s)
{
    if (!f)
    {
        if (WScript.StdErr)
            WScript.StdErr.WriteLine(s)

        throw s
    }
}

function warn(f, s)
{
    if (!f)
    {
        if (WScript.StdErr)
            WScript.StdErr.WriteLine(s)
    }
}

function CreateXML(file)
{
    var xml = WScript.CreateObject("Microsoft.XMLDOM")
    
    if (file && !xml.load(file))
        throw "cannot load xml file: " + file
        
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
        
        assert(lang, "lang is missing")
        //warn(text, "text is missing")
        assert(!views[lang], "a view for this lang already exists")
        
        views[lang] = text
    }
    catch(e)
    {
        throw "view " + i + "; " + e
    }
    
    return views
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
        throw "text " + i + "; " + e
    }
        
    return paragraphs
}

//-----------------------------------------------------------------------------
// Book
//
//      chapters: array of Chapter
//-----------------------------------------------------------------------------
function Book(xmlFile)
{
    var XML = CreateXML(xmlFile)
    var node = XML.selectSingleNode("book")
    
    assert(node != null, "<book> is missing")
    
    this.title      = node.getAttribute("title")
    this.keywords   = node.getAttribute("keywords")
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
    
    assert(nodes.length, "<chapter> is missing")
    
    for (var i = 0; i < nodes.length; i++)
    try
    {
        chapters.push(new Chapter(nodes[i]))
    }
    catch(e)
    {
        throw "chapter " + i + "; " + e
    }
    
    return chapters
}

//-----------------------------------------------------------------------------
// HTMLComposer
//-----------------------------------------------------------------------------
function HTMLComposer(book)
{
    this.book = book
}

HTMLComposer.prototype = HTMLComposer

//-----------------------------------------------------------------------------
// HTMLComposer.SaveAs
//-----------------------------------------------------------------------------
function HTMLComposer.SaveAs(HtmlFilePath)
{
    this.XMLDoc = CreateXML()
    
    var XML = this.XMLDoc
    
    var htmlNode = XML.createElement("html")
    var headNode = XML.createElement("head")
    var bodyNode = XML.createElement("body") 
    
    XML.appendChild(htmlNode)
    htmlNode.appendChild(headNode)
    htmlNode.appendChild(bodyNode)
 
    this.WriteContentTypeTag(headNode)
    this.WriteBookTitle(headNode)
    this.WriteStyleSheet(headNode)
    this.WriteKeywords(headNode)
    this.WriteChapters(bodyNode)
    
    XML.save(HtmlFilePath)
    
    this.XMLDoc = null
}

//-----------------------------------------------------------------------------
// HTMLComposer.CreateNode
//-----------------------------------------------------------------------------
function HTMLComposer.CreateNode(name)
{
    return this.XMLDoc.createNode(1, name, "")
}

//-----------------------------------------------------------------------------
// HTMLComposer.WriteKeywords
//-----------------------------------------------------------------------------
function HTMLComposer.WriteKeywords(XML)
{
    var node = this.CreateNode("meta")
    
    node.setAttribute("name", "keywords")
    node.setAttribute("content", this.book.keywords)
    
    XML.appendChild(node)
}

//-----------------------------------------------------------------------------
// HTMLComposer.WriteStyleSheet
//-----------------------------------------------------------------------------
function HTMLComposer.WriteStyleSheet(XML)
{
    var node = this.CreateNode("link")
    
    node.setAttribute("rel", "stylesheet")
    node.setAttribute("type", "text/css")
    node.setAttribute("href", this.book.styles)
    
    XML.appendChild(node)
}

//-----------------------------------------------------------------------------
// HTMLComposer.WriteContentTypeTag
//-----------------------------------------------------------------------------
function HTMLComposer.WriteContentTypeTag(XML)
{
    var node = this.CreateNode("meta")
    
    node.setAttribute("http-equiv", "Content-Type")
    node.setAttribute("content", "text/html; charset=utf-8")
    
    XML.appendChild(node)
}

//-----------------------------------------------------------------------------
// HTMLComposer.WriteBookTitle
//-----------------------------------------------------------------------------
function HTMLComposer.WriteBookTitle(XML)
{
    var node = this.CreateNode("title")
    node.text = this.book.title
    XML.appendChild(node)
}

//-----------------------------------------------------------------------------
// HTMLComposer.WriteChapters
//-----------------------------------------------------------------------------
function HTMLComposer.WriteChapters(XML)
{
    for (var i in this.book.chapters)
    {
        var chapter = this.book.chapters[i]
        
        this.WriteChapterTitle(XML, chapter.title)
        this.WriteParagraphs(XML, chapter.paragraphs)
    }
}

//-----------------------------------------------------------------------------
// HTMLComposer.WriteChapterTitle
//-----------------------------------------------------------------------------
function HTMLComposer.WriteChapterTitle(XML, title)
{
    var node = this.CreateNode("h2")
    node.text = title.GetTranslation("ru")
    XML.appendChild(node)
}

//-----------------------------------------------------------------------------
// HTMLComposer.WriteParagraphs
//-----------------------------------------------------------------------------
function HTMLComposer.WriteParagraphs(XML, paragraphs)
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
// HTMLComposer.WriteLangViews
//-----------------------------------------------------------------------------
function HTMLComposer.WriteLangViews(XML, views)
{
    for (var lang in views)
    {
        var text = views[lang]
        var node = this.CreateNode("p")
        
        node.text = Text.Preprocess(text)
        node.setAttribute("class", lang)
        
        XML.appendChild(node)
    }
}

//-----------------------------------------------------------------------------
// Main
//-----------------------------------------------------------------------------

try
{
    var b = new Book("book.xml")
    var c = new HTMLComposer(b)
    
    c.SaveAs("book.html")
}
catch(e)
{
    WScript.StdErr.WriteLine("exception: " + e.message)
}