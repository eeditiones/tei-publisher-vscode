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

    public resolveWebviewView(webviewView: vscode.WebviewView, _context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken) {
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
						(async () => {
							let editor = this._currentEditor;
							if (!editor || editor.document.isClosed) {
								editor = vscode.window.activeTextEditor;
							}
							if (editor) {
								const plugin = this._registry.get(message.register);
								if (plugin) {
									const snippet = plugin.format(message.item);
									if (snippet) {
										await editor.insertSnippet(new vscode.SnippetString(snippet));
									}
								}
							}
						})().catch(error => {
							console.error('Failed to insert snippet:', error);
							vscode.window.showErrorMessage('Failed to insert snippet.');
						});
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
		const configs: unknown[] | undefined = vscode.workspace.getConfiguration('teipublisher').get('apiList');
		if (!configs || !Array.isArray(configs)) {
			return;
		}
		this._registry.clear();
		configs.forEach((config: unknown) => {
			if (!config || typeof config !== 'object' || !('plugin' in config) || !('name' in config)) {
				return;
			}
			let registry: Registry;
			const pluginName = String(config.plugin);
			switch (pluginName) {
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
			this._registry.set(String(config.name), registry);
		});
		if (ev && this._view) {
			this._view.webview.html = this._getHtmlForWebview(this._view.webview);
		}
	}

	public show() {
		this._view?.show(true);
	}

    public async query(text: string, register: string | null, editor?: vscode.TextEditor) {
		if (editor) {
			this._currentEditor = editor;
		}
		if (!register) {
			register = this._currentRegister;
		}
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Querying authorities for ${text}`,
			cancellable: false
		}, async (progress) => {
			let results: RegistryResultItem[] = [];
			let totalItems = 0;
			if (register && register !== '') {
				const plugin = this._registry.get(register);
				if (plugin) {
					try {
						const result = await plugin.query(text);
						results = result.items;
						totalItems = result.totalItems;
					} catch (error) {
						console.error('Lookup failed on plugin %s:', plugin.constructor.name, error);
					}
				}
			} else {
				const increment = 100 / this._registry.size;
				for (const plugin of this._registry.values()) {
					progress.report({
						message: plugin.name,
						increment: increment
					});
					try {
						const result = await plugin.query(text);
						totalItems += result.totalItems;
						results = results.concat(result.items);
					} catch (error) {
						console.error('Lookup failed on plugin %s:', plugin.constructor.name, error);
					}
				}
			}
			const data: RegistryResult = {
				totalItems: totalItems,
				items: results
			};
			this._view?.webview.postMessage({ command: 'results', data: data, query: text });
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

		const nonce = getNonce();
		
		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}';  font-src ${webview.cspSource}; style-src ${webview.cspSource};">
				<link href="${codiconsUri}" rel="stylesheet">
				<link href="${stylesResetUri}" rel="stylesheet">
				<link href="${stylesMainUri}" rel="stylesheet">
				<title>TEI Publisher Entity Lookup</title>
			</head>
			<body>
				<select id="api-list">
					<option value=''>All</option>
					${ this._getApiOptions() }
				</select>
				<div class="toolbar">
                    <input id="query" class="input" type="text" placeholder="Suchtext">
                    <button id="run-query" class="button is-info">
                        <i class="codicon codicon-search"></i>
                    </button>
				</div>
				<div id="status">Found <span id="items">0</span> items.</div>
				<table class="table">
                    <tbody id="results"></tbody>
				</table>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}

	private _getApiOptions(): string {
		const config: unknown[] | undefined = vscode.workspace.getConfiguration('teipublisher').get('apiList');
		if (!config || !Array.isArray(config)) {
			return '';
		}
		return config.map((api: unknown) => {
			if (!api || typeof api !== 'object' || !('name' in api) || !('label' in api)) {
				return '';
			}
			const apiName = String(api.name);
			const apiLabel = String(api.label);
			const registryName = this._registry.get(apiName)?.name || '';
			return `<option value="${apiName}">${apiLabel} - ${registryName}</option>`;
		}).join('');
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}