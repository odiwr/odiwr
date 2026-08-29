// SERVER-ONLY. The Cloudflare R2 bucket: the content document and the uploads.
//
// Never import this from a client component — it holds the private keys.
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

const client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET = process.env.R2_BUCKET || "";
/** Public origin the bucket is served from, e.g. https://media.odiwr.com */
export const MEDIA_BASE = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");

export function r2Configured(): boolean {
  return Boolean(process.env.R2_ENDPOINT && BUCKET && process.env.R2_ACCESS_KEY_ID);
}

export function publicUrl(key: string): string {
  return `${MEDIA_BASE}/${key.replace(/^\//, "")}`;
}

/** Returns null when the key does not exist, rather than throwing. */
export async function getText(key: string): Promise<string | null> {
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    return (await res.Body?.transformToString()) ?? null;
  } catch {
    return null;
  }
}

export async function putText(key: string, body: string, contentType: string): Promise<void> {
  await client.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType })
  );
}

export async function putBytes(
  key: string,
  body: Uint8Array,
  contentType: string
): Promise<string> {
  await client.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType })
  );
  return publicUrl(key);
}

export async function remove(key: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export type R2File = { key: string; filename: string; url: string; size: number };

export async function list(prefix: string): Promise<R2File[]> {
  const out: R2File[] = [];
  let token: string | undefined;

  do {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token })
    );
    for (const object of res.Contents ?? []) {
      const key = object.Key;
      // A "folder" placeholder has no bytes and no name of its own.
      if (!key || key.endsWith("/")) continue;
      out.push({
        key,
        filename: key.slice(key.lastIndexOf("/") + 1),
        url: publicUrl(key),
        size: object.Size ?? 0,
      });
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);

  return out.sort((a, b) => a.filename.localeCompare(b.filename));
}

export type FolderNode = { name: string; path: string; children: FolderNode[] };

/**
 * The folder tree implied by the object keys.
 *
 * R2 has no folders — "gifs/redirects/12.gif" is one flat key. This rebuilds the
 * hierarchy the keys describe so the picker can be browsed like a directory.
 */
export function folderTree(files: R2File[]): FolderNode[] {
  const root: FolderNode = { name: "", path: "", children: [] };

  for (const file of files) {
    const parts = file.key.split("/");
    parts.pop(); // the filename itself
    let node = root;
    let path = "";
    for (const part of parts) {
      path = path ? `${path}/${part}` : part;
      let next = node.children.find((c) => c.name === part);
      if (!next) {
        next = { name: part, path, children: [] };
        node.children.push(next);
      }
      node = next;
    }
  }

  const sort = (nodes: FolderNode[]): FolderNode[] =>
    nodes
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((n) => ({ ...n, children: sort(n.children) }));

  return sort(root.children);
}

export type FileNode = {
  name: string;
  path: string;
  children: FileNode[];
  files: { key: string; name: string; url: string }[];
};

/** The same hierarchy as folderTree, with each folder's files attached. */
export function fileTree(files: R2File[]): FileNode[] {
  const root: FileNode = { name: "", path: "", children: [], files: [] };

  for (const file of files) {
    const parts = file.key.split("/");
    const filename = parts.pop() ?? file.key;
    let node = root;
    let path = "";
    for (const part of parts) {
      path = path ? `${path}/${part}` : part;
      let next = node.children.find((c) => c.name === part);
      if (!next) {
        next = { name: part, path, children: [], files: [] };
        node.children.push(next);
      }
      node = next;
    }
    node.files.push({ key: file.key, name: filename, url: file.url });
  }

  const sort = (nodes: FileNode[]): FileNode[] =>
    nodes
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((n) => ({ ...n, children: sort(n.children), files: n.files.sort((a, b) => a.name.localeCompare(b.name)) }));

  return sort(root.children);
}
