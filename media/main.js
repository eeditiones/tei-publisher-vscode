class View {
    
    constructor(vscode) {
        this.vscode = vscode;

        const runQuery = document.getElementById('run-query');
        runQuery.addEventListener('click', (ev) => {
            ev.preventDefault();
            this.lookup();
        });

        const register = document.getElementById('api-list');
        register.addEventListener('change', (ev) => {
            this.vscode.postMessage({
                command: 'register',
                register: register.value
            });
        });

        const input = document.getElementById('query');
        input.addEventListener('keyup', (ev) => {
            if (ev.key === 'Enter') {
                this.lookup();
            }
        });

        // Handle messages sent from the extension to the webview
        window.addEventListener('message', event => {
            const message = event.data; // The json data that the extension sent
            switch (message.command) {
                case 'query':
                    document.getElementById('query').value = message.text;
                    this.lookup();
                    break;
                case 'results':
                    document.getElementById('query').value = message.query;
                    this.outputResults(message.data);
                    break;
            }
        });
    }

    outputResults(items) {
        document.getElementById('items').innerHTML = items.totalItems;
        const results = document.getElementById('results');
        results.innerHTML = '';
        items.items.forEach((item) => {
            const tr = document.createElement('tr');
            let td = document.createElement('td');
            tr.appendChild(td);
            const button = document.createElement('button');
            td.appendChild(button);
            button.innerHTML = `<i class="codicon codicon-add"></i>`;
            button.addEventListener('click', () => {
                this.vscode.postMessage({
                    command: 'replace',
                    item: item,
                    register: item.register
                });
            });

            td = document.createElement('td');
            let div = document.createElement('div');
            td.appendChild(div);

            if (item.link) {
                const link = document.createElement('a');
                link.target = '_blank';
                link.href = item.link;
                link.innerHTML = item.label;
                div.appendChild(link);
            } else {
                div.innerHTML = item.label;
            }
            if (item.details) {
                div = document.createElement('div');
                div.className = 'details';
                div.innerHTML = item.details;
                td.appendChild(div);
            }
            tr.appendChild(td);

            td = document.createElement('td');
            td.innerHTML = item.register;
            tr.appendChild(td);
            
            results.appendChild(tr);
        });
    }

    lookup() {
        const query = document.getElementById('query').value;
        const style = document.getElementById('api-list').value;
        const results = document.getElementById('results');
        console.log('Sending query: %s: %s', style, query);
        results.innerHTML = '';
        this.vscode.postMessage({
            'command': 'query',
            'register': style,
            'query': query
        });
    }
}

(function () {
    const vscode = acquireVsCodeApi();
    new View(vscode);
}());