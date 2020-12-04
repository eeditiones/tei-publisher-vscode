class KBA {

    async query(register, key) {
        let apis = register === '' ?  ['actors', 'places', 'terms'] : [register];
        const results = [];
        for (let api of apis) {
            console.log('sending %s query: %s', api, key);
            const json = await fetch(`https://kb-prepare.k-r.ch/api/${api}?search=${encodeURIComponent(key)}`, { mode: "cors" })
                .then(response => response.json());
            let label;
            switch (api) {
                case 'places':
                    label = 'placeName_full';
                    break;
                case 'terms':
                    label = 'fullLabel';
                    break;
                default:
                    label = 'persName_full';
                    break;
            }
            json.data.forEach((item) => {
                const link = document.createElement('a');
                link.href = `https://kb-prepare.k-r.ch/${api}/${item.id}`;
                link.target = '_blank';
                link.innerHTML = item['full-id'];

                const type = api === 'actors' ? item['authority_type'] : api;
                const result = {
                    type: type,
                    id: item['full-id'],
                    label: item[label],
                    data: link
                };
                results.push(result);
            });
        }
        return results;
    }

    format(item) {
        switch (item.type) {
            case 'person':
                return {
                    before: `<persName key="${item.id}">`,
                    after: `</persName>`
                };
            case 'organisation':
                return {
                    before: `<orgName key="${item.id}">`,
                    after: `</orgName>`
                };
            case 'places':
                return {
                    before: `<placeName key="${item.id}">`,
                    after: `</placeName>`
                };
            case 'terms':
                return {
                    before: `<term key="${item.id}">`,
                    after: `</term>`
                };
        }
    }
}

class View {
    
    constructor(registry, vscode) {
        this.registry = registry;
        this.vscode = vscode;

        const runQuery = document.getElementById('run-query');
        runQuery.addEventListener('click', (ev) => {
            ev.preventDefault();
            this.lookup();
        });

        // Handle messages sent from the extension to the webview
        window.addEventListener('message', event => {
            const message = event.data; // The json data that the extension sent
            switch (message.command) {
                case 'query':
                    document.getElementById('query').value = message.text;
                    this.lookup();
                    break;
            }
        });
    }

    outputResults(items) {
        const results = document.getElementById('results');
        items.forEach((item) => {
            const tr = document.createElement('tr');
            let td = document.createElement('td');
            tr.appendChild(td);
            const button = document.createElement('a');
            td.appendChild(button);
            button.className = 'button';
            button.innerHTML = `<span class="icon"><i class="fas fa-edit"></i></span>`;
            button.addEventListener('click', () => {
                const format = this.registry.format(item);
                this.vscode.postMessage({
                    command: 'replace',
                    before: format.before,
                    after: format.after
                });
            });

            td = document.createElement('td');
            td.innerHTML = item.label;
            tr.appendChild(td);

            td = document.createElement('td');
            tr.appendChild(td);
            td.appendChild(item.data);

            results.appendChild(tr);
        });
    }

    lookup() {
        const query = document.getElementById('query').value;
        const style = document.getElementById('api-list').value;
        const results = document.getElementById('results');
        console.log('Sending query: %s: %s', style, query);
        results.innerHTML = '';
        this.registry.query(style, query)
            .then((results) => {
                this.outputResults(results);
            });
    }
}

(function () {
    const registry = new KBA();
    const vscode = acquireVsCodeApi();
    new View(registry, vscode);
}());