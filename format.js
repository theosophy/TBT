//-----------------------------------------------------------------------------
// Formats a string by inserting line breaks in proper places.
//-----------------------------------------------------------------------------
function FormatText(text, maxlinesize)
{
    var lbi = [-1]
    var lsi = -1

    for (var i = 0; i < text.length; i++)
    {
        var llbi = lbi[lbi.length - 1]

        if (i - llbi > maxlinesize && lsi > llbi)
            lbi.push(lsi)

        if (text.charAt(i) == ' ')
            lsi = i
    }

    if (lbi[lbi.length - 1] < text.length - 1)
        lbi.push(text.length - 1)

    var lines = ['']

    for (var i = 1; i < lbi.length; i++)
    {
        var line = text.substring(lbi[i - 1] + 1, lbi[i] + 1)
        lines.push(line)
    }

    return lines.join('\n')
}

//-----------------------------------------------------------------------------
// Formats all <view> tags in a xml file.
//-----------------------------------------------------------------------------
function FormatFile(args)
{
    var xml = WScript.CreateObject("Microsoft.XMLDOM")

    xml.async = false
    xml.load(args.src)

    var nodes = xml.selectNodes('//view')

    for (var i = 0; i < nodes.length; i++)
    {
        var text = nodes[i].text
        text = text.replace(/[\x00-\x20]+/gm, ' ')
        text = FormatText(text, args.maxline)
        nodes[i].text = text
    }

    xml.save(args.res)
}

//-----------------------------------------------------------------------------
// Returns an argument by name.
//-----------------------------------------------------------------------------
function Arg(name)
{
    return WScript.Arguments.Named(name)
}

//-----------------------------------------------------------------------------
// Prints a line to console.
//-----------------------------------------------------------------------------
function Println(text)
{
    WScript.StdOut.WriteLine(text)
}

//-----------------------------------------------------------------------------
// Main function.
//-----------------------------------------------------------------------------
function Main()
{
    var src = Arg('src')
    var res = Arg('res')

    if (!src || !res)
    {
        Println('cscript format.js /src:sourcexml /res:resultxml')
        return
    }

    FormatFile
    ({
        maxline:    100,
        src:        src,
        res:        res
    })
}

Main()