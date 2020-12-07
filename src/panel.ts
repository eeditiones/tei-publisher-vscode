import * as vscode from 'vscode';
import { KBA } from "./connectors/kba";
import { Metagrid } from "./connectors/metagrid";
import { GooglePlaces } from "./connectors/gplaces";
import { GND } from "./connectors/gnd";
import { Registry, RegistryResult } from './registry';

export class RegistryPanel implements vscode.WebviewViewProvider {

	public currentPanel: RegistryPanel | undefined;
	public static readonly viewType = 'teipublisher.entityView';

	private _registry:Map<string, Registry> = new Map();

    private _view?: vscode.WebviewView;
	private _currentEditor: vscode.TextEditor | undefined = undefined;

    public resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, token: vscode.CancellationToken) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            // And restrict the webview to only loading content from our extension's `media` directory.
            localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'media')]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
		webviewView.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case 'replace':
						if (this._currentEditor) {
							const editor = this._currentEditor;
							const plugin = this._registry.get(message.register);
							if (plugin) {
								const snippet = plugin.format(message.item);
								editor.insertSnippet(new vscode.SnippetString(snippet));
							}
						}
						return;
					case 'query':
                        this.query(message.query, message.register);
						break;
				}
			}
		);
    }

	constructor(private readonly _extensionUri: vscode.Uri) {
		this.loadPlugins();
    }
    

	private loadPlugins() {
		const configs:any[] | undefined = vscode.workspace.getConfiguration('teipublisher').get('apiList');
		if (!configs) {
			return;
		}
		configs.forEach((config) => {
			let registry;
			switch (config.plugin) {
				case 'kba':
					registry = new KBA(config);
					break;
				case 'google':
					registry = new GooglePlaces(config);
					break;
				case 'gnd':
					registry = new GND(config);
					break;
				default:
					registry = new Metagrid(config);
					break;
			}
			this._registry.set(config.name, registry);
		});
	}

	public show() {
		this._view?.show(true);
	}

    public async query(text: string, register: string, editor?:vscode.TextEditor) {
        if (editor) {
            this._currentEditor = editor;
        }
        let results:RegistryResult[] = [];

        if (register && register !== '') {
            const plugin = this._registry.get(register);
            if (plugin) {
                const result = await plugin.query(text);
                results = result;
            }
        } else {
            for (let plugin of this._registry.values()) {
                const result = await plugin.query(text);
                results = results.concat(result);
            }
        }
        console.log('Results: %o', results);
        this._view?.webview.postMessage({ command: 'results', data: results, query: text });
    }

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Local path to main script run in the webview
		const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js');

		// And the uri we use to load this script in the webview
		const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

		// Uri to load styles into webview
		const stylesResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
		const stylesMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
		const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'codicon.css'));
		const codiconsFontUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'codicon.ttf'));

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${scriptUri}; font-src ${codiconsFontUri}; style-src ${codiconsUri} ${webview.cspSource};">
				<link href="${codiconsUri}" rel="stylesheet">
				<link href="${stylesResetUri}" rel="stylesheet">
				<link href="${stylesMainUri}" rel="stylesheet">
				<title>TEI Publisher Entity Lookup</title>
			</head>
			<body>
				<div class="toolbar">
                    <select id="api-list">
                        <option value=''>Alle</option>
                        ${ this._getApiOptions() }
                    </select>
                    <input id="query" class="input" type="text" placeholder="Suchtext">
                    <button id="run-query" class="button is-info">
                        <i class="codicon codicon-search"></i>
                    </button>
				</div>
				<table class="table">
                    <tbody id="results"></tbody>
				</table>
				<script src="${scriptUri}"></script>
			</body>
			</html>`;
	}

	private _getApiOptions() {
		const config:any[] | undefined = vscode.workspace.getConfiguration('teipublisher').get('apiList');
		if (!config) {
			return '';
		}
		return config.map((api) => `<option value="${api.name}">${api.label}</option>`).join('');
	}
}