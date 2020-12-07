import * as vscode from 'vscode';
import axios from 'axios';
import { RegistryPanel } from "./panel";

export function activate(context: vscode.ExtensionContext) {
	const provider = new RegistryPanel(context.extensionUri);
	context.subscriptions.push(vscode.window.registerWebviewViewProvider(RegistryPanel.viewType, provider));
	context.subscriptions.push(
		vscode.commands.registerCommand('teipublisher.lookup', () => {
			const editor = vscode.window.activeTextEditor;
			if (editor && !editor.selection.isEmpty) {
				const selected = editor.document.getText(editor.selection);
				provider.query(selected, '', editor);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('teipublisher.preview', preview)
	);
}

// this method is called when your extension is deactivated
export function deactivate() {}

function preview() {
	if (!vscode.window.activeTextEditor) {
		return;
	}
	const editor = vscode.window.activeTextEditor;
	loadOddList().then((items) => {
		if (!items) {
			return;
		}
		vscode.window.showQuickPick(items, { placeHolder: 'ODD to use', canPickMany: false })
			.then((odd) => {
				const tei = editor.document.getText();
				const params: { base:string, odd?: string } = {
					base: "http://localhost:8080/exist/apps/kb/"
				};
				if (odd) {
					params.odd = `${odd.description}.odd`;
				}
				const fileName = vscode.workspace.asRelativePath(editor.document.uri);
				vscode.window.withProgress({
					location: vscode.ProgressLocation.Notification,
					title: `Transforming document ${fileName}`,
					cancellable: false
				}, (progress) => {
					return new Promise((resolve, reject) => {
						axios.post('http://localhost:8080/exist/apps/kb/api/preview', tei, {
							headers: {
								"Content-Type": "application/xml",
								"Origin": "http://localhost:8080"
							},
							params
						}).then((response) => {
							if (response.status !== 200) {
								reject();
							}
							const panel = vscode.window.createWebviewPanel(
								'teipublisher-transform',
								`Transformation Result ${fileName}`,
								vscode.ViewColumn.Beside,
								{
									enableScripts: true
								}
							);
							panel.webview.html = response.data;
							resolve();
						});
					});
				});
			});
	});
}

async function loadOddList(): Promise<vscode.QuickPickItem[] | null> {
	const response = await axios.get('http://localhost:8080/exist/apps/kb/api/odd', {
		headers: {
			"Origin": "http://localhost:8080"
		}
	});
	if (response.status === 200) {
		const odds:vscode.QuickPickItem[] = [];
		response.data.forEach((odd: { label: string; name: string; }) => {
			odds.push({
				label: odd.label,
				description: odd.name
			});
		});
		return odds;
	}
	vscode.window.showErrorMessage('Retrieving list of available ODDs failed!');
	return null;
}