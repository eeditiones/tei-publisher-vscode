import * as path from 'path';
import * as Mocha from 'mocha';
import { glob } from 'glob';

export function run(): Promise<void> {
	// Create the mocha test
	const mocha = new Mocha({
		ui: 'tdd',
		color: true
	});

	const testsRoot = path.resolve(__dirname, '..');

	// Use the new Promise-based glob API
	return glob('**/**.test.js', { cwd: testsRoot }).then((files: string[]) => {
		// Add files to the test suite
		files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

		// Run the mocha test
		return new Promise<void>((resolve, reject) => {
			try {
				mocha.run((failures: number) => {
					if (failures > 0) {
						reject(new Error(`${failures} tests failed.`));
					} else {
						resolve();
					}
				});
			} catch (err) {
				console.error(err);
				reject(err);
			}
		});
	}).catch((err) => {
		console.error(err);
		throw err;
	});
}
