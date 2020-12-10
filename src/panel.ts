import * as vscode from 'vscode';
import { KBGA } from "./connectors/kbga";
import { Metagrid } from "./connectors/metagrid";
import { GooglePlaces } from "./connectors/gplaces";
import { GND } from "./connectors/gnd";
import { GeoNames } from "./connectors/geonames";
import { Registry, RegistryResult, RegistryResultItem } from './registry';

/**
 * Implements the webview for entity lookups.
 */
export class RegistryPanel implements vscode.WebviewViewProvider {

	public currentPanel: RegistryPanel | undefined;
	public static readonly viewType = 'teipublisher.entityView';

	private _registry:Map<string, Registry> = new Map();
	private _currentRegister:string = '';
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
					case 'register':
						this._currentRegister = message.register;
						break;
					case 'replace':
						if (this._currentEditor) {
							const editor = this._currentEditor;
							const plugin = this._registry.get(message.register);
							if (plugin) {
								const snippet = plugin.format(message.item);
								editor.insertSnippet(new vscode.SnippetString(snippet));
							}
						}
						break;
					case 'query':
                        this.query(message.query, message.register);
						break;
				}
			}
		);
    }

	constructor(private readonly _extensionUri: vscode.Uri) {
    }
    

	public configure(ev?: vscode.ConfigurationChangeEvent) {
		const configs:any[] | undefined = vscode.workspace.getConfiguration('teipublisher').get('apiList');
		if (!configs) {
			return;
		}
		this._registry.clear();
		configs.forEach((config) => {
			let registry;
			switch (config.plugin) {
				case 'kbga':
					registry = new KBGA(config);
					break;
				case 'google':
					registry = new GooglePlaces(config);
					break;
				case 'gnd':
					registry = new GND(config);
					break;
				case 'geonames':
					registry = new GeoNames(config);
					break;
				default:
					registry = new Metagrid(config);
					break;
			}
			this._registry.set(config.name, registry);
		});
		if (ev && this._view) {
			this._view.webview.html = this._getHtmlForWebview(this._view.webview);
		}
	}

	public show() {
		this._view?.show(true);
	}

    public async query(text: string, register: string|null, editor?:vscode.TextEditor) {
		if (editor) {
			this._currentEditor = editor;
		}
		if (!register) {
			register = this._currentRegister;
		}
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Querying authorities for ${text}`,
			cancellable: false
		}, (progress) => {
			return new Promise(async (resolve) => {
				let results:RegistryResultItem[] = [];
				let totalItems = 0;
				if (register && register !== '') {
					const plugin = this._registry.get(register);
					if (plugin) {
						try {
							const result = await plugin.query(text);
							results = result.items;
							totalItems = result.totalItems;
						} catch (e) {
							console.error('Lookup failed on plugin %s', plugin.constructor.name);
						}
					}
				} else {
					const increment = 100 / this._registry.size;
					for (let plugin of this._registry.values()) {
						progress.report({
							message: plugin.constructor.name,
							increment: increment
						});
						try {
							const result = await plugin.query(text);
							totalItems += result.totalItems;
							results = results.concat(result.items);
						} catch (e) {
							console.error('Lookup failed on plugin %s', plugin.constructor.name);
						}
					}
				}
				const data:RegistryResult = {
					totalItems: totalItems,
					items: results
				};
				this._view?.webview.postMessage({ command: 'results', data: data, query: text });
				resolve(true);
			});
		});
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
                        <option value=''>All</option>
                        ${ this._getApiOptions() }
                    </select>
                    <input id="query" class="input" type="text" placeholder="Suchtext">
                    <button id="run-query" class="button is-info">
                        <i class="codicon codicon-search"></i>
                    </button>
				</div>
				<div id="status">Found <span id="items">0</span> items.</div>
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