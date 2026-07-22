import { libraries } from '$routes/libraries.ts';

export const entries = (): Array<{ module_path: string }> => {
	const result: Array<{ module_path: string }> = [];
	for (const [repo_path, lib] of Object.entries(libraries)) {
		result.push({ module_path: repo_path });
		for (const mod of (lib as any).source_json?.modules ?? []) {
			result.push({ module_path: `${repo_path}/${mod.path}` });
		}
	}
	return result;
};
