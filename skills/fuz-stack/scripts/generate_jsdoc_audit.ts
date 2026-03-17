/**
 * Generic script to audit JSDoc comments in a SvelteKit project.
 * Scans src/lib directory and creates a markdown checklist of files containing JSDoc.
 *
 * Usage: gro run skills/fuz-stack/scripts/generate_jsdoc_audit.ts
 * Output: jsdoc_audit.md
 *
 * For full JSDoc/TSDoc conventions, see:
 * - ../references/tsdoc_comments.md - comprehensive style guide and implementation details
 * - ../SKILL.md - documentation workflow and when to run audits
 */

import {readdir, readFile, writeFile} from 'node:fs/promises';
import {join, relative} from 'node:path';

// File extensions to scan
const EXTENSIONS = ['.ts', '.js', '.svelte', '.svelte.ts'];

// JSDoc pattern - matches /** ... */ style comments
const JSDOC_PATTERN = /\/\*\*[\s\S]*?\*\//;

const PROMPT = `# JSDoc Comment Audit

Review all JSDoc comments in the files below and remove or improve low-value comments.

## Guidelines for valuable JSDoc comments

**Keep comments that:**
- Explain non-obvious design decisions or tradeoffs
- Document complex behavior, edge cases, or gotchas
- Provide critical context about "why" something works the way it does
- Clarify unintuitive APIs or parameters
- Warn about side effects or mutations using \`@mutates\` tag
- Specify units (ms, px, etc.) or value ranges for numeric parameters
- Document error conditions using \`@throws\` or when null/undefined is returned
- Note performance implications or computational complexity

**Consider removing comments that:**
- Restate what the code/name already says (e.g., \`/** Gets user */ function get_user()\`)
- Only repeat TypeScript type information already in the signature
- Describe "what" without explaining "why" or providing meaningful context
- Appear outdated, incorrect, or inconsistent with the implementation
- Document obvious \`@param\` or \`@returns\` without additional context

**General principles:**
- Be conservative - when in doubt, keep the comment
- Conciseness is good, but clarity is better
- Prefer keeping/improving docs for public API over internal/private functions
- Trust TypeScript types to document themselves
- Trust clear naming to be self-documenting
- Focus on the non-obvious and truly helpful
- JSDoc comments should be complete sentences with proper capitalization and periods
- Exception: @param descriptions are sentence fragments — use a hyphen separator, lowercase, no period (e.g., \`@param foo - the foo value\`)
- Use \`@returns\` (not \`@return\`) for return value documentation
- Use \`@mutates\` to document when functions modify their arguments or have side effects
- Keep comments that explain parameter relationships, constraints, or usage patterns
- Keep examples that demonstrate transformations or non-obvious behavior

## Files to review

`;

/**
 * Recursively finds all files in a directory matching the given extensions.
 */
async function find_files(dir: string, base_dir: string = dir): Promise<Array<string>> {
	const files: Array<string> = [];
	const pending: Array<Promise<Array<string>>> = [];
	try {
		const entries = await readdir(dir, {withFileTypes: true});

		for (const entry of entries) {
			const full_path = join(dir, entry.name);

			if (entry.isDirectory()) {
				pending.push(find_files(full_path, base_dir));
			} else if (entry.isFile()) {
				const has_valid_ext = EXTENSIONS.some((ext) => entry.name.endsWith(ext));
				if (has_valid_ext) {
					files.push(relative(base_dir, full_path));
				}
			}
		}

		const nested_results = await Promise.all(pending);
		for (const nested of nested_results) {
			files.push(...nested);
		}
	} catch (err) {
		console.warn(`Warning: Could not read directory ${dir}: ${(err as Error).message}`);
	}

	return files;
}

/**
 * Checks if a file contains JSDoc comments.
 */
async function has_jsdoc(file_path: string): Promise<boolean> {
	try {
		const content = await readFile(file_path, 'utf-8');
		return JSDOC_PATTERN.test(content);
	} catch (err) {
		console.warn(`Warning: Could not read file ${file_path}: ${(err as Error).message}`);
		return false;
	}
}

/**
 * Main execution.
 */
async function main(): Promise<void> {
	const output_file = 'jsdoc_audit.md';
	const src_lib = 'src/lib';

	console.log(`Scanning ${src_lib} for JSDoc comments...`);

	// Find all relevant files
	const all_files = await find_files(src_lib);
	console.log(`Found ${all_files.length} files to check`);

	// Filter to only files with JSDoc
	const jsdoc_checks = await Promise.all(
		all_files.map(async (file) => ({file, has: await has_jsdoc(join(src_lib, file))})),
	);
	const files_with_jsdoc = jsdoc_checks.filter((r) => r.has).map((r) => r.file);

	console.log(`Found ${files_with_jsdoc.length} files with JSDoc comments`);

	// Generate markdown checklist
	const checklist = files_with_jsdoc.map((file) => `- [ ] ${file}`).join('\n');

	const markdown = PROMPT + checklist + '\n';

	// Write output
	await writeFile(output_file, markdown, 'utf-8');

	console.log(`\nAudit checklist written to: ${output_file}`);
	console.log(`Review the files and check them off as you clean up their JSDoc comments.`);
}

main().catch((err: unknown) => {
	console.error('Error:', err);
	process.exit(1);
});
