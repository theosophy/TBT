[![Build Status](https://travis-ci.org/theosophy/TBT.svg?branch=master)](https://travis-ci.org/theosophy/TBT)

Полный перевод книги "Человек: Откуда, как и Куда" ("Max: Whence, How and Whither").

Неполный перевод книги "Жизни Алкиона" ("Lives of Alcyone").

Переводы публикуются на http://theosophy.github.io/

If you want to translate a chapter of the book, follow these steps:

1. Go to https://sites.google.com/site/livesofalcyone/ and find what
   you want to translate. This source is not mandatory, but it's more
   complete than other sources I could find.
   
2. For example you have chosen chapter "Life 15" to translate.
   Create a file `/src/loa/chapters/life15.xml` and put the contents of the chapter
   from the source to the created file. Use `/src/loa/chapters/life1.xml`
   as an example.
   
3. Open `/src/loa/book.xml` and add a reference to the created file:

        <?xml version="1.0" encoding="UTF-8"?>
        <book title="Lives of Alcyone">
            <chapter contents="chapters/note.xml"/>
            <chapter contents="chapters/foreword.xml"/>
            <chapter contents="chapters/intro.xml"/>
            <chapter contents="chapters/life1.xml"/>
            
            <chapter contents="chapters/life15.xml"/>
        </book>
        
4. Open `/src/loa/chapters/life15.xml` and add `<view>` tags with the translation.
   Use `/src/loa/chapters/life1.xml` as an example.
   
5. Run `npm test` - it will compile the books.

6. Publish the updated books at the site [repository](https://github.com/theosophy/theosophy.github.io).

7. See the published version at [theosophy.github.io](http://theosophy.github.io/).
