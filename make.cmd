@md bin 2> nul
@call npm i

@node build --book src/loa --lang ru en --format md > bin/loa-ru.md
@node build --book src/manwhw --lang ru en --format md > bin/manwhw-ru.md

@node build --book src/loa --lang ru en > bin/loa-ru-en.html
@node build --book src/manwhw --lang ru > bin/manwhw-ru.html

@node build --book src/loa --lang ru > bin/loa-ru.html
@node build --book src/manwhw --lang ru en > bin/manwhw-ru-en.html
