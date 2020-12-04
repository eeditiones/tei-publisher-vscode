import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	let view = TeiViewPanel.createOrShow(context.extensionUri);

	context.subscriptions.push(
		vscode.commands.registerCommand('teipublisher.lookup', () => {
			const editor = vscode.window.activeTextEditor;
			if (editor && !editor.selection.isEmpty) {
				const selected = editor.document.getText(editor.selection);
				view = TeiViewPanel.createOrShow(context.extensionUri);
				view.query(selected, editor);
			}
		})
	);
}

// this method is called when your extension is deactivated
export function deactivate() {}

class TeiViewPanel {

	public static currentPanel: TeiViewPanel | undefined;
	public static readonly viewType = 'entityView';

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];
	private _currentEditor: vscode.TextEditor | undefined = undefined;

	public static createOrShow(extensionUri: vscode.Uri) {
		// If we already have a panel, show it.
		if (TeiViewPanel.currentPanel) {
			TeiViewPanel.currentPanel._panel.reveal(vscode.ViewColumn.Two);
			return TeiViewPanel.currentPanel;
		}

		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
			TeiViewPanel.viewType,
			'TEI Entity Lookup',
			vscode.ViewColumn.Two,
			{
				// Enable javascript in the webview
				enableScripts: true,

				// And restrict the webview to only loading content from our extension's `media` directory.
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
			}
		);

		TeiViewPanel.currentPanel = new TeiViewPanel(panel, extensionUri);
		return TeiViewPanel.currentPanel;
	}

	public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		TeiViewPanel.currentPanel = new TeiViewPanel(panel, extensionUri);
	}

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this._panel = panel;
		this._extensionUri = extensionUri;

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
							const selected = editor.document.getText(editor.selection);
							const newText = `${message.before}${selected}${message.after}`;
							editor.edit((builder) => {
								builder.replace(editor.selection, newText);
							});
						}
						return;
				}
			},
			null,
			this._disposables
		);
	}

	public query(text: string, editor: vscode.TextEditor) {
		this._currentEditor = editor;
		// Send a message to the webview webview.
		// You can send any JSON serializable data.
		this._panel.webview.postMessage({ command: 'query', text: text });
	}

	public dispose() {
		TeiViewPanel.currentPanel = undefined;

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

		// Use a nonce to only allow specific scripts to be run
		const nonce = getNonce();
		
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
                        <input id="query" class="input" type="text" placeholder="Suchtext" value="Martin Luther">
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
		const config = vscode.workspace.getConfiguration('teipublisher').get('apiList');
		console.log(config);
		return Object.entries(<any>config).map(([label, id]) => {
			return `<option value="${id}">${label}</option>`;
		});
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