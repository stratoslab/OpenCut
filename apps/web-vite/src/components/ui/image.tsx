import { CSSProperties, ImgHTMLAttributes } from "react";

interface ImageProps extends ImgHTMLAttributes<HTMLImageElement> {
	src: string;
	alt: string;
	width?: number | string;
	height?: number | string;
	fill?: boolean;
	className?: string;
	style?: CSSProperties;
	quality?: number;
}

export default function Image({
	src,
	alt,
	width,
	height,
	fill,
	className,
	style,
	loading = "lazy",
	decoding = "async",
	...props
}: ImageProps) {
	const imgStyle: CSSProperties = fill
		? { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", ...style }
		: { width, height, ...style };

	return (
		<img
			src={src}
			alt={alt}
			width={fill ? undefined : width}
			height={fill ? undefined : height}
			className={className}
			style={imgStyle}
			loading={loading}
			decoding={decoding}
			{...props}
		/>
	);
}
