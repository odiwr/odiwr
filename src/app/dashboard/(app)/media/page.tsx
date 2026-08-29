import Icon from "@/components/icons";
import FolderPicker from "@/components/dashboard/FolderPicker";
import { list, folderTree, r2Configured, MEDIA_BASE } from "@/lib/r2";
import { deleteMedia } from "../actions";

export const dynamic = "force-dynamic";

const size = (bytes: number) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ uploaded?: string }>;
}) {
  const { uploaded } = await searchParams;

  if (!r2Configured()) {
    return <p className="text-foreground/50">R2 is not configured.</p>;
  }

  const files = await list("");
  const tree = folderTree(files);

  return (
    <div className="flex flex-col gap-8">
      <form
        action="/dashboard/api/upload"
        method="post"
        encType="multipart/form-data"
        className="flex flex-col gap-4"
      >
        <label className="label">
          File
          <input type="file" name="file" className="field" required />
        </label>

        <div className="label">
          Folder
          <FolderPicker name="folder" tree={tree} initial="uploads" />
        </div>

        <button type="submit" className="btn btn-primary w-max">
          Upload
        </button>
      </form>

      {uploaded && <p className="break-all text-accent">{uploaded}</p>}

      <div className="flex flex-col gap-1">
        <h2 className="text-foreground/40">
          {files.length} file{files.length === 1 ? "" : "s"} on {MEDIA_BASE.replace(/^https?:\/\//, "")}
        </h2>

        {files.map((file) => (
          <div key={file.key} className="row">
            <a
              href={file.url}
              target="_blank"
              rel="noreferrer noopener"
              className="truncate transition-colors hover:text-accent"
            >
              {file.key}
            </a>
            <span className="flex shrink-0 items-center gap-4 text-foreground/40">
              {size(file.size)}
              <form action={deleteMedia}>
                <input type="hidden" name="key" value={file.key} />
                <button
                  type="submit"
                  className="flex transition-colors hover:text-accent"
                  aria-label={`Delete ${file.key}`}
                >
                  <Icon name="material-symbols:close-rounded" size="1.35em" />
                </button>
              </form>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
