import * as vscode from 'vscode';
import axios from 'axios';
import { RegistryPanel } from "./panel";
import * as sax from "slimdom-sax-parser";
import * as slimdom from 'slimdom';

let apiEndpoint: string = 'http://localhost:8080/exist/apps/tei-publisher/';
let previousOdd: string|undefined;

export function activate(context: vscode.ExtensionContext) {
	const provider = new RegistryPanel(context.extensionUri);
	context.subscriptions.push(vscode.window.registerWebviewViewProvider(RegistryPanel.viewType, provider));
	context.subscriptions.push(
		vscode.commands.registerCommand('teipublisher.lookup', () => {
			const editor = vscode.window.activeTextEditor;
			if (editor && !editor.selection.isEmpty) {
				provider.show();
				const selected = editor.document.getText(editor.selection);
				provider.query(selected, null, editor);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('teipublisher.preview', preview)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('teipublisher.encloseInTag', encloseInTag)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('teipublisher.expandSelection', expandSelection)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('teipublisher.splitElement', splitElement)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('teipublisher.deleteTag', deleteTag)
	);

	vscode.workspace.onDidChangeConfiguration((ev) => {
		if (ev.affectsConfiguration('teipublisher')) {
			configure(provider, ev);
		}
	});
	configure(provider);
}

function configure(provider: RegistryPanel, ev?: vscode.ConfigurationChangeEvent) {
	const endpoint:string|undefined = vscode.workspace.getConfiguration('teipublisher').get('endpoint');
	if (endpoint) {
		apiEndpoint = endpoint;
	}
	provider.configure(ev);
}

// this method is called when your extension is deactivated
export function deactivate() {}

/**
 * Preview the document currently open in the editor by sending the
 * content to a TEI Publisher instance and transforming it to HTML via ODD.
 */
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
					base: `${apiEndpoint}/`
				};
				if (odd) {
					params.odd = `${odd.description}.odd`;
					previousOdd = odd.description;
				}
				console.log(`Using ODD ${params.odd}`);
				const fileName = vscode.workspace.asRelativePath(editor.document.uri);
				vscode.window.withProgress({
					location: vscode.ProgressLocation.Notification,
					title: `Transforming document ${fileName}`,
					cancellable: false
				}, (progress) => {
					return new Promise((resolve, reject) => {
						axios.post(`${apiEndpoint}/api/preview`, tei, {
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
							panel.webview.html = injectStyles(response.data);
							resolve(true);
						}).catch((error) => {
							console.log(error.response.data);
							vscode.window.showErrorMessage(`The request failed: ${error.response.data.description}`);
							reject();
						});
					});
				});
			});
	});
}

function injectStyles(content:string) :string {
	const config = vscode.workspace.getConfiguration('teipublisher');
	const fontSize:string|undefined = config.get('fontSize');
	const lineHeight:string|undefined = config.get('lineHeight');
	let styles;
	if (fontSize) {
		styles = `font-size: ${fontSize};`;
	}
	if (lineHeight) {
		styles += `line-height: ${lineHeight};`;
	}
	return content.replace(/<body([^>]+)>/, `<body style="${styles}"$1>`);
}

/**
 * Retrieve a list of available ODDs and return them as quick pick items
 * for users to select from.
 */
function loadOddList(): Thenable<vscode.QuickPickItem[]> {
	return vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: `Retrieving list of ODDs`,
		cancellable: false
	}, (progress) => {
		return new Promise((resolve, reject) => {
			axios.get(`${apiEndpoint}/api/odd`, {
				headers: {
					"Origin": "http://localhost:8080"
				}
			})
			.then(response => {
				if (response.status === 200) {
					const odds:vscode.QuickPickItem[] = [];
					response.data.forEach((odd: { label: string; name: string; }) => {
						const item:vscode.QuickPickItem = {
							label: odd.label,
							description: odd.name
						};
						if (previousOdd && odd.name === previousOdd) {
							item.picked = true;
						}
						odds.push(item);
					});
					odds.sort((a, b) => {
						if (a.picked && !b.picked) {
							return -1;
						}
						if (a.description && b.description) {
							return a.description.localeCompare(b.description);
						}
						return -1;
					});
					resolve(odds);
				} else {
					vscode.window.showErrorMessage('Retrieving list of available ODDs failed!');
					reject();
				}
			})
			.catch(error => {
				vscode.window.showErrorMessage('Retrieving list of available ODDs failed!');
				reject();
			});
		});
	});
}

