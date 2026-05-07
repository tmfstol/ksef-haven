import type { Project } from "@/hooks/useProjects";

/**
 * Returns flat list of projects ordered as: parent, then its subprojects.
 * Each entry has `depth` (0 = top-level, 1 = subproject).
 */
export function flattenProjectTree<T extends Project>(projects: T[]): Array<T & { depth: number }> {
  const top = projects.filter((p) => !p.parent_id);
  const out: Array<T & { depth: number }> = [];
  for (const p of top) {
    out.push({ ...p, depth: 0 });
    const subs = projects.filter((s) => s.parent_id === p.id);
    for (const s of subs) out.push({ ...s, depth: 1 });
  }
  // Append orphans whose parent wasn't returned
  for (const p of projects) {
    if (p.parent_id && !out.find((o) => o.id === p.id)) {
      out.push({ ...p, depth: 1 });
    }
  }
  return out;
}
