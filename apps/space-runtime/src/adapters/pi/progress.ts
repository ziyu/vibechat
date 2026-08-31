export function toolLabel(name: string, path?: string) {
  const normalized = name.toLowerCase();
  if (normalized === "read") return path ? `读取 ${path}` : "读取项目文件";
  if (normalized === "write") return path ? `写入 ${path}` : "写入项目文件";
  if (normalized === "edit") return path ? `编辑 ${path}` : "编辑项目文件";
  if (normalized === "bash") return "检查项目结构";
  return `运行 ${name}`;
}

export function isFileMutation(name?: string) {
  const normalized = name?.toLowerCase();
  return normalized === "write" || normalized === "edit";
}

export function progressStatus(
  status: unknown,
): "pending" | "in_progress" | "completed" | "failed" {
  if (
    status === "in_progress" ||
    status === "completed" ||
    status === "failed"
  ) {
    return status;
  }
  return "pending";
}