function encloseInTag() {
	if (!vscode.window.activeTextEditor) {
		return;
	}
	vscode.window.showInputBox({
		prompt: 'Wrap selection with element',
		placeHolder: 'Name of the element'
	})
	.then(tag => {
		if (tag) {
			const snippet = `<${tag}>$TM_SELECTED_TEXT</${tag}>`;
			vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(snippet));
		}
	});
}

function expandSelection() {
	const editor = vscode.window.activeTextEditor;
	if (editor) {
		sax.async(editor.document.getText(), {position: true})
		.then((dom) => {
			const start = editor.selection.start;
			const end = editor.selection.end;
			const startPos = editor.document.offsetAt(start);
			const endPos = editor.document.offsetAt(end);
			const contextNode = findNode(dom, startPos, endPos);
			if (contextNode) {
				const range = getRangeForNode(editor.document, startPos === endPos ? contextNode : contextNode.parentNode);
				editor.selection = new vscode.Selection(range.start, range.end);
			}
		})
		.catch((error) => {
			vscode.window.showErrorMessage(`XML invalid: ${error}`);
		});
	}
}

function splitElement() {
	const editor = vscode.window.activeTextEditor;
	if (editor) {
		sax.async(editor.document.getText(), {position: true})
		.then((dom) => {
			const end = editor.selection.end;
			const endPos = editor.document.offsetAt(end);
			const contextNode = findNode(dom, endPos, endPos);
			if (contextNode) {
				const parentNode = contextNode.parentNode;
				if (parentNode.nodeType === slimdom.Node.ELEMENT_NODE) {
					editor.edit((builder) => {
						builder.insert(end, `</${parentNode.nodeName}><${parentNode.nodeName}>`);
					});
				}
			}
		})
		.catch((error) => {
			vscode.window.showErrorMessage(`XML invalid: ${error}`);
		});
	}
}

function deleteTag() {
	const editor = vscode.window.activeTextEditor;
	if (editor) {
		sax.async(editor.document.getText(), {position: true})
		.then((dom) => {
			const start = editor.selection.start;
			const end = editor.selection.end;
			const startPos = editor.document.offsetAt(start);
			const endPos = editor.document.offsetAt(end);
			const contextNode = findNode(dom, startPos, endPos);
			if (contextNode) {
				const elem = contextNode.nodeType === slimdom.Node.ELEMENT_NODE ? contextNode : contextNode.parentNode;
				const startTag = new vscode.Range(
					editor.document.positionAt(elem.position.start), 
            		editor.document.positionAt(elem.position.end)
				);
				const endTag = new vscode.Range(
					editor.document.positionAt(elem.closePosition.start), 
            		editor.document.positionAt(elem.closePosition.end)
				);
				editor.edit((builder) => {
					builder.delete(startTag);
					builder.delete(endTag);
				});
			}
		})
		.catch((error) => {
			vscode.window.showErrorMessage(`XML invalid: ${error}`);
		});
	}
}

function findNode(node: any, start: number, end:number, contextNode?: any): any {
	if ((node.position && start >= node.position.start && end <= node.position.end) ||
		(node.closePosition && start >= node.position.start && end <= node.closePosition.end)) {
		contextNode = node;
	}
	node = node.firstChild;
	while(node) {
		contextNode = findNode(node, start, end, contextNode);
		node = node.nextSibling;
	}
	return contextNode;
}

function getRangeForNode(document: vscode.TextDocument, contextNode: any) {
    let range: vscode.Range;
    if (contextNode.closePosition) {
        range = new vscode.Range(
            document.positionAt(contextNode.position.start), 
            document.positionAt(contextNode.closePosition.end)
        );
    } else {
        range = new vscode.Range(
            document.positionAt(contextNode.position.start), 
            document.positionAt(contextNode.position.end)
        );
    }
    return range;
}