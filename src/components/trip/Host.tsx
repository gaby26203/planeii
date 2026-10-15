import type { TripData } from "@/data/trip";
import { EditableImage, EditableText, SectionHead } from "./shared";

export function Host({ trip }: { trip: TripData }) {
 const hosts = trip.hosts?.length ? trip.hosts : [trip.host];
 return (
 <section className="container-ed section-pad ">
 <p className="eyebrow text-primary"><EditableText path="copy.hostEyebrow" value={trip.copy.hostEyebrow} /></p>
 <div className={`section-title-gap grid gap-14 ${hosts.length > 1 ? "@4xl:grid-cols-2" : "@4xl:grid-cols-12"}`}>
 {hosts.map((host, index) => (
 <article key={`${host.name}-${index}`} className={hosts.length === 1 ? "grid gap-10 @4xl:col-span-12 @4xl:grid-cols-12 @4xl:gap-16" : "grid gap-6"}>
 <div className={hosts.length === 1 ? "@4xl:col-span-7 @4xl:pr-16" : ""}>
 <SectionHead eyebrow="" title={<EditableText path={`hosts.${index}.name`} value={host.name} />} />
 <p className="mt-6 text-lg leading-relaxed text-muted-foreground"><EditableText path={`hosts.${index}.bio`} value={host.bio} /></p>
 </div>
 <figure className={hosts.length === 1 ? "@4xl:col-span-5" : "order-first"}>
 <EditableImage image={host.image} imageKey={`host-${index}`} loading="lazy" className="aspect-[4/3] w-full object-cover @4xl:aspect-[4/5]" />
 </figure>
 </article>
 ))}
 </div>
 </section>
 );
}
