import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { v4 as uuidv4 } from "uuid";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(prefix: string = "item"): string {
  return `${prefix}_${uuidv4().replace(/-/g, "").slice(0, 12)}`;
}

export function noteBlocksToMarkdown(
  title: string,
  blocks: Array<{ type: string; content?: unknown; props?: Record<string, unknown> }>
): string {
  const lines: string[] = [`# ${title}`, ""];

  for (const block of blocks) {
    const textContent = extractTextContent(block.content);

    switch (block.type) {
      case "heading": {
        const level = (block.props?.level as number) || 1;
        lines.push(`${"#".repeat(level)} ${textContent}`);
        break;
      }
      case "paragraph":
        lines.push(textContent || "");
        break;
      case "bulletListItem":
        lines.push(`- ${textContent}`);
        break;
      case "numberedListItem":
        lines.push(`1. ${textContent}`);
        break;
      case "checkListItem": {
        const checked = block.props?.checked ? "x" : " ";
        lines.push(`- [${checked}] ${textContent}`);
        break;
      }
      case "image": {
        const url = (block.props?.url as string) || "";
        const caption = (block.props?.caption as string) || "image";
        lines.push(`![${caption}](${url})`);
        break;
      }
      default:
        if (textContent) lines.push(textContent);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function extractTextContent(content: unknown): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "text" in item) {
          return (item as { text: string }).text;
        }
        return "";
      })
      .join("");
  }
  return "";
}
