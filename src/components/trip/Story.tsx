import type { TripData } from "@/data/trip";
import { EditableImage, EditableText, SectionHead, Txt } from "./shared";

export function StorySection({ trip }: { trip: TripData }) {
 const { story } = trip;
 return (
 <section id="viaje" className="container-ed grid gap-12 section-pad @4xl:grid-cols-12">
 <div className="@4xl:col-span-7">
 <p className="eyebrow text-primary"><EditableText path="copy.storyEyebrow" value={trip.copy.storyEyebrow} /></p>
 <h2 className="section-title-gap text-4xl leading-[1.05] md:text-6xl">
 <EditableText path="story.heading.0" value={story.heading[0] ?? ""} /><br /><em className="text-primary"><EditableText path="story.heading.1" value={story.heading[1] ?? ""} /></em>
 </h2>
 <div className="mt-12 max-w-xl space-y-6 text-lg leading-relaxed text-muted-foreground">
 {story.paragraphs.map((p, i) => (
 <p key={i} className={i === 0 ? "first-letter:font-serif first-letter:text-[1.6em] first-letter:text-foreground" : ""}><EditableText path={`story.paragraphs.${i}`} value={p} /></p>
 ))}
 </div>
 <a href="#experiencias" className="eyebrow mt-10 inline-block border-b border-foreground pb-1"><EditableText path="copy.storyLink" value={trip.copy.storyLink} /></a>
 </div>
 <figure className="@4xl:col-span-5 @4xl:pt-24">
 <EditableImage image={story.image} imageKey="story" loading="lazy" width={1024} height={1280} className="aspect-[4/5] w-full object-cover" />
 <figcaption className="mt-3 text-sm text-muted-foreground"><EditableText path="copy.storyCaption" value={trip.copy.storyCaption} /></figcaption>
 </figure>
 </section>
 );
}

export { Highlights } from "./HighlightsCarousel";
