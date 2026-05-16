import { invoke } from "@tauri-apps/api/core";

export type AuditFileEntry = {
  id: number;
  name: string;
  path: string;
  hash: string;
  size: number;
  modifiedAt: string | null;
};

export const pickAuditFolder = (): Promise<string | null> =>
  invoke<string | null>("pick_audit_folder");

export const auditListFiles = (path: string): Promise<AuditFileEntry[]> =>
  invoke<AuditFileEntry[]>("audit_list_files", { path });

export const openAuditFile = (path: string): Promise<void> =>
  invoke<void>("open_audit_file", { path });

export const deleteToTrash = (path: string): Promise<void> =>
  invoke<void>("delete_to_trash", { path });
