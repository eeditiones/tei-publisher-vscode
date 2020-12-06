import * as vscode from 'vscode';
import { KBA } from "./kba";
import { Metagrid } from "./metagrid";
import { GooglePlaces } from "./gplaces";
import { Registry, RegistryResult } from './registry';

export class RegistryPanel {

	public static currentPanel: RegistryPanel | undefined;
	public static readonly viewType = 'entityView';

	private _registry:Map<string, Registry> = new Map();

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];
	private _currentEditor: vscode.TextEditor | undefined = undefined;

	public static createOrShow(extensionUri: vscode.Uri) {
		// If we already have a panel, show it.
		if (RegistryPanel.currentPanel) {
			RegistryPanel.currentPanel._panel.reveal(vscode.ViewColumn.Two);
			return RegistryPanel.currentPanel;
		}

		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
			RegistryPanel.viewType,
			'TEI Entity Lookup',
			vscode.ViewColumn.Two,
			{
				// Enable javascript in the webview
				enableScripts: true,

				// And restrict the webview to only loading content from our extension's `media` directory.
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
			}
		);

		RegistryPanel.currentPanel = new RegistryPanel(panel, extensionUri);
		return RegistryPanel.currentPanel;
	}

	public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		RegistryPanel.currentPanel = new RegistryPanel(panel, extensionUri);
	}

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this._panel = panel;
		this._extensionUri = extensionUri;
		
		this.loadPlugins();

		// Set the webview's initial html content
		// update
		this._panel.webview.html = this._getHtmlForWebview(panel.webview);

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Update the content based on view changes
		this._panel.onDidChangeViewState(
			e => {
				if (this._panel.visible) {
					// update
				}
			},
			null,
			this._disposables
		);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(
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
			},
			null,
			this._disposables
		);
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
				default:
					registry = new Metagrid(config);
					break;
			}
			this._registry.set(config.name, registry);
		});
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
        this._panel.webview.postMessage({ command: 'results', data: results, query: text });
    }

	public dispose() {
		RegistryPanel.currentPanel = undefined;

		// Clean up our resources
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Local path to main script run in the webview
		const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js');

		// And the uri we use to load this script in the webview
		const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

		// Local path to css styles
		const styleResetPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css');
		const stylesPathMainPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css');

		// Uri to load styles into webview
		const stylesResetUri = webview.asWebviewUri(styleResetPath);
		const stylesMainUri = webview.asWebviewUri(stylesPathMainPath);
		
		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9.0/css/bulma.min.css">
				<link href="${stylesResetUri}" rel="stylesheet">
				<link href="${stylesMainUri}" rel="stylesheet">
				<script defer src="https://use.fontawesome.com/releases/v5.3.1/js/all.js"></script>
				<title>TEI Publisher Entity Lookup</title>
			</head>
			<body>
				<h1 class="title is-5">Karl Barth Edition</h1>
				<div class="field has-addons">
                    <div class="control">
                        <span class="select">
                            <select id="api-list">
								<option value=''>Alle</option>
								${ this._getApiOptions() }
                            </select>
                        </span>
                    </div>
                    <div class="control is-expanded">
                        <input id="query" class="input" type="text" placeholder="Suchtext">
                    </div>
                    <div class="control">
                        <button id="run-query" class="button is-info">
                            <span class="icon">
                                <i class="fas fa-search"></i>
                            </span>
                        </button>
                    </div>
				</div>
				<table class="table is-fullwidth is-striped">
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