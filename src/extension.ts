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

	vscode.workspace.onDidChangeConfiguration((ev: vscode.ConfigurationChangeEvent) => {
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
async function preview() {
	if (!vscode.window.activeTextEditor) {
		return;
	}
	const editor = vscode.window.activeTextEditor;
	try {
		const items = await loadOddList();
		if (!items) {
			return;
		}
		const odd = await vscode.window.showQuickPick(items, { placeHolder: 'ODD to use', canPickMany: false });
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
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Transforming document ${fileName}`,
			cancellable: false
		}, async (_progress) => {
			try {
				const response = await axios.post(`${apiEndpoint}/api/preview`, tei, {
					headers: {
						"Content-Type": "application/xml",
						"Origin": "http://localhost:8080"
					},
					params
				});
				if (response.status !== 200) {
					vscode.window.showErrorMessage('The request failed with an unexpected status code.');
					return;
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
			} catch (error: unknown) {
				const errorMessage = axios.isAxiosError(error) && error.response?.data?.description
					? error.response.data.description
					: 'The request failed with an unknown error.';
				console.error('Preview request failed:', error);
				vscode.window.showErrorMessage(`The request failed: ${errorMessage}`);
			}
		});
	} catch (error) {
		console.error('Preview failed:', error);
		vscode.window.showErrorMessage('Failed to preview document.');
	}
}

function injectStyles(content:string): string {
	const config = vscode.workspace.getConfiguration('teipublisher');
	const fontSize: string | undefined = config.get('fontSize');
	const lineHeight: string | undefined = config.get('lineHeight');
	let styles = '';
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
async function loadOddList(): Promise<vscode.QuickPickItem[]> {
	return vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: `Retrieving list of ODDs`,
		cancellable: false
	}, async (_progress) => {
		try {
			const response = await axios.get(`${apiEndpoint}/api/odd`, {
				headers: {
					"Origin": "http://localhost:8080"
				}
			});
			if (response.status === 200) {
				const odds: vscode.QuickPickItem[] = [];
				response.data.forEach((odd: { label: string; name: string; }) => {
					const item: vscode.QuickPickItem = {
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
				return odds;
			} else {
				vscode.window.showErrorMessage('Retrieving list of available ODDs failed!');
				return [];
			}
		} catch (error) {
			console.error('Failed to load ODD list:', error);
			vscode.window.showErrorMessage('Retrieving list of available ODDs failed!');
			return [];
		}
	});
}

let lastInsertedTag: string|undefined;

async function encloseInTag() {
	if (!vscode.window.activeTextEditor) {
		return;
	}
	const tag = await vscode.window.showInputBox({
		prompt: 'Wrap selection with element',
		placeHolder: 'Name of the element',
		value: lastInsertedTag
	});
	if (tag) {
		lastInsertedTag = tag;
		const snippet = `<${tag}>$TM_SELECTED_TEXT</${tag}>`;
		await vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(snippet));
	}
}

async function expandSelection() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}
	try {
		const dom = await sax.async(editor.document.getText(), {position: true});
		const start = editor.selection.start;
		const end = editor.selection.end;
		const startPos = editor.document.offsetAt(start);
		const endPos = editor.document.offsetAt(end);
		const contextNode = findNode(dom, startPos, endPos);
		if (contextNode) {
			const range = getRangeForNode(editor.document, startPos === endPos ? contextNode : contextNode.parentNode);
			editor.selection = new vscode.Selection(range.start, range.end);
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		vscode.window.showErrorMessage(`XML invalid: ${errorMessage}`);
	}
}

async function splitElement() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}
	try {
		const text = editor.document.getText();
		const dom = await sax.async(text, {position: true});
		const end = editor.selection.end;
		const endPos = editor.document.offsetAt(end);
		const contextNode = findNode(dom, endPos, endPos);
		if (contextNode) {
			const parentNode = contextNode.parentNode;
				if (parentNode && parentNode.nodeType === slimdom.Node.ELEMENT_NODE) {
					const wsRegex = /\s+/g;
					wsRegex.lastIndex = endPos;
					const afterPos = wsRegex.exec(text) ? wsRegex.lastIndex : endPos;
					await editor.edit((builder: vscode.TextEditorEdit) => {
						builder.insert(editor.document.positionAt(afterPos), `<${parentNode.nodeName}>`);
						builder.insert(end, `</${parentNode.nodeName}>`);
					});
			}
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		vscode.window.showErrorMessage(`XML invalid: ${errorMessage}`);
	}
}

async function deleteTag() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}
	try {
		const dom = await sax.async(editor.document.getText(), {position: true});
		const start = editor.selection.start;
		const end = editor.selection.end;
		const startPos = editor.document.offsetAt(start);
		const endPos = editor.document.offsetAt(end);
		const contextNode = findNode(dom, startPos, endPos);
		if (contextNode) {
			const elem = contextNode.nodeType === slimdom.Node.ELEMENT_NODE ? contextNode : contextNode.parentNode;
			if (elem && elem.position && elem.closePosition) {
				const startTag = new vscode.Range(
					editor.document.positionAt(elem.position.start), 
					editor.document.positionAt(elem.position.end)
				);
				const endTag = new vscode.Range(
					editor.document.positionAt(elem.closePosition.start), 
					editor.document.positionAt(elem.closePosition.end)
				);
				await editor.edit((builder: vscode.TextEditorEdit) => {
					builder.delete(startTag);
					builder.delete(endTag);
				});
			}
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		vscode.window.showErrorMessage(`XML invalid: ${errorMessage}`);
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