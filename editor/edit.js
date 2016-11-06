(function () {
    function log(...args) {
        console.log('[edit.js]', ...args);
    }

    log('Initializing');

    document.body.addEventListener('mousedown', event => {
        const target = event.target; // <td>
        const chapter = target.parentElement.parentElement.parentElement; // <table>

        var paraid = 0;

        for (const tr of chapter.querySelectorAll('tr')) {
            if (tr == target.parentElement)
                break;
            paraid++;
        }

        var langid = 0;

        for (const td of target.parentElement.querySelectorAll('td')) {
            if (td == target)
                break;
            langid++;
        }

        const langs = document.body.getAttribute('data-lang').split(' ');

        // e.g. /src/loa/chapters/life33.xml?para=15&lang=ru
        const url = '/' + document.body.getAttribute('data-path')
            + '/' + chapter.getAttribute('data-path')
            + '?para=' + paraid + '&lang=' + langs[langid];

        if (target.tagName == 'TD' && target.textContent == '' && !target.hasAttribute('contenteditable')) {
            log(url, 'enabled for editing');
            target.setAttribute('contenteditable', 'true');
            target.addEventListener('keyup', event => {
                if (event.which == 13 && event.ctrlKey) {
                    const text = target.textContent;
                    log(url, 'updating contents with', text);
                    const xhr = new XMLHttpRequest;
                    xhr.open('POST', url);
                    xhr.send(text);
                    target.removeAttribute('contenteditable');
                    xhr.onreadystatechange = () => {
                        if (xhr.readyState != 4)
                            return;

                        if (xhr.status >= 200 && xhr.status < 300) {
                            target.setAttribute('class', 'done');
                        } else {
                            target.setAttribute('class', 'fail');
                            target.setAttribute('title', xhr.status + ' ' + xhr.statusText + '\n'
                                + xhr.responseText);
                        }
                    };
                }
            });
        }
    });
})();