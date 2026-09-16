import Link from "next/link";
import { notFound } from "next/navigation";
import CategoryPicker from "@/components/dashboard/CategoryPicker";
import Checkbox from "@/components/dashboard/Checkbox";
import WishLinkFields from "@/components/dashboard/WishLinkFields";
import { getContent, type WishItem } from "@/lib/content";
import { saveWishItem, deleteWishItem } from "../../actions";

export const dynamic = "force-dynamic";

/** One wishlist item. */
export default async function WishEditor({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { id } = await params;
  const { category } = await searchParams;
  const isNew = id === "new";

  const content = await getContent();
  const item: Partial<WishItem> = isNew
    ? { category }
    : (content.wishlist.find((i) => i.id === id) ?? {});

  if (!isNew && !item.id) notFound();

  const categories = [...content.wishCategories];
  for (const i of content.wishlist) if (!categories.includes(i.category)) categories.push(i.category);

  return (
    <form action={saveWishItem} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={item.id ?? ""} />

      <WishLinkFields
        href={item.href ?? ""}
        title={item.title ?? ""}
        image={item.image ?? ""}
        site={item.site ?? ""}
        siteCustom={Boolean(item.siteCustom)}
        imageBg={item.imageBg ?? ""}
        imageBgCustom={Boolean(item.imageBgCustom)}
        imageScale={item.imageScale ?? 100}
        imageOverride={item.imageOverride ?? ""}
        price={item.price !== undefined ? String(item.price) : ""}
        category={
          <div className="label">
            Category
            <CategoryPicker categories={categories} initial={item.category ?? ""} />
          </div>
        }
        toggles={
          <>
            <Checkbox name="visible" label="Show on site" defaultChecked={!item.hidden} />
            <Checkbox
              name="purchased"
              label="Purchased"
              defaultChecked={Boolean(item.purchased)}
            />
          </>
        }
      />

      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary">
          Save
        </button>

        {isNew ? (
          <Link href="/dashboard/wishlist" className="btn btn-danger ml-auto">
            Discard
          </Link>
        ) : (
          <button type="submit" formAction={deleteWishItem} className="btn btn-danger ml-auto">
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
