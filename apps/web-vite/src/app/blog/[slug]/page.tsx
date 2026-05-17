import Image from "@/components/ui/image";
import { Navigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { BasePage } from "@/app/base-page";
import Prose from "@/components/ui/prose";
import { Separator } from "@/components/ui/separator";
import { getSinglePost } from "@/blog/query";
import type { Post } from "@/blog/types";

export default function BlogPostPage() {
	const { slug } = useParams<{ slug: string }>();
	if (!slug) return <Navigate to="/404" replace />;

	const [post, setPost] = useState<Post | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		getSinglePost({ slug }).then((result) => {
			if (result?.post) setPost(result.post);
			setLoading(false);
		});
	}, [slug]);

	if (loading) return <div>Loading...</div>;
	if (!post) return <Navigate to="/404" replace />;

	return (
		<BasePage>
			<PostHeader post={post} />
			<Separator />
			<PostContent post={post} />
		</BasePage>
	);
}

function PostHeader({ post }: { post: Post }) {
	const formattedDate = new Date(post.publishedAt).toLocaleDateString("en-US", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});

	return (
		<div className="flex flex-col items-center justify-center gap-8">
			<PostMeta date={formattedDate} publishedAt={post.publishedAt} />
			<PostTitle title={post.title} />
			{post.coverImage && <PostCoverImage post={post} />}
		</div>
	);
}

function PostCoverImage({ post }: { post: Post }) {
	return (
		<div className="relative aspect-video overflow-hidden rounded-lg w-full mt-4">
			<Image
				src={post.coverImage}
				alt={post.title}
				loading="eager"
				fill
				className="rounded-lg object-cover"
			/>
		</div>
	);
}

function PostMeta({ date, publishedAt }: { date: string; publishedAt: Date }) {
	return (
		<div className="flex items-center justify-center">
			<time dateTime={publishedAt.toString()}>{date}</time>
		</div>
	);
}

function PostTitle({ title }: { title: string }) {
	return (
		<h1 className="text-5xl font-bold tracking-tight md:text-4xl text-center">
			{title}
		</h1>
	);
}

function PostContent({ post }: { post: Post }) {
	return (
		<section className="">
			<Prose html={post.content} />
		</section>
	);
}
