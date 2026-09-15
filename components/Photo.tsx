import { PHOTOS, type PhotoName } from "@/lib/photos";

// One <picture> per photo slot: AVIF first, WebP behind it, both with a srcset so a phone never
// pulls the desktop rendition. The wrapper carries the crop's aspect-ratio and the inlined blur, so
// the slot reserves its exact height before the file arrives and never flashes empty cream.
//
// `sizes` has no sensible default — a wrong one silently ships the 2x file to every phone — so each
// caller states the width the slot actually occupies at its breakpoints.
export function Photo({
  name,
  alt,
  sizes,
  priority = false,
  fill = false,
  className = "",
  imgClassName = "",
  style,
}: {
  name: PhotoName;
  alt: string;
  sizes: string;
  priority?: boolean;
  /** Take height from the parent (a stretched grid cell) instead of from the crop's aspect-ratio. */
  fill?: boolean;
  className?: string;
  imgClassName?: string;
  style?: React.CSSProperties;
}) {
  const photo = PHOTOS[name];
  const [w, h] = photo.ratio;
  const largest = photo.widths[photo.widths.length - 1];

  const srcset = (ext: string) =>
    photo.widths.map((width) => `/photos/${name}-${width}.${ext} ${width}w`).join(", ");

  return (
    // `fill` positions the wrapper itself rather than leaving it to the caller: passing
    // "absolute inset-0" in className looks like it works but loses to this element's own
    // `relative`, since Tailwind emits .relative after .absolute and class order doesn't decide it.
    // The wrapper then has no definite height and the photo silently disappears.
    <div
      className={`overflow-hidden ${fill ? "absolute inset-0" : "relative"} ${className}`}
      style={{
        ...(fill ? null : { aspectRatio: `${w} / ${h}` }),
        backgroundImage: `url("${photo.blur}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        ...style,
      }}
    >
      <picture>
        <source type="image/avif" srcSet={srcset("avif")} sizes={sizes} />
        <source type="image/webp" srcSet={srcset("webp")} sizes={sizes} />
        <img
          src={`/photos/${name}-${largest}.webp`}
          alt={alt}
          width={largest}
          height={Math.round((largest * h) / w)}
          loading={priority ? "eager" : "lazy"}
          // The hero photo is the LCP element; fetchpriority moves it ahead of the demo bundle.
          fetchPriority={priority ? "high" : undefined}
          decoding={priority ? "sync" : "async"}
          className={`absolute inset-0 h-full w-full object-cover ${imgClassName}`}
        />
      </picture>
    </div>
  );
}
